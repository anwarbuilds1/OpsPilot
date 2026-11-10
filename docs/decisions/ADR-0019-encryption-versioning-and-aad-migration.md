# ADR-0019: Envelope Encryption Versioning and AAD Backward-Compatible Migration

- **Status:** Accepted
- **Date:** 2026-11-10
- **Author(s):** OpsPilot Core Engineering
- **Deciders:** Platform Security & Core Architecture Team

---

## Context
OpsPilot employs envelope encryption using AES-256-GCM to store provider credentials, API keys, and deployment secrets in PostgreSQL (`integration_credentials`). To strictly guarantee multi-tenant cryptographic isolation, the tenant identifier (`organizationId`) is bound to the ciphertext as Additional Authenticated Data (AAD).

During early development (v1), credentials were encrypted without AAD. When AAD was subsequently introduced, existing v1 ciphertexts failed authentication during decryption with `Unsupported state or unable to authenticate data`. Furthermore, attempting fallback decryption across versions risks silent security degradation if misconfigured.

## Problem Statement
How to safely support legacy v1 ciphertexts (without AAD) alongside modern v2 ciphertexts (with AAD), ensure zero silent fallback vulnerabilities, enforce that all new credentials use v2, and provide a safe, retryable migration mechanism for existing database records?

## Decision
1. **Explicit Versioning via `key_version`:**
   - The `key_version` column in `integration_credentials` and `EncryptedDataRecord.keyVersion` acts as the strict cryptographic routing switch.
   - `keyVersion === 1` (Legacy): Decrypts using tenant-derived DEK without AAD.
   - `keyVersion === 2` (Current): Encrypts and decrypts using tenant-derived DEK with `organizationId` bound as mandatory AAD.
   - Any unknown `keyVersion` is rejected immediately with `Unsupported encryption key version`.

2. **Strict Cryptographic Non-Fallback:**
   - Decryption logic never attempts silent trial-and-error fallback. If a v2 record fails authentication, it throws an authentication mismatch exception rather than attempting v1 decryption.

3. **All Newly Encrypted Credentials Use v2:**
   - `currentKeyVersion` is set to 2. All calls to `encrypt()` produce v2 records.

4. **Safe, Transactional Database Migration (`migrateLegacyCredentials`):**
   - Implemented in `IntegrationsRepository.migrateLegacyCredentials(organizationId?: string)`.
   - Queries records with `key_version = 1`, rotates them to v2 within a database transaction, and updates records conditionally (`WHERE id = $id AND key_version = 1`).
   - The operation is fully idempotent and retryable.

## Alternatives Considered
1. **Trial-and-Error Decryption Fallback:** Attempting v2 with AAD and falling back to v1 without AAD on error. Rejected: creates a cryptographic downgrade oracle and violates zero-trust principles.
2. **Offline Destructive Data Migration:** Dropping existing credentials and requiring customers to re-enter them. Rejected: breaks customer operational continuity and violates backward compatibility requirements.

## Rationale & Consequences
### Positive Consequences:
- Existing v1 credentials continue to decrypt transparently during transition.
- Full cryptographic binding of tenant ID prevents cross-tenant ciphertext transplant attacks.
- Operators can run online zero-downtime migration to upgrade all stored secrets to v2.

### Negative Consequences / Trade-offs:
- The encryption service must retain legacy v1 decryption logic until all legacy records are verified migrated.
- **`keyVersion` Semantic Overloading (Documented Architectural Debt):** `keyVersion` currently represents both the HKDF Data Encryption Key derivation index (`opspilot-dek-v${version}-${organizationId}`) and the ciphertext framing format (v1 = legacy no-AAD, v2 = modern with-AAD). If future key rotation increments the master key derivation index to version 3 without changing framing, `decrypt()` would require updating. Formal decoupling of ciphertext framing format from master KEK versions is logged as Phase 2 architectural debt under NIST SP 800-57.

## Security Implications
- Strong cryptographic tenant binding via GCM AAD ensures ciphertext cannot be copied to another tenant's row and decrypted.
- Absence of silent fallback preserves cryptographic certainty of failed authentications.

## Migration & Implementation Plan
- Implemented in `packages/security/src/encryption/envelope-encryption.service.ts`.
- Repository migration helper implemented in `packages/database/src/repositories/integrations.repository.ts`.
- Regression tests added in `packages/security/tests/envelope-encryption.spec.ts` and `packages/database/tests/integrations-repository.spec.ts`.

## References
- ADR-0018: Cloudflare API Token Scoping & Envelope Encryption
- NIST SP 800-38D: Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM)
