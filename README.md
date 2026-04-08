# SRE Agent System

## Overview
The SRE Agent System is a decoupled, event-driven architecture designed to automate site reliability tasks. It leverages a microservices approach with asynchronous communication via RabbitMQ and full observability through OpenTelemetry (OTel), Prometheus, Jaeger, and Grafana.

### System Architecture
- **Interpreter Gateway**: The entry point for user intents via REST API.
- **Validation Agent**: Consumes tasks and performs health/SLO checks.
- **Mock Jira Agent**: Simulates incident ticket creation.
- **Mock Code Agent**: Diagnostic and triage service. Explores codebase for hidden risks and retrieves historical context from a vector database (VoyageAI + ChromaDB).
- **Infrastructure**: RabbitMQ (Message Bus), OTel Collector, Jaeger (Tracing), Prometheus (Metrics), Grafana (Visualization).

---

## Deployment Instructions

### Prerequisites
- Docker and Docker Compose installed.
- Node.js (v18+) and npm (for running the regression suite).

### Step 1: Start the Infrastructure and Services
Run the following command in the root directory:
```bash
docker compose up -d
```
This will start all 10 containers, including the observability stack and the agents.

### Step 2: Verify the Deployment
Check the status of the containers:
```bash
docker compose ps
```
The services will be available at:
- **Interpreter Gateway**: http://localhost:48000
- **Jaeger UI**: http://localhost:46686
- **Prometheus UI**: http://localhost:49090
- **Grafana UI**: http://localhost:43000

### Step 3: Run the Regression Suite (Optional)
To validate the deployment programmatically:
```bash
# Run unit tests
cd QA/units && npm install && npm test

# Run E2E tests
cd ../e2e && npm install && npm test
```

---

## Observability & Grafana Dashboards

The system is provisioned with two primary data sources in Grafana:
1. **Prometheus**: For metrics visualization.
2. **Jaeger**: For distributed tracing exploration.

### Grafana Access
- **URL**: http://localhost:43000
- **Auth**: Anonymous access is enabled with Admin role.

### Extensive Dashboard Guide

#### 1. Distributed Tracing Dashboard (Jaeger Integration)
The system uses the Jaeger datasource to visualize end-to-end request flows.
- **Trace Propagation**: Every intent submitted to the `/intent` endpoint generates a unique `trace_id` which is propagated across RabbitMQ using standard AMQP headers.
- **Full Chain Visibility**: You can track a single user request from:
  - `interpreter-gateway` (publish_to_rabbitmq)
  - `validation-agent` (validate_intent)
  - `mock-code-agent` (code_triage_incident)
  - `mock-jira-agent` (jira_create_incident)
- **Key Metric**: Trace duration and span dependencies.

#### 2. RabbitMQ Messaging Health
Standard metrics are scraped from the OTel Collector, allowing for visualization of:
- **Message Throughput**: Rate of messages per routing key (`tasks.interpreter`, `tasks.validation.results`, `tasks.code.fix`).
- **Processing Latency**: Time elapsed between message consumption and completion of processing spans.
- **Error Rates**: Tracking of failed message processing attempts in the validation and mock agents.

#### 3. OTel Collector Internal Metrics
The dashboard displays the health of the telemetry pipeline itself:
- **Receivers/Exporters Status**: Monitoring the OTLP receivers and the Jaeger/Prometheus exporters.
- **Queue/Batch Size**: Visibility into the `batch` processor to ensure telemetry data isn't being dropped due to saturation.

### How to Create Custom Dashboards
1. Go to **Dashboards** -> **New** -> **New Dashboard**.
2. **Add Visualization**.
3. Select **Prometheus** as the data source.
4. Use PromQL to query metrics like `request_duration_seconds_count` or OTel-specific metrics.
5. For tracing, select the **Jaeger** data source to query specific `task_id` tags.

---

## Technical Specifications
- **Trace Context**: W3C Traceparent format propagated via AMQP headers.
- **Messaging**: `aio-pika` (RabbitMQ) with standard message schemas.
- **Observability**: OpenTelemetry SDK 1.x (Python) with OTLP/HTTP exporter.
- **Vector Database**: Simulated integration with **VoyageAI** and **ChromaDB** for historical incident retrieval.
