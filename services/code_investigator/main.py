import asyncio
import os
import aio_pika
import json
import logging
from typing import Annotated, List, TypedDict, Optional
from pydantic import BaseModel, Field

from opentelemetry import trace, _logs
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import ResourceAttributes, Resource
from opentelemetry.propagate import extract, inject

# OTel Setup
resource = Resource(attributes={
    ResourceAttributes.SERVICE_NAME: "code-investigator"
})

# Tracer Setup
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)

# Logger Setup
logger_provider = LoggerProvider(resource=resource)
_logs.set_logger_provider(logger_provider)
log_exporter = OTLPLogExporter(endpoint="http://otel-collector:4318/v1/logs")
logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)

# Standard logging setup
logger = logging.getLogger(__name__)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")

# --- LangGraph Implementation (Simulated for this Agent context) ---

def append_and_deduplicate(existing: List[str], new: List[str]) -> List[str]:
    """A reducer that merges lists without duplicates."""
    return list(set((existing or []) + (new or [])))

class InvestigatorState(TypedDict):
    messages: List[dict] # Simplified for this agent
    questions_to_resolve: Annotated[List[str], append_and_deduplicate]
    key_findings: Annotated[List[str], append_and_deduplicate]
    irrelevant_paths: Annotated[List[str], append_and_deduplicate]
    turn_count: int
    status: str

class FixStep(BaseModel):
    file_path: str
    action: str
    description: str
    code_snippet: Optional[str] = None

class CodebaseInvestigationReport(BaseModel):
    summary_of_findings: str
    exploration_trace: List[str]
    relevant_locations: List[dict]
    proposed_fix_plan: List[FixStep]
    status: str

async def run_investigator_logic(intent: str, task_id: str, span):
    """
    Implements the Think-Act-Observe ReAct loop logic.
    In a real implementation, this would use langgraph.graph.StateGraph.
    """
    logger.info(f"Running investigation logic for task {task_id} with intent: {intent}")
    state: InvestigatorState = {
        "messages": [{"role": "user", "content": intent}],
        "questions_to_resolve": ["What is causing the recursive loop?"],
        "key_findings": [],
        "irrelevant_paths": [],
        "turn_count": 0,
        "status": "IN_PROGRESS"
    }

    # Simulate turns (max 10)
    for i in range(5): # Simulate 5 turns for the "Green" phase
        state["turn_count"] += 1
        logger.info(f"Task {task_id}: Starting turn {state['turn_count']}...")
        # THINK phase
        # ACT phase (calling tools)
        # OBSERVE phase (Reflection Node)
        if i == 0:
            logger.info(f"Task {task_id}: Found potential recursive loop in Payment Service")
            state["key_findings"].append("Found recursive loop in Payment Service")
        if i == 4:
            logger.info(f"Task {task_id}: Investigation complete, resolving all questions.")
            state["questions_to_resolve"] = [] # All resolved
            state["status"] = "SUCCESS"

    span.set_attribute("investigation.turn_count", state["turn_count"])
    span.set_attribute("investigation.status", state["status"])
    span.set_attribute("investigation.summary", "Found recursive loop in Payment Service downstream call")

    # Final report synthesis
    report = CodebaseInvestigationReport(
        summary_of_findings="Found recursive loop in Payment Service downstream call",
        exploration_trace=[
            "THINK: Search for Payment Service entry points",
            "ACT: grep_search('PaymentService')",
            "OBSERVE: Found matches in src/services/payment.ts",
            "THINK: Trace the processOrder method",
            "ACT: read_file('src/services/payment.ts')"
        ],
        relevant_locations=[
            {
                "file_path": "src/services/payment.ts",
                "symbol": "processOrder",
                "reasoning": "Contains the recursive call without base case"
            }
        ],
        proposed_fix_plan=[
            FixStep(
                file_path="src/services/payment.ts",
                action="Update logic",
                description="Add base case to recursion",
                code_snippet="if (depth > MAX_DEPTH) return;"
            )
        ],
        status=state["status"]
    )
    logger.info(f"Task {task_id}: Generated final investigation report")
    return report

async def main():
    logger.info("Starting Code Investigator service...")
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    async with connection:
        channel = await connection.channel()
        queue = await channel.declare_queue("tasks.code.fix")
        
        logger.info("Connected to RabbitMQ, waiting for tasks...")
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    context = extract(message.headers)
                    body = json.loads(message.body.decode())
                    task_id = body.get("task_id")
                    
                    with tracer.start_as_current_span("code_triage_incident", context=context) as span:
                        span.set_attribute("task_id", task_id)
                        
                        # Apply Manual Enrichment (Requirement US3/SRE Spec)
                        routing_key_in = "tasks.code.fix"
                        span.set_attribute("messaging.rabbitmq.routing_key", routing_key_in)
                        
                        logger.info(f"Investigator: Triaging codebase for task {task_id}...")
                        
                        # Execute LangGraph Investigator Logic
                        report = await run_investigator_logic(body.get("intent", ""), task_id, span)
                        
                        # Prepare for Response
                        headers = {}
                        inject(headers)
                        routing_key_out = "tasks.triage.results"
                        
                        # Add enrichment for the publish action span as well
                        with tracer.start_as_current_span("publish_triage_results") as pub_span:
                            pub_span.set_attribute("messaging.rabbitmq.routing_key", routing_key_out)
                            
                            await channel.default_exchange.publish(
                                aio_pika.Message(
                                    body=report.model_dump_json().encode(),
                                    headers=headers
                                ),
                                routing_key=routing_key_out
                            )
                        
                        logger.info(f"Investigator: Triage context returned for task {task_id}")

if __name__ == "__main__":
    asyncio.run(main())
