from fastapi import FastAPI, BackgroundTasks, Request, Response
from pydantic import BaseModel
import uuid
import os
import aio_pika
import json
import httpx
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import ResourceAttributes, Resource

# OTel Setup
resource = Resource(attributes={
    ResourceAttributes.SERVICE_NAME: "interpreter-gateway"
})
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SRE Agent Interpreter Gateway")
FastAPIInstrumentor.instrument_app(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IntentRequest(BaseModel):
    intent: str
    metadata: dict = {}

class IntentResponse(BaseModel):
    task_id: str
    status: str

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

from opentelemetry.propagate import inject

# ... (imports and OTel setup remains same)

async def publish_task(task_id: str, intent: str):
    routing_key = "tasks.interpreter"
    with tracer.start_as_current_span("publish_to_rabbitmq") as span:
        # Manual Enrichment (SRE Spec US3)
        span.set_attribute("messaging.rabbitmq.routing_key", routing_key)
        
        connection = await aio_pika.connect_robust(RABBITMQ_URL)
        async with connection:
            channel = await connection.channel()
            
            # Standard OTel Header Injection
            headers = {}
            inject(headers)
            
            message_body = json.dumps({
                "task_id": task_id,
                "intent": intent
            })
            
            await channel.default_exchange.publish(
                aio_pika.Message(
                    body=message_body.encode(),
                    headers=headers
                ),
                routing_key=routing_key
            )

class IncidentReportRequest(BaseModel):
    incident_details: str
    metadata: dict = {}

@app.post("/intent", response_model=IntentResponse, status_code=202)
async def submit_intent(request: IntentRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    background_tasks.add_task(publish_task, task_id, request.intent)
    return IntentResponse(task_id=task_id, status="accepted")

@app.post("/report-incident", response_model=IntentResponse, status_code=202)
async def report_incident(request: IncidentReportRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    background_tasks.add_task(publish_task, task_id, request.incident_details)
    return IntentResponse(task_id=task_id, status="accepted")

# OTLP Proxy Implementation
COLLECTOR_URL = os.getenv("OTEL_COLLECTOR_URL", "http://otel-collector:4318")

async def forward_telemetry(payload: dict, path: str, request: Request):
    user_agent = request.headers.get("user-agent", "unknown")
    client_ip = request.client.host if request.client else "unknown"
    
    # Enrichment: add attributes to all resource instances
    key_root = "resourceLogs" if "logs" in path else "resourceSpans"
    if key_root in payload:
        for resource_entry in payload[key_root]:
            if "resource" not in resource_entry:
                resource_entry["resource"] = {}
            attributes = resource_entry["resource"].get("attributes", [])
            attributes.append({"key": "browser.user_agent", "value": {"stringValue": user_agent}})
            attributes.append({"key": "client.ip", "value": {"stringValue": client_ip}})
            resource_entry["resource"]["attributes"] = attributes
            
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(f"{COLLECTOR_URL}{path}", json=payload)
            return Response(content=resp.content, status_code=resp.status_code)
        except Exception as e:
            return Response(content=str(e), status_code=500)

@app.post("/v1/logs")
async def proxy_logs(request: Request):
    payload = await request.json()
    return await forward_telemetry(payload, "/v1/logs", request)

@app.post("/v1/traces")
async def proxy_traces(request: Request):
    payload = await request.json()
    return await forward_telemetry(payload, "/v1/traces", request)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
