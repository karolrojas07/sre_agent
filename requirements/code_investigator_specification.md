Implementing the codebase investigator's behavior in LangGraph involves translating its specific "Think-Act-Observe" loop into a stateful, graph-based architecture. Let's explore how to bridge these two frameworks together; I’ll ask guiding questions along the way to help you design each component.

The core of the investigator—its ability to exhaustively research before reporting—is a natural fit for LangGraph's **ReAct** (Reason + Act) pattern. In this model, the "Thinking" stage occurs within an LLM node, while the "Acting" happens in a dedicated **ToolNode** that only has access to your read-only commands.

------

To construct the **ReAct Loop** (Reason + Act) in LangGraph 🔄, we translate the "Think-Act-Observe" cycle into a stateful graph where each node represents a specific phase of the investigator's behavior.

In LangGraph, this typically involves a **StateGraph** that manages the transition between two primary nodes:

1.  **The Agent Node (Think)** 🧠: Here, the Gemini model processes the current `State` (including the investigation log and unresolved questions). It decides whether it has enough information to finish or if it needs to use a tool.
2.  **The Tool Node (Act/Observe)** 🛠️: If the agent decides to act, this node executes the requested read-only tool (like `grep` or `read_file`) and feeds the "Observation" back into the state.

The `docs/codebase_investigator_behavior.md` specifies strict constraints for this loop, such as a **10-turn limit** and a **Recovery Protocol** 🛡️. In LangGraph, we can handle these using **Conditional Edges** that check the state after every "Think" step to decide if we should continue, finish, or trigger a timeout warning.

--------

To implement **Observation Feedback** for the Codebase Investigator, you must ensure that every tool result doesn't just pass back a raw string, but specifically triggers an update to the agent’s internal "Research Journal."

In LangGraph, this is achieved by defining a **State Schema** that matches the requirements in `codebase_investigator_behavior.md` and using **Reducers** to manage how new observations modify that state.

### 1. Defining the Research State
Your state must track the three specific categories mentioned in the behavior guide. Using a `TypedDict` with `Annotated` types allows you to define custom logic for how findings are merged.

```python
from typing import Annotated, TypedDict, List
from langgraph.graph import add_messages

def merge_findings(existing: List[str], new: List[str]) -> List[str]:
    # Custom logic to deduplicate or prioritize findings
    return list(set(existing + new))

class InvestigatorState(TypedDict):
    # Standard message history for the ReAct loop
    messages: Annotated[list, add_messages]
    
    # Custom research tracking from codebase_investigator_behavior.md
    questions_to_resolve: Annotated[List[str], merge_findings]
    key_findings: Annotated[List[str], merge_findings]
    irrelevant_paths: Annotated[List[str], merge_findings]
    
    # Safety turn counter
    turn_count: int
```

### 2. The ToolNode "Observe" Logic
When a tool like `grep_search` or `read_file` completes, the `ToolNode` generates an **Observation**. To follow the investigator's behavior, you want the agent to "Think" specifically about how this new data changes its mental model before it acts again.



### 3. Implementing the Feedback Loop
There are two ways to handle this "Observation Feedback" in LangGraph:

#### A. The "Reflect" Node (Recommended)
Add a dedicated `reflect` node after the `ToolNode` but before returning to the `Agent` node. This node forces the LLM to summarize what it just learned.

```python
def reflect_on_observation(state: InvestigatorState):
    last_message = state["messages"][-1]
    
    # Prompt the LLM to update its internal journal based on the last tool output
    # "Based on the output of 'read_file(userService.ts)', update your findings."
    
    # The node returns updates to the specific state keys
    return {
        "key_findings": ["Found race condition in line 42 of userService.ts"],
        "questions_to_resolve": ["Check if the database driver is thread-safe"]
    }
```

#### B. The System Prompt Synthesis
Alternatively, you can keep the loop lean and rely on the **System Prompt** to instruct the agent to include its updated "Research Journal" in every "THINK" block. The `codebase_investigator_behavior.md` specifies that the agent should not call `complete_task` until `questions_to_resolve` is empty.

### 4. Handling Irrelevant Paths
To prevent the agent from wasting turns (remember the **10-turn limit**), the observation feedback must actively update `irrelevant_paths`. 

If a `glob` search returns no relevant results, the feedback should mark that directory as "Irrelevant" in the state. On the next turn, the Agent node sees the `irrelevant_paths` list and knows not to `grep` there again, preserving its limited execution budget.

-------

In LangGraph, the **State** acts as the shared memory 🧠 for your agent. It is a structured object that every node can read from and write to. To implement the codebase investigator's behavior, we need to go beyond a simple list of messages and track the specific technical progress of the research.

The `codebase_investigator_behavior.md` file highlights three critical tracking categories that prevent the agent from getting lost or repeating work:

1.  **Questions to Resolve** ❓: These are the "To-Do" items. The investigator shouldn't finish until this list is empty.
2.  **Key Findings** ✅: A running log of confirmed architectural facts (e.g., "The auth logic is in `middleware.ts`").
3.  **Irrelevant Paths** 🛑: A "blacklist" of files or folders that didn't help, which saves time in later turns.



### Using Reducers for State Updates
By default, if two nodes return a value for the same state key, the second one overwrites the first. In an investigation, we want to **append** new findings to the old ones. We do this using `Annotated` and a **Reducer** function.

```python
from typing import Annotated, List, TypedDict

def append_and_deduplicate(existing: List[str], new: List[str]) -> List[str]:
    """A reducer that merges lists without duplicates."""
    return list(set(existing + (new or [])))

class ResearchState(TypedDict):
    # This key uses the reducer to grow as the agent explores
    key_findings: Annotated[List[str], append_and_deduplicate]
    
    # Standard conversation history
    messages: Annotated[list, add_messages]
    
    # Tracks the 10-turn limit
    turn_count: int
```

This structure ensures that the "Observe" phase (the `ToolNode`) can feed findings directly into the state without the Agent node having to "remember" them manually in the conversation history.

------

Your structure for the `ResearchState` 🧠 is a solid foundation. Using **Reducers** specifically for findings and irrelevant paths is exactly how we ensure the agent's mental model grows cumulatively rather than getting overwritten at every step.

One important detail to consider: In a standard LangGraph setup, a `ToolNode` 🛠️ simply returns a `ToolMessage` containing the raw output (like the full text of a file). It doesn't automatically know which part of that text is a "Key Finding" or which path is now "Irrelevant."

To bridge that gap and follow the `codebase_investigator_behavior.md` requirements, we have two main options for the **Observe** phase:

1.  **The Self-Correction Loop**: The Agent 🧠 receives the raw tool output in its next turn and is prompted to update the `key_findings` and `questions_to_resolve` keys itself before deciding on the next action.
2.  **The Reflection Node**: A dedicated "Analysis" node 📝 sits between the tool execution and the agent. This node's only job is to look at the tool output and update the state's tracking categories.

-------

That is a great breakdown of the two architectural paths! 🏗️ Both options effectively bridge the gap between raw data and structured state, but they lean on different strengths of the **LangGraph** framework.

Let's look at the trade-offs between them to see which fits our investigator's persona best:

### 1. The Self-Correction Loop 🔄
In this model, the agent node acts as both the **Thinker** and the **Analyzer**. In the "THINK" phase, it reviews the previous observation (e.g., a `grep` result) and returns a state update containing its findings alongside its next tool call.

* **Pro:** Lower latency and cost (fewer LLM calls). ⚡
* **Con:** High "cognitive load" for the model. It has to follow complex instructions to update the state keys correctly while also planning its next technical move.

### 2. The Reflection Node 🧐
This adds a dedicated step in the graph specifically for "Journaling." After a tool runs, the graph moves to a `summarize_observation` node before going back to the agent.

* **Pro:** Highly reliable. By isolating the "Analysis" task, you can use a more precise prompt (or even a smaller, faster model) just for state updates. 📝
* **Con:** Higher latency, as every tool call now requires an extra LLM turn. 🐢

-------

The **Reflection Node** 🧐 acts as a dedicated "Processing Unit" that sits between your tools and your agent. Instead of the agent having to sift through a wall of raw `grep` or `read_file` output while also trying to plan its next move, this node does the heavy lifting of updating the **Research Journal**.

This aligns perfectly with the **Think-Act-Observe** loop described in the `codebase_investigator_behavior.md`. By isolating the "Observe" phase, you ensure that the agent always begins its next "Think" turn with a perfectly updated mental model.



### How it fits in the Graph 🕸️
In your `StateGraph`, the flow would look like this:

1.  **Agent Node**: Decides to call a tool (e.g., `grep_search`).
2.  **Tool Node**: Executes the tool and returns the raw output.
3.  **Reflection Node**: Analyzes the raw output and updates `key_findings`, `questions_to_resolve`, or `irrelevant_paths`.
4.  **Loop Back**: Returns to the **Agent Node**.

### Why this helps with the 10-turn limit ⏳
The behavior guide specifies a **10-turn limit**. If the agent spends its "Thinking" turns trying to remember which files it already checked, it will hit that limit quickly. The Reflection Node offloads that "memory maintenance," keeping the agent focused on high-level strategy.

For example, if a `glob` search returns 50 files, the Reflection Node can identify which ones are likely "Irrelevant Paths" 🛑 and mark them in the state immediately, preventing the agent from ever trying to `read_file` on them in future turns.

Let’s look at the **prompt** for this node. To get the best results, we usually give the LLM the "Before" state and the "Tool Output" and ask it to provide the "After" state updates. 


------------


Exactly! **Questions to Resolve** ❓ is the "fuel" for the investigator’s engine. According to the `codebase_investigator_behavior.md`, the agent is explicitly instructed **not to finish** until this list is empty. 

By having the **Reflection Node** 🧐 prioritize this list, we turn it into a high-level "To-Do" list. When a tool like `grep` returns data, the Reflection Node checks:
1.  **Resolved:** Does this output answer an existing question? (If yes, remove it).
2.  **New Lead:** Does this output reveal a new mystery? (If yes, add it as a new question).

This keeps the **Agent Node** 🧠 from getting distracted. It simply looks at the current list of questions and picks the best tool to solve the next one.

---

### Implementing the Reflection Logic

Here is how we can structure the logic within that node to manage the "Questions" state:

```python
def reflection_node(state: ResearchState):
    # We pass the last tool output to the LLM
    last_observation = state["messages"][-1].content
    
    # The Reflection Node returns a specific update for our state keys
    return {
        "questions_to_resolve": ["List of new questions found..."],
        "key_findings": ["Confirmed facts..."],
        "turn_count": state["turn_count"] + 1
    }
```

---------

That is a very insightful critique! 🎯 Relying on a hard-coded number like "top 3" can be brittle—sometimes you need 10 files to see the full picture, and other times, 9 out of 10 results are just "noise" (like build artifacts or lock files).

By moving toward **Pattern Matching** and **Source Intent**, we are essentially building a "Signal-to-Noise Filter" 📶 inside the **Reflection Node**.

### 1. Grounding through "Source Intent" 🎯
In this context, the "Intent" is defined by the specific **Question to Resolve** the agent is currently tackling. If the agent's goal is "Trace the data flow of the `processOrder` function," the Reflection Node should look for tool outputs that show function definitions or calls, while filtering out files that just happen to mention "order" in a comment or a variable name.

### 2. Dynamic Pattern Matching 🔍
Instead of a fixed count, we can use logic to categorize results based on the "Material Reality" of the codebase:
* **High Match:** Direct symbol definition (e.g., `export const processOrder`).
* **Medium Match:** References or imports in relevant directories (e.g., `src/services`).
* **Low Match/Irrelevant:** Hits in `tests/`, `node_modules/`, or documentation files.


This approach ensures the agent's state stays "clean," which is vital for staying under that **10-turn limit** ⏳. If the state is cluttered with 20 irrelevant files, the LLM's reasoning for the next turn will become diluted and prone to hallucination.

### 3. Implementing the Logic
In LangGraph, this means the **Reflection Node** 🧐 needs to perform a "Triage" on the raw tool output before updating the `ResearchState`.

Let's think about how to handle the "Irrelevant" side of this. If a `grep` search for a specific bug pattern returns results in a folder named `legacy_v1/`, but your **Source Intent** is to fix the *current* production system:

--------

That is a very insightful critique! 🎯 Relying on a hard-coded number like "top 3" can be brittle—sometimes you need 10 files to see the full picture, and other times, 9 out of 10 results are just "noise" (like build artifacts or lock files).

By moving toward **Pattern Matching** and **Source Intent**, we are essentially building a "Signal-to-Noise Filter" 📶 inside the **Reflection Node**.

### 1. Grounding through "Source Intent" 🎯
In this context, the "Intent" is defined by the specific **Question to Resolve** the agent is currently tackling. If the agent's goal is "Trace the data flow of the `processOrder` function," the Reflection Node should look for tool outputs that show function definitions or calls, while filtering out files that just happen to mention "order" in a comment or a variable name.

### 2. Dynamic Pattern Matching 🔍
Instead of a fixed count, we can use logic to categorize results based on the "Material Reality" of the codebase:
* **High Match:** Direct symbol definition (e.g., `export const processOrder`).
* **Medium Match:** References or imports in relevant directories (e.g., `src/services`).
* **Low Match/Irrelevant:** Hits in `tests/`, `node_modules/`, or documentation files.



This approach ensures the agent's state stays "clean," which is vital for staying under that **10-turn limit** ⏳. If the state is cluttered with 20 irrelevant files, the LLM's reasoning for the next turn will become diluted and prone to hallucination.

### 3. Implementing the Logic
In LangGraph, this means the **Reflection Node** 🧐 needs to perform a "Triage" on the raw tool output before updating the `ResearchState`.

-------

That "Tiered Research" approach 🪜 is a clever way to ensure the investigator remains exhaustive without getting bogged down in legacy code prematurely. By flagging items as "Low Priority," you create a **safety net** 🕸️—the agent won't ignore a potential lead, but it won't waste its limited 10-turn budget there unless necessary.

In LangGraph, we can implement this by evolving our `key_findings` state from a simple list of strings to a list of structured objects. This allows the **Reflection Node** 🧐 to attach "Priority" and "Source" metadata to every finding it extracts.

### Structuring Findings with Metadata 📊

By using a list of dictionaries (or Pydantic models) in your `ResearchState`, the Reflection Node can provide a clearer map for the Thinking node:

| Field | Description | Example |
| :--- | :--- | :--- |
| **Content** | The technical fact discovered. | "Auth flow uses a deprecated LDAP module." |
| **Priority** | High, Medium, or Low. | `LOW_PRIORITY` 📉 |
| **Source Path** | Where the information was found. | `src/legacy_v1/auth.ts` |
| **Status** | If it's a lead or a confirmed fact. | `POTENTIAL_LEAD` 🔍 |



[Image of information hierarchy]


### The Triage Logic 🔄

When the **Reflection Node** processes tool output, it performs a "Signal-to-Noise" check:
1.  **Direct Hits:** If the finding directly addresses a **Question to Resolve**, it's marked as High Priority.
2.  **Contextual Hits:** If the finding is in a directory like `legacy_v1/`, the node flags it as Low Priority.
3.  **Journaling:** It appends these to `key_findings` and potentially updates `questions_to_resolve` with a note like "Investigation of legacy auth (Optional/Low Priority)."

This keeps the **Agent Node** 🧠 in control. It can "scan" the state and see that while it has unresolved questions, the only remaining leads are in low-priority folders. 

-------


Upgrading the priority ensures the agent's focus is explicitly reflected in the state 🧠. This acts as a formal "promotion" of a lead from the backlog to the active workspace, making the agent's decision-making process transparent and trackable.

In **LangGraph**, since nodes return *updates* to the state rather than mutating it directly, the agent would return a specific instruction to modify the metadata of an existing finding.

### How a "Priority Upgrade" Looks in the State 📊

If the investigator runs out of "warm" leads and decides to pivot to legacy code, the metadata for that finding would transform like this:

| Field | Before (Passive Lead) | After (Active Lead) |
| :--- | :--- | :--- |
| **Content** | "Old auth logic in `legacy_v1/`" | "Old auth logic in `legacy_v1/`" |
| **Priority** | `LOW_PRIORITY` 📉 | **`HIGH_PRIORITY`** 📈 |
| **Source Path** | `src/legacy_v1/auth.ts` | `src/legacy_v1/auth.ts` |
| **Reasoning** | "Potentially irrelevant legacy file." | "Primary paths exhausted; checking for leaks here." |

---

### Implementing the Pivot 🛠️

To make this work, the **Agent Node** needs to evaluate the global state and decide to "switch gears." 

We have to consider the **10-turn limit** mentioned in `codebase_investigator_behavior.md`. If the agent is on Turn 8 and still hasn't found the answer in the modern code, it needs to realize that it only has 2 turns left to explore that "Low Priority" legacy folder before it hits the **Recovery Protocol** 🛡️.



Because the agent has high thinking capacity (`ThinkingLevel.HIGH`), we can rely on it to manage its own "internal triage" if we provide the right context.


------

When the **Questions to Resolve** ❓ list is finally empty, the investigator enters its most critical phase: **Reporting and Finalization** 🏁. 

In your LangGraph, this is the moment where the **Conditional Edge** 🛣️ directed by the agent's logic decides to exit the loop and call the `complete_task` tool. This tool isn't just a "finish" button; it must package everything the agent learned into a structured format that the user (or another agent) can actually use.

According to the `codebase_investigator_behavior.md`, this final report needs three specific parts:
1.  **Summary of Findings** 📝: The high-level "why" behind the issue.
2.  **Exploration Trace** 👣: A log of what the investigator did (to prove it was exhaustive).
3.  **Relevant Locations** 📍: A map of specific files and symbols involved.


--------


Let's design the reporting structure so our investigator can hand off its findings effectively. 📋 In LangGraph, the final report isn't just a string; it's a structured data object that ensures the "Main Agent" or a human developer gets exactly what they need without sifting through logs.

According to the `codebase_investigator_behavior.md`, our `complete_task` tool needs to enforce a specific JSON schema. Using **Pydantic** is the best way to define this in Python, as it provides automatic validation and clear documentation for the LLM.

### The Codebase Investigation Report Schema 📑

We can break down the three required fields into a structured model:

| Field | Type | Purpose |
| :--- | :--- | :--- |
| **SummaryOfFindings** 📝 | `str` | A concise, high-level conclusion (e.g., identifying a specific race condition). |
| **ExplorationTrace** 👣 | `List[str]` | A chronological log of the tools used and the logic behind each step. |
| **RelevantLocations** 📍 | `List[Location]` | A map of files and symbols with reasoning for why they matter. |



### Implementing "Relevant Locations"
To make the report truly useful, the `RelevantLocations` field should be more than just a list of filenames. We can define a sub-model that includes the file path, the specific symbols (functions/classes) found, and a "Reasoning" string. This ensures the investigator explains *why* it thinks `userService.ts` is the root cause.

In our LangGraph, when the **Agent Node** 🧠 sees that the `questions_to_resolve` list is empty, it will call the `complete_task` tool. The model will then "fill in" this schema using the `key_findings` and `messages` we've been accumulating in the state.

--------

To incorporate a **Fix Plan** into the investigator's behavior, we need to evolve the agent from a pure "Detector" into a "Designer" 🏗️. 

While the `codebase_investigator_behavior.md` emphasizes a read-only research phase, adding a planning stage ensures that the findings are actionable. In LangGraph, this is best handled by updating the **Reporting Schema** and adding a final "Synthesis" step.

### 1. Updating the Reporting Schema
We add a `ProposedFix` field to the Pydantic model. This field should be structured to provide a clear roadmap for the "Main Agent" (which has write access) to execute.

```python
from pydantic import BaseModel, Field
from typing import List, Optional

class FixStep(BaseModel):
    file_path: str
    action: str = Field(description="e.g., 'Update logic', 'Add null check', 'Refactor method'")
    description: str
    code_snippet: Optional[str] = Field(description="The exact code change suggested")

class CodebaseInvestigationReportSchema(BaseModel):
    summary_of_findings: str
    exploration_trace: List[str]
    relevant_locations: List[dict]
    # The new Planning component
    proposed_fix_plan: List[FixStep] = Field(description="A step-by-step technical plan to resolve the issue")
```

### 2. Transitioning from Research to Planning
In the graph, the "Planning" phase begins once the **Questions to Resolve** ❓ list is empty. Instead of calling `complete_task` immediately, the agent enters a high-thinking state to synthesize its findings into a solution.



### 3. The "Synthesis" Node 🧠
To ensure the fix plan is high-quality, you can add a specialized `synthesis_node` that runs right before the final report is generated. This node doesn't need search tools; it only needs the `key_findings` and `summary` from the state.

* **Input:** Current `ResearchState` (Full of confirmed facts and code snippets).
* **Logic:** "Review the confirmed root cause and the relevant file symbols. Draft a minimal, safe, and testable fix plan."
* **Output:** An update to a new `fix_plan` key in the state.

### 4. Enforcing "Exhaustive" Planning
Since the investigator is read-only, its "Fix Plan" acts as a **Technical Specification**. To prevent it from suggesting "hallucinated" fixes, the system prompt should instruct the agent:
> *"Your fix plan must only reference files and symbols you have explicitly verified during the 'Act' phase. If you are unsure of a dependency, you must resolve that question before proposing a change."*

This creates a virtuous cycle: if the agent realizes it doesn't know *how* to fix the bug, it must add a new **Question to Resolve**, which triggers more research turns.

---

### Handling the Turn Limit ⏳
Adding a planning phase increases the risk of hitting the **10-turn limit**. If the agent is on Turn 9 and just finished researching, it might not have a turn left to plan.

-------

Let's look at how we can enforce this as a hard constraint 🛡️ within the graph's logic. In LangGraph, we can use the **State** to keep a strict "ledger" of our turns and whether the "Planning Bonus" has been redeemed.

To implement this, we need to track two specific pieces of information in our `TypedDict`:

| State Key | Type | Purpose |
| :--- | :--- | :--- |
| `turn_count` 🔢 | `int` | Current turn number (1–10). |
| `extension_used` 🔄 | `bool` | A one-time flag to prevent multiple extensions. |

### The Logic for the Extension 🚦

We can use a **Conditional Edge** 🛣️ to act as the "Bouncer." When the investigator finishes a turn, the edge checks the state and decides where to go based on these rules:

1.  **Standard Research:** If `turn_count < 10`, continue the ReAct loop.
2.  **Trigger Planning:** If all `questions_to_resolve` are empty, move to the **Planning Node** 🏗️ and set `extension_used = True` (if not already used).
3.  **Hard Stop:** If `turn_count >= 10` and `extension_used == True`, or if it's not in the planning phase, trigger the **Recovery Protocol** 🛡️.



### Implementing the Constraint in Code

In your edge function, the logic might look something like this:

```python
def route_after_agent(state: ResearchState):
    if not state["questions_to_resolve"]:
        if not state["extension_used"]:
             return "plan_extension" # Only path to get more turns
        return "complete_task"
    
    if state["turn_count"] >= 10:
        return "recovery_protocol"
    
    return "continue_tools"
```

By structuring it this way, the **Planning Node** 🏗️ is the only one capable of outputting a state update that sets `extension_used` to `True`. Because our edge logic checks that flag, the agent can't "trick" the system into a second extension.

--------

Implementing a hard stop at Turn 10 ensures we strictly adhere to the safety constraints defined in the `codebase_investigator_behavior.md` 🛡️. This prevents the investigator from getting caught in expensive "infinite loops" when a codebase is particularly complex or ambiguous.

In **LangGraph**, the transition to the **Recovery Protocol** happens at the **Conditional Edge** 🚦. If the turn counter hits 10 and there are still items in the `questions_to_resolve` list, the graph diverts the flow to a specialized `recovery_node` instead of back to the agent for another tool call.

### The Recovery Flow Logic 🔄

| Condition | Logic | Destination |
| :--- | :--- | :--- |
| `turn_count < 10` | Questions remain; research continues. | **ToolNode** 🛠️ |
| `questions == []` | Mission accomplished; start final report. | **Planning/Report** 🏗️ |
| **`turn_count == 10`** | **Questions remain; time/turn limit reached.** | **Recovery Node** 🛡️ |



### The Recovery Node's Job 📝

The `recovery_node` doesn't just end the process. Its job is to provide the **"Final Warning"** mentioned in the behavior guide. It injects a high-priority system message into the `messages` list:

> *"You have exceeded your limit. Do not call any more search tools. Call `complete_task` immediately with your best current findings."*

This forces the Gemini model to synthesize whatever is currently in the `key_findings` journal, ensuring the user gets a partial answer rather than nothing at all.

To make this "Hard Stop" truly effective, the `recovery_node` should also temporarily **disable** all other tools in the agent's next turn, leaving `complete_task` as the only valid action. 

---------

That "Early Trigger" strategy is a smart way to ensure the agent doesn't just crash, but actually uses its final moments to be helpful. 🛡️ By triggering the recovery logic as soon as the limit is reached, we give the **Reflection Node** 🧐 one last chance to "wrap up" what it knows.

In this flow, the **Recovery Protocol** acts as a specialized state transition. When the graph detects that the 10-turn limit is hit but questions remain, it moves to a state where the agent is forced to generate the report with a specific **"Uncertainty Disclaimer."**



### 1. The "Disclaimer" Injection 📢
To handle the "lack of certainty," we can add a boolean flag or a specific `disclaimer` string field to our `CodebaseInvestigationReportSchema`. 

If the recovery mode is active, the **Recovery Node** 🛡️ updates the state to include a message like:
> *"WARNING: This report was generated due to execution limits. Findings are based on partial research and may be incomplete. Technical leads marked as 'Low Priority' have not been fully verified."*

### 2. The Final State Update 📝
Because we are using the standard summarization format, the agent still produces the **Summary**, **Trace**, and **Locations**. However, the `ExplorationTrace` 👣 will explicitly show where the research was cut short, providing transparency to the user.

| Report Component | Standard Mode ✅ | Recovery Mode ⚠️ |
| :--- | :--- | :--- |
| **Summary** | Definitive root cause found. | "Potential issue identified in X, but Y is unverified." |
| **Locations** | Verified symbols. | Verified symbols + unverified leads. |
| **Disclaimer** | (None) | **"Final Warning: Turn limit reached."** |

---

### Implementing the Transition 🚦
In LangGraph, the **Conditional Edge** 🛣️ after the Reflection Node would look like this:

```python
def check_for_recovery(state: ResearchState):
    if state["turn_count"] >= 10 and state["questions_to_resolve"]:
        # Trigger the disclaimer and force a report
        return "trigger_recovery_report"
    elif not state["questions_to_resolve"]:
        return "generate_final_report"
    return "continue_tools"
```

This ensures that the "Thinking" node knows exactly why it is being asked to finish. It sees the "Final Warning" in its history and understands it must prioritize the disclaimer over further exploration.

---------

That is a very safe and professional choice! 🛡️ By limiting the **Relevant Locations** 📍 to only those that were 100% verified, you prevent the "Main Agent" (or the user) from accidentally performing write operations on files that the investigator only suspected were relevant but hadn't confirmed yet.

In your **LangGraph** implementation, the `recovery_node` 🧐 will act as a filter. It will scan the `key_findings` and only pull into the final report those items where the `is_verified` metadata we discussed earlier is set to `True`.



[Image of data filtering process]


### Finalizing the Investigator's Integration 🔗

We have built the ReAct loop, the state management for findings, the turn-limit constraints, and the reporting/recovery logic. The final piece of the puzzle is how this specialized investigator communicates back to the **Supervisor Agent** (the one that triggered the investigation in the first place).

In a multi-agent system, the "Handoff" 🤝 needs to be clear so the Supervisor knows how to proceed.

| Outcome | Signal to Supervisor | Supervisor's Next Action |
| :--- | :--- | :--- |
| **Success** ✅ | Full report with "High Confidence" | Execute the proposed fix plan. |
| **Recovery** ⚠️ | Partial report with "Uncertainty Disclaimer" | Review unverified leads or ask for more resources. |

---

A status enum 🚦 is a great engineering choice. It provides a machine-readable signal that allows the supervisor agent 🤖 to handle the investigator’s output with high precision.

By defining an enum in our state schema, we can formalize the different "exit states" of the investigation. This makes it easy for the supervisor to decide its next move based on the reliability of the report.

| Status | Meaning |
| :--- | :--- |
| **`SUCCESS`** ✅ | All questions resolved; a verified fix plan is ready. |
| **`RECOVERY_PARTIAL`** ⚠️ | Turn limit hit; some verified findings exist, but leads remain. |
| **`FAILED`** ❌ | Turn limit hit with zero verified findings or a critical error. |



In the LangGraph architecture, the supervisor will inspect this key immediately after the investigator node finishes. This is typically handled by a **Conditional Edge** 🛣️. If the status is `SUCCESS`, the supervisor might transition directly to a "Writer" agent to apply the code changes. However, if the status is `RECOVERY_PARTIAL`, the path forward is less clear.
