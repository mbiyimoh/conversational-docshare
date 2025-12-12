import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

/**
 * Generate unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Error response formatter
 */
function formatErrorResponse(error: AppError | Error, requestId: string) {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
      },
      requestId,
      timestamp: new Date().toISOString(),
    }
  }

  // Handle Prisma errors
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this value already exists',
          retryable: false,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }
    }

    if (error.code === 'P2025') {
      return {
        error: {
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record was not found',
          retryable: false,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }
    }

    return {
      error: {
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
        retryable: true,
      },
      requestId,
      timestamp: new Date().toISOString(),
    }
  }

  // Generic error
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message:
        process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
      retryable: false,
    },
    requestId,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Global error handler middleware
 *
 * IMPORTANT: Express requires ALL 4 parameters (err, req, res, next) for error handlers.
 * Express uses the function's arity (parameter count) to distinguish error handlers
 * from regular middleware. If we remove req or next, Express won't recognize this
 * as an error handler and errors won't be caught.
 *
 * @see https://expressjs.com/en/guide/error-handling.html
 * "Error-handling middleware always takes four arguments"
 */
export function errorHandler(
  err: Error,
  req: Request,      // Required by Express - used for potential request context logging
  res: Response,
  next: NextFunction // Required by Express - could call next(err) to chain error handlers
) {
  // Suppress TypeScript unused variable warnings - Express requires these parameters
  void req
  void next

  const requestId = generateRequestId()

  // Log error for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${requestId}] Error:`, err)
  } else {
    // In production, log to external service (e.g., Sentry)
    console.error(`[${requestId}] ${err.name}: ${err.message}`)
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500

  // Format and send error response
  const response = formatErrorResponse(err, requestId)
  res.status(statusCode).json(response)
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      retryable: false,
    },
    timestamp: new Date().toISOString(),
  })
}

/**
 * Async route handler wrapper
 * Catches errors from async functions and passes to error middleware
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
