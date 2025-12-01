/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly retryable: boolean
  public readonly details?: unknown

  constructor(
    message: string,
    statusCode: number,
    code: string,
    retryable: boolean = false,
    details?: unknown
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.retryable = retryable
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Validation errors (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', false, details)
  }
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', false)
  }
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN', false)
  }
}

/**
 * Not found errors (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND', false)
  }
}

/**
 * Conflict errors (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', false)
  }
}

/**
 * Rate limit errors (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true)
  }
}

/**
 * External service errors (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External service error: ${service}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      true,
      originalError?.message
    )
  }
}

/**
 * Database errors (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      `Database error: ${message}`,
      500,
      'DATABASE_ERROR',
      true,
      originalError?.message
    )
  }
}

/**
 * Generic server errors (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', true)
  }
}

/**
 * File processing errors (500)
 */
export class FileProcessingError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, 'FILE_PROCESSING_ERROR', true, details)
  }
}

/**
 * LLM/AI service errors (500)
 */
export class LLMError extends AppError {
  constructor(message: string, retryable: boolean = true, details?: unknown) {
    super(message, 500, 'LLM_ERROR', retryable, details)
  }
}
