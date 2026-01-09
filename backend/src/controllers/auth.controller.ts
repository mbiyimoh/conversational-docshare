import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { createToken } from '../utils/jwt'

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  try {
    const { email, password, name } = req.body

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          retryable: false,
        },
      })
      return
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
          retryable: false,
        },
      })
      return
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
    })

    res.status(201).json({
      user,
      token,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Password')) {
      res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: error.message,
          retryable: false,
        },
      })
      return
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register user',
        retryable: true,
      },
    })
  }
}

/**
 * Login with email and password
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required',
          retryable: false,
        },
      })
      return
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user || !user.passwordHash) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          retryable: false,
        },
      })
      return
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          retryable: false,
        },
      })
      return
    }

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      email: user.email,
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    })
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to login',
        retryable: true,
      },
    })
  }
}

/**
 * Get current user from JWT token
 */
export async function me(req: Request, res: Response) {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          retryable: false,
        },
      })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        subscriptionTier: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          retryable: false,
        },
      })
      return
    }

    res.json({ user })
  } catch {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user',
        retryable: true,
      },
    })
  }
}
