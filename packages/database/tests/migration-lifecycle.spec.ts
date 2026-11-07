import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool, MigrationRunner } from '../src/index.js';

describe('PostgreSQL Migration Lifecycle', () => {
  const pool = createDatabasePool();
  const runner = new MigrationRunner(pool);
  const migrationsDir = path.resolve(__dirname, '../src/migrations');

  beforeAll(async () => {
    // Ensure clean state before starting
    try {
      await runner.down(migrationsDir);
    } catch {
      // Ignore if clean
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it('runs migrations UP and creates schema tables', async () => {
    const executed = await runner.up(migrationsDir);
    expect(executed).toContain('0001_initial_schema');

    const result = await pool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('services', 'deployments', 'organizations');
    `);
    const tables = result.rows.map((r) => r.table_name);
    expect(tables).toContain('services');
    expect(tables).toContain('deployments');
    expect(tables).toContain('organizations');
  });

  it('is idempotent: running UP again does not re-apply migrations', async () => {
    const secondRun = await runner.up(migrationsDir);
    expect(secondRun).toHaveLength(0);
  });

  it('rolls back cleanly via DOWN migration', async () => {
    const rolledBack = await runner.down(migrationsDir);
    expect(rolledBack).toContain('0001_initial_schema');

    const result = await pool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('services', 'deployments');
    `);
    expect(result.rows).toHaveLength(0);

    // Re-apply so next test files have the tables
    await runner.up(migrationsDir);
  });
});
