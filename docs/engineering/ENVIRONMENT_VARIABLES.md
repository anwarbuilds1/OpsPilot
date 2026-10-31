# Environment Variables Reference

> **Configuration File:** `.env` (Local) / Secret Managers (Production)  
> **Parsing Library:** Zod with `@nestjs/config` validation  
> **Security Warning:** Never commit real secrets or production `.env` files to Git.

This document provides the canonical catalog of all environment configuration variables used across OpsPilot API and worker processes.

---

## 1. Application & Server Configuration

| Variable | Description | Required? | Default (Local) |
|---|---|:---:|---|
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | Yes | `development` |
| `PORT` | HTTP port for the NestJS API | No | `3001` |
| `API_PREFIX` | Versioned route prefix | No | `api/v1` |
| `CORS_ORIGINS` | Comma-separated list of allowed origins | Yes in prod | `http://localhost:3000` |
| `LOG_LEVEL` | Log verbosity (`debug`, `info`, `warn`, `error`) | No | `debug` (dev) / `info` (prod) |

---

## 2. Database & Cache

| Variable | Description | Required? | Example / Default |
|---|---|:---:|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes | `postgres://postgres:postgres@localhost:5432/opspilot_dev` |
| `DATABASE_POOL_MIN` | Minimum database pool connections | No | `2` |
| `DATABASE_POOL_MAX` | Maximum database pool connections | No | `10` |
| `REDIS_URL` | Redis connection URL | Yes | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Password for Redis authentication | No in dev | `""` |

---

## 3. Authentication & Encryption

| Variable | Description | Required? | Example / Security Constraints |
|---|---|:---:|---|
| `JWT_SECRET` | Secret key for signing session tokens | Yes | Minimum 64 random characters |
| `JWT_EXPIRES_IN` | Access token lifespan | No | `15m` |
| `REFRESH_TOKEN_EXPIRES_IN` | Refresh token lifespan | No | `7d` |
| `MASTER_ENCRYPTION_KEY` | Hex-encoded 256-bit key for credential envelope encryption | Yes in dev/local | 64-char hex string (`openssl rand -hex 32`) |
| `AWS_KMS_KEY_ARN` | AWS KMS Key ARN for cloud envelope encryption | Yes in prod | `arn:aws:kms:us-east-1:123456789012:key/...` |

---

## 4. GitHub App Integration

| Variable | Description | Required? | Example |
|---|---|:---:|---|
| `GITHUB_APP_ID` | Numeric GitHub App ID | Yes | `123456` |
| `GITHUB_APP_PRIVATE_KEY` | PEM-formatted private key for GitHub App | Yes | Base64-encoded or raw PEM string |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret for HMAC-SHA256 signature verification | Yes | Minimum 32 random characters |

---

## 5. AI Gateway Providers

| Variable | Description | Required? | Notes |
|---|---|:---:|---|
| `DEFAULT_AI_PROVIDER` | Default LLM provider (`gemini`, `anthropic`, `openai`) | Yes | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API Key | Conditional | Required if `DEFAULT_AI_PROVIDER=gemini` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API Key | Conditional | Required if `DEFAULT_AI_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | OpenAI API Key | Conditional | Required if `DEFAULT_AI_PROVIDER=openai` |
| `AI_MAX_TOOL_CALLS` | Hard ceiling for agent tool calls | No | `10` |
| `AI_TIMEOUT_MS` | Total investigation timeout | No | `180000` (3 minutes) |

---

## 6. Example Local `.env.example`

```bash
# Server
NODE_ENV=development
PORT=3001
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=debug

# Storage
DATABASE_URL=postgres://postgres:postgres@localhost:5432/opspilot_dev
REDIS_URL=redis://localhost:6379

# Auth & Cryptography
JWT_SECRET=super-secret-development-jwt-key-do-not-use-in-production-1234567890
MASTER_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# GitHub (Get from GitHub App settings)
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=development-webhook-secret-string

# AI Providers
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
```
