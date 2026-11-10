import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createDatabasePool, MigrationRunner } from '../src/index.js';

describe('PostgreSQL Migration Lifecycle (Isolated Schema)', () => {
  const TEST_SCHEMA = 'test_migration_lifecycle';
  const migrationsDir = path.resolve(__dirname, '../src/migrations');

  let adminPool: Pool;
  let isolatedPool: Pool;
  let runner: MigrationRunner;

  beforeAll(async () => {
    // 1. Administrative pool with default public search path to manage isolated test schema
    adminPool = createDatabasePool();
    // Ensure public schema migrations are applied first for baseline checks
    const adminRunner = new MigrationRunner(adminPool);
    await adminRunner.up(migrationsDir);

    await adminPool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;`);
    await adminPool.query(`CREATE SCHEMA ${TEST_SCHEMA};`);

    // 2. Dedicated test pool with connection-level search_path restricted to TEST_SCHEMA
    isolatedPool = createDatabasePool({
      options: `-c search_path=${TEST_SCHEMA}`,
    });
    runner = new MigrationRunner(isolatedPool);
  });

  afterAll(async () => {
    // Clean up dedicated pool
    await isolatedPool.end();

    // Clean up isolated test schema and admin pool
    await adminPool.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE;`);
    await adminPool.end();
  });

  it('runs migrations UP in isolated schema without touching public schema', async () => {
    const executed = await runner.up(migrationsDir);
    expect(executed).toContain('0001_initial_schema');

    // Verify tables exist in test_migration_lifecycle
    const isolatedTablesResult = await isolatedPool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name IN ('services', 'deployments', 'organizations', '_schema_migrations');
    `, [TEST_SCHEMA]);
    const isolatedTables = isolatedTablesResult.rows.map((r) => r.table_name);
    expect(isolatedTables).toContain('services');
    expect(isolatedTables).toContain('deployments');
    expect(isolatedTables).toContain('organizations');
    expect(isolatedTables).toContain('_schema_migrations');

    // Verify public schema tables are unaffected
    const publicTablesResult = await adminPool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('services', 'deployments', 'organizations');
    `);
    expect(publicTablesResult.rows.length).toBeGreaterThanOrEqual(3);
  });

  it('is idempotent: running UP again in isolated schema does not re-apply migrations', async () => {
    const secondRun = await runner.up(migrationsDir);
    expect(secondRun).toHaveLength(0);
  });

  it('rolls back cleanly via DOWN migration without affecting public schema', async () => {
    const rolledBack = await runner.down(migrationsDir);
    expect(rolledBack).toContain('0001_initial_schema');

    // Verify tables dropped in test_migration_lifecycle
    const isolatedResult = await isolatedPool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = $1 AND table_name IN ('services', 'deployments');
    `, [TEST_SCHEMA]);
    expect(isolatedResult.rows).toHaveLength(0);

    // Verify public schema tables were NOT dropped during rollback
    const publicResult = await adminPool.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('services', 'deployments');
    `);
    expect(publicResult.rows).toHaveLength(2);
  });
});
