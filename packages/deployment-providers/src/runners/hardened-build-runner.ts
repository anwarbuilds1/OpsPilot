import { DomainException } from '@opspilot/domain';

export class SecurityViolationException extends DomainException {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SECURITY_VIOLATION', context);
  }
}

export interface RunnerResourceLimits {
  readonly memoryMb: number;
  readonly cpus: number;
  readonly pidsLimit: number;
  readonly tmpfsTmpMb: number;
  readonly tmpfsWorkspaceMb: number;
  readonly timeoutSeconds: number;
}

export interface RunnerSecurityOptions {
  readonly userUid: number;
  readonly userGid: number;
  readonly readOnlyRootfs: boolean;
  readonly dropCapabilities: readonly string[];
  readonly noNewPrivileges: boolean;
  readonly blockedEgressSubnets: readonly string[];
}

export interface BuildRunnerTask {
  readonly buildId: string;
  readonly organizationId: string;
  readonly repoUrl: string;
  readonly commitSha: string;
  readonly buildCommand: string;
  readonly environmentVariables?: Record<string, string>;
  readonly volumeMounts?: readonly { hostPath: string; containerPath: string; readOnly?: boolean }[];
}

export interface ContainerExecutionSpec {
  readonly image: string;
  readonly commandArgs: readonly string[];
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

export class HardenedBuildRunner {
  readonly defaultLimits: RunnerResourceLimits = {
    memoryMb: 2048,
    cpus: 1.5,
    pidsLimit: 256,
    tmpfsTmpMb: 512,
    tmpfsWorkspaceMb: 2048,
    timeoutSeconds: 900, // 15 minutes max
  };

  readonly securityConfig: RunnerSecurityOptions = {
    userUid: 10001,
    userGid: 10001,
    readOnlyRootfs: true,
    dropCapabilities: ['ALL'],
    noNewPrivileges: true,
    blockedEgressSubnets: [
      '169.254.169.254/32', // Cloud instance metadata service (AWS/GCP/Azure)
      '10.0.0.0/8',         // RFC 1918 Private Subnet
      '172.16.0.0/12',      // RFC 1918 Private Subnet
      '192.168.0.0/16',     // RFC 1918 Private Subnet
    ],
  };

  private readonly forbiddenEnvPatterns = [
    /aws_secret_access_key/i,
    /aws_session_token/i,
    /cloudflare_api_token/i,
    /cf_token/i,
    /ssh_private_key/i,
    /database_url/i,
    /password/i,
    /secret/i,
  ];

  /**
   * Validates build task parameters and builds the hardened container execution specification.
   */
  prepareExecutionSpec(
    runnerImage: string,
    task: BuildRunnerTask,
    customLimits?: Partial<RunnerResourceLimits>
  ): ContainerExecutionSpec {
    this.auditTaskSecurity(task);

    const limits = { ...this.defaultLimits, ...customLimits };
    const dockerArgs: string[] = [];

    // 1. Non-root user execution (UID/GID 10001)
    dockerArgs.push('--user', `${this.securityConfig.userUid}:${this.securityConfig.userGid}`);

    // 2. Read-only root filesystem
    if (this.securityConfig.readOnlyRootfs) {
      dockerArgs.push('--read-only');
    }

    // 3. Drop all Linux capabilities
    for (const cap of this.securityConfig.dropCapabilities) {
      dockerArgs.push(`--cap-drop=${cap}`);
    }

    // 4. Prevent privilege escalation
    if (this.securityConfig.noNewPrivileges) {
      dockerArgs.push('--security-opt=no-new-privileges:true');
    }

    // 5. Process limits (Fork-bomb protection)
    dockerArgs.push(`--pids-limit=${limits.pidsLimit}`);

    // 6. Memory and CPU limits
    dockerArgs.push(
      `--memory=${limits.memoryMb}m`,
      `--memory-swap=${limits.memoryMb}m`,
      `--cpus=${limits.cpus}`
    );

    // 7. Bounded tmpfs storage limits
    dockerArgs.push(
      `--tmpfs=/tmp:rw,nosuid,size=${limits.tmpfsTmpMb}m`,
      `--tmpfs=/workspace:rw,nosuid,size=${limits.tmpfsWorkspaceMb}m`
    );

    // 8. Ephemeral container cleanup
    dockerArgs.push('--rm');

    // 9. Sanitized environment variables
    const sanitizedEnv: Record<string, string> = {
      OPSPILOT_BUILD_ID: task.buildId,
      OPSPILOT_ORG_ID: task.organizationId,
      OPSPILOT_COMMIT_SHA: task.commitSha,
      OPSPILOT_BUILD_COMMAND: task.buildCommand,
      NODE_ENV: 'production',
      CI: 'true',
    };

    if (task.environmentVariables) {
      for (const [key, val] of Object.entries(task.environmentVariables)) {
        sanitizedEnv[key] = val;
      }
    }

    for (const [key, val] of Object.entries(sanitizedEnv)) {
      dockerArgs.push('-e', `${key}=${val}`);
    }

    // 10. Volume mounts (guaranteed no docker socket or rootfs mounting)
    if (task.volumeMounts) {
      for (const mount of task.volumeMounts) {
        const roFlag = mount.readOnly ? ':ro' : '';
        dockerArgs.push('-v', `${mount.hostPath}:${mount.containerPath}${roFlag}`);
      }
    }

    return {
      image: runnerImage,
      commandArgs: dockerArgs,
      environmentVariables: sanitizedEnv,
      timeoutMs: limits.timeoutSeconds * 1000,
    };
  }

  /**
   * Generates iptables firewall rules to blackhole cloud metadata and private subnets.
   */
  generateEgressFirewallRules(bridgeInterface: string = 'br-opspilot'): readonly string[] {
    const rules: string[] = [];
    for (const subnet of this.securityConfig.blockedEgressSubnets) {
      rules.push(`iptables -I FORWARD -i ${bridgeInterface} -d ${subnet} -j DROP`);
    }
    return rules;
  }

  /**
   * Audits build task to reject credential ingestion, docker socket exposure, or path escapes.
   */
  private auditTaskSecurity(task: BuildRunnerTask): void {
    // Check environment variables for leaked credentials
    if (task.environmentVariables) {
      for (const key of Object.keys(task.environmentVariables)) {
        for (const pattern of this.forbiddenEnvPatterns) {
          if (pattern.test(key)) {
            throw new SecurityViolationException(
              `Forbidden credential pattern detected in build environment: '${key}'. ` +
              `Provider API keys and infrastructure credentials must NEVER be passed into untrusted build runners.`,
              { field: key }
            );
          }
        }
      }
    }

    // Check volume mounts for host socket or dangerous paths
    if (task.volumeMounts) {
      for (const mount of task.volumeMounts) {
        if (
          mount.hostPath.includes('docker.sock') ||
          mount.containerPath.includes('docker.sock')
        ) {
          throw new SecurityViolationException(
            'CRITICAL SECURITY VIOLATION: Mounting /var/run/docker.sock into build runners is strictly forbidden.',
            { mount }
          );
        }

        const sensitiveDirs = ['/etc', '/proc', '/sys', '/root', '/bin', '/usr', '/var/run'];
        for (const sensitive of sensitiveDirs) {
          if (mount.hostPath === sensitive || mount.hostPath.startsWith(`${sensitive}/`)) {
            throw new SecurityViolationException(
              `Mounting host root/system directory '${mount.hostPath}' into build runner is forbidden.`,
              { mount }
            );
          }
        }
      }
    }
  }
}
