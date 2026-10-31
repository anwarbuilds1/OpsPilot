# Project & Monorepo Structure

> **Monorepo Manager:** npm workspaces (or pnpm)  
> **Status:** Canonical Codebase Blueprint

OpsPilot is structured as a modular monorepo cleanly separating application runtime tiers, reusable packages, deployment providers, and documentation.

---

## 1. Directory Tree Layout

```text
OpsPilot/
├── apps/
│   ├── api/                     # NestJS Core Application API
│   │   ├── src/
│   │   │   ├── main.ts          # API Ingress & Fastify initialization
│   │   │   ├── app.module.ts    # Root NestJS Module
│   │   │   ├── common/          # Middleware, Guards, Interceptors, Filters
│   │   │   └── modules/         # Encapsulated Business Modules
│   │   │       ├── auth/
│   │   │       ├── organizations/
│   │   │       ├── projects/
│   │   │       ├── services/
│   │   │       ├── integrations/
│   │   │       ├── deployments/
│   │   │       ├── observability/
│   │   │       ├── incidents/
│   │   │       ├── ai-investigation/
│   │   │       ├── approvals/
│   │   │       └── audit/
│   │   ├── test/                # API e2e and integration tests
│   │   ├── Dockerfile           # Production container for API
│   │   └── package.json
│   │
│   ├── dashboard/               # Next.js 14 Web Frontend
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router pages
│   │   │   │   ├── (auth)/      # Login, Register, Verify routes
│   │   │   │   └── (dashboard)/ # Authenticated project & incident views
│   │   │   ├── components/      # UI components (Shadcn UI, Tailwind)
│   │   │   ├── lib/             # API client, React Query hooks
│   │   │   └── types/           # Frontend DTO interfaces
│   │   ├── package.json
│   │   └── tailwind.config.js
│   │
│   └── workers/                 # BullMQ Background Worker Processes
│       ├── src/
│       │   ├── deployment-worker/ # Deployment orchestrator
│       │   ├── telemetry-worker/  # Health checks & metric polling
│       │   ├── incident-worker/   # Incident detection & correlation
│       │   ├── ai-worker/         # AI Investigation Agent runner
│       │   └── main.ts            # Worker bootstrap entrypoint
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   ├── domain/                  # Pure domain entities, value objects, domain events
│   ├── database/                # Prisma/Kysely schema, migrations, connection pool
│   ├── contracts/               # Shared DTOs, API contracts, Zod schemas
│   ├── deployment-providers/    # DeploymentProvider interface & adapters (AWS, VPS)
│   │   ├── src/
│   │   │   ├── provider.interface.ts
│   │   │   ├── aws-ecs/
│   │   │   └── vps-docker/
│   ├── ai-gateway/              # LLM abstraction, tool schemas, token budgets
│   ├── security/                # Envelope encryption, AES-256-GCM, secret redactor
│   └── telemetry/               # OpenTelemetry setup & metric aggregators
│
├── docker/
│   ├── docker-compose.dev.yml   # Local PostgreSQL & Redis backing services
│   ├── build-runner.Dockerfile  # Ephemeral container image for Docker builds
│   └── ssh-runner.Dockerfile    # Ephemeral container image for VPS SSH deploys
│
├── docs/                        # Complete System Documentation
├── .github/                     # GitHub Actions, Issue Templates, PR Templates
├── package.json                 # Monorepo root package definition
├── tsconfig.json                # Base TypeScript configuration
├── AGENTS.md                    # Mandatory AI Coding Agent Operating Rules
└── README.md
```
