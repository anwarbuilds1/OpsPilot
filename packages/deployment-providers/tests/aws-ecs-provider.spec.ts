import { describe, expect, it } from 'vitest';
import { AwsEcsDeploymentConfig, TargetProviders } from '@opspilot/domain';
import { AwsEcsProvider } from '../src/index.js';

describe('AwsEcsProvider', () => {
  const provider = new AwsEcsProvider();

  const validConfig: AwsEcsDeploymentConfig = {
    deploymentId: '11111111-1111-1111-1111-111111111111',
    organizationId: '22222222-2222-2222-2222-222222222222',
    projectId: '33333333-3333-3333-3333-333333333333',
    serviceId: '44444444-4444-4444-4444-444444444444',
    deploymentTargetId: '55555555-5555-5555-5555-555555555555',
    targetProvider: TargetProviders.AWS_ECS,
    buildStrategy: 'dockerfile',
    artifactType: 'oci_image',
    applicationRuntime: 'container',
    environment: 'production',
    commitSha: 'a'.repeat(40),
    branch: 'main',
    healthcheckPath: '/health',
    imageUri: '123456789012.dkr.ecr.us-east-1.amazonaws.com/payments:latest',
    dockerfilePath: 'Dockerfile',
    buildContext: '.',
    containerPort: 8080,
    cpuUnits: 512,
    memoryMb: 1024,
    clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/prod',
    taskFamily: 'payments-api',
    environmentVariables: { NODE_ENV: 'production' },
    secrets: { DB_PASS: 'secret' },
  };

  it('validates connection successfully with valid IAM role', async () => {
    const result = await provider.validateConnection(
      { roleArn: 'arn:aws:iam::123456789012:role/OpsPilotExecutionRole' },
      { clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/prod' }
    );
    expect(result.connected).toBe(true);
    expect(result.providerVersion).toContain('Amazon ECS');
  });

  it('fails connection validation with invalid role', async () => {
    const result = await provider.validateConnection({ roleArn: 'invalid-role' });
    expect(result.connected).toBe(false);
    expect(result.error).toContain('Invalid AWS IAM role ARN');
  });

  it('prepares ECS deployment and produces Task Definition target artifact', async () => {
    const prepared = await provider.prepareDeployment(validConfig);
    expect(prepared.targetProvider).toBe(TargetProviders.AWS_ECS);
    expect(prepared.targetArtifactId).toContain('task-definition');
    expect(prepared.artifact.artifactReference).toBe(validConfig.imageUri);
  });

  it('deploys prepared ECS deployment and returns external deployment ID', async () => {
    const prepared = await provider.prepareDeployment(validConfig);
    const result = await provider.deploy(prepared, { roleArn: 'arn:aws:iam::role' });

    expect(result.success).toBe(true);
    expect(result.status).toBe('Deploying');
    expect(result.providerDeploymentId).toBeDefined();
    expect(result.versionIdentifier).toBe(prepared.targetArtifactId);
  });

  it('executes rollback to previous Task Definition ARN', async () => {
    const prevTaskDef = 'arn:aws:ecs:us-east-1:123456789012:task-definition/payments-api:41';
    const rollback = await provider.rollback(validConfig.deploymentId, prevTaskDef, {});

    expect(rollback.success).toBe(true);
    expect(rollback.restoredArtifactId).toBe(prevTaskDef);
  });

  it('checks service health via target URL', async () => {
    const healthy = await provider.checkHealth('http://payments.internal/health');
    expect(healthy.isHealthy).toBe(true);

    const unhealthy = await provider.checkHealth('http://unhealthy-service.internal/health');
    expect(unhealthy.isHealthy).toBe(false);
    expect(unhealthy.httpStatusCode).toBe(503);
  });
});
