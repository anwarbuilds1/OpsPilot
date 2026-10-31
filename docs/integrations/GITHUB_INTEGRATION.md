# GitHub App Integration Architecture

> **Integration Method:** Official GitHub App Manifest  
> **Webhook Security:** HMAC-SHA256 Signature Verification  
> **Permissions:** Least-Privilege Scoped Repository Access

This document details the configuration, permissions, and webhook processing for the OpsPilot GitHub App integration.

---

## 1. GitHub App Permissions Matrix

OpsPilot requests strictly the minimal permissions necessary to read metadata, ingest webhooks, checkout source code, and create remediation PRs:

| Permission | Access Level | Rationale |
|---|:---:|---|
| **Repository Metadata** | Read-Only | Discover branches, repository names, and default branch configurations. |
| **Repository Contents** | Read & Write | Read Dockerfiles and source code at specific commit SHAs; create remediation branches and PRs. |
| **Pull Requests** | Read & Write | Open automated remediation PRs with diagnostic summaries; track merge events. |
| **Commit Statuses** | Read & Write | Post deployment and health check status badges directly onto GitHub commits and PRs. |
| **Webhooks** | Ingest | Receive real-time push and PR lifecycle events. |

---

## 2. Webhook Signature Verification

Every incoming webhook to `/api/v1/integrations/github/webhook` is verified using the `X-Hub-Signature-256` header:

```typescript
export function verifyGitHubWebhookSignature(
  rawPayload: Buffer,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', webhookSecret)
    .update(rawPayload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}
```

---

## 3. Webhook Event Handling

| Webhook Event | OpsPilot Action |
|---|---|
| `push` | Extracts commit SHA, branch, and author. If matching an active service's tracked branch, enqueues a `deploy-service` job in BullMQ. |
| `pull_request.closed` (merged) | If merged into the tracked production branch, registers commit metadata and enqueues deployment. |
| `installation.created` | Links GitHub App installation ID to the user's organization; discovers accessible repositories. |
| `installation.deleted` | Revokes repository access; flags active GitHub integrations as `revoked`. |
