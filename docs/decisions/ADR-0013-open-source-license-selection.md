# ADR-0013: Open-Source License Selection & Comparative Analysis

- **Status:** Pending Project Owner Approval
- **Date:** 2026-11-01
- **Author:** Principal Software Architect & Open-Source Maintainer
- **Deciders:** OpsPilot Project Owner / Founder

---

## Context
OpsPilot is designed as an open-source operations platform. Selecting an open-source license is a critical strategic decision that governs commercial usage, community adoption, contributor participation, patent protections, and competitive cloud hosting risks.

Per project governance rules, the software architect must not independently enforce a license without explicit project owner sign-off. This document provides the comparative legal and technical analysis to inform that decision.

---

## Problem Statement
Which open-source license best aligns with OpsPilot's mission to support small SaaS teams while protecting project IP and fostering a healthy developer ecosystem?

---

## Comparative License Evaluation

We evaluated three primary license archetypes: **MIT**, **Apache-2.0**, and **AGPL-3.0**.

| Dimension | MIT License | Apache License 2.0 | GNU Affero GPL (AGPLv3) |
|---|---|---|---|
| **License Type** | Permissive | Permissive with Patent Grant | Strong Network Copyleft |
| **Commercial Usage** | Unrestricted | Unrestricted | Permitted, but source must be disclosed |
| **Modification Rights** | Unrestricted | Unrestricted | Derivative works must be AGPLv3 |
| **Redistribution Rights** | Unrestricted (keep copyright) | Unrestricted (keep notices & license) | Derivative works must provide complete source code |
| **Explicit Patent Grant** | :x: No patent clause | :white_check_mark: Express grant of patent rights; retaliation clause | :white_check_mark: Express grant of patent rights |
| **Network Copyleft** | :x: None (can run as closed SaaS) | :x: None (can run as closed SaaS) | :white_check_mark: **Yes** (modifications must be open-sourced if offered over network) |
| **Cloud Provider Protection** | Low (AWS can fork and sell as managed service) | Medium (Protects against patent claims; no SaaS source requirement) | High (Prevents cloud providers from offering proprietary managed forks without sharing source) |
| **Enterprise Adoption Friction** | Extremely Low | Very Low (Standard enterprise choice) | High (Many corporate legal teams forbid AGPL inside internal infrastructure) |

---

## Detailed License Analysis

### 1. MIT License
- **Pros:** Maximum developer adoption; zero friction for startups; universal familiarity.
- **Cons:** No explicit patent grant or patent retaliation defense; hyperscale cloud providers can take the codebase, build a proprietary managed OpsPilot service, and contribute nothing back.

### 2. Apache License 2.0
- **Pros:**
  - Clear, explicit grant of patent rights from contributors to users.
  - Patent retaliation clause: if someone sues OpsPilot users over patent infringement, their license is automatically terminated.
  - Highly favored by modern developer tooling ecosystems (Kubernetes, Apache Airflow, Docker, OpenTelemetry).
  - Clean contributor license workflow.
- **Cons:** Does not prevent a competitor from hosting a closed, proprietary multi-tenant SaaS version of the platform.

### 3. GNU Affero General Public License v3 (AGPL-3.0)
- **Pros:**
  - Strong network copyleft: any entity that modifies OpsPilot and runs it as a network service (SaaS) must release the complete source code under AGPL-3.0.
  - Prevents cloud hyperscalers from capturing the project's commercial value without contributing back.
  - Used successfully by projects like Grafana, Mastodon, and Mattermost.
- **Cons:**
  - Significant enterprise legal resistance: many engineering organizations have strict blanket bans against AGPL software in their stacks, fearing viral copyleft contamination of their proprietary services.
  - More complex commercial licensing (often necessitates a dual-licensing model).

---

## Architect's Recommendation

**Recommended Option: Apache License 2.0**

### Rationale:
1. **Adoption Over Monopolization:** At this stage of OpsPilot's lifecycle, developer adoption, community trust, and frictionless evaluation by small engineering teams are far more important than defensive SaaS copyleft protections.
2. **Patent Protection:** Unlike MIT, Apache-2.0 provides crucial patent infringement defenses for contributors and users.
3. **Compatibility:** Fully compatible with upstream dependencies (NestJS, Next.js, OpenTelemetry, BullMQ).

---

## Pending Decision & Current Repository Status

Until the project owner formally approves this decision:
- The root `LICENSE` file remains uncommitted or clearly marked as `Pending License Selection`.
- The repository is marked as `Proposed Open-Source Specification` in documentation and badges.
- No contributor claims of licensing terms are legally binding until this ADR is marked **Accepted**.
