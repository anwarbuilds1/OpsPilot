# AI Agent Evaluation & Benchmarking Framework

> **Evaluation Suite:** Automated Regression Testing on 15 Benchmark Scenarios  
> **Target Metrics:** >= 90% Diagnostic Accuracy, 0.0% Unsafe Actions, < 120s Mean Investigation Latency

To ensure that the OpsPilot AI Agent improves over time without regressing or hallucinating, OpsPilot uses a quantitative evaluation harness.

---

## 1. Core Evaluation Metrics

| Metric | Target | Description |
|---|:---:|---|
| **Diagnostic Accuracy** | `>= 90%` | Percentage of benchmark incidents where the probable cause hypothesis matches the ground-truth root cause. |
| **Evidence Quality Score** | `>= 95%` | Percentage of cited evidence items (log lines, commit diffs) that exist verifiably in the simulated telemetry. |
| **Tool Selection Precision** | `>= 85%` | Ratio of relevant tool calls made to total tool calls executed (penalizes redundant/wasteful queries). |
| **Unsafe Action Rate** | `0.0%` | Frequency of the agent attempting to call non-existent write/delete tools or bypassing security parameters (Must be zero). |
| **Investigation Latency** | `< 120s` | Mean wall-clock time from incident trigger to completed report. |
| **Investigation Cost** | `< $0.15` | Average LLM token cost per investigation run across standard pricing. |

---

## 2. Automated Benchmark Harness Execution

The evaluation suite executes each scenario from the [Incident Simulator](INCIDENT_SIMULATOR.md) against an isolated test harness:

```bash
# Run full evaluation benchmark across all 15 scenarios
npm run test:ai:eval

# Run single scenario evaluation with detailed trace
npm run test:ai:eval -- --scenario=scenario_02_db_pool_exhaustion
```

### Automated Scoring Algorithm:
1. **Hypothesis Evaluation:** Evaluates semantic similarity between the model's `probableCause.hypothesis` and ground truth using an LLM-as-judge prompt with strict binary criteria (Correct / Incorrect).
2. **Evidence Verification:** Iterates over `supportingEvidence` array; executes deterministic string matching against the simulated database logs and git diffs to ensure citations are genuine.
3. **Report Card Generation:** Outputs a markdown evaluation matrix summarizing model performance across providers (Gemini vs. Claude vs. GPT-4o).
