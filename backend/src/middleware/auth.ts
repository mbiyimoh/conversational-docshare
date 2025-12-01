import { Request, Response, NextFunction } from 'express'
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../utils/jwt'

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromHeader(req.headers.authorization)

  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        retryable: false,
      },
    })
    return
  }

  const payload = await verifyToken(token)

  if (!payload) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        retryable: false,
      },
    })
    return
  }

  req.user = payload
  next()
}

/**
 * Optional authentication middleware - doesn't fail if no token
 * Note: res parameter required by Express middleware signature
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  // res unused but required by Express middleware type signature
  void res
  const token = extractTokenFromHeader(req.headers.authorization)

  if (token) {
    const payload = await verifyToken(token)
    if (payload) {
      req.user = payload
    }
  }

  next()
}
