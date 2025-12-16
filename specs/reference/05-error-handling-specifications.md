# Error Handling Specifications

**Purpose:** Comprehensive error handling strategy including error codes, retry logic, user-facing messages, logging, and graceful degradation.

---

## Overview

Robust error handling is critical for production readiness. This specification covers:

1. **Error Classification** - Types of errors and how to handle them
2. **Error Codes** - Standard

ized error codes for all failures
3. **Retry Strategies** - When and how to retry failed operations
4. **User-Facing Messages** - Clear, actionable error communication
5. **Logging & Monitoring** - Error tracking for debugging
6. **Graceful Degradation** - Fallback behaviors when services fail

---

## Error Classification

### 1. Client Errors (4xx) - User's fault

| Code | Type | Description | Retryable |
|------|------|-------------|-----------|
| 400 | `VALIDATION_ERROR` | Invalid request data | No |
| 401 | `AUTHENTICATION_REQUIRED` | Missing auth token | No |
| 402 | `PAYMENT_REQUIRED` | Subscription required | No |
| 403 | `FORBIDDEN` | Insufficient permissions | No |
| 404 | `NOT_FOUND` | Resource doesn't exist | No |
| 409 | `CONFLICT` | Resource already exists | No |
| 413 | `PAYLOAD_TOO_LARGE` | File/request too large | No |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Invalid file type | No |
| 422 | `UNPROCESSABLE_ENTITY` | Semantic error | No |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Yes (after delay) |

### 2. Server Errors (5xx) - System's fault

| Code | Type | Description | Retryable |
|------|------|-------------|-----------|
| 500 | `INTERNAL_ERROR` | Unexpected server error | Yes |
| 502 | `BAD_GATEWAY` | Upstream service failed | Yes |
| 503 | `SERVICE_UNAVAILABLE` | Temporary unavailability | Yes |
| 504 | `GATEWAY_TIMEOUT` | Upstream timeout | Yes |

### 3. Custom Application Errors

| Code | Type | Description | Retryable |
|------|------|-------------|-----------|
| - | `DOCUMENT_PROCESSING_ERROR` | File parsing failed | No |
| - | `LLM_ERROR` | AI provider error | Yes |
| - | `EMBEDDING_ERROR` | Vector generation failed | Yes |
| - | `CITATION_ERROR` | Citation verification failed | No |
| - | `DATABASE_ERROR` | Database operation failed | Yes |

---

## Standardized Error Response Format

```typescript
// lib/errors/types.ts

export interface ErrorResponse {
  error: {
    code: string              // Machine-readable error code
    message: string           // Human-readable message
    details?: Record<string, any>  // Additional context
    field?: string            // For validation errors
    retryable: boolean        // Can client retry?
    retryAfter?: number       // Seconds to wait before retry
  }
  requestId: string           // For support/debugging
  timestamp: string           // ISO 8601 timestamp
}

// Example:
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": {
      "field": "email",
      "constraint": "required"
    },
    "retryable": false
  },
  "requestId": "req_abc123xyz",
  "timestamp": "2025-01-20T18:00:00Z"
}
```

---

## Error Classes

```typescript
// lib/errors/AppError.ts

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public retryable: boolean = false,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON(): ErrorResponse['error'] {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable
    }
  }
}

// Specific error classes

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super('VALIDATION_ERROR', message, 400, false, { field })
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('AUTHENTICATION_REQUIRED', message, 401, false)
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super('FORBIDDEN', message, 403, false)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404, false, { resource })
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409, false)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Too many requests. Try again in ${retryAfter} seconds.`,
      429,
      true,
      { retryAfter }
    )
  }
}

export class DocumentProcessingError extends AppError {
  constructor(message: string, fileType?: string) {
    super('DOCUMENT_PROCESSING_ERROR', message, 422, false, { fileType })
  }
}

export class LLMError extends AppError {
  constructor(message: string, provider?: string) {
    super('LLM_ERROR', message, 502, true, { provider })
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super('DATABASE_ERROR', message, 500, true)
  }
}
```

---

## Error Handler Middleware

```typescript
// lib/errors/errorHandler.ts

import { NextRequest, NextResponse } from 'next/server'
import { AppError } from './AppError'
import { v4 as uuidv4 } from 'uuid'

export function errorHandler(error: unknown, req?: NextRequest): NextResponse {
  // Generate request ID for tracking
  const requestId = `req_${uuidv4().substring(0, 12)}`

  // Log error
  console.error('[Error Handler]', {
    requestId,
    error,
    url: req?.url,
    method: req?.method,
    timestamp: new Date().toISOString()
  })

  // Handle known AppError
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.toJSON(),
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: error.statusCode }
    )
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = handlePrismaError(error as any)
    return NextResponse.json(
      {
        error: prismaError,
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: prismaError.statusCode || 500 }
    )
  }

  // Handle generic Error
  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message = process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error'

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message,
          retryable: true
        },
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }

  // Unknown error type
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        retryable: true
      },
      requestId,
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  )
}

// Prisma error mapping
function handlePrismaError(error: any): {
  code: string
  message: string
  statusCode: number
  retryable: boolean
} {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return {
        code: 'CONFLICT',
        message: 'Resource already exists',
        statusCode: 409,
        retryable: false
      }

    case 'P2025':
      // Record not found
      return {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        statusCode: 404,
        retryable: false
      }

    case 'P2003':
      // Foreign key constraint violation
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reference',
        statusCode: 400,
        retryable: false
      }

    case 'P1001':
      // Can't reach database
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database temporarily unavailable',
        statusCode: 503,
        retryable: true
      }

    default:
      return {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        statusCode: 500,
        retryable: true
      }
  }
}
```

---

## Component-Specific Error Handling

### 1. Document Processing Errors

```typescript
// lib/documentProcessor/errorHandling.ts

export const DOCUMENT_ERROR_HANDLERS = {
  // PDF Errors
  'PDF is encrypted': {
    userMessage: 'This PDF is password-protected. Please provide the password or upload an unlocked version.',
    recovery: 'prompt_password',
    retryable: false
  },

  'Invalid PDF structure': {
    userMessage: 'PDF file appears corrupted. We\'ll attempt to extract what we can.',
    recovery: 'attempt_repair',
    retryable: true
  },

  'PDF contains no extractable text': {
    userMessage: 'This appears to be a scanned PDF. OCR processing is not yet supported. Please upload a text-based PDF.',
    recovery: 'suggest_ocr',
    retryable: false
  },

  'PDF exceeds size limit': {
    userMessage: 'PDF file is too large (max 50MB). Please compress or split the file.',
    recovery: 'none',
    retryable: false
  },

  // DOCX Errors
  'Invalid DOCX file': {
    userMessage: 'Word document appears corrupted or in an unsupported format.',
    recovery: 'suggest_resave',
    retryable: false
  },

  // XLSX Errors
  'Excel file exceeds sheet limit': {
    userMessage: 'Spreadsheet has too many sheets (max 50). Please reduce and try again.',
    recovery: 'none',
    retryable: false
  },

  // Generic
  'Unsupported file type': {
    userMessage: 'File type not supported. Supported formats: PDF, DOCX, XLSX, MD.',
    recovery: 'none',
    retryable: false
  }
}

export function handleDocumentProcessingError(
  error: Error,
  filename: string,
  filetype: string
): ProcessingResult {
  const errorMessage = error.message

  const handler = DOCUMENT_ERROR_HANDLERS[errorMessage as keyof typeof DOCUMENT_ERROR_HANDLERS]

  if (handler) {
    return {
      status: 'failed',
      fullText: '',
      outline: { sections: [] },
      errors: [{
        type: 'extraction_failed',
        message: handler.userMessage,
        severity: 'error'
      }],
      quality: {
        outlineConfidence: 0,
        textCompleteness: 0,
        warnings: [handler.userMessage]
      }
    }
  }

  // Unknown error
  return {
    status: 'failed',
    fullText: '',
    outline: { sections: [] },
    errors: [{
      type: 'extraction_failed',
      message: `Failed to process ${filetype.toUpperCase()} file. Please try again or contact support.`,
      severity: 'error'
    }],
    quality: {
      outlineConfidence: 0,
      textCompleteness: 0,
      warnings: [errorMessage]
    }
  }
}
```

### 2. LLM Provider Errors

```typescript
// lib/llm/errorHandling.ts

export function handleLLMError(error: any): {
  userMessage: string
  retryable: boolean
  retryAfter?: number
  fallback?: string
} {
  // OpenAI errors
  if (error.type === 'insufficient_quota') {
    return {
      userMessage: 'AI service quota exceeded. Please contact support to upgrade your plan.',
      retryable: false
    }
  }

  if (error.type === 'rate_limit_error' || error.status === 429) {
    const retryAfter = error.headers?.['retry-after']
      ? parseInt(error.headers['retry-after'])
      : 60

    return {
      userMessage: 'Too many AI requests. Please wait a moment and try again.',
      retryable: true,
      retryAfter
    }
  }

  if (error.type === 'invalid_request_error') {
    if (error.message?.includes('context_length_exceeded')) {
      return {
        userMessage: 'Conversation is too long. Please start a new conversation or ask shorter questions.',
        retryable: false,
        fallback: 'truncate_history'
      }
    }

    if (error.message?.includes('invalid_api_key')) {
      return {
        userMessage: 'AI service configuration error. Please contact support.',
        retryable: false
      }
    }

    return {
      userMessage: 'Invalid AI request. Please rephrase your question.',
      retryable: false
    }
  }

  if (error.status === 503 || error.type === 'service_unavailable') {
    return {
      userMessage: 'AI service temporarily unavailable. Please try again in a few moments.',
      retryable: true,
      retryAfter: 30
    }
  }

  if (error.status === 500 || error.type === 'server_error') {
    return {
      userMessage: 'AI service encountered an error. Our team has been notified.',
      retryable: true,
      retryAfter: 10
    }
  }

  // Anthropic errors
  if (error.error?.type === 'overloaded_error') {
    return {
      userMessage: 'AI service is experiencing high demand. Please try again shortly.',
      retryable: true,
      retryAfter: 30
    }
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return {
      userMessage: 'Could not connect to AI service. Please check your connection and try again.',
      retryable: true,
      retryAfter: 10
    }
  }

  // Generic error
  return {
    userMessage: 'AI response failed. Please try again.',
    retryable: true,
    retryAfter: 5
  }
}
```

### 3. Database Errors

```typescript
// lib/db/errorHandling.ts

export function handleDatabaseError(error: any): {
  userMessage: string
  retryable: boolean
  shouldLog: boolean
} {
  // Connection errors
  if (error.code === 'P1001') {
    return {
      userMessage: 'Database temporarily unavailable. Please try again shortly.',
      retryable: true,
      shouldLog: true
    }
  }

  // Timeout
  if (error.code === 'P1008') {
    return {
      userMessage: 'Database operation timed out. Please try again.',
      retryable: true,
      shouldLog: true
    }
  }

  // Unique constraint
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field'
    return {
      userMessage: `This ${field} is already in use.`,
      retryable: false,
      shouldLog: false
    }
  }

  // Foreign key constraint
  if (error.code === 'P2003') {
    return {
      userMessage: 'Referenced resource does not exist.',
      retryable: false,
      shouldLog: false
    }
  }

  // Record not found
  if (error.code === 'P2025') {
    return {
      userMessage: 'Resource not found.',
      retryable: false,
      shouldLog: false
    }
  }

  // Generic database error
  return {
    userMessage: 'Database operation failed. Please try again.',
    retryable: true,
    shouldLog: true
  }
}
```

### 4. File Upload Errors

```typescript
// lib/upload/errorHandling.ts

export function handleUploadError(error: any, filesize?: number): {
  userMessage: string
  errorCode: string
} {
  if (error.code === 'LIMIT_FILE_SIZE' || (filesize && filesize > 50 * 1024 * 1024)) {
    return {
      userMessage: 'File is too large (max 50MB). Please compress or split the file.',
      errorCode: 'FILE_TOO_LARGE'
    }
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return {
      userMessage: 'Invalid file field. Please check your upload.',
      errorCode: 'INVALID_FIELD'
    }
  }

  if (error.code === 'ENOENT') {
    return {
      userMessage: 'Upload directory not found. Please contact support.',
      errorCode: 'STORAGE_ERROR'
    }
  }

  if (error.code === 'ENOSPC') {
    return {
      userMessage: 'Server storage full. Please contact support.',
      errorCode: 'STORAGE_FULL'
    }
  }

  return {
    userMessage: 'File upload failed. Please try again.',
    errorCode: 'UPLOAD_ERROR'
  }
}
```

---

## Retry Strategies

### Exponential Backoff

```typescript
// lib/retry/exponentialBackoff.ts

interface RetryOptions {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    retryableErrors = ['ECONNREFUSED', 'ETIMEDOUT', '503', '502', '504']
  } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      const isRetryable = retryableErrors.some(code =>
        error instanceof Error && (
          error.message.includes(code) ||
          (error as any).code === code ||
          (error as any).status?.toString() === code
        )
      )

      if (!isRetryable || attempt === maxAttempts) {
        throw error
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      )

      // Add jitter (±25%)
      const jitter = delay * (0.75 + Math.random() * 0.5)

      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${Math.round(jitter)}ms...`)

      await new Promise(resolve => setTimeout(resolve, jitter))
    }
  }

  throw lastError
}

// Usage example:
// const result = await retryWithBackoff(
//   () => openai.chat.completions.create(...),
//   { maxAttempts: 3, initialDelayMs: 2000 }
// )
```

### Circuit Breaker

```typescript
// lib/retry/circuitBreaker.ts

enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN'  // Testing if recovered
}

interface CircuitBreakerOptions {
  failureThreshold: number    // Failures before opening
  successThreshold: number    // Successes to close from half-open
  timeout: number             // Ms before attempting half-open
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private nextAttempt = Date.now()

  constructor(
    private serviceName: string,
    private options: CircuitBreakerOptions = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000  // 1 minute
    }
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.serviceName}. Service unavailable.`)
      }
      // Time to try half-open
      this.state = CircuitState.HALF_OPEN
      this.successCount = 0
    }

    try {
      const result = await fn()

      // Success
      this.onSuccess()
      return result

    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++

      if (this.successCount >= this.options.successThreshold) {
        console.log(`[Circuit Breaker] ${this.serviceName} recovered. Closing circuit.`)
        this.state = CircuitState.CLOSED
        this.successCount = 0
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.successCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      console.log(`[Circuit Breaker] ${this.serviceName} still failing. Re-opening circuit.`)
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.options.timeout
      return
    }

    if (this.failureCount >= this.options.failureThreshold) {
      console.log(`[Circuit Breaker] ${this.serviceName} failure threshold reached. Opening circuit.`)
      this.state = CircuitState.OPEN
      this.nextAttempt = Date.now() + this.options.timeout
    }
  }

  getState(): CircuitState {
    return this.state
  }
}

// Global circuit breakers for external services
export const circuitBreakers = {
  openai: new CircuitBreaker('OpenAI'),
  anthropic: new CircuitBreaker('Anthropic'),
  database: new CircuitBreaker('Database', { failureThreshold: 3, timeout: 30000 })
}

// Usage:
// const result = await circuitBreakers.openai.execute(() =>
//   openai.chat.completions.create(...)
// )
```

---

## Logging & Monitoring

### Structured Logging

```typescript
// lib/logging/logger.ts

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface LogContext {
  userId?: string
  projectId?: string
  sessionId?: string
  requestId?: string
  [key: string]: any
}

class Logger {
  private serviceName: string

  constructor(serviceName: string = 'app') {
    this.serviceName = serviceName
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context
    }

    // In production, send to logging service (Datadog, Sentry, etc.)
    if (process.env.NODE_ENV === 'production') {
      // sendToLoggingService(logEntry)
    }

    // Console output (structured JSON for parsing)
    console.log(JSON.stringify(logEntry))
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    })
  }
}

export const logger = new Logger()

// Usage:
// logger.error('Document processing failed', error, {
//   projectId: 'cm123',
//   documentId: 'doc456',
//   filename: 'report.pdf'
// })
```

### Error Tracking Integration

```typescript
// lib/monitoring/sentry.ts (example)

import * as Sentry from '@sentry/nextjs'

export function initSentry(): void {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
      tracesSampleRate: 0.1,  // 10% of transactions
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
        }
        return event
      }
    })
  }
}

export function captureError(error: Error, context?: Record<string, any>): void {
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, { extra: context })
  } else {
    console.error('[Error]', error, context)
  }
}
```

---

## Graceful Degradation

### LLM Fallback Strategy

```typescript
// lib/llm/fallback.ts

export async function chatWithFallback(
  projectId: string,
  messages: any[],
  agentConfig: any
): Promise<any> {
  const providers = [
    { name: 'primary', model: agentConfig.modelProvider },
    { name: 'fallback', model: agentConfig.modelProvider === 'openai' ? 'anthropic' : 'openai' }
  ]

  for (const provider of providers) {
    try {
      const result = await chatWithProvider(provider.model, projectId, messages, agentConfig)
      return result
    } catch (error) {
      console.error(`[LLM Fallback] ${provider.name} failed:`, error)

      if (provider.name === 'fallback') {
        // Last resort: return graceful error message
        throw new LLMError(
          'AI service temporarily unavailable. Please try again in a few moments.',
          provider.model
        )
      }

      // Continue to fallback
      console.log(`[LLM Fallback] Trying fallback provider: ${providers[1].model}`)
    }
  }
}
```

### Partial Response Handling

```typescript
// If LLM stream fails mid-response, save partial conversation

export async function handlePartialResponse(
  conversationId: string,
  partialMessages: any[],
  error: Error
): Promise<void> {
  // Save what we have
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messages: partialMessages,
      messageCount: partialMessages.length,
      // Mark as incomplete
      metadata: {
        incomplete: true,
        error: error.message,
        lastUpdate: new Date().toISOString()
      }
    }
  })

  // Notify user
  console.warn('[Partial Response] Conversation incomplete:', conversationId)
}
```

---

## User-Facing Error Messages

### Error Message Guidelines

1. **Be specific:** "PDF file is too large (max 50MB)" not "Upload failed"
2. **Be actionable:** Tell user what to do next
3. **Be empathetic:** "We're sorry..." for system errors
4. **Never expose internals:** No stack traces or SQL errors
5. **Provide support:** Include requestId for debugging

### Message Templates

```typescript
// lib/errors/messages.ts

export const ERROR_MESSAGES = {
  // Authentication
  INVALID_CREDENTIALS: 'Email or password is incorrect. Please try again.',
  TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  ACCOUNT_LOCKED: 'Too many failed attempts. Please try again in 1 hour or reset your password.',

  // Documents
  FILE_TOO_LARGE: 'File is too large (max 50MB). Please compress or split your document.',
  UNSUPPORTED_FORMAT: 'File format not supported. Please upload PDF, DOCX, XLSX, or MD files.',
  PROCESSING_FAILED: 'We couldn\'t process this document. Please try a different file or contact support.',
  ENCRYPTED_PDF: 'This PDF is password-protected. Please remove the password and try again.',

  // Chat
  RATE_LIMIT_CHAT: 'You\'ve reached the message limit. Please wait a moment or upgrade your plan.',
  LLM_UNAVAILABLE: 'AI service is temporarily unavailable. We\'re working to restore it.',
  CONVERSATION_TOO_LONG: 'This conversation is too long. Please start a new conversation.',

  // Share Links
  LINK_EXPIRED: 'This share link has expired. Please contact the document owner for a new link.',
  LINK_MAXED_OUT: 'This share link has reached its view limit. Please contact the document owner.',
  INVALID_PASSWORD: 'Incorrect password. Please try again or contact the document owner.',
  NOT_WHITELISTED: 'Your email is not authorized to view this document. Please contact the document owner.',

  // Generic
  NETWORK_ERROR: 'Could not connect to the server. Please check your internet connection.',
  SERVER_ERROR: 'Something went wrong on our end. We\'ve been notified and are working on it.',
  MAINTENANCE: 'We\'re performing scheduled maintenance. Please try again in a few minutes.'
}
```

---

## Testing Strategy

```typescript
// tests/errors/errorHandler.test.ts

import { errorHandler } from '@/lib/errors/errorHandler'
import { ValidationError, LLMError } from '@/lib/errors/AppError'

describe('Error Handler', () => {
  it('should handle ValidationError correctly', () => {
    const error = new ValidationError('Email required', 'email')
    const response = errorHandler(error)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.retryable).toBe(false)
  })

  it('should handle LLM errors with retry', () => {
    const error = new LLMError('Rate limit exceeded', 'openai')
    const response = errorHandler(error)

    expect(response.status).toBe(502)
    const json = await response.json()
    expect(json.error.retryable).toBe(true)
  })

  it('should hide internal errors in production', () => {
    process.env.NODE_ENV = 'production'

    const error = new Error('Sensitive internal error')
    const response = errorHandler(error)

    const json = await response.json()
    expect(json.error.message).not.toContain('Sensitive')
  })
})

// tests/retry/exponentialBackoff.test.ts

import { retryWithBackoff } from '@/lib/retry/exponentialBackoff'

describe('Retry with Exponential Backoff', () => {
  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success')
    const result = await retryWithBackoff(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on retryable error', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValue('success')

    const result = await retryWithBackoff(fn, { maxAttempts: 3 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should throw after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'))

    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 10 })
    ).rejects.toThrow('ETIMEDOUT')

    expect(fn).toHaveBeenCalledTimes(3)
  })
})
```

---

## Summary

This error handling specification provides:

- ✅ **Standardized error format** - Consistent API responses
- ✅ **Error classification** - Clear 4xx vs 5xx vs custom errors
- ✅ **Component-specific handling** - Tailored for documents, LLM, DB, etc.
- ✅ **Retry strategies** - Exponential backoff + circuit breaker
- ✅ **User-friendly messages** - Clear, actionable communication
- ✅ **Structured logging** - JSON logs for monitoring
- ✅ **Graceful degradation** - Fallbacks when services fail
- ✅ **Comprehensive testing** - Error scenarios covered

**Next Steps:**
1. Implement error classes in `lib/errors/`
2. Add error handler middleware to API routes
3. Set up Sentry or logging service
4. Create error message catalog
5. Implement retry logic for critical operations
6. Test all error scenarios
7. Monitor error rates in production
