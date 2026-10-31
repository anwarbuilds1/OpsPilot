# AI Gateway Architecture & Provider Abstraction

> **Package:** `packages/ai-gateway`  
> **Interface:** `AiGatewayClient`  
> **Status:** Approved Baseline

The OpsPilot AI Gateway decouples the application from specific LLM vendors, providing a unified, type-safe interface for tool-enabled chat completions, schema validation, and cost tracking.

---

## 1. Unified Gateway Interface

```typescript
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletionResponse {
  message: ChatMessage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
  };
}

export interface AiGatewayClient {
  readonly providerName: 'gemini' | 'anthropic' | 'openai';
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
```

---

## 2. Token Counting & Cost Tracking

The AI Gateway calculates exact token costs based on model-specific pricing tables:

```typescript
export const MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
  'gemini-2.0-flash': { promptPer1k: 0.0001, completionPer1k: 0.0004 },
  'claude-3-5-sonnet': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'gpt-4o': { promptPer1k: 0.005, completionPer1k: 0.015 }
};
```
Every investigation run records its accumulated token count and estimated cost directly in the `agent_runs` table in PostgreSQL.

---

## 3. Fallback Policies & Resilience

If the primary configured model provider returns an HTTP 500 error, experiences persistent rate limiting (HTTP 429), or times out after 60 seconds:
1. The gateway logs a warning with the provider error code.
2. If a fallback model is configured in `.env` (e.g., `FALLBACK_AI_PROVIDER=gemini`), the request is re-dispatched to the secondary provider without restarting the investigation.
3. If both providers fail, the investigation status transitions gracefully to `Inconclusive` with a diagnostic reason.
