import asyncio
import os
import aio_pika
import json
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import ResourceAttributes, Resource
from opentelemetry.propagate import extract, inject

# OTel Setup
resource = Resource(attributes={
    ResourceAttributes.SERVICE_NAME: "mock-code-agent"
})
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

async def main():
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue("tasks.code.fix")
        
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    # Extract trace context
                    context = extract(message.headers)
                    body = json.loads(message.body.decode())
                    
                    with tracer.start_as_current_span("code_triage_incident", context=context) as span:
                        span.set_attribute("task_id", body.get("task_id"))
                        print(f"Code Agent: Triaging codebase for task {body.get('task_id')}...")
                        
                        # Simulate Vector DB Lookup (VoyageAI + ChromaDB)
                        span.set_attribute("vector_db.lookup", "ChromaDB")
                        span.set_attribute("vector_db.embedding_model", "VoyageAI")
                        
                        # Return triaged context to Interpreter Gateway via a dedicated response queue
                        headers = {}
                        inject(headers)
                        
                        triage_result = {
                            "task_id": body.get("task_id"),
                            "incident_context": "Found recursive loop in Payment Service downstream call",
                            "suggested_priority": "High",
                            "similar_incidents": ["INC-1234", "INC-5678"]
                        }
                        
                        await channel.default_exchange.publish(
                            aio_pika.Message(
                                body=json.dumps(triage_result).encode(),
                                headers=headers
                            ),
                            routing_key="tasks.triage.results"
                        )
                        print(f"Code Agent: Triage context returned to Interpreter for task {body.get('task_id')}")

if __name__ == "__main__":
    asyncio.run(main())
