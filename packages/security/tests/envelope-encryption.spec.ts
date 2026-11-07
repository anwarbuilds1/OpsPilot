import { describe, it, expect } from 'vitest';
import { EnvelopeEncryptionService } from '../src/encryption/envelope-encryption.service.js';

describe('EnvelopeEncryptionService', () => {
  const service = new EnvelopeEncryptionService();
  const org1 = 'a0000000-0000-4000-8000-000000000001';
  const org2 = 'a0000000-0000-4000-8000-000000000002';
  const secretData = 'cf_api_token_very_secret_998877665544332211';

  it('successfully encrypts and decrypts a secret for a valid tenant', () => {
    const record = service.encrypt(secretData, org1);

    expect(record.encryptedPayload).toBeDefined();
    expect(record.authTag.length).toBe(32); // 16 bytes hex = 32 chars
    expect(record.initializationVector.length).toBe(24); // 12 bytes hex = 24 chars
    expect(record.keyVersion).toBe(1);

    const decrypted = service.decrypt(record, org1);
    expect(decrypted).toBe(secretData);
  });

  it('fails decryption when accessed by a different organization (Tenant Isolation)', () => {
    const record = service.encrypt(secretData, org1);

    expect(() => {
      service.decrypt(record, org2);
    }).toThrow(/Envelope decryption failed: cryptographic authentication tag mismatch or wrong organization context/);
  });

  it('fails decryption when the payload or auth tag is tampered with', () => {
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

  it('supports key/secret rotation yielding a newly decryptable record', () => {
    const record = service.encrypt(secretData, org1);
    const rotated = service.rotate(record, org1);

    expect(rotated.initializationVector).not.toBe(record.initializationVector);
    const decrypted = service.decrypt(rotated, org1);
    expect(decrypted).toBe(secretData);
  });

  it('validates master key length in constructor', () => {
    expect(() => new EnvelopeEncryptionService('short-key')).toThrow(/Master key must be a 64-character hex string/);

    const validHexKey = 'a'.repeat(64);
    const customService = new EnvelopeEncryptionService(validHexKey);
    const record = customService.encrypt('custom-key-test', org1);
    expect(customService.decrypt(record, org1)).toBe('custom-key-test');
  });

  it('rejects empty plaintext or missing organizationId', () => {
    expect(() => service.encrypt('', org1)).toThrow(/Plaintext cannot be empty/);
    expect(() => service.encrypt(secretData, '')).toThrow(/organizationId is required/);
    expect(() => service.decrypt({ encryptedPayload: '', authTag: '', initializationVector: '', keyVersion: 1 }, org1)).toThrow(/Invalid encrypted data record/);
    expect(() => service.decrypt({ encryptedPayload: 'xyz', authTag: '00', initializationVector: '00', keyVersion: 1 }, '')).toThrow(/organizationId is required/);
  });
});
