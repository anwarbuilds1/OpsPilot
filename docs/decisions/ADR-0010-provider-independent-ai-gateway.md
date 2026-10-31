# ADR-0010: Provider-Independent AI Gateway

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
AI model capabilities, pricing, context windows, and latency evolve rapidly across providers (Google DeepMind Gemini, Anthropic Claude, OpenAI). Tying OpsPilot directly to a single provider or proprietary SDK would limit user choice and create significant vendor lock-in risk.

## Problem Statement
How should OpsPilot interface with Large Language Models for automated incident investigations?

## Decision
We decide to build an internal, **provider-independent AI Gateway** (`packages/ai-gateway`). The gateway presents a unified interface for chat completion, tool definition schema translation, structured output validation via Zod, token counting, and retry policies.

## Alternatives Considered
1. **Direct OpenAI SDK Dependency:**
   - *Rejected:* Locks the entire system into a single commercial provider.
2. **Third-Party Frameworks (LangChain, LlamaIndex):**
   - *Pros:* Off-the-shelf multi-provider support.
   - *Cons:* Rapidly changing APIs, significant bloat, difficult debugging, unnecessary abstraction layers for a focused investigation workflow.
3. **LiteLLM / Vercel AI SDK:**
   - *Pros:* Clean abstractions.
   - *Decision:* We adopt clean, minimal TypeScript interfaces modeled on the Vercel AI SDK Core patterns while retaining full internal control over prompt formatting and security redacting.

## Rationale & Consequences
- **Positive:** Customers can switch between Gemini 1.5/2.0, Claude 3.5 Sonnet, or GPT-4o simply by configuring an API key; fallback models can be configured if a primary provider experiences downtime.
- **Negative:** Requires maintaining tool schema adapters across provider formats.

## References
- [`docs/ai/AI_GATEWAY.md`](../ai/AI_GATEWAY.md)
