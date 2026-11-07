export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, trace?: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements ILogger {
  constructor(private readonly prefix: string = 'DeploymentProvider') {}

  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[${this.prefix}] [DEBUG] ${message}`, context ?? '');
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[${this.prefix}] [INFO] ${message}`, context ?? '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.prefix}] [WARN] ${message}`, context ?? '');
  }

  error(message: string, trace?: string, context?: Record<string, unknown>): void {
    console.error(`[${this.prefix}] [ERROR] ${message}`, trace ?? '', context ?? '');
  }
}
