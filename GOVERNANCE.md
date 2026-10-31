# Project Governance (Proposed Specification)

> **Status:** Proposed Draft  
> **Maintainer Model:** Founder-Led Open-Source Project

This document outlines the proposed governance model for **OpsPilot**. The goal is to provide a transparent, lightweight decision-making framework that balances agility during early development with clear paths for community participation and maintainership.

---

## 1. Governance Principles

1. **Safety & Security First:** Because OpsPilot coordinates deployment infrastructure and production incident response, architectural safety and tenant isolation take precedence over rapid, untested feature addition.
2. **Open Architectural Review:** Significant architectural shifts must be proposed via Architecture Decision Records (ADRs) in `docs/decisions/` and reviewed publicly.
3. **Meritocratic Evolution:** Contributors who demonstrate consistent quality, architectural rigor, and adherence to security principles will be invited into maintainer roles.

---

## 2. Roles & Responsibilities

### 2.1 Project Lead / Founder
- Sets overall product direction, scope, and release milestones.
- Final authority on controversial technical disputes or license changes.
- Manages security escalation and confidential disclosures.
- Approves production releases and tags.

### 2.2 Core Maintainers
- Review, approve, and merge Pull Requests.
- Ensure incoming PRs adhere to coding standards, test coverage, and `AGENTS.md` rules.
- Maintain CI/CD pipelines, documentation, and dependency security updates.
- Triage GitHub issues and facilitate community discussions.

### 2.3 Contributors
- Anyone who submits an issue, pull request, documentation fix, or test scenario.
- Adhere to the [Code of Conduct](CODE_OF_CONDUCT.md) and [Contributing Guide](CONTRIBUTING.md).

---

## 3. Decision-Making Process

- **Standard Code Changes:** Require approval from at least one Core Maintainer and passing CI checks.
- **Architectural Changes:** Require a written ADR submitted as a PR to `docs/decisions/`. The ADR must remain open for discussion for a minimum of **5 business days** to allow community feedback before maintainer sign-off.
- **Breaking Changes:** Require explicit sign-off from the Project Lead and must include a documented migration path in `docs/engineering/DATABASE_MIGRATIONS.md` or API release notes.

---

## 4. Release Process & Cadence

- OpsPilot follows [Semantic Versioning (SemVer 2.0.0)](https://semver.org/).
- Releases are tagged on the `main` branch by Core Maintainers after automated security and regression test verification.
- Release notes are compiled directly from `CHANGELOG.md`.

---

## 5. Security Escalation

Security matters follow the confidential escalation path defined in [SECURITY.md](SECURITY.md). Security advisories and patches are prioritized ahead of standard feature development.
