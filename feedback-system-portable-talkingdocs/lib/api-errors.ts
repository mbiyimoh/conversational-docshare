// ============================================================================
// API Error Handler
// ============================================================================
//
// Centralized error handling for all API routes.
// Provides consistent error responses across the entire API.
//
// If you already have an API error handler, you can skip this file
// and use your existing one in the API routes.
// ============================================================================

import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Standardized API error response structure.
 * All API endpoints return errors in this format for consistency.
 */
export interface ApiError {
  error: string
  details?: unknown
  suggestion?: string
  code?: string
}

/**
 * Base class for permission-related errors.
 * Provides type-safe error handling for authorization failures.
 */
export class PermissionError extends Error {
  public readonly statusCode: number
  public readonly suggestion?: string

  constructor(message: string, statusCode: number = 403, suggestion?: string) {
    super(message)
    this.name = 'PermissionError'
    this.statusCode = statusCode
    this.suggestion = suggestion

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Thrown when user lacks any access to a resource.
 * Maps to HTTP 403 Forbidden.
 */
export class AccessDeniedError extends PermissionError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'You do not have permission to access this resource')
    this.name = 'AccessDeniedError'
  }
}

/**
 * Type guard to check if error is a Prisma known request error
 */
function isPrismaKnownRequestError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  )
}

/**
 * Type guard to check if error is a Prisma initialization error
 */
function isPrismaInitializationError(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'PrismaClientInitializationError'
  )
}

/**
 * Centralized error handler for all API routes.
 *
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   try {
 *     // ... your business logic
 *   } catch (error) {
 *     return ApiErrorHandler.handle(error)
 *   }
 * }
 * ```
 */
export class ApiErrorHandler {
  /**
   * Handles any error and returns appropriate NextResponse with status code.
   */
  static handle(error: unknown): NextResponse<ApiError> {
    // Permission errors
    if (error instanceof PermissionError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.suggestion && { suggestion: error.suggestion })
        },
        { status: error.statusCode }
      )
    }

    // Zod validation errors (400 Bad Request)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    // Business logic errors
    if (error instanceof Error) {
      // Authentication errors (401)
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Authorization errors (403)
      if (error.message === 'Admin access required' ||
          error.message.includes('Forbidden') ||
          error.message.includes('not authorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }

      // Not found errors (404)
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
    }

    // Prisma database errors (using type guard for portability)
    if (isPrismaKnownRequestError(error)) {
      console.error('Prisma error:', error.code, error.message)

      const errorMap: Record<string, { status: number; message: string; suggestion?: string }> = {
        'P2002': {
          status: 409,
          message: 'A record with these properties already exists',
          suggestion: 'Use different values or update the existing record'
        },
        'P2003': {
          status: 400,
          message: 'Invalid reference to related record',
          suggestion: 'Verify that all referenced IDs exist'
        },
        'P2025': {
          status: 404,
          message: 'Record not found',
          suggestion: 'Verify the ID is correct and the record exists'
        }
      }

      const mapped = errorMap[error.code]
      if (mapped) {
        return NextResponse.json(
          {
            error: mapped.message,
            code: error.code,
            ...(mapped.suggestion && { suggestion: mapped.suggestion })
          },
          { status: mapped.status }
        )
      }

      return NextResponse.json(
        { error: 'Database operation failed', code: error.code },
        { status: 500 }
      )
    }

    // Prisma client initialization errors
    if (isPrismaInitializationError(error)) {
      console.error('Prisma initialization error:', error.message)
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }

    // Unknown errors - log but don't expose details
    console.error('Unexpected API error:', error)
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        suggestion: 'Please try again. If the problem persists, contact support.'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function for consistent success responses.
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}
