import { Pool, PoolConfig } from 'pg';

export function createDatabasePool(customConfig?: PoolConfig): Pool {
  const connectionString = customConfig?.connectionString ?? process.env.DATABASE_URL;

  if (connectionString) {
    return new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ...customConfig,
    });
  }

  const defaults: PoolConfig = {
    user: process.env.PGUSER ?? process.env.USER ?? 'postgres',
    database: process.env.PGDATABASE ?? 'postgres',
    host: process.env.PGHOST ?? '/var/run/postgresql',
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  };

  return new Pool({ ...defaults, ...customConfig });
}
