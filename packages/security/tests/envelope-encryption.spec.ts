import { describe, it, expect } from 'vitest';
import { EnvelopeEncryptionService, EncryptedDataRecord } from '../src/encryption/envelope-encryption.service.js';

describe('EnvelopeEncryptionService', () => {
  const service = new EnvelopeEncryptionService();
  const org1 = 'a0000000-0000-4000-8000-000000000001';
  const org2 = 'a0000000-0000-4000-8000-000000000002';
  const secretData = 'cf_api_token_very_secret_998877665544332211';

  it('successfully encrypts as modern v2 with AAD and decrypts for authorized tenant', () => {
    const record = service.encrypt(secretData, org1);

    expect(record.encryptedPayload).toBeDefined();
    expect(record.authTag.length).toBe(32); // 16 bytes hex = 32 chars
    expect(record.initializationVector.length).toBe(24); // 12 bytes hex = 24 chars
    expect(record.keyVersion).toBe(2);

    const decrypted = service.decrypt(record, org1);
    expect(decrypted).toBe(secretData);
  });

  it('decrypts legacy v1 ciphertext without AAD (Backward Compatibility)', () => {
    const legacyFixture: EncryptedDataRecord = {
      encryptedPayload: 'dOTp0IkWo0HYsVsw1LDythPFZr3/wKOS97t02xs=',
      authTag: 'd13c735aeeefcf084a14e7c744121b8c',
      initializationVector: '123456789012345678901234',
      keyVersion: 1,
    };

    const decrypted = service.decrypt(legacyFixture, org1);
    expect(decrypted).toBe('legacy-v1-secret-token-abcdef');
  });

  it('fails decryption of legacy v1 ciphertext when accessed by different tenant', () => {
    const legacyFixture: EncryptedDataRecord = {
      encryptedPayload: 'dOTp0IkWo0HYsVsw1LDythPFZr3/wKOS97t02xs=',
      authTag: 'd13c735aeeefcf084a14e7c744121b8c',
      initializationVector: '123456789012345678901234',
      keyVersion: 1,
    };

    expect(() => {
      service.decrypt(legacyFixture, org2);
    }).toThrow(/Envelope decryption failed: cryptographic authentication tag mismatch or wrong organization context/);
  });

  it('fails v2 decryption when accessed by a different organization (Tenant Isolation)', () => {
    const record = service.encrypt(secretData, org1);

    expect(() => {
      service.decrypt(record, org2);
    }).toThrow(/Envelope decryption failed: cryptographic authentication tag mismatch or wrong organization context/);
  });

  it('fails decryption when v2 payload or auth tag is tampered with', () => {
    const record = service.encrypt(secretData, org1);

    const tamperedPayloadRecord = {
      ...record,
      encryptedPayload: Buffer.from('tampered-payload').toString('base64'),
    };

    expect(() => {
      service.decrypt(tamperedPayloadRecord, org1);
    }).toThrow(/Envelope decryption failed/);

    const tamperedTagRecord = {
      ...record,
      authTag: '00'.repeat(16),
    };

    expect(() => {
      service.decrypt(tamperedTagRecord, org1);
    }).toThrow(/Envelope decryption failed/);
  });

  it('never falls back from failed v2 authentication to legacy v1 decryption', () => {
    const v2Record = service.encrypt(secretData, org1);
    const corruptedV2Record: EncryptedDataRecord = {
      ...v2Record,
      authTag: 'ff'.repeat(16), // Corrupted tag
    };

    expect(() => service.decrypt(corruptedV2Record, org1)).toThrow(
      /Envelope decryption failed: cryptographic authentication tag mismatch/
    );
  });

  it('rejects unknown or unsupported key versions', () => {
    const unknownVersionRecord: EncryptedDataRecord = {
      encryptedPayload: Buffer.from('test').toString('base64'),
      authTag: '00'.repeat(16),
      initializationVector: '12'.repeat(12),
      keyVersion: 99,
    };

    expect(() => service.decrypt(unknownVersionRecord, org1)).toThrow(
      /Unsupported encryption key version: 99/
    );
  });

  it('rotates legacy v1 records to modern v2 records with AAD', () => {
    const legacyFixture: EncryptedDataRecord = {
      encryptedPayload: 'dOTp0IkWo0HYsVsw1LDythPFZr3/wKOS97t02xs=',
      authTag: 'd13c735aeeefcf084a14e7c744121b8c',
      initializationVector: '123456789012345678901234',
      keyVersion: 1,
    };

    const rotated = service.rotate(legacyFixture, org1);
    expect(rotated.keyVersion).toBe(2);
    expect(rotated.initializationVector).not.toBe(legacyFixture.initializationVector);

    const decrypted = service.decrypt(rotated, org1);
    expect(decrypted).toBe('legacy-v1-secret-token-abcdef');
  });

  it('validates master key length in constructor', () => {
    expect(() => new EnvelopeEncryptionService('short-key')).toThrow(/Master key must be a 64-character hex string/);

    const validHexKey = 'a'.repeat(64);
    const customService = new EnvelopeEncryptionService(validHexKey);
    const record = customService.encrypt('custom-key-test', org1);
    expect(customService.decrypt(record, org1)).toBe('custom-key-test');
  });

  it('rejects fallback master key when NODE_ENV is production', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.OPSPILOT_MASTER_KEY;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.OPSPILOT_MASTER_KEY;

      expect(() => new EnvelopeEncryptionService()).toThrow(
        /OPSPILOT_MASTER_KEY environment variable .* is required in production/
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) {
        process.env.OPSPILOT_MASTER_KEY = originalKey;
      }
    }
  });

  it('rejects empty plaintext or missing organizationId', () => {
    expect(() => service.encrypt('', org1)).toThrow(/Plaintext cannot be empty/);
    expect(() => service.encrypt(secretData, '')).toThrow(/organizationId is required/);
    expect(() => service.decrypt({ encryptedPayload: '', authTag: '', initializationVector: '', keyVersion: 2 }, org1)).toThrow(/Invalid encrypted data record/);
    expect(() => service.decrypt({ encryptedPayload: 'xyz', authTag: '00', initializationVector: '00', keyVersion: 2 }, '')).toThrow(/organizationId is required/);
  });
});
