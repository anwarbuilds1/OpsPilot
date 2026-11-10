import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool, PoolClient } from 'pg';

export const MIGRATION_LOCK_ID = 7483921;

export class MigrationRunner {
  constructor(private readonly pool: Pool) {}

  private async ensureMigrationTable(client: PoolClient): Promise<void> {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async up(migrationsDir: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1);', [MIGRATION_LOCK_ID]);
      await this.ensureMigrationTable(client);

      const appliedResult = await client.query<{ version: string }>(
        'SELECT version FROM _schema_migrations ORDER BY version ASC'
      );
      const appliedSet = new Set(appliedResult.rows.map((r) => r.version));

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
        .sort();

      const executed: string[] = [];

      for (const file of files) {
        const version = file.replace(/\.sql$/, '');
        if (appliedSet.has(version)) {
          continue;
        }

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('INSERT INTO _schema_migrations (version) VALUES ($1)', [version]);
          await client.query('COMMIT');
          executed.push(version);
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
        }
      }

      return executed;
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
      } catch {
        // Advisory lock is session-scoped; if the connection was severed,
        // PostgreSQL automatically releases any session advisory locks.
      } finally {
        client.release();
      }
    }
  }

  async down(migrationsDir: string): Promise<string[]> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1);', [MIGRATION_LOCK_ID]);
      await this.ensureMigrationTable(client);

      const appliedResult = await client.query<{ version: string }>(
        'SELECT version FROM _schema_migrations ORDER BY version DESC'
      );

      const executed: string[] = [];

      for (const row of appliedResult.rows) {
        const downFile = `${row.version}.down.sql`;
        const filePath = path.join(migrationsDir, downFile);

        if (!fs.existsSync(filePath)) {
          throw new Error(`Rollback script for migration ${row.version} does not exist: ${downFile}`);
        }

        const sql = fs.readFileSync(filePath, 'utf-8');
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('DELETE FROM _schema_migrations WHERE version = $1', [row.version]);
          await client.query('COMMIT');
          executed.push(row.version);
        } catch (err) {
          await client.query('ROLLBACK');
          throw new Error(`Rollback ${downFile} failed: ${(err as Error).message}`);
        }
      }

      return executed;
    } finally {
      try {
        await client.query('SELECT pg_advisory_unlock($1);', [MIGRATION_LOCK_ID]);
      } catch {
        // Advisory lock is session-scoped; if the connection was severed,
        // PostgreSQL automatically releases any session advisory locks.
      } finally {
        client.release();
      }
    }
  }
}
