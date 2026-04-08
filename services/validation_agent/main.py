import asyncio
import os
import aio_pika
import json
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import ResourceAttributes, Resource

# OTel Setup
resource = Resource(attributes={
    ResourceAttributes.SERVICE_NAME: "validation-agent"
})
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

from opentelemetry.propagate import extract, inject

# ... (imports and OTel setup remains same)

async def main():
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue("tasks.interpreter")
        
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    # Extract trace context from headers
                    context = extract(message.headers)
                    body = json.loads(message.body.decode())
                    
                    with tracer.start_as_current_span("validate_intent", context=context) as span:
                        span.set_attribute("task_id", body.get("task_id"))
                        print(f"Validated intent: {body.get('intent')}")
                        
                        # Downstream publishing with context injection
                        headers = {}
                        inject(headers)
                        
                        result_body = json.dumps({"task_id": body.get("task_id"), "status": "failed"})
                        
                        # Publish to Jira
                        await channel.default_exchange.publish(
                            aio_pika.Message(body=result_body.encode(), headers=headers),
                            routing_key="tasks.validation.results"
                        )
                        
                        # Publish to Code Fix
                        await channel.default_exchange.publish(
                            aio_pika.Message(body=result_body.encode(), headers=headers),
                            routing_key="tasks.code.fix"
                        )

if __name__ == "__main__":
    asyncio.run(main())
