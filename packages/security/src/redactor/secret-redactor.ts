export interface ISecretRedactor {
  redact(text: string): string;
  redactObject<T>(obj: T): T;
}

export class SecretRedactor implements ISecretRedactor {
  private readonly rules: { pattern: RegExp; replacement: string }[] = [
    {
      // Bearer tokens (Authorization headers, CF tokens, etc.)
      pattern: /(bearer\s+)[A-Za-z0-9_\-.~+/]+=*/gi,
      replacement: '$1[REDACTED_TOKEN]',
    },
    {
      // Cloudflare API tokens (typically 40 alphanumeric/special characters)
      pattern: /\b[a-zA-Z0-9_-]{40}\b/g,
      replacement: '[REDACTED_KEY_40]',
    },
    {
      // Private keys
      pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
      replacement: '[REDACTED_PRIVATE_KEY]',
    },
    {
      // Database connection strings containing user:password@
      pattern: /(postgres(?:ql)?|mysql|mongodb):\/\/([^:]+):([^@]+)@/gi,
      replacement: '$1://$2:[REDACTED_PASSWORD]@',
    },
    {
      // Generic password/secret assignments in config/env
      pattern: /(["']?(?:password|secret|token|api_?key|private_?key)["']?\s*[:=]\s*["'])([^"'\r\n]+)(["'])/gi,
      replacement: '$1[REDACTED]$3',
    },
  ];

  redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }
    let sanitized = text;
    for (const rule of this.rules) {
      sanitized = sanitized.replace(rule.pattern, rule.replacement);
    }
    return sanitized;
  }

  redactObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.redact(obj) as unknown as T;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (/password|secret|token|apikey|privatekey|credential/i.test(key)) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = this.redactObject(value);
        }
      }
      return result as T;
    }
    return obj;
  }
}
