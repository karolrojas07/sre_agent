from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import uuid
import os
import aio_pika
import json
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
