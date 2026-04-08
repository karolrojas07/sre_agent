# Validation Agent & UI Scaffolding Specification

## 1. Executive Summary
This document outlines the architectural breakdown and implementation strategy for the **Validation Agent** and its associated **Vite-based UI**, as specified in `docs/diagram.png`. The goal is to deliver a high-fidelity, traceable SRE automation component that integrates seamlessly with the existing Interpreter Gateway and RabbitMQ message bus.

## 2. Architectural Pillars
The implementation is grounded in the following technical constraints:
- **Frontend**: Vite (React + TypeScript) using Vanilla CSS for a modern, responsive aesthetic.
- **Backend API**: FastAPI serving as a synchronous command/control sidecar.
- **Async Logic**: LangGraph-based processing node within the Python ecosystem (using `aio-pika` for RabbitMQ).
- **Communication**: All external requests are mediated through the **Interpreter Gateway** to ensure centralized orchestration and end-to-end distributed tracing.

---

## 3. Work Breakdown Structure (WBS)

### Phase 1: Validation Agent (FastAPI & LangGraph)
*   **1.1 API Sidecar Implementation**:
    *   Transition the current `validation_agent/main.py` into a FastAPI application.
    *   Expose `/health` and `/status` endpoints to provide real-time visibility into agent saturation and error budgets.
    *   Implement a `/report-incident` POST endpoint that acts as a trigger for the internal LangGraph node.
*   **1.2 LangGraph Node Scaffolding**:
    *   Implement a `StateGraph` representing the "Thinking" process of the Validation Agent.
    *   Define a ReAct loop (Think-Act-Observe) that performs automated SLO checks and service health validations.
    *   Configure the node to persist its research state, allowing the UI to visualize the agent's progress during an incident triage.
*   **1.3 Messaging & Context Propagation**:
    *   Integrate `aio-pika` background tasks within the FastAPI event loop.
    *   Implement header-based trace context extraction and injection to maintain a single `trace_id` from the UI through to the final validation result.

### Phase 2: Frontend UI (Vite & React)
*   **2.1 Project Scaffolding**:
    *   Initialize a Vite project in `services/ui` adhering to the Feature-Sliced Design (FSD) pattern.
    *   Set up **TanStack Query** for asynchronous server state and **ky** for type-safe API interactions.
*   **2.2 Validation Management Dashboard**:
    *   Develop a real-time dashboard displaying SLO metrics and active incident reports.
    *   Integrate a "Thinking View" that renders the LangGraph state transitions, providing transparency into the agent's automated logic.
*   **2.3 Client-Side Observability**:
    *   Instrument the Vite application with the OpenTelemetry Web SDK.
    *   Ensure all fetch requests to the Interpreter Gateway include the `traceparent` header to enable full-stack visibility in Jaeger.

### Phase 3: Integration & Infrastructure
*   **3.1 Containerization**:
    *   Update `docker-compose.yml` to include the `ui` and `validation-agent` services.
    *   Configure environment variables for RabbitMQ connectivity and OTel Collector endpoints.
*   **3.2 Automated Validation (TDD)**:
    *   Implement a Playwright E2E suite in `QA/e2e/` that simulates a user reporting an incident via the UI.
    *   Verify that the incident triggers the Validation Agent and produces a traceable record in the observability stack.

---

## 4. Implementation Strategy (The Dialectic)
Following the SRE Agent core mandates:
1.  **Red Phase**: Define the `IValidationAgent` domain port and write a failing Playwright test that expects a successful validation trace.
2.  **Green Phase**: Implement the minimal FastAPI and LangGraph logic to satisfy the test, ensuring RabbitMQ messages follow the `ValidationResultMessage` schema.
3.  **Refactor Phase**: Optimize the OTel manual enrichment to include `messaging.rabbitmq.routing_key` and other "Golden Signal" metrics.
