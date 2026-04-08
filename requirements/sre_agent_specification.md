# SRE Agent Project Specification

## 1. Project Overview
The SRE Agent is a specialized system designed to automate and monitor site reliability engineering tasks. It focuses on high observability, reliable asynchronous messaging, and a reproducible local development environment.

## 2. Architectural Goals
- **Standardization:** Adhere to OpenTelemetry (OTel) standards for all telemetry data (metrics and traces).
- **Decoupling:** Use asynchronous message passing for service communication.
- **Observability:** Ensure every component is observable via standardized metrics and distributed tracing.
- **Reproducibility:** Use Docker Compose for a consistent local development experience.

## 3. Messaging Infrastructure
- **Broker:** RabbitMQ with the Management Plugin enabled for easy inspection.
- **Library:** `aio-pika` (asynchronous Python library).
- **Instrumentation:** 
    - Use OTel auto-instrumentation agents for capturing messaging metadata.
    - Hybrid approach: Manually enrich traces with `messaging.rabbitmq.routing_key` on every span.
- **Ingestion:** RabbitMQ metrics must be pushed to the OTel Collector via the `prometheusremotewrite` receiver.

## 4. Observability Stack
- **OpenTelemetry Collector:** 
    - Image: `otel/opentelemetry-collector-contrib`.
    - Role: Single, shared gateway within the Docker Compose network.
    - Function: Aggregate metrics and traces; handle trace context propagation.
- **Tracing Backend:** Jaeger.
- **Metrics Backend:** Prometheus.
- **Visualization:** 
    - Grafana with automated provisioning for dashboards and data sources.
    - Priority: RabbitMQ-specific metrics (queue depth, consumer counts) and "Golden Signals."

## 5. Infrastructure as Code (IaC)
- **Tool:** Docker Compose.
- **Environment:** Optimized for local development only.
- **Persistence:** 
    - Use named Docker volumes for Prometheus and Grafana storage.
    - **Constraint:** Do not map volumes to the local filesystem; volume lifecycle is managed by an external process.

## 6. Development Methodology
- **Process:** TDD (Red-Green-Refactor) to drive the implementation.
- **Standards:** Strictly follow SOLID principles and Clean Object-Oriented Programming.
- **Architecture:** Hexagonal Architecture (Ports & Adapters) to keep domain logic pure and infrastructure-agnostic.

## 7. User Stories (Domain Model)
1. **Define SLO:** As an SRE, I want to define an SLO for services to monitor reliability.
2. **IaC Definition:** As a Developer, I want to use Docker Compose for a reproducible local environment.
3. **RabbitMQ Integration:** As an Architect, I want to use `aio-pika` and OTel to ensure reliable and traced message delivery.
4. **Centralized Telemetry:** As an SRE, I want a single OTel Collector to aggregate all local observability data.
5. **Automated Visualization:** As an SRE, I want Grafana to be auto-provisioned with RabbitMQ dashboards using persistent data.
