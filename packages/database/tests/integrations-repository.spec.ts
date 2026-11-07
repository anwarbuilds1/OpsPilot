import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createDatabasePool,
  IntegrationsRepository,
} from '../src/index.js';

describe('IntegrationsRepository (Cloudflare & Multi-tenant Credentials)', () => {
  const pool = createDatabasePool();
  const repo = new IntegrationsRepository(pool);

  const orgA = '77700000-0000-0000-0000-000000000001';
  const orgB = '77700000-0000-0000-0000-000000000002';
  const integrationId = '77710000-0000-0000-0000-000000000001';
  const cfApiToken = 'v1.0-cf-token-secret-999888777666555444333222111';

  beforeAll(async () => {
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
});
