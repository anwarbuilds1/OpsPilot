# ADR-0003: Redis and BullMQ for Asynchronous Jobs

- **Status:** Superseded by Decision 7 (PostgreSQL-backed queue — selected architecture, implementation pending; BullMQ/Redis retained as future high-throughput alternative)
- **Superseded Date:** 2026-11-07
- **Superseded By:** [`docs/reports/PROJECT_FOUNDATION_DECISIONS.md`](../reports/PROJECT_FOUNDATION_DECISIONS.md) (Decision 7) and [`docs/reports/PROJECT_FOUNDATION_RECONCILIATION.md`](../reports/PROJECT_FOUNDATION_RECONCILIATION.md) (Section 7)
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

> [!NOTE]
> **Supersession Notice (November 2026):**
> This decision record was superseded during Project Foundation Reconciliation (Decision 7). OpsPilot v0.1.0 adopts a **PostgreSQL-backed queue — selected architecture, implementation pending** (`pg-boss` or custom `FOR UPDATE SKIP LOCKED` worker) to eliminate Redis operational overhead for small teams and enable single-transaction outbox persistence. BullMQ and Redis are preserved as a future scale tier if queue throughput exceeds 5,000 jobs/minute.

## Context
OpsPilot executes asynchronous, long-running operations including Docker builds, image pushes, AWS ECS stabilization polling, health check probing, and multi-turn AI investigations. These tasks cannot run synchronously in HTTP request threads.

## Problem Statement
What queue and asynchronous task distribution mechanism should OpsPilot employ?

## Decision
We decide to use **Redis 7** and **BullMQ** for asynchronous job orchestration across dedicated worker processes.

## Alternatives Considered
1. **AWS SQS + SNS:**
   - *Pros:* Fully managed, high durability.
   - *Cons:* Heavy vendor lock-in to AWS; difficult to run cleanly during local development or on VPS deployments.
2. **Temporal.io:**
   - *Pros:* Powerful workflow engine for long-running sagas.
   - *Cons:* Substantial architectural complexity and steep operational learning curve for a small team.
3. **Database-backed Queues (pg-boss, Graphile Worker):**
   - *Pros:* No separate Redis instance needed.
   - *Cons:* High write/polling load on the primary relational database; lacks low-latency sub-millisecond job scheduling and Redis-native rate limiting.

## Rationale & Consequences
- **Positive:** First-class TypeScript support; built-in exponential backoff, retry policies, stalled job detection, and concurrency control; lightweight local development via standard Redis containers.
- **Negative:** Redis is transient; business state transitions must be durably committed to PostgreSQL, not tracked solely in Redis.

## References
- [`docs/engineering/BACKGROUND_JOB_SPECIFICATION.md`](../engineering/BACKGROUND_JOB_SPECIFICATION.md)
