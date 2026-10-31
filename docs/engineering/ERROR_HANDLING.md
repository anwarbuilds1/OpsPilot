# Error Handling Standards & Exception Hierarchy

> **Status:** Mandatory Engineering Standard  
> **Framework:** NestJS / TypeScript

This document establishes the error handling architecture for OpsPilot across API controllers, domain services, and BullMQ worker processes.

---

## 1. Exception Hierarchy

All application errors must inherit from the base `DomainException`:

```typescript
export abstract class DomainException extends Error {
  public abstract readonly code: string;
  public abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown> | Array<unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common Domain Exceptions:
export class ResourceNotFoundException extends DomainException {
  public readonly code = 'RESOURCE_NOT_FOUND';
  public readonly statusCode = 404;
}

export class TenantAccessDeniedException extends DomainException {
  public readonly code = 'TENANT_ACCESS_DENIED';
  public readonly statusCode = 403;
}

export class InvalidStateTransitionException extends DomainException {
  public readonly code = 'INVALID_STATE_TRANSITION';
  public readonly statusCode = 409;
}

export class ProviderConnectionException extends DomainException {
  public readonly code = 'PROVIDER_CONNECTION_FAILED';
  public readonly statusCode = 502;
}

export class RateLimitExceededException extends DomainException {
  public readonly code = 'RATE_LIMIT_EXCEEDED';
  public readonly statusCode = 429;
}
```

---

## 2. Global Exception Filter

In NestJS, a global `DomainExceptionFilter` intercepts all thrown exceptions and transforms them into the standardized [API Error Contract](API_ERROR_CONTRACT.md):

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let statusCode = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal error occurred';
    let details: unknown = undefined;

    if (exception instanceof DomainException) {
      statusCode = exception.statusCode;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = 'HTTP_EXCEPTION';
      message = exception.message;
    } else {
      // Unhandled fatal exception: Log detailed stack trace internally
      this.logger.error(`Unhandled Exception at ${request.url}`, (exception as Error)?.stack);
    }

    response.status(statusCode).send({
      statusCode,
      error: HttpStatus[statusCode] || 'Unknown',
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.id || 'unknown'
    });
  }
}
```

---

## 3. Worker Error Handling & Retry Policies

In background workers (BullMQ), errors are strictly classified into two categories:

### 3.1 Transient Errors (Retryable)
- Network timeouts contacting CloudWatch or Docker Engine.
- Transient PostgreSQL connection resets.
- Temporary rate limit breaches (HTTP 429) from LLM providers.
- **Action:** Re-throw the error so BullMQ triggers exponential backoff retries.

### 3.2 Permanent Errors (Non-Retryable / Fatal)
- Syntax errors in user-provided `Dockerfile`.
- Invalid AWS IAM role credentials (unauthorized).
- Schema validation failures in webhook payloads.
- **Action:** Catch the error, log structured diagnostics, update database entity to `Failed`, and do **not** re-throw (to prevent wasting worker cycles on impossible retries).
