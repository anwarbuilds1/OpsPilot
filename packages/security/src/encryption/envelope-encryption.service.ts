import * as crypto from 'node:crypto';

export interface EncryptedDataRecord {
  readonly encryptedPayload: string; // Base64
  readonly authTag: string;          // Hex (32 chars)
  readonly initializationVector: string; // Hex (24 chars)
  readonly keyVersion: number;
}

export interface IEnvelopeEncryptionService {
  encrypt(plaintext: string, organizationId: string): EncryptedDataRecord;
  decrypt(record: EncryptedDataRecord, organizationId: string): string;
  rotate(record: EncryptedDataRecord, organizationId: string): EncryptedDataRecord;
}

export class EnvelopeEncryptionService implements IEnvelopeEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly masterKey: Buffer;
  private readonly currentKeyVersion = 1;

  constructor(masterKeyHex?: string) {
    if (masterKeyHex) {
      if (masterKeyHex.length !== 64) {
        throw new Error('Master key must be a 64-character hex string (256 bits)');
      }
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      const envKey = process.env.OPSPILOT_MASTER_KEY;
      if (envKey && envKey.length === 64) {
        this.masterKey = Buffer.from(envKey, 'hex');
      } else {
        // Deterministic fallback for dev/test environments
        this.masterKey = crypto.createHash('sha256').update('opspilot-default-dev-master-key-2026').digest();
      }
    }
  }

  /**
   * Derives a tenant-unique 256-bit Data Encryption Key (DEK) using HKDF.
   */
  private deriveTenantKey(organizationId: string, version: number): Buffer {
    const info = `opspilot-dek-v${version}-${organizationId}`;
    return Buffer.from(crypto.hkdfSync('sha256', this.masterKey, organizationId, info, 32));
  }

  encrypt(plaintext: string, organizationId: string): EncryptedDataRecord {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }
    if (!organizationId) {
      throw new Error('organizationId is required for tenant-scoped envelope encryption');
    }

    const iv = crypto.randomBytes(12); // Standard 96-bit IV for AES-GCM
    const dek = this.deriveTenantKey(organizationId, this.currentKeyVersion);

    const cipher = crypto.createCipheriv(this.algorithm, dek, iv);
    let encrypted = cipher.update(plaintext, 'utf-8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      encryptedPayload: encrypted,
      authTag: authTag.toString('hex'),
      initializationVector: iv.toString('hex'),
      keyVersion: this.currentKeyVersion,
    };
  }

  decrypt(record: EncryptedDataRecord, organizationId: string): string {
    if (!record || !record.encryptedPayload) {
      throw new Error('Invalid encrypted data record');
    }
    if (!organizationId) {
      throw new Error('organizationId is required for decryption');
    }

    const iv = Buffer.from(record.initializationVector, 'hex');
    const authTag = Buffer.from(record.authTag, 'hex');
    const dek = this.deriveTenantKey(organizationId, record.keyVersion);

    const decipher = crypto.createDecipheriv(this.algorithm, dek, iv);
    decipher.setAuthTag(authTag);

    try {
      let decrypted = decipher.update(record.encryptedPayload, 'base64', 'utf-8');
      decrypted += decipher.final('utf-8');
      return decrypted;
    } catch (err) {
      throw new Error(`Envelope decryption failed: cryptographic authentication tag mismatch or wrong organization context`);
    }
  }

  rotate(record: EncryptedDataRecord, organizationId: string): EncryptedDataRecord {
    const plaintext = this.decrypt(record, organizationId);
    return this.encrypt(plaintext, organizationId);
  }
}
