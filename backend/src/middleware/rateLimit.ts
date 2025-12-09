import rateLimit from 'express-rate-limit'

// Disable rate limiting in development for testing
const isDev = process.env.NODE_ENV !== 'production'

/**
 * Rate limiter for authentication endpoints
 * 10 requests per hour per IP (disabled in dev)
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 10000 : 10, // Effectively unlimited in dev
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
      retryable: true,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Rate limiter for registration endpoints
 * 5 requests per hour per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 10000 : 5, // Effectively unlimited in dev
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts, please try again later',
      retryable: true,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 100, // Effectively unlimited in dev
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      retryable: true,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
