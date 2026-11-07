import { describe, expect, it } from 'vitest';
import { TargetProviders, VpsDockerDeploymentConfig } from '@opspilot/domain';
import { VpsDockerProvider } from '../src/index.js';

describe('VpsDockerProvider', () => {
  const provider = new VpsDockerProvider();

  const validConfig: VpsDockerDeploymentConfig = {
    deploymentId: '11111111-1111-1111-1111-111111111111',
    organizationId: '22222222-2222-2222-2222-222222222222',
    projectId: '33333333-3333-3333-3333-333333333333',
    serviceId: '44444444-4444-4444-4444-444444444444',
    deploymentTargetId: '55555555-5555-5555-5555-555555555555',
    targetProvider: TargetProviders.VPS_DOCKER,
    buildStrategy: 'dockerfile',
    artifactType: 'oci_image',
    applicationRuntime: 'container',
    environment: 'production',
    commitSha: 'b'.repeat(40),
    branch: 'main',
    healthcheckPath: '/health',
    imageUri: 'registry.internal/acme/app:v1.2.0',
    dockerfilePath: 'Dockerfile',
    buildContext: '.',
    containerPort: 3000,
    cpuUnits: 1024,
    memoryMb: 2048,
    hostIp: '192.168.1.100',
    sshPort: 22,
    composeFilePath: 'docker-compose.yml',
    environmentVariables: { PORT: '3000' },
    secrets: { API_KEY: 'secret' },
  };

  it('validates connection successfully with valid SSH key', async () => {
    const result = await provider.validateConnection(
      { sshPrivateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nvalid\n-----END OPENSSH PRIVATE KEY-----' },
      { hostIp: '192.168.1.100', sshPort: 22 }
    );
    expect(result.connected).toBe(true);
    expect(result.providerVersion).toContain('Docker Engine');
  });

  it('fails connection validation with invalid SSH key', async () => {
    const result = await provider.validateConnection(
      { sshPrivateKey: 'invalid-key' },
      { hostIp: '192.168.1.100' }
    );
    expect(result.connected).toBe(false);
  });

  it('prepares VPS deployment and generates docker-compose manifest', async () => {
    const prepared = await provider.prepareDeployment(validConfig);
    expect(prepared.targetProvider).toBe(TargetProviders.VPS_DOCKER);
    expect(prepared.targetArtifactId).toContain('docker-compose');
    expect(prepared.providerMetadata['composeContent']).toContain('image: registry.internal/acme/app:v1.2.0');
    expect(prepared.providerMetadata['composeContent']).toContain('"3000:3000"');
  });

  it('executes deployment via SSH command execution', async () => {
    const prepared = await provider.prepareDeployment(validConfig);
    const result = await provider.deploy(prepared, {
      sshPrivateKey: 'valid-ssh-key',
    });

    expect(result.success).toBe(true);
    expect(result.versionIdentifier).toBe(prepared.targetArtifactId);
  });

  it('executes rollback to previous docker-compose artifact', async () => {
    const prevCompose = '/etc/opspilot/srv-1/docker-compose.previous.yml';
    const rollback = await provider.rollback(validConfig.deploymentId, prevCompose, {
      sshPrivateKey: 'valid-ssh-key',
    });

    expect(rollback.success).toBe(true);
    expect(rollback.restoredArtifactId).toBe(prevCompose);
  });
});
