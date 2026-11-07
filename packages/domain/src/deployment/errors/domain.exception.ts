export interface DomainExceptionDetails {
  readonly code: string;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export abstract class DomainException extends Error {
  readonly code: string;
  readonly context?: Readonly<Record<string, unknown>>;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context ? Object.freeze({ ...context }) : undefined;
    const capture = (Error as unknown as { captureStackTrace?: (target: object, constructorOpt?: Function) => void }).captureStackTrace;
    capture?.(this, this.constructor);
  }
}
