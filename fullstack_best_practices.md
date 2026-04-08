# Full-Stack Development Best Practices Master Guide

This document serves as the primary source of truth for architectural standards, programming patterns, and development workflows for this project. It integrates knowledge from specialized domains including OpenAPI, Python, Web Testing, OpenSearch, and Data Persistence.

---

## 1. API Design: Contract-First & OpenAPI Best Practices

Treat the **OpenAPI Specification (OAS)** as the "Single Source of Truth."

### Design-First Workflow
*   **Design Before Code:** Define endpoints, schemas, and validation rules in OAS *before* writing backend logic.
*   **Parallel Development:** Use the OAS to generate mock servers (e.g., Prism) so frontend teams can build against a stable interface while the backend is in progress.
*   **Automated Governance:** Use linters like **Spectral** in CI/CD pipelines to enforce naming conventions and security policies.
*   **Contract Testing:** Use tools like **Dredd** or **Pact** to ensure the live API honors the specification.

### Naming & Schema Standards
*   **Paths:** Use `kebab-case` and plural nouns (e.g., `/user-profiles`).
*   **Schemas:** Use `PascalCase` for model names and `camelCase` or `snake_case` consistently for properties.
*   **Reusable Components:** Define schemas in `components/schemas` and reference them with `$ref` to stay DRY.
*   **Validation:** Use `maxLength`, `pattern` (Regex), and `minimum/maximum` to enforce data integrity at the schema level.

---

## 2. Backend Architecture: Python & Design Patterns

Expert-level Python design focuses on **SOLID principles**, **Clean Code**, and leveraging Python's idiomatic features.

### Architectural Strategy: Hexagonal Architecture (Ports & Adapters)
*   **Core Domain:** Keep business logic "pure" and persistence-ignorant.
*   **Ports:** Define abstract interfaces for external needs (e.g., `UserRepositoryInterface`).
*   **Adapters:** Implement concrete classes (e.g., `PostgresUserRepository`) to connect the core to infrastructure.

### Key Pythonic Patterns
*   **Factory Method:** Centralize object instantiation to adhere to the Open/Closed Principle.
*   **Strategy Pattern:** Use composition over inheritance to swap algorithms (e.g., different payment providers) at runtime.
*   **Observer Pattern:** Implement loose coupling for event-driven updates.
*   **Decorator Pattern:** Use Python's native `@decorator` syntax for cross-cutting concerns like logging or authentication.
*   **Singleton Warning:** Avoid manual Singletons; use Python's module system for clean, safe global state.

---

## 3. Data Persistence Patterns

Bridge the "impedance mismatch" between objects and relational databases using decoupled patterns.

### Persistence Strategies
*   **Data Mapper (Preferred):** Use **SQLAlchemy** to decouple domain objects from the database schema, maintaining "persistence ignorance" in the core.
*   **Active Record:** Reserved for simple CRUD; avoid in complex enterprise logic due to tight coupling (Django-style).
*   **Repository Pattern:** Treat persisted data as an in-memory collection of domain objects. Focus on **Aggregate Roots** and use the application's ubiquitous language.
*   **Unit of Work (UoW):** Coordinate multiple repository updates into a single atomic transaction. (Managed implicitly by SQLAlchemy `Session`).

---

## 4. Frontend Integration & Type Safety

Ensure end-to-end type safety to eliminate "contract drift."

*   **Automated SDK Generation:** Generate TypeScript clients directly from the backend `openapi.json` using tools like `hey API`.
*   **Compile-Time Verification:** Catch schema mismatches during the build process rather than at runtime.
*   **Runtime Validation:** Use **Zod** on the frontend to validate user inputs and environment variables, deriving TS types directly from schemas.

---

## 5. Web Testing & Automation

### Cypress (E2E & Component Testing)
*   **Test Independence:** Ensure tests can run in any order.
*   **App Actions:** Prefer setting state programmatically over brittle Page Object Models.
*   **Selectors:** Use dedicated `data-cy` or `data-testid` attributes instead of fragile CSS classes.
*   **Avoid Anti-patterns:** Never use static `cy.wait()`; use `cy.intercept()` to wait for network signals.

### Playwright (Modern Web Automation)
*   **Locator Strategy:** Prioritize user-facing roles (`getByRole`) over DOM structure.
*   **Web-First Assertions:** Use auto-retrying assertions like `expect(locator).toBeVisible()`.
*   **State Reuse:** Authenticate once and reuse `storageState` across tests to save time.
*   **Visual Testing:** Run visual regressions in **Docker** to ensure consistent rendering across environments.

---

## 6. OpenSearch & Search Performance

### Index Management
*   **Explicit Mappings:** Avoid dynamic mapping; define strict structures for performance and consistency.
*   **Index State Management (ISM):** Automate rollovers, segment merges, and data retention policies.
*   **Aliases:** Use aliases to reindex data without application downtime.

### Query Optimization
*   **Filter Context:** Use filter contexts (non-scoring) for exact matches to leverage caching.
*   **Deep Pagination:** Use **Point in Time (PIT)** and `search_after` instead of `from/size` for large result sets.
*   **Eager Global Ordinals:** Enable for frequently aggregated keyword fields to reduce query latency.

---

## 7. DevOps & Security

*   **Monorepo:** Use **Turborepo** or **pnpm** to keep frontend, backend, and generated SDKs in sync.
*   **Architectural Fitness Functions:** Automate CI tests to prevent domain logic from importing infrastructure adapters.
*   **Security:** Implement **OAuth2 with PKCE** and enforce **TLS 1.3**. Always assume the client is compromised; perform all critical filtering on the backend.
