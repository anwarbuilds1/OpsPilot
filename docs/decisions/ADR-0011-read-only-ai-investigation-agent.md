# ADR-0011: Read-Only AI Investigation Agent

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
Deploying AI agents into operational environments introduces severe risks: hallucinated infrastructure mutations, accidental deletion of production databases, execution of arbitrary commands, or prompt injection exploits via malicious log streams.

## Problem Statement
What operational permissions should the AI Incident Investigation Agent possess?

## Decision
We decide that the AI Investigation Agent is strictly **Read-Only**. The agent is provided only with tools that query state (`get_application_logs`, `query_metrics`, `get_recent_commits`, etc.). It possesses zero write permissions, zero infrastructure mutate APIs, and zero direct shell execution capabilities.

## Alternatives Considered
1. **Autonomous Self-Healing Agent (Write-enabled):**
   - *Pros:* Automatically restarts crashed containers or rolls back deployments without human latency.
   - *Cons:* Extremely high risk of compounding production outages; uncontained loops; complete violation of enterprise security requirements.

## Rationale & Consequences
- **Positive:** Absolute safety against automated destruction; eliminates liability for unintended infrastructure damage; builds trust with engineering teams.
- **Negative:** Autonomous remediation is limited to proposing actions rather than applying them directly.

## Security Implications
Even in the event of a successful prompt injection through untrusted application logs, the attacker cannot instruct the agent to execute destructive infrastructure actions because no such tools exist in its tool manifest.

## References
- [`docs/ai/AI_AGENT_SECURITY.md`](../security/AI_AGENT_SECURITY.md)
