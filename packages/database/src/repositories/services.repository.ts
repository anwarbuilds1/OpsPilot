import { Pool } from 'pg';
import {
  ApplicationRuntime,
  ArtifactType,
  BuildStrategy,
  Service,
  ServiceProps,
  TargetProvider,
} from '@opspilot/domain';

export class ServicesRepository {
  constructor(private readonly pool: Pool) {}

  async create(props: ServiceProps): Promise<Service> {
    const domainService = new Service(props);

    const query = `
      INSERT INTO services (
        id, organization_id, project_id, name, slug, repository_name, branch,
        target_provider, build_strategy, artifact_type, application_runtime,
        dockerfile_path, build_context, container_port, healthcheck_path,
        cpu_units, memory_mb, config, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *;
    `;

    const values = [
      domainService.id,
      domainService.organizationId,
      domainService.projectId,
      domainService.name,
      domainService.slug,
      domainService.repositoryName,
      domainService.branch,
      domainService.targetProvider,
      domainService.buildStrategy,
      domainService.artifactType,
      domainService.applicationRuntime,
      domainService.dockerfilePath ?? null,
      domainService.buildContext,
      domainService.containerPort ?? null,
      domainService.healthcheckPath,
      domainService.cpuUnits ?? null,
      domainService.memoryMb ?? null,
      JSON.stringify(domainService.config),
      domainService.isActive,
    ];

    const result = await this.pool.query(query, values);
    return this.mapRowToService(result.rows[0]);
  }

  async findById(id: string, organizationId: string): Promise<Service | null> {
    const query = `
      SELECT * FROM services 
      WHERE id = $1 AND organization_id = $2;
    `;
    const result = await this.pool.query(query, [id, organizationId]);
    if (result.rows.length === 0) {
      return null;
    }
    return this.mapRowToService(result.rows[0]);
  }

  async listByProject(projectId: string, organizationId: string): Promise<Service[]> {
    const query = `
      SELECT * FROM services 
      WHERE project_id = $1 AND organization_id = $2
      ORDER BY created_at DESC;
    `;
    const result = await this.pool.query(query, [projectId, organizationId]);
    return result.rows.map((row) => this.mapRowToService(row));
  }

  private mapRowToService(row: Record<string, unknown>): Service {
    return new Service({
      id: row['id'] as string,
      organizationId: row['organization_id'] as string,
      projectId: row['project_id'] as string,
      name: row['name'] as string,
      slug: row['slug'] as string,
      repositoryName: row['repository_name'] as string,
      branch: row['branch'] as string,
      targetProvider: row['target_provider'] as TargetProvider,
      buildStrategy: row['build_strategy'] as BuildStrategy,
      artifactType: row['artifact_type'] as ArtifactType,
      applicationRuntime: row['application_runtime'] as ApplicationRuntime,
      dockerfilePath: (row['dockerfile_path'] as string) || undefined,
      buildContext: row['build_context'] as string,
      containerPort: (row['container_port'] as number) || undefined,
      healthcheckPath: row['healthcheck_path'] as string,
      cpuUnits: (row['cpu_units'] as number) || undefined,
      memoryMb: (row['memory_mb'] as number) || undefined,
      config: typeof row['config'] === 'string' ? JSON.parse(row['config']) : (row['config'] as Record<string, unknown>),
      isActive: row['is_active'] as boolean,
      createdAt: new Date(row['created_at'] as string),
      updatedAt: new Date(row['updated_at'] as string),
    });
  }
}
