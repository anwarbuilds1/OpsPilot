import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DeploymentStatuses,
  InvalidStateTransitionException,
  TargetProviders,
} from '@opspilot/domain';
import {
  createDatabasePool,
  DeploymentsRepository,
  ServicesRepository,
} from '../src/index.js';
import { ensureDatabaseMigrated } from './test-helper.js';

describe('DeploymentsRepository & State Transition Idempotency', () => {
  const pool = createDatabasePool();
  const deploymentsRepo = new DeploymentsRepository(pool);
  const servicesRepo = new ServicesRepository(pool);

  const orgA = 'c0000000-0000-0000-0000-000000000001';
  const orgB = 'c0000000-0000-0000-0000-000000000002';
  const projA = 'd0000000-0000-0000-0000-000000000001';
  const srvA = 'e0000000-0000-0000-0000-000000000001';
  const tgtA = 'f0000000-0000-0000-0000-000000000001';
  const depId = '01000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await ensureDatabaseMigrated(pool);

    // Seed Org A
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Org A', 'org-a') ON CONFLICT DO NOTHING;`, [orgA]);
    // Seed Org B
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'Org B', 'org-b') ON CONFLICT DO NOTHING;`, [orgB]);

    // Seed Project A under Org A
    await pool.query(`INSERT INTO projects (id, organization_id, name, slug) VALUES ($1, $2, 'Proj A', 'proj-a') ON CONFLICT DO NOTHING;`, [projA, orgA]);

    // Seed Service A under Org A
    await servicesRepo.create({
      id: srvA,
      organizationId: orgA,
      projectId: projA,
      name: 'Service A',
      slug: 'service-a',
      repositoryName: 'acme/srv-a',
      targetProvider: TargetProviders.AWS_ECS,
      buildStrategy: 'dockerfile',
      artifactType: 'oci_image',
      applicationRuntime: 'container',
      dockerfilePath: 'Dockerfile',
      containerPort: 8080,
      cpuUnits: 512,
      memoryMb: 1024,
    });

    // Seed Deployment Target A under Org A
    await pool.query(`
      INSERT INTO deployment_targets (id, organization_id, name, provider, configuration)
      VALUES ($1, $2, 'Target A', 'aws_ecs', '{"cluster": "prod"}'::jsonb)
      ON CONFLICT DO NOTHING;
    `, [tgtA, orgA]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgA, orgB]);
    await pool.end();
  });

  it('creates a new deployment with status Queued', async () => {
    const deployment = await deploymentsRepo.create({
      id: depId,
      organizationId: orgA,
      projectId: projA,
      serviceId: srvA,
      deploymentTargetId: tgtA,
      targetProvider: TargetProviders.AWS_ECS,
      environment: 'production',
      commitSha: 'a'.repeat(40),
      commitMessage: 'Initial release',
      status: DeploymentStatuses.QUEUED,
    });

    expect(deployment.id).toBe(depId);
    expect(deployment.status).toBe(DeploymentStatuses.QUEUED);
    expect(deployment.organizationId).toBe(orgA);
  });

  it('atomically transitions status from Queued to Preparing', async () => {
    const updated = await deploymentsRepo.transitionStatus(
      depId,
      orgA,
      DeploymentStatuses.QUEUED,
      DeploymentStatuses.PREPARING
    );

    expect(updated).not.toBeNull();
    expect(updated?.status).toBe(DeploymentStatuses.PREPARING);
    expect(updated?.startedAt).toBeDefined();
  });

  it('prevents race conditions: duplicate transition from Queued returns null', async () => {
    // Current status is now Preparing. Trying to transition from Queued again must return null!
    const duplicateAttempt = await deploymentsRepo.transitionStatus(
      depId,
      orgA,
      DeploymentStatuses.QUEUED,
      DeploymentStatuses.PREPARING
    );

    expect(duplicateAttempt).toBeNull();
  });

  it('enforces state machine validation: rejects illegal jump from Preparing to Succeeded', async () => {
    await expect(
      deploymentsRepo.transitionStatus(
        depId,
        orgA,
        DeploymentStatuses.PREPARING,
        DeploymentStatuses.SUCCEEDED
      )
    ).rejects.toThrow(InvalidStateTransitionException);
  });

  it('enforces tenant boundary: finding deployment with Org B returns null', async () => {
    const crossTenantSearch = await deploymentsRepo.findById(depId, orgB);
    expect(crossTenantSearch).toBeNull();
  });

  it('enforces tenant boundary: updating deployment with Org B returns null', async () => {
    const crossTenantUpdate = await deploymentsRepo.transitionStatus(
      depId,
      orgB,
      DeploymentStatuses.PREPARING,
      DeploymentStatuses.BUILDING
    );
    expect(crossTenantUpdate).toBeNull();
  });

  it('progresses through Building -> Publishing -> Deploying -> HealthChecking -> Succeeded', async () => {
    const building = await deploymentsRepo.transitionStatus(depId, orgA, DeploymentStatuses.PREPARING, DeploymentStatuses.BUILDING);
    expect(building?.status).toBe(DeploymentStatuses.BUILDING);

    const publishing = await deploymentsRepo.transitionStatus(depId, orgA, DeploymentStatuses.BUILDING, DeploymentStatuses.PUBLISHING);
    expect(publishing?.status).toBe(DeploymentStatuses.PUBLISHING);

    const deploying = await deploymentsRepo.transitionStatus(depId, orgA, DeploymentStatuses.PUBLISHING, DeploymentStatuses.DEPLOYING);
    expect(deploying?.status).toBe(DeploymentStatuses.DEPLOYING);

    const healthChecking = await deploymentsRepo.transitionStatus(depId, orgA, DeploymentStatuses.DEPLOYING, DeploymentStatuses.HEALTH_CHECKING);
    expect(healthChecking?.status).toBe(DeploymentStatuses.HEALTH_CHECKING);

    const succeeded = await deploymentsRepo.transitionStatus(depId, orgA, DeploymentStatuses.HEALTH_CHECKING, DeploymentStatuses.SUCCEEDED);
    expect(succeeded?.status).toBe(DeploymentStatuses.SUCCEEDED);
    expect(succeeded?.completedAt).toBeDefined();
  });

  it('records chronological deployment events', async () => {
    await deploymentsRepo.recordEvent(orgA, depId, 'Building', 'Docker compilation completed in 42s', 'INFO');
    const result = await pool.query('SELECT * FROM deployment_events WHERE deployment_id = $1', [depId]);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows[0].stage).toBe('Building');
  });
});
