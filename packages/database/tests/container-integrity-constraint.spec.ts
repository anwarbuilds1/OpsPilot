import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool } from '../src/index.js';
import { ensureDatabaseMigrated } from './test-helper.js';

describe('PostgreSQL Conditional Constraint: check_container_runtime_fields', () => {
  const pool = createDatabasePool();
  const testOrgId = 'a0000000-0000-0000-0000-000000000001';
  const testProjId = 'b0000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await ensureDatabaseMigrated(pool);

    await pool.query(`
      INSERT INTO organizations (id, name, slug) 
      VALUES ($1, 'Acme Corp', 'acme-corp')
      ON CONFLICT (id) DO NOTHING;
    `, [testOrgId]);

    await pool.query(`
      INSERT INTO projects (id, organization_id, name, slug) 
      VALUES ($1, $2, 'Core Infrastructure', 'core-infra')
      ON CONFLICT (id) DO NOTHING;
    `, [testProjId, testOrgId]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
    await pool.end();
  });

  it('rejects container service with NULL container_port via CHECK constraint', async () => {
    const insertSql = `
      INSERT INTO services (
        organization_id, project_id, name, slug, repository_name,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, container_port, cpu_units, memory_mb
      ) VALUES (
        $1, $2, 'Invalid ECS Service', 'invalid-ecs', 'acme/app',
        'aws_ecs', 'dockerfile', 'oci_image', 'container',
        'Dockerfile', NULL, 512, 1024
      );
    `;

    await expect(pool.query(insertSql, [testOrgId, testProjId])).rejects.toThrowError(
      /check_container_runtime_fields/
    );
  });

  it('rejects container service with NULL dockerfile_path via CHECK constraint', async () => {
    const insertSql = `
      INSERT INTO services (
        organization_id, project_id, name, slug, repository_name,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, container_port, cpu_units, memory_mb
      ) VALUES (
        $1, $2, 'Invalid VPS Service', 'invalid-vps', 'acme/app',
        'vps_docker', 'dockerfile', 'oci_image', 'container',
        NULL, 8080, 512, 1024
      );
    `;

    await expect(pool.query(insertSql, [testOrgId, testProjId])).rejects.toThrowError(
      /check_container_runtime_fields/
    );
  });

  it('rejects container service with NULL cpu_units or memory_mb', async () => {
    const insertSql = `
      INSERT INTO services (
        organization_id, project_id, name, slug, repository_name,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, container_port, cpu_units, memory_mb
      ) VALUES (
        $1, $2, 'Invalid VPS Memory', 'invalid-vps-mem', 'acme/app',
        'vps_docker', 'dockerfile', 'oci_image', 'container',
        'Dockerfile', 8080, 512, NULL
      );
    `;

    await expect(pool.query(insertSql, [testOrgId, testProjId])).rejects.toThrowError(
      /check_container_runtime_fields/
    );
  });

  it('allows edge service (Cloudflare Workers) with NULL container columns', async () => {
    const insertSql = `
      INSERT INTO services (
        organization_id, project_id, name, slug, repository_name,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, container_port, cpu_units, memory_mb, config
      ) VALUES (
        $1, $2, 'Valid Edge Worker', 'valid-edge-worker', 'acme/edge',
        'cloudflare_workers', 'cloudflare_worker_bundle', 'worker_bundle', 'v8_isolate',
        NULL, NULL, NULL, NULL, '{"compatibilityDate": "2024-11-01"}'::jsonb
      ) RETURNING id;
    `;

    const result = await pool.query(insertSql, [testOrgId, testProjId]);
    expect(result.rows[0].id).toBeDefined();
  });

  it('allows valid container service when all container columns are supplied', async () => {
    const insertSql = `
      INSERT INTO services (
        organization_id, project_id, name, slug, repository_name,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, container_port, cpu_units, memory_mb
      ) VALUES (
        $1, $2, 'Valid ECS Service', 'valid-ecs-srv', 'acme/api',
        'aws_ecs', 'dockerfile', 'oci_image', 'container',
        'Dockerfile', 8080, 512, 1024
      ) RETURNING id;
    `;

    const result = await pool.query(insertSql, [testOrgId, testProjId]);
    expect(result.rows[0].id).toBeDefined();
  });
});
