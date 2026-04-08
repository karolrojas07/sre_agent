# Centralized Logging with Grafana Loki Specification

## 1. Overview
The goal of this specification is to implement a centralized logging architecture for the SRE Agent project using Grafana Loki. This ensures that logs from all services (frontend and backend) are aggregated, searchable, and correlated with existing traces and metrics within the Grafana UI.

## 2. Architectural Requirements
- **Standardization:** All logs must follow the OpenTelemetry (OTel) LogRecord specification.
- **Proxy Pattern:** The `interpreter-gateway` acts as a transparent OTLP proxy for all frontend (Vite UI) telemetry, including logs and traces.
- **Enrichment:** The gateway must inject additional browser-side metadata (e.g., `User-Agent`, `client.ip`) into the OTel Resource attributes before forwarding telemetry to the collector.
- **Aggregation:** A single `otel-collector-contrib` instance processes all logs and exports them to Grafana Loki.
- **Correlation:** Logs must include `trace_id` and `span_id` for seamless navigation between traces and logs in Grafana.

## 3. Infrastructure (Loki)
- **Image:** `grafana/loki:latest`.
- **Service Name:** `loki`.
- **Port:** 3100 (Internal only, exposed via Grafana).
- **Persistence:** Use a named Docker volume `loki_data` for persistent log storage.
- **Provisioning:** Grafana must be provisioned with a Loki datasource pointing to `http://loki:3100`.

## 4. Telemetry Pipeline (OTel Collector)
- **Receiver:** OTLP HTTP receiver (Port 4318) for logs from the gateway and backend services.
- **Processor:** Batch processor for efficient ingestion.
- **Exporter:** `loki` exporter configured with attribute mapping:
    - `service.name` → `job`
    - `deployment.environment` → `env`
    - `log.level` → `level`
- **Pipeline:** Define a `logs` pipeline: `receivers: [otlp] -> processors: [batch] -> exporters: [loki]`.

## 5. Service-Level Implementation
### 5.1 Interpreter Gateway (Proxy & Metadata)
- **Endpoints:** Implement `/v1/logs` and `/v1/traces` to receive OTLP JSON payloads from the frontend.
- **Logic:** Parse the request, extract client metadata from HTTP headers, append it to the OTel Resource attributes, and forward the request to the collector.

### 5.2 Backend Services (Python)
- **Library:** `opentelemetry-sdk-logs` and `opentelemetry-exporter-otlp`.
- **Format:** Emit log bodies as structured JSON directly from the service.
- **Correlation:** Use the standard OTel LoggingHandler to automatically attach active span contexts to log records.

### 5.3 Frontend (Vite UI)
- **Configuration:** Update `otel.ts` to point the OTLP exporter to the `interpreter-gateway` (Port 48000) instead of the collector directly.

## 6. Development & Validation
- **TDD Approach:** Drive the implementation by first defining the expected log structure and labels in the regression suite.
- **Ontology Mandate:** Ensure `Log` is defined as a subclass of `TelemetryData` in `docs/sre_ontology.ttl`.
- **User Story:** Satisfy User Story 14 (Centralized Logging with Grafana Loki) in `QA/sre_user_stories_kg.ttl`.
- **Validation:** 
    - Verify ontology consistency using the Pellet (Openllet) linter.
    - Implement an E2E Playwright test in `QA/e2e/tests/logging.spec.ts` that asserts logs from both UI and Backend are queryable in Loki via the Grafana/Loki API.
