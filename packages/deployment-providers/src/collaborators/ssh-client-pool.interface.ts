export interface SshCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

export interface ISshClientPool {
  executeCommand(
    hostIp: string,
    port: number,
    user: string,
    command: string,
    privateKey: string
  ): Promise<SshCommandResult>;

  testConnection(
    hostIp: string,
    port: number,
    user: string,
    privateKey: string
  ): Promise<boolean>;
}

export class MockSshClientPool implements ISshClientPool {
  async executeCommand(
    _hostIp: string,
    _port: number,
    _user: string,
    command: string,
    privateKey: string
  ): Promise<SshCommandResult> {
    if (!privateKey || privateKey.includes('invalid')) {
      return { stdout: '', stderr: 'Permission denied (publickey)', exitCode: 255 };
    }
    if (command.includes('docker compose ps')) {
      return { stdout: 'payments-api running 8080/tcp', stderr: '', exitCode: 0 };
    }
    return { stdout: 'Command executed successfully', stderr: '', exitCode: 0 };
  }

  async testConnection(
    _hostIp: string,
    _port: number,
    _user: string,
    privateKey: string
  ): Promise<boolean> {
    return !!privateKey && !privateKey.includes('invalid');
  }
}
