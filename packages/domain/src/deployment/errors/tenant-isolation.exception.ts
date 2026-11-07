import { DomainException } from './domain.exception.js';

export class TenantIsolationException extends DomainException {
  constructor(message: string, expectedOrgId: string, actualOrgId?: string) {
    super(message, 'TENANT_ISOLATION_VIOLATION', { expectedOrgId, actualOrgId });
  }
}
