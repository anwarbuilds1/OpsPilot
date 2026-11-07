import { DomainException } from './domain.exception.js';

export class ConfigurationValidationException extends DomainException {
  readonly field?: string;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_VALIDATION_FAILED', { field, ...context });
    this.field = field;
  }
}
