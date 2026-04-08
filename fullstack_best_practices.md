# Full-Stack Development Best Practices Master Guide (Vite Edition)

This document serves as the primary source of truth for architectural standards and development workflows. It integrates knowledge from OpenAPI, Python, Vite, Vitest, and modern frontend state management.

---

## 1. API Design: Contract-First & OpenAPI Best Practices

Treat the **OpenAPI Specification (OAS)** as the "Single Source of Truth."

### Design-First Workflow
* **Design Before Code:** Define endpoints and schemas in OAS *before* writing backend logic.
* **Parallel Development:** Use OAS to generate mock servers so frontend teams can build against stable interfaces.
* **Automated Governance:** Use linters like **Spectral** to enforce naming conventions.

---

## 2. Backend Architecture: Python & Design Patterns

Expert-level Python design focuses on **SOLID principles** and leveraging idiomatic features.

### Architectural Strategy: Hexagonal Architecture (Ports & Adapters)
* **Core Domain:** Keep business logic "pure" and persistence-ignorant.
* **Ports:** Define abstract interfaces for external needs (e.g., `UserRepositoryInterface`).
* **Adapters:** Implement concrete classes (e.g., `PostgresUserRepository`) to connect the core to infrastructure.

---

## 3. Data Persistence Patterns

Bridge the "impedance mismatch" between objects and relational databases using decoupled patterns.

* **Data Mapper:** Use **SQLAlchemy** to decouple domain objects from the database schema.
* **Repository Pattern:** Treat persisted data as an in-memory collection of domain objects focusing on **Aggregate Roots**.
* **Unit of Work (UoW):** Coordinate multiple repository updates into a single atomic transaction, managed implicitly by SQLAlchemy `Session`.

---

## 4. Frontend Integration & Vite Architecture

[cite_start]Shift from monolithic frameworks to Vite’s **ESM-centric** philosophy, prioritizing speed and modularity[cite: 1, 4].

### Architectural Patterns
* [cite_start]**Feature-Based Organization (FSD):** Group code by business feature (e.g., `src/features/auth`) rather than technical role (components/hooks)[cite: 24, 27, 48].
* [cite_start]**Public API (Barrel Exports):** Each feature must expose a public interface via `index.ts` to enforce encapsulation[cite: 220, 221].
* [cite_start]**Type Safety:** Prefer TypeScript `type` over `interface` for component props and API responses for better flexibility and consistency[cite: 193, 194, 209].

### Connectivity & State
* [cite_start]**API Client:** Use **ky** for a lightweight (3KB) fetch wrapper with built-in retry logic and excellent TypeScript support[cite: 314, 319, 344].
* [cite_start]**Server State:** Use **TanStack Query** for caching and background refetching[cite: 77, 310, 311].
* [cite_start]**Client State:** Use **Zustand** for lightweight, boilerplate-free global state (e.g., auth, theme)[cite: 114, 115, 343].

---

## 5. Web Testing & Automation

[cite_start]Vite enables a unified testing pipeline where tests share the same configuration as the build tool[cite: 20].

### Unit & Component Testing (Vitest)
* [cite_start]**Unified Pipeline:** Use **Vitest** to run tests using the same transformation logic as the Vite dev server[cite: 20, 22].
* [cite_start]**Browser Mode:** For component testing, run tests in real browsers (via Playwright/WebdriverIO) rather than JSDOM to catch styling and accessibility issues[cite: 23, 325, 326].
* [cite_start]**Mocking:** Use **Mock Service Worker (MSW)** to intercept requests at the network level for both development and testing[cite: 18, 321, 322].

### End-to-End (E2E) Testing
* [cite_start]**Playwright:** Prioritize Playwright for CI/CD due to its native parallelism and faster execution compared to legacy tools[cite: 27, 30].
* [cite_start]**Stable Locators:** Always use `data-testid` or `getByRole` to ensure tests remain resilient to UI changes[cite: 26, 30, 328].

---

## 6. OpenSearch & Search Performance

### Index Management
* **Explicit Mappings:** Define strict structures; avoid dynamic mapping for performance.
* **Index State Management (ISM):** Automate rollovers and data retention policies.

### Query Optimization
* **Filter Context:** Use non-scoring filters for exact matches to leverage caching.
* **Deep Pagination:** Use **Point in Time (PIT)** and `search_after` instead of `from/size`.

---

## 7. DevOps, Security & Environment

* [cite_start]**Environment Variables:** Adhere to the **`VITE_`** prefix convention for variables exposed to the client; non-prefixed variables remain server-side only for security[cite: 31, 333].
* [cite_start]**Path Aliases:** Use absolute imports (e.g., `@/features/...`) configured in `vite.config.ts` and `tsconfig.json` to eliminate fragile relative paths[cite: 214, 215, 216].
* [cite_start]**Build Optimization:** Utilize **Code Splitting** (via `React.lazy`) and **Manual Chunks** in Rollup to optimize loading performance for large features[cite: 235, 237, 244].
* **Security:** Implement **OAuth2 with PKCE**. Always assume the client is compromised; perform all critical filtering on the backend.
