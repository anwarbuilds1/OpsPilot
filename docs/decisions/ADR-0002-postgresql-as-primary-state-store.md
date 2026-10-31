# ADR-0002: PostgreSQL as Primary State Store

- **Status:** Accepted
- **Date:** 2026-11-01
- **Author:** Principal Software Architect
- **Deciders:** OpsPilot Core Team

---

## Context
OpsPilot manages state machines for deployments, tenant memberships, encrypted integration credentials, incident timelines, and audit logs. Losing deployment history or encountering inconsistent relational state could result in corrupted infrastructure updates or security bypasses.

## Problem Statement
What database engine should serve as the primary durable system of record?

## Decision
We decide to use **PostgreSQL 16** as the sole primary state store for all relational entities, time-partitioned metric snapshots, and audit records.

## Alternatives Considered
1. **Document Database (MongoDB):**
   - *Pros:* Flexible schema for arbitrary JSON telemetry.
   - *Cons:* Lacks strict foreign key guarantees and ACID transaction reliability needed across multi-entity deployment workflows.
2. **Dedicated Time-Series Database (TimescaleDB / InfluxDB):**
   - *Pros:* Optimized for massive high-frequency metric streams.
   - *Cons:* Adds another piece of infrastructure to manage. Standard PostgreSQL table partitioning (`RANGE (created_at)`) is more than sufficient for OpsPilot's initial scale.

## Rationale & Consequences
- **Positive:** Rock-solid relational integrity with foreign keys, partial indexes, and JSONB columns for flexible provider metadata; native declarative partitioning; mature backup and migration tooling.
- **Negative:** Requires disciplined migration management.

## Security Implications
Enforces organization-level row scoping. Credential columns are encrypted using AES-256-GCM before writing to disk.

## References
- [`docs/engineering/DATABASE_DESIGN.md`](../engineering/DATABASE_DESIGN.md)
