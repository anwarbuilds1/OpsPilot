import * as path from 'node:path';
import { Pool } from 'pg';
import { MigrationRunner } from '../src/index.js';

let migrationPromise: Promise<void> | null = null;

export async function ensureDatabaseMigrated(pool: Pool): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        const migrationsDir = path.resolve(__dirname, '../src/migrations');
        const runner = new MigrationRunner(pool);
        await runner.up(migrationsDir);
      } catch (err) {
        migrationPromise = null;
        throw err;
      }
    })();
  }
  return migrationPromise;
}
