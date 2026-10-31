# Credential Management & Key Cryptography

> **Security Standard:** NIST SP 800-57 (Key Management Recommendations)  
> **Status:** Mandatory Security Specification

This document outlines the cryptographic controls, envelope encryption specifications, key rotation policies, and zero-leakage memory hygiene implemented in OpsPilot.

---

## 1. Storage of Cloud & Infrastructure Credentials

OpsPilot explicitly rejects storing plaintext infrastructure credentials. When a customer registers a VPS SSH key or connects an AWS IAM role:

1. **Generation of Ephemeral DEK:** An ephemeral 256-bit AES Data Encryption Key (DEK) is generated in memory:
   ```typescript
   const dek = crypto.randomBytes(32); // 256 bits
   const iv = crypto.randomBytes(12);  // 96 bits for AES-GCM
   ```
2. **Payload Encryption:** The credential payload (e.g., SSH private key string or AWS External ID) is encrypted using AES-256-GCM:
   ```typescript
   const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
   const ciphertext = Buffer.concat([cipher.update(credentialString, 'utf8'), cipher.final()]);
   const authTag = cipher.getAuthTag();
   ```
3. **DEK Wrapping via KEK:** The DEK is encrypted using the master Key Encryption Key (KEK) via AWS KMS (`kms:Encrypt`) or the local master key.
4. **Database Write:** The ciphertext, auth tag, IV, and wrapped DEK are saved in the `integration_credentials` table. The plaintext DEK is immediately overwritten in memory with zeros.

---

## 2. In-Memory Decryption & Zero-Exposure Policy

- **Decryption Scope:** Decryption occurs exclusively in background worker memory at the exact instant an outbound connection to AWS or an SSH server is required.
- **No API Exposure:** API endpoints (`GET /integrations`, `GET /integrations/:id`) **never** return decrypted credentials. They return only metadata (e.g., `keyType: "ed25519"`, `fingerprint: "SHA256:abc..."`).
- **No LLM Exposure:** Decrypted credentials are strictly blacklisted from being passed into the AI Gateway or tool execution parameters.
- **Zeroing Memory:** Buffer objects holding decrypted SSH private keys are manually zeroed (`buffer.fill(0)`) immediately after the connection is established.
