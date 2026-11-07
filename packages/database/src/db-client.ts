import { Pool, PoolConfig } from 'pg';

export function createDatabasePool(customConfig?: PoolConfig): Pool {
  const defaults: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    user: process.env.PGUSER ?? 'anwar',
    database: process.env.PGDATABASE ?? 'postgres',
    host: process.env.PGHOST ?? '/var/run/postgresql',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  };

  return new Pool({ ...defaults, ...customConfig });
}
