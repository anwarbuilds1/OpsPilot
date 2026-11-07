import { describe, expect, it } from 'vitest';
import { SecretRedactor } from '../src/index.js';

describe('SecretRedactor', () => {
  const redactor = new SecretRedactor();

  it('redacts Bearer tokens in headers', () => {
    const raw = 'Authorization: Bearer my-secret-jwt-token-12345';
    expect(redactor.redact(raw)).toBe('Authorization: Bearer [REDACTED_TOKEN]');
  });

  it('redacts database credentials in URLs', () => {
    const raw = 'Connected to postgresql://admin:superSecretPass123@db.internal:5432/opspilot';
    expect(redactor.redact(raw)).toBe('Connected to postgresql://admin:[REDACTED_PASSWORD]@db.internal:5432/opspilot');
  });

  it('redacts private keys', () => {
    const raw = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y...dummy...
-----END RSA PRIVATE KEY-----`;
    expect(redactor.redact(raw)).toBe('[REDACTED_PRIVATE_KEY]');
  });

  it('redacts 40-character API tokens', () => {
    const raw = 'Log: Cloudflare trace hash 0123456789abcdef0123456789abcdef01234567 generated';
    expect(redactor.redact(raw)).toContain('[REDACTED_KEY_40]');
  });

  it('recursively redacts sensitive keys in JSON objects', () => {
    const payload = {
      service: 'payment',
      config: {
        apiUrl: 'https://api.stripe.com',
        apiKey: 'sk_live_12345',
        nested: {
          dbPassword: 'secretpassword',
          safeParam: 42,
        },
      },
    };

    const sanitized = redactor.redactObject(payload) as Record<string, unknown>;
    const config = sanitized.config as Record<string, unknown>;
    const nested = config.nested as Record<string, unknown>;

    expect(config.apiKey).toBe('[REDACTED]');
    expect(nested.dbPassword).toBe('[REDACTED]');
    expect(nested.safeParam).toBe(42);
    expect(sanitized.service).toBe('payment');
  });
});
