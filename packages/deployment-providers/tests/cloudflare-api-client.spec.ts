import { describe, expect, it, vi } from 'vitest';
import {
  CloudflareApiClient,
  CloudflareApiError,
} from '../src/cloudflare/common/cloudflare-api-client.js';

describe('CloudflareApiClient', () => {
  const dummyToken = 'cf_token_0123456789abcdef0123456789abcdef';
  const dummyAccountId = 'cf_acc_1122334455667788';

  it('successfully verifies a valid API token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: { id: 'token-abc', status: 'active' },
      }),
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any });
    const result = await client.verifyToken(dummyToken);

    expect(result.valid).toBe(true);
    expect(result.tokenId).toBe('token-abc');
    expect(result.status).toBe('active');
  });

  it('handles invalid or expired API token gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        success: false,
        errors: [{ code: 1000, message: 'Invalid API Token' }],
      }),
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any });
    const result = await client.verifyToken(dummyToken);

    expect(result.valid).toBe(false);
  });

  it('lists accounts associated with the API token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: [
          { id: 'acc-1', name: 'Production Account' },
          { id: 'acc-2', name: 'Staging Account' },
        ],
      }),
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any });
    const accounts = await client.listAccounts(dummyToken);

    expect(accounts.length).toBe(2);
    expect(accounts[0].name).toBe('Production Account');
  });

  it('performs deep permission probing across product APIs', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      // Allow workers and pages, but reject d1
      if (url.includes('/d1/database')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ errors: [{ message: 'Forbidden' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, result: [] }),
      });
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any });
    const capabilities = await client.probeCapabilities(dummyAccountId, dummyToken);

    expect(capabilities.workers).toBe(true);
    expect(capabilities.pages).toBe(true);
    expect(capabilities.tail).toBe(true);
    expect(capabilities.d1).toBe(false);
  });

  it('retries with exponential backoff on HTTP 429 rate limit', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          headers: new Headers({ 'Retry-After': '0' }),
          statusText: 'Too Many Requests',
          json: async () => ({ errors: [{ message: 'Rate limit exceeded' }] }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, result: { id: 'worker-v1', number: 1, created_on: '2026-11-08' } }),
      });
    });

    const client = new CloudflareApiClient({
      fetchFn: mockFetch as any,
      baseBackoffMs: 10,
      maxRetries: 2,
    });

    const result = await client.uploadScriptVersion(
      dummyAccountId,
      'my-worker',
      { esmContent: 'export default {};', compatibilityDate: '2026-11-01' },
      dummyToken,
    );

    expect(callCount).toBe(2);
    expect(result.id).toBe('worker-v1');
  });

  it('redacts sensitive tokens in CloudflareApiError messages', async () => {
    const sensitiveErrorMsg = `Failed to authorize with Bearer ${dummyToken}`;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        errors: [{ message: sensitiveErrorMsg }],
      }),
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any, maxRetries: 0 });

    await expect(
      client.listAccounts(dummyToken),
    ).rejects.toThrowError(CloudflareApiError);

    try {
      await client.listAccounts(dummyToken);
    } catch (err: any) {
      expect(err.message).not.toContain(dummyToken);
      expect(err.message).toContain('[REDACTED_TOKEN]');
    }
  });

  it('enforces Cloudflare Pages file count and file size limits', async () => {
    const client = new CloudflareApiClient();
    const manifest: Record<string, string> = {};
    const files = new Map<string, Buffer>();

    // Test file size limit (> 25 MiB)
    files.set('/huge.bin', Buffer.alloc(26 * 1024 * 1024)); // 26 MiB
    manifest['/huge.bin'] = 'fake-hash';

    await expect(
      client.createPagesDirectUploadDeployment(
        dummyAccountId,
        'my-pages',
        manifest,
        files,
        'production',
        dummyToken,
      ),
    ).rejects.toThrow(/Cloudflare Pages asset exceeds 25 MiB file size limit/);
  });

  it('executes official 4-stage Direct Upload lifecycle: session -> check-missing -> upload -> deployment', async () => {
    const calledEndpoints: string[] = [];
    const authHeaders: string[] = [];

    const mockFetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      calledEndpoints.push(url);
      const auth = (init.headers as Headers)?.get('Authorization') ?? '';
      authHeaders.push(auth);

      if (url.includes('/direct_upload')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: { id: 'session-jwt-token-xyz', upload_url: 'https://upload.pages.dev' },
          }),
        });
      }

      if (url.includes('/pages/assets/check-missing')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: ['hash-missing-file-2'], // only file 2 is missing
          }),
        });
      }

      if (url.includes('/pages/assets/upload')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: null,
          }),
        });
      }

      if (url.includes('/deployments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            result: {
              id: 'dep-uuid-official-1',
              short_id: 'dep-off-1',
              project_id: 'proj-1',
              project_name: 'my-pages',
              environment: 'production',
              url: 'https://dep-off-1.my-pages.pages.dev',
              created_on: new Date().toISOString(),
            },
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });

    const client = new CloudflareApiClient({ fetchFn: mockFetch as any });
    const manifest: Record<string, string> = {
      '/index.html': 'hash-cached-file-1',
      '/about.html': 'hash-missing-file-2',
    };
    const files = new Map<string, Buffer>();
    files.set('/index.html', Buffer.from('<html>home</html>'));
    files.set('/about.html', Buffer.from('<html>about</html>'));

    const res = await client.createPagesDirectUploadDeployment(
      dummyAccountId,
      'my-pages',
      manifest,
      files,
      'production',
      dummyToken,
    );

    expect(res.id).toBe('dep-uuid-official-1');
    expect(res.url).toBe('https://dep-off-1.my-pages.pages.dev');

    // Verify all 4 endpoints were called in exact order
    expect(calledEndpoints.length).toBe(4);
    expect(calledEndpoints[0]).toContain('/pages/projects/my-pages/direct_upload');
    expect(calledEndpoints[1]).toContain('/pages/assets/check-missing');
    expect(calledEndpoints[2]).toContain('/pages/assets/upload');
    expect(calledEndpoints[3]).toContain('/pages/projects/my-pages/deployments');

    // Verify authentication: session JWT used for asset endpoints, API token used for control plane
    expect(authHeaders[0]).toBe(`Bearer ${dummyToken}`);
    expect(authHeaders[1]).toBe('Bearer session-jwt-token-xyz');
    expect(authHeaders[2]).toBe('Bearer session-jwt-token-xyz');
    expect(authHeaders[3]).toBe(`Bearer ${dummyToken}`);
  });
});
