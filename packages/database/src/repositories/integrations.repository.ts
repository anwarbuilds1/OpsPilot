import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  EnvelopeEncryptionService,
  IEnvelopeEncryptionService,
  EncryptedDataRecord,
} from '@opspilot/security';

export type IntegrationType = 'github' | 'aws' | 'vps' | 'cloudflare';

export interface IntegrationRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly type: IntegrationType;
  readonly status: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateIntegrationParams {
  readonly id?: string;
  readonly organizationId: string;
  readonly name: string;
  readonly type: IntegrationType;
  readonly metadata?: Record<string, unknown>;
  readonly secretPayload: string;
}

export class IntegrationsRepository {
  private readonly encryptionService: IEnvelopeEncryptionService;

  constructor(
    private readonly pool: Pool,
    encryptionService?: IEnvelopeEncryptionService,
  ) {
    this.encryptionService = encryptionService ?? new EnvelopeEncryptionService();
  }

  /**
   * Connect an integration and securely store its encrypted credentials within an atomic transaction.
   */
  async create(params: CreateIntegrationParams): Promise<IntegrationRecord> {
    if (!params.organizationId) {
      throw new Error('organizationId is required');
    }
    if (!params.secretPayload) {
      throw new Error('secretPayload is required');
    }

    const integrationId = params.id ?? randomUUID();
    const metadata = params.metadata ?? {};
    const encrypted: EncryptedDataRecord = this.encryptionService.encrypt(
      params.secretPayload,
      params.organizationId,
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertIntegrationQuery = `
        INSERT INTO integrations (id, organization_id, name, type, status, metadata)
        VALUES ($1, $2, $3, $4, 'active', $5)
        RETURNING *;
      `;
      const integrationRes = await client.query(insertIntegrationQuery, [
        integrationId,
        params.organizationId,
        params.name,
        params.type,
        JSON.stringify(metadata),
      ]);

      const insertCredsQuery = `
        INSERT INTO integration_credentials (
          organization_id, integration_id, encrypted_payload, auth_tag, initialization_vector, key_version
        ) VALUES ($1, $2, $3, $4, $5, $6);
      `;
      await client.query(insertCredsQuery, [
        params.organizationId,
        integrationId,
        encrypted.encryptedPayload,
        encrypted.authTag,
        encrypted.initializationVector,
        encrypted.keyVersion,
      ]);

      await client.query('COMMIT');
      return this.mapRow(integrationRes.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find an integration by ID, enforcing tenant isolation.
   */
  async findById(id: string, organizationId: string): Promise<IntegrationRecord | null> {
    const query = `
      SELECT * FROM integrations
      WHERE id = $1 AND organization_id = $2;
    `;
    const res = await this.pool.query(query, [id, organizationId]);
    if (res.rows.length === 0) {
      return null;
    }
    return this.mapRow(res.rows[0]);
  }

  /**
   * List integrations for an organization, optionally filtered by type.
   */
  async listByOrganization(
    organizationId: string,
    type?: IntegrationType,
  ): Promise<IntegrationRecord[]> {
    let query = `
      SELECT * FROM integrations
      WHERE organization_id = $1
    `;
    const values: unknown[] = [organizationId];

    if (type) {
      query += ` AND type = $2`;
      values.push(type);
    }

    query += ` ORDER BY created_at DESC;`;

    const res = await this.pool.query(query, values);
    return res.rows.map((row) => this.mapRow(row));
  }

  /**
   * Retrieve and decrypt the integration secret, strictly requiring matching organizationId.
   */
  async getDecryptedSecret(
    integrationId: string,
    organizationId: string,
  ): Promise<string | null> {
    const query = `
      SELECT encrypted_payload, auth_tag, initialization_vector, key_version
      FROM integration_credentials
      WHERE integration_id = $1 AND organization_id = $2;
    `;
    const res = await this.pool.query(query, [integrationId, organizationId]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const record: EncryptedDataRecord = {
      encryptedPayload: row.encrypted_payload,
      authTag: row.auth_tag,
      initializationVector: row.initialization_vector,
      keyVersion: Number(row.key_version),
    };

    return this.encryptionService.decrypt(record, organizationId);
  }

  /**
   * Rotate the integration credentials: either re-encrypt with current master key or set a new secret.
   */
  async rotateSecret(
    integrationId: string,
    organizationId: string,
    newSecretPayload?: string,
  ): Promise<void> {
    let encrypted: EncryptedDataRecord;

    if (newSecretPayload) {
      encrypted = this.encryptionService.encrypt(newSecretPayload, organizationId);
    } else {
      const current = await this.getDecryptedSecret(integrationId, organizationId);
      if (!current) {
        throw new Error(`Integration ${integrationId} not found for organization ${organizationId}`);
      }
      encrypted = this.encryptionService.encrypt(current, organizationId);
    }

    const query = `
      UPDATE integration_credentials
      SET encrypted_payload = $1, auth_tag = $2, initialization_vector = $3, key_version = $4, updated_at = NOW()
      WHERE integration_id = $5 AND organization_id = $6;
    `;
    const res = await this.pool.query(query, [
      encrypted.encryptedPayload,
      encrypted.authTag,
      encrypted.initializationVector,
      encrypted.keyVersion,
      integrationId,
      organizationId,
    ]);

    if (res.rowCount === 0) {
      throw new Error(`Integration credentials not found for integration ${integrationId}`);
    }
  }

  /**
   * Safely and idempotently migrates legacy (v1, pre-AAD) credentials to modern (v2, with AAD) credentials.
   * Can be run per-organization or cluster-wide in a safe, retryable manner.
   *
   * Counter semantics:
   * - `total`: Candidate records discovered with key_version = 1 at the start of the batch.
   * - `migrated`: Records where key_version was actively updated from 1 to 2 by this transaction (rowCount > 0).
   * - `skipped`: Candidate records not migrated by this call, either because decryption/rotation failed
   *   or because a concurrent worker already updated the record (rowCount === 0).
   */
  async migrateLegacyCredentials(
    organizationId?: string,
  ): Promise<{ total: number; migrated: number; skipped: number }> {
    let selectQuery = `
      SELECT id, integration_id, organization_id, encrypted_payload, auth_tag, initialization_vector, key_version
      FROM integration_credentials
      WHERE key_version = 1
    `;
    const params: unknown[] = [];
    if (organizationId) {
      selectQuery += ` AND organization_id = $1`;
      params.push(organizationId);
    }

    const client = await this.pool.connect();
    let migrated = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');
      const res = await client.query(selectQuery, params);

      for (const row of res.rows) {
        const legacyRecord: EncryptedDataRecord = {
          encryptedPayload: row.encrypted_payload,
          authTag: row.auth_tag,
          initializationVector: row.initialization_vector,
          keyVersion: row.key_version,
        };

        try {
          const v2Record = this.encryptionService.rotate(legacyRecord, row.organization_id);
          const updateRes = await client.query(
            `
            UPDATE integration_credentials
            SET encrypted_payload = $1, auth_tag = $2, initialization_vector = $3, key_version = $4, updated_at = NOW()
            WHERE id = $5 AND key_version = 1;
            `,
            [
              v2Record.encryptedPayload,
              v2Record.authTag,
              v2Record.initializationVector,
              v2Record.keyVersion,
              row.id,
            ],
          );

          if ((updateRes.rowCount ?? 0) > 0) {
            migrated++;
          } else {
            // Concurrently updated by another transaction or deleted
            skipped++;
          }
        } catch {
          skipped++;
        }
      }

      await client.query('COMMIT');
      return { total: res.rows.length, migrated, skipped };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Revoke an integration by marking its status as 'revoked'.
   */
  async revoke(integrationId: string, organizationId: string): Promise<boolean> {
    const query = `
      UPDATE integrations
      SET status = 'revoked', updated_at = NOW()
      WHERE id = $1 AND organization_id = $2;
    `;
    const res = await this.pool.query(query, [integrationId, organizationId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Delete an integration and its credentials.
   */
  async delete(integrationId: string, organizationId: string): Promise<boolean> {
    const query = `
      DELETE FROM integrations
      WHERE id = $1 AND organization_id = $2;
    `;
    const res = await this.pool.query(query, [integrationId, organizationId]);
    return (res.rowCount ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): IntegrationRecord {
    return {
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      name: row['name'] as string,
      type: row['type'] as IntegrationType,
      status: row['status'] as string,
      metadata:
        typeof row['metadata'] === 'string'
          ? JSON.parse(row['metadata'] as string)
          : (row['metadata'] as Record<string, unknown>),
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    };
  }
}
