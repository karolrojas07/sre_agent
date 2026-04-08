# Architectural Interfaces Specification

## 1. Overview
This document specifies the high-level interfaces and functional roles for the SRE Agent system components as depicted in `docs/diagram.png`. These components are designed to automate site reliability tasks through a decoupled, event-driven architecture.

## 2. Functional Roles & Interactions
The system consists of several specialized agents interacting via RabbitMQ and REST interfaces:

- **Interpreta (Interpreter Agent)**: 
    - **Role**: Translates high-level user intent from the UI or REST API into actionable domain tasks.
    - **Interaction**: Acts as the primary entry point for user requests. Publishes tasks to RabbitMQ for downstream processing.
- **Agente Validacion (Validation Agent)**: 
    - **Role**: Performs continuous SRE validation tasks, such as SLO compliance monitoring and service health checks.
    - **Interaction**: Consumes validation requests; emits health status and SLO alerts.
- **Agente Jira (Jira Agent)**: 
    - **Role**: Acts as a bridge to the Jira API for incident management.
    - **Interaction**: Consumes 'Incident' messages from RabbitMQ to create or update tickets; communicates with external Jira REST endpoints.
- **Agent Codigo (Code Agent)**: 
    - **Role**: Strictly a diagnostic and context-provisioning service. Explores the codebase to triage incidents, adds context, and determines if priority changes are necessary based on internal risk.
    - **Interaction**: Consumes triage requests; retrieves similar historical cases from a vector database; returns triaged context to the Interpreter Gateway for centralized orchestration.

## 3. High-Level Interfaces (Domain Ports)
To maintain SOLID principles and Hexagonal Architecture, each agent's core logic is defined by a domain port:

- `IInterpreter`: Interface for intent parsing and task orchestration.
- `IValidationAgent`: Interface for executing SRE checks and SLO monitoring.
- `IJiraAgent`: Interface for lifecycle management of Jira issues.
- `ICodeAgent`: Interface for automated codebase exploration, triage analysis, and historical context retrieval via Vector DB.

## 4. Messaging & Interaction Patterns
- **Asynchronous Communication**: RabbitMQ serves as the central message bus. Services communicate via standardized message schemas (e.g., `Task`, `Incident`, `ValidationResult`).
- **REST Gateway**: A FastAPI-based REST layer provides synchronous access to the `IInterpreter` for UI interactions.
- **Decoupling**: Agents must remain agnostic of each other's internal implementations, interacting only through defined message types and routing keys.

## 5. Observability Standards
Each interface must implement the following telemetry hooks:
- **Distributed Tracing**: Spans must be created for every message consumption/production and external API call.
- **Context Propagation**: Trace IDs must be propagated through RabbitMQ headers to ensure end-to-end visibility.
- **Metrics**: Standard "Golden Signals" (Latency, Traffic, Errors, Saturation) must be exported to the OTel Collector.
- **Logging**: Structured logs must include `trace_id` for correlation in Jaeger and Grafana.

## 6. Implementation Strategy
1. **Ontology Update**: Reflect new agent classes and relationships in `docs/sre_ontology.ttl`.
2. **Knowledge Graph Update**: Define behavioral user stories in `QA/sre_user_stories_kg.ttl`.
3. **TDD Workflow**: Define domain ports first, followed by failing unit tests in `QA/units/`.
4. **Adapter Implementation**: Develop concrete infrastructure adapters (RabbitMQ, Jira REST, Code Analysis tools).
5. **E2E Validation**: Verify full-chain interaction using Playwright tests in `QA/e2e/`.
