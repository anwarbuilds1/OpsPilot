import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabasePool,
  IntegrationsRepository,
} from '../src/index.js';
import { ensureDatabaseMigrated } from './test-helper.js';

function createLegacyV1Record(plaintext: string, organizationId: string) {
  const masterKey = crypto.createHash('sha256').update('opspilot-default-dev-master-key-2026').digest();
  const info = `opspilot-dek-v1-${organizationId}`;
  const dek = Buffer.from(crypto.hkdfSync('sha256', masterKey, organizationId, info, 32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return {
    encryptedPayload: encrypted,
    authTag: authTag.toString('hex'),
    initializationVector: iv.toString('hex'),
    keyVersion: 1,
  };
}

describe('IntegrationsRepository (Cloudflare & Multi-tenant Credentials)', () => {
  const pool = createDatabasePool();
  const repo = new IntegrationsRepository(pool);

  const orgA = '77700000-0000-0000-0000-000000000001';
  const orgB = '77700000-0000-0000-0000-000000000002';
  const integrationId = '77710000-0000-0000-0000-000000000001';
  const cfApiToken = 'v1.0-cf-token-secret-999888777666555444333222111';

  beforeAll(async () => {
    await ensureDatabaseMigrated(pool);

    // Clean up any stale integration from previous runs
    await pool.query(`DELETE FROM integrations WHERE id = $1;`, [integrationId]);

    // Ensure Org A and Org B exist
    await pool.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Integrations Org A', 'integ-org-a') ON CONFLICT (id) DO NOTHING;`,
      [orgA],
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Integrations Org B', 'integ-org-b') ON CONFLICT (id) DO NOTHING;`,
      [orgB],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM integrations WHERE id = $1;`, [integrationId]);
    await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2);`, [orgA, orgB]);
    await pool.end();
  });

  it('creates an integration with encrypted credentials', async () => {
    const created = await repo.create({
      id: integrationId,
      organizationId: orgA,
      name: 'Production Cloudflare Account',
      type: 'cloudflare',
      metadata: {
        accountId: 'cf-acc-1234567890abcdef',
        accountName: 'Acme Cloudflare',
      },
      secretPayload: cfApiToken,
    });

    expect(created.id).toBe(integrationId);
    expect(created.organizationId).toBe(orgA);
    expect(created.type).toBe('cloudflare');
    expect(created.status).toBe('active');
    expect(created.metadata['accountId']).toBe('cf-acc-1234567890abcdef');

    // Verify raw credentials row in DB is encrypted, NOT plaintext
    const credRow = await pool.query(
      `SELECT encrypted_payload, auth_tag, initialization_vector FROM integration_credentials WHERE integration_id = $1`,
      [integrationId],
    );
    expect(credRow.rows.length).toBe(1);
    expect(credRow.rows[0].encrypted_payload).not.toContain(cfApiToken);
    expect(credRow.rows[0].auth_tag).toBeDefined();
    expect(credRow.rows[0].initialization_vector).toBeDefined();
  });

  it('retrieves the decrypted secret for the authorized organization', async () => {
    const decrypted = await repo.getDecryptedSecret(integrationId, orgA);
    expect(decrypted).toBe(cfApiToken);
  });

  it('enforces tenant isolation: other organization cannot read integration or credentials', async () => {
    // Organization B attempts to find Org A's integration
    const found = await repo.findById(integrationId, orgB);
    expect(found).toBeNull();

    // Organization B attempts to decrypt Org A's secret
    const secret = await repo.getDecryptedSecret(integrationId, orgB);
    expect(secret).toBeNull();
  });

  it('lists integrations filtered by organization and type', async () => {
    const orgAList = await repo.listByOrganization(orgA, 'cloudflare');
    expect(orgAList.length).toBeGreaterThanOrEqual(1);
    expect(orgAList.some((i) => i.id === integrationId)).toBe(true);

    const orgBList = await repo.listByOrganization(orgB, 'cloudflare');
    expect(orgBList.some((i) => i.id === integrationId)).toBe(false);
  });

  it('rotates credentials with a new secret payload', async () => {
    const newToken = 'v1.0-rotated-token-555444333222111000';
    await repo.rotateSecret(integrationId, orgA, newToken);

    const decrypted = await repo.getDecryptedSecret(integrationId, orgA);
    expect(decrypted).toBe(newToken);
  });

  it('revokes an integration by setting status to revoked', async () => {
    const revoked = await repo.revoke(integrationId, orgA);
    expect(revoked).toBe(true);

    const found = await repo.findById(integrationId, orgA);
    expect(found?.status).toBe('revoked');
  });

  it('deletes an integration and its cascade-related credentials', async () => {
    const deleted = await repo.delete(integrationId, orgA);
    expect(deleted).toBe(true);

    const found = await repo.findById(integrationId, orgA);
    expect(found).toBeNull();

    const credRow = await pool.query(
      `SELECT * FROM integration_credentials WHERE integration_id = $1`,
      [integrationId],
    );
    expect(credRow.rows.length).toBe(0);
  });

  it('reads legacy v1 credentials without AAD and safely migrates them to v2 with AAD', async () => {
    const legacyIntegrationId = '77710000-0000-0000-0000-000000000002';
    const legacySecret = 'legacy-v1-secret-token-integration-12345';

    // Create integration record
    await pool.query(
      `INSERT INTO integrations (id, organization_id, name, type, status, metadata)
       VALUES ($1, $2, 'Legacy Cloudflare Integration', 'cloudflare', 'active', '{}')
       ON CONFLICT (id) DO NOTHING;`,
      [legacyIntegrationId, orgA],
    );

    // Insert v1 credential directly
    const v1Rec = createLegacyV1Record(legacySecret, orgA);
    await pool.query(
      `INSERT INTO integration_credentials (integration_id, organization_id, encrypted_payload, auth_tag, initialization_vector, key_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (integration_id) DO UPDATE
       SET encrypted_payload = EXCLUDED.encrypted_payload,
           auth_tag = EXCLUDED.auth_tag,
           initialization_vector = EXCLUDED.initialization_vector,
           key_version = EXCLUDED.key_version;`,
      [legacyIntegrationId, orgA, v1Rec.encryptedPayload, v1Rec.authTag, v1Rec.initializationVector, v1Rec.keyVersion],
    );

    // 1. Verify legacy v1 record decrypts successfully
    const decryptedLegacy = await repo.getDecryptedSecret(legacyIntegrationId, orgA);
    expect(decryptedLegacy).toBe(legacySecret);

    // 2. Perform safe migration
    const migrationResult = await repo.migrateLegacyCredentials(orgA);
    expect(migrationResult.migrated).toBe(1);
    expect(migrationResult.skipped).toBe(0);

    // 3. Verify key_version is upgraded to 2 in the database
    const updatedRow = await pool.query(
      `SELECT key_version, auth_tag FROM integration_credentials WHERE integration_id = $1`,
      [legacyIntegrationId],
    );
    expect(updatedRow.rows[0].key_version).toBe(2);

    // 4. Verify secret is still decryptable with v2 (AAD)
    const decryptedV2 = await repo.getDecryptedSecret(legacyIntegrationId, orgA);
    expect(decryptedV2).toBe(legacySecret);

    // 5. Verify subsequent migration run is a no-op (retryable and idempotent)
    const retryResult = await repo.migrateLegacyCredentials(orgA);
    expect(retryResult.total).toBe(0);
    expect(retryResult.migrated).toBe(0);

    // Cleanup
    await repo.delete(legacyIntegrationId, orgA);
  });

  it('concurrency test: concurrent migration workers do not inflate migration counts', async () => {
    const numRecords = 5;
    const testIds: string[] = [];

    // Create 5 legacy records
    for (let i = 1; i <= numRecords; i++) {
      const id = `77710000-0000-0000-0000-00000000001${i}`;
      testIds.push(id);
      await pool.query(
        `INSERT INTO integrations (id, organization_id, name, type, status, metadata)
         VALUES ($1, $2, $3, 'cloudflare', 'active', '{}')
         ON CONFLICT (id) DO NOTHING;`,
        [id, orgA, `Concurrent Legacy Integration ${i}`],
      );

      const secret = `secret-concurrent-${i}`;
      const rec = createLegacyV1Record(secret, orgA);
      await pool.query(
        `INSERT INTO integration_credentials (integration_id, organization_id, encrypted_payload, auth_tag, initialization_vector, key_version)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (integration_id) DO UPDATE
         SET encrypted_payload = EXCLUDED.encrypted_payload,
             auth_tag = EXCLUDED.auth_tag,
             initialization_vector = EXCLUDED.initialization_vector,
             key_version = EXCLUDED.key_version;`,
        [id, orgA, rec.encryptedPayload, rec.authTag, rec.initializationVector, rec.keyVersion],
      );
    }

    // Run two concurrent migration workers simultaneously
    const [result1, result2] = await Promise.all([
      repo.migrateLegacyCredentials(orgA),
      repo.migrateLegacyCredentials(orgA),
    ]);

    // Critical assertion: the total migrated across both workers must EXACTLY equal numRecords
    expect(result1.migrated + result2.migrated).toBe(numRecords);

    // Each worker's total must equal migrated + skipped
    expect(result1.migrated + result1.skipped).toBe(result1.total);
    expect(result2.migrated + result2.skipped).toBe(result2.total);

    // Verify all rows in DB are now key_version = 2
    const rows = await pool.query(
      `SELECT key_version FROM integration_credentials WHERE integration_id = ANY($1::uuid[])`,
      [testIds],
    );
    expect(rows.rows.length).toBe(numRecords);
    for (const row of rows.rows) {
      expect(row.key_version).toBe(2);
    }

    // Subsequent migration must be a no-op
    const finalRun = await repo.migrateLegacyCredentials(orgA);
    expect(finalRun.total).toBe(0);
    expect(finalRun.migrated).toBe(0);

    // Cleanup
    for (const id of testIds) {
      await repo.delete(id, orgA);
    }
  });
});
