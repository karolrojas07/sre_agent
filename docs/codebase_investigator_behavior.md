# Codebase Investigator: Technical Behavior and Architecture

The `@codebase_investigator` is a hyper-specialized, read-only sub-agent within the Gemini CLI designed for deep architectural analysis, root-cause investigation, and system-wide dependency mapping. Unlike the main agent, it is optimized for "thinking on paper" and exhaustive research before proposing or planning any changes.

## 1. Core Architecture
The investigator operates as a `LocalAgentDefinition` executed via the `LocalAgentExecutor`. It is designed to be a "research arm" that handles vague or complex requests by building a complete mental model of the relevant code segments.

### Key Specifications:
- **Model:** Prefers `PREVIEW_GEMINI_FLASH_MODEL` (Gemini 2.0 Flash) to leverage high-speed reasoning and modern features.
- **Thinking Configuration:** Explicitly enables `ThinkingLevel.HIGH` (or a high `thinkingBudget`), allowing the model to perform extensive internal reasoning before each action.
- **Constraints:** 
    - **Read-Only:** Access is strictly limited to analytical tools (`ls`, `read_file`, `glob`, `grep_search`).
    - **Source Environment:** Access is restricted to a provided codebase (e.g., `django-oscar` at `https://github.com/django-oscar/django-oscar/`) cloned into a non-mapped volume.
    - **Execution Limits:** Capped at **10 research turns**. If `questions_to_resolve` is empty before Turn 10, the agent is granted **1 discrete extension turn** for "Planning" (designing the fix) which does not count against the 10-turn research budget.
    - **Non-Interactive:** It cannot ask the user for clarification; it must resolve ambiguities through code exploration.

## 2. The Think-Act-Observe Loop (LangGraph Implementation)
The investigator follows a structured **ReAct (Reason + Act)** pattern implemented in LangGraph:

1.  **Agent Node (THINK):** The Gemini model generates reasoning and tool calls based on the current state.
2.  **Tool Node (ACT):** Executes search/read tools on the `django-oscar` codebase.
3.  **Reflection Node (OBSERVE):** A specialized processing node that performs "Signal-to-Noise" triage on tool output. It updates the state's **Research Journal** with metadata (e.g., marking paths as verified findings or irrelevant paths).

## 3. The Research Journal (Stateful Tracking)
The "Scratchpad" (now the **Research State**) is managed via LangGraph reducers to ensure cumulative memory:

| Section | Metadata | Purpose |
| :--- | :--- | :--- |
| **Questions to Resolve** | `lead_priority` | Technical leads to investigate. Mission concludes when empty. |
| **Key Findings** | `is_verified`, `source` | Confirmed architectural facts and code snippets. |
| **Irrelevant Paths** | `reason` | Folders or files determined to be dead ends. |

## 4. Reporting and Output
The investigation concludes with a call to the `complete_task` tool, pushing the `CodebaseInvestigationReportSchema` to a RabbitMQ queue for consumption by the **Mock Incident Tracking** system.

### Report Payload:
- **SummaryOfFindings:** High-level architectural root cause.
- **ExplorationTrace:** Chronological log of tools and reasoning.
- **RelevantLocations:** Mapping of verified symbols and files.
- **FixPlan:** A technical design for resolving the issue (produced during the planning extension).
- **Status Enum:** One of `SUCCESS`, `RECOVERY_PARTIAL`, or `FAILED`.

## 5. Termination and Graceful Recovery
If the investigator reaches the **10-turn limit** with unresolved questions, the **Recovery Protocol** triggers:
1.  The Reflection Node identifies verified findings and filters out unverified leads.
2.  The Agent is forced to call `complete_task` with a status of `RECOVERY_PARTIAL`.
3.  A "Final Warning" header is prepended to the summary: *"Turn limit reached. Partial report generated based on available verified findings."*
