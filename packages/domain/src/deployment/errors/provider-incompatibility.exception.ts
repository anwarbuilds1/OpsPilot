import { TargetProvider } from '../enums/target-provider.enum.js';
import { DomainException } from './domain.exception.js';

export class ProviderIncompatibilityException extends DomainException {
  constructor(provider: TargetProvider, reason: string) {
    super(`Provider '${provider}' cannot execute requested operation: ${reason}`, 'PROVIDER_INCOMPATIBILITY', {
      provider,
      reason,
    });
  }
}
