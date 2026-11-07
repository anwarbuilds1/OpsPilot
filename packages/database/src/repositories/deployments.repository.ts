import { Pool } from 'pg';
import {
  Deployment,
  DeploymentEnvironment,
  DeploymentProps,
  DeploymentStatus,
  DeploymentStateMachine,
  TargetProvider,
} from '@opspilot/domain';

export class DeploymentsRepository {
  constructor(private readonly pool: Pool) {}

  async create(props: DeploymentProps): Promise<Deployment> {
    const query = `
      INSERT INTO deployments (
        id, organization_id, project_id, service_id, deployment_target_id,
        provider, environment, commit_sha, commit_message, commit_author,
        image_uri, artifact_reference, status, failure_reason, started_at, completed_at, triggered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;

    const values = [
      props.id,
      props.organizationId,
      props.projectId,
      props.serviceId,
      props.deploymentTargetId,
      props.targetProvider,
      props.environment,
      props.commitSha,
      props.commitMessage ?? null,
      props.commitAuthor ?? null,
      props.imageUri ?? null,
      props.artifactReference ?? null,
      props.status ?? 'Queued',
      props.failureReason ?? null,
      props.startedAt ?? null,
      props.completedAt ?? null,
      props.triggeredBy ?? null,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToDeployment(result.rows[0]);
  }

  async findById(id: string, organizationId: string): Promise<Deployment | null> {
    const query = `
      SELECT * FROM deployments 
      WHERE id = $1 AND organization_id = $2;
    `;
    const result = await this.pool.query(query, [id, organizationId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToDeployment(result.rows[0]);
  }

  /**
   * Idempotently transitions deployment status using atomic conditional UPDATE.
   * If another worker already updated the status, returns null.
   */
  async transitionStatus(
    deploymentId: string,
    organizationId: string,
    fromStatus: DeploymentStatus,
    toStatus: DeploymentStatus,
    failureReason?: string
  ): Promise<Deployment | null> {
    DeploymentStateMachine.validateTransition(fromStatus, toStatus);

    const query = `
      UPDATE deployments
      SET 
        status = $1::deployment_status,
        failure_reason = COALESCE($2, failure_reason),
        updated_at = NOW(),
        started_at = CASE WHEN $1::text = 'Preparing' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN $1::text IN ('Succeeded', 'Failed', 'RolledBack', 'Cancelled') THEN NOW() ELSE completed_at END
      WHERE id = $3 AND organization_id = $4 AND status = $5::deployment_status
      RETURNING *;
    `;

    const result = await this.pool.query(query, [
      toStatus,
      failureReason ?? null,
      deploymentId,
      organizationId,
      fromStatus,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDeployment(result.rows[0]);
  }

  async recordEvent(
    organizationId: string,
    deploymentId: string,
    stage: string,
    message: string,
    level: string = 'INFO'
  ): Promise<void> {
    const query = `
      INSERT INTO deployment_events (organization_id, deployment_id, stage, message, level)
      VALUES ($1, $2, $3, $4, $5);
    `;
    await this.pool.query(query, [organizationId, deploymentId, stage, message, level]);
  }

  private mapRowToDeployment(row: Record<string, unknown>): Deployment {
    return new Deployment({
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      projectId: row['project_id'] as string,
      serviceId: row['service_id'] as string,
      deploymentTargetId: row['deployment_target_id'] as string,
      targetProvider: row['provider'] as TargetProvider,
      environment: row['environment'] as DeploymentEnvironment,
      commitSha: row['commit_sha'] as string,
      commitMessage: row['commit_message'] as string | undefined,
      commitAuthor: row['commit_author'] as string | undefined,
      imageUri: row['image_uri'] as string | undefined,
      artifactReference: row['artifact_reference'] as string | undefined,
      status: row['status'] as DeploymentStatus,
      failureReason: row['failure_reason'] as string | undefined,
      startedAt: row['started_at'] ? new Date(row['started_at'] as string) : undefined,
      completedAt: row['completed_at'] ? new Date(row['completed_at'] as string) : undefined,
      triggeredBy: row['triggered_by'] as string | undefined,
      createdAt: new Date(row['created_at'] as string),
    });
  }
}
