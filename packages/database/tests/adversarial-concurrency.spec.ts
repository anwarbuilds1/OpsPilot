import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createDatabasePool, MigrationRunner, MIGRATION_LOCK_ID } from '../src/index.js';
import { ensureDatabaseMigrated } from './test-helper.js';

describe('Adversarial Database Concurrency & Lock Resilience', () => {
  const migrationsDir = path.resolve(__dirname, '../src/migrations');
  let adminPool: Pool;

  beforeAll(async () => {
    adminPool = createDatabasePool();
    await ensureDatabaseMigrated(adminPool);
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('Scenario 1: Two concurrent migration runners serialize safely via advisory lock', async () => {
    const testSchema = 'test_adv_concurrent_runners';
    await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    await adminPool.query(`CREATE SCHEMA ${testSchema};`);

    const pool1 = createDatabasePool({ options: `-c search_path=${testSchema}` });
    const pool2 = createDatabasePool({ options: `-c search_path=${testSchema}` });

    const runner1 = new MigrationRunner(pool1);
    const runner2 = new MigrationRunner(pool2);

    try {
      // Launch both runners simultaneously
      const [res1, res2] = await Promise.all([
        runner1.up(migrationsDir),
        runner2.up(migrationsDir),
      ]);

      // Together they must have applied the migrations without duplicate key errors
      const combined = [...res1, ...res2];
      expect(combined).toContain('0001_initial_schema');

      // Exactly one runner applied a given migration, neither crashed
      expect(res1.length === 0 || res2.length === 0).toBe(true);

      // Verify schema is completely intact
      const tablesResult = await pool1.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name IN ('organizations', 'services', 'deployments', '_schema_migrations');
      `, [testSchema]);
      expect(tablesResult.rows).toHaveLength(4);
    } finally {
      await pool1.end();
      await pool2.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    }
  });

  it('Scenario 2: Migration failure inside transaction rolls back and releases advisory lock and client', async () => {
    const testSchema = 'test_adv_migration_failure';
    await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    await adminPool.query(`CREATE SCHEMA ${testSchema};`);

    const testPool = createDatabasePool({ options: `-c search_path=${testSchema}` });
    const runner = new MigrationRunner(testPool);

    // Create temporary directory with an invalid migration
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opspilot-mig-fail-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '0001_good.sql'), 'CREATE TABLE dummy_success (id int);');
      fs.writeFileSync(path.join(tmpDir, '0002_bad.sql'), 'THIS IS COMPLETELY INVALID SQL;');

      await expect(runner.up(tmpDir)).rejects.toThrow(/Migration 0002_bad\.sql failed/);

      // Verify dummy_success is recorded because 0001 committed before 0002 failed
      const goodCheck = await testPool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'dummy_success';
      `, [testSchema]);
      expect(goodCheck.rows).toHaveLength(1);

      // Verify advisory lock is released and can be acquired immediately by another client
      const probeClient = await testPool.connect();
      try {
        const lockAcquired = await probeClient.query<{ acquired: boolean }>(
          'SELECT pg_try_advisory_lock($1) as acquired;',
          [MIGRATION_LOCK_ID]
        );
        expect(lockAcquired.rows[0].acquired).toBe(true);
        await probeClient.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
      } finally {
        probeClient.release();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      await testPool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    }
  });

  it('Scenario 3: PostgreSQL drops session advisory lock when connection terminates', async () => {
    const testPool = createDatabasePool();
    const client = await testPool.connect();
    // Catch the expected connection termination error on the socket
    client.on('error', () => {});

    // Acquire the lock on client
    await client.query('SELECT pg_advisory_lock($1);', [MIGRATION_LOCK_ID]);

    // Verify lock is held: another client cannot acquire try_lock
    const probePool = createDatabasePool();
    const probe1 = await probePool.connect();
    try {
      const busyResult = await probe1.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) as acquired;',
        [MIGRATION_LOCK_ID]
      );
      expect(busyResult.rows[0].acquired).toBe(false);
    } finally {
      probe1.release();
    }

    // Now terminate the backend connection holding the lock
    const pidResult = await client.query<{ pid: number }>('SELECT pg_backend_pid() as pid;');
    const clientPid = pidResult.rows[0].pid;

    await adminPool.query('SELECT pg_terminate_backend($1);', [clientPid]);

    // Short wait to allow socket teardown
    await new Promise((r) => setTimeout(r, 150));

    // Verify another client can acquire the lock immediately
    const probe2 = await probePool.connect();
    try {
      const freeResult = await probe2.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) as acquired;',
        [MIGRATION_LOCK_ID]
      );
      expect(freeResult.rows[0].acquired).toBe(true);
      await probe2.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
    } finally {
      probe2.release();
      await probePool.end();
      try {
        client.release();
      } catch {
        // Connection already terminated
      }
      await testPool.end();
    }
  });

  it('Scenario 4: Fresh empty database initializes and migrates cleanly', async () => {
    const testSchema = 'test_adv_fresh_db';
    await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    await adminPool.query(`CREATE SCHEMA ${testSchema};`);

    const freshPool = createDatabasePool({ options: `-c search_path=${testSchema}` });
    const runner = new MigrationRunner(freshPool);

    try {
      const executed = await runner.up(migrationsDir);
      expect(executed).toEqual(['0001_initial_schema']);

      const tablesResult = await freshPool.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1;
      `, [testSchema]);
      const tableNames = tablesResult.rows.map((r) => r.table_name);
      expect(tableNames).toContain('_schema_migrations');
      expect(tableNames).toContain('organizations');
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('services');
      expect(tableNames).toContain('deployments');
      expect(tableNames).toContain('integrations');
      expect(tableNames).toContain('integration_credentials');
    } finally {
      await freshPool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    }
  });

  it('Scenario 5: Repeated migration execution is completely idempotent and returns empty list', async () => {
    const testSchema = 'test_adv_idempotent';
    await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    await adminPool.query(`CREATE SCHEMA ${testSchema};`);

    const pool = createDatabasePool({ options: `-c search_path=${testSchema}` });
    const runner = new MigrationRunner(pool);

    try {
      const firstRun = await runner.up(migrationsDir);
      expect(firstRun.length).toBeGreaterThan(0);

      // Repeated run 1
      const secondRun = await runner.up(migrationsDir);
      expect(secondRun).toHaveLength(0);

      // Repeated run 2
      const thirdRun = await runner.up(migrationsDir);
      expect(thirdRun).toHaveLength(0);
    } finally {
      await pool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS ${testSchema} CASCADE;`);
    }
  });
});
