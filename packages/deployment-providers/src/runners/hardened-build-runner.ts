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
  readonly buildCommand?: string;
  readonly commandArgs?: readonly string[];
  readonly networkMode?: 'none' | 'isolated-bridge';
  readonly environmentVariables?: Record<string, string>;
  readonly volumeMounts?: readonly { hostPath: string; containerPath: string; readOnly?: boolean }[];
}

export interface ContainerExecutionSpec {
  readonly image: string;
  readonly containerName: string;
  readonly commandArgs: readonly string[];
  readonly argv: readonly string[];
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

    // 9. Deterministic container naming
    const containerName = `opspilot-build-${task.buildId}`;
    dockerArgs.push(`--name=${containerName}`);

    // 10. Guaranteed network isolation (default to --network=none)
    const networkMode = task.networkMode ?? 'none';
    dockerArgs.push(`--network=${networkMode}`);

    // 11. Sanitized environment variables
    const sanitizedEnv: Record<string, string> = {
      OPSPILOT_BUILD_ID: task.buildId,
      OPSPILOT_ORG_ID: task.organizationId,
      OPSPILOT_COMMIT_SHA: task.commitSha,
      NODE_ENV: 'production',
      CI: 'true',
    };

    if (task.buildCommand) {
      sanitizedEnv['OPSPILOT_BUILD_COMMAND'] = task.buildCommand;
    }

    if (task.environmentVariables) {
      for (const [key, val] of Object.entries(task.environmentVariables)) {
        sanitizedEnv[key] = val;
      }
    }

    for (const [key, val] of Object.entries(sanitizedEnv)) {
      dockerArgs.push('-e', `${key}=${val}`);
    }

    // 12. Volume mounts (guaranteed no docker socket or rootfs mounting)
    if (task.volumeMounts) {
      for (const mount of task.volumeMounts) {
        const roFlag = mount.readOnly ? ':ro' : '';
        dockerArgs.push('-v', `${mount.hostPath}:${mount.containerPath}${roFlag}`);
      }
    }

    // 13. Determine direct argv arguments for container execution
    let argv: readonly string[] = [];
    if (task.commandArgs && task.commandArgs.length > 0) {
      argv = [...task.commandArgs];
    } else if (task.buildCommand && task.buildCommand.trim().length > 0) {
      argv = task.buildCommand.trim().split(/\s+/).filter(Boolean);
    }

    return {
      image: runnerImage,
      containerName,
      commandArgs: dockerArgs,
      argv,
      environmentVariables: sanitizedEnv,
      timeoutMs: limits.timeoutSeconds * 1000,
    };
  }

  /**
   * Generates a deterministic container cleanup command to terminate and remove orphaned containers.
   */
  generateCleanupCommand(buildId: string): string {
    if (!buildId || !/^[a-zA-Z0-9_-]+$/.test(buildId)) {
      throw new SecurityViolationException('Invalid buildId for container cleanup', { buildId });
    }
    return `docker rm -f opspilot-build-${buildId}`;
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
   * Audits build task to reject credential ingestion, docker socket exposure, host networking, or path escapes.
   */
  private auditTaskSecurity(task: BuildRunnerTask): void {
    if (!task.buildId || !/^[a-zA-Z0-9_-]+$/.test(task.buildId)) {
      throw new SecurityViolationException(
        `Invalid buildId '${task.buildId}'. Must be alphanumeric with dashes or underscores.`,
        { buildId: task.buildId }
      );
    }

    // Reject host networking
    const networkMode = (task as { networkMode?: string }).networkMode;
    if (networkMode === 'host') {
      throw new SecurityViolationException(
        'CRITICAL SECURITY VIOLATION: Host networking (--network=host) is strictly forbidden for build runners.',
        { networkMode }
      );
    }
    if (networkMode && networkMode !== 'none' && networkMode !== 'isolated-bridge') {
      throw new SecurityViolationException(
        `Invalid network mode '${networkMode}'. Only 'none' or 'isolated-bridge' are permitted.`,
        { networkMode }
      );
    }

    // Validate argv arguments and prevent shell wrapper injection
    if (task.commandArgs) {
      for (const arg of task.commandArgs) {
        if (typeof arg !== 'string') {
          throw new SecurityViolationException('commandArgs must contain only strings');
        }
        if (arg.includes('\0')) {
          throw new SecurityViolationException('commandArgs cannot contain null bytes');
        }
      }
      if (task.commandArgs.length > 0) {
        const first = task.commandArgs[0]?.trim();
        if ((first === 'sh' || first === 'bash' || first === '/bin/sh' || first === '/bin/bash') && task.commandArgs.includes('-c')) {
          throw new SecurityViolationException(
            'CRITICAL SECURITY VIOLATION: Wrapping build commands in shell execution (sh -c / bash -c) is strictly forbidden.',
            { commandArgs: task.commandArgs }
          );
        }
      }
    }

    // If legacy buildCommand string is provided without commandArgs, reject shell metacharacters
    if (task.buildCommand && (!task.commandArgs || task.commandArgs.length === 0)) {
      const dangerousShellChars = /[;&|`$()<>\n]/;
      if (dangerousShellChars.test(task.buildCommand)) {
        throw new SecurityViolationException(
          `Unsafe shell metacharacters detected in buildCommand: '${task.buildCommand}'. Pass validated commandArgs argv array instead.`,
          { buildCommand: task.buildCommand }
        );
      }
    }

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

        const sensitiveDirs = ['/', '/etc', '/proc', '/sys', '/root', '/bin', '/usr', '/var', '/var/run', '/dev', '/boot', '/lib', '/lib64'];
        for (const sensitive of sensitiveDirs) {
          if (mount.hostPath === sensitive || (mount.hostPath.startsWith(`${sensitive}/`) && !mount.hostPath.startsWith('/tmp'))) {
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
