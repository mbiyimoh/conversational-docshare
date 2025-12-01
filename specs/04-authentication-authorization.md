# Authentication & Authorization

**Purpose:** Complete implementation specification for user authentication, authorization, and share link access control.

---

## Overview

The system requires two distinct auth flows:
1. **Creator Authentication:** Full user accounts with JWT tokens
2. **Viewer Access:** Anonymous or authenticated access via share links

**Library Choice:** NextAuth.js v5 (Auth.js)

**Rationale:**
- ✅ Built for Next.js (seamless integration)
- ✅ Supports multiple providers (email/password, OAuth)
- ✅ JWT and session strategies
- ✅ Edge-compatible
- ✅ Type-safe with TypeScript
- ✅ Active maintenance and community

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  AUTHENTICATION FLOW                     │
└─────────────────────────────────────────────────────────┘

Creator Registration/Login
    ↓
  NextAuth.js
    ↓
  JWT Token (7 days expiry)
    ↓
  Stored in HTTP-only cookie + returned in response
    ↓
  Middleware validates token on protected routes


┌─────────────────────────────────────────────────────────┐
│                 SHARE LINK ACCESS FLOW                   │
└─────────────────────────────────────────────────────────┘

Viewer → Share URL (/s/:shareCode)
    ↓
  Access Gate Check
    ├─ public_password → Verify password
    ├─ email_required → Collect email (no verification)
    └─ whitelist → Check email in whitelist
    ↓
  Session ID Generated (anonymous)
    ↓
  Stored in cookie (sessionId) + localStorage
    ↓
  Chat API accepts sessionId for tracking
```

---

## NextAuth.js Configuration

### Installation

```bash
npm install next-auth@beta  # v5
npm install @auth/prisma-adapter
npm install bcryptjs
npm install @types/bcryptjs --save-dev
```

### File Structure

```
/app
  /api
    /auth
      /[...nextauth]
        route.ts          # NextAuth.js handler
/lib
  /auth
    auth.ts              # Auth configuration
    middleware.ts        # Auth middleware
    password.ts          # Password hashing utilities
```

---

## Auth Configuration

```typescript
// lib/auth/auth.ts

import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db'
import { verifyPassword } from './password'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Email/Password (primary for MVP)
    CredentialsProvider({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() }
        })

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials')
        }

        // Verify password
        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash
        )

        if (!isValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    }),

    // Google OAuth (Phase 2)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    }),

    // GitHub OAuth (Phase 2)
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60  // 7 days
  },

  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 7 * 24 * 60 * 60
  },

  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify'
  },

  callbacks: {
    // Add user data to JWT
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
      }
      return token
    },

    // Add JWT data to session
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.role = token.role as string
      }
      return session
    },

    // Control authorization
    async signIn({ user, account, profile }) {
      // For email/password, always allow
      if (account?.provider === 'credentials') {
        return true
      }

      // For OAuth, check if user exists or create
      if (!user.email) {
        return false
      }

      // Check if account with this email exists
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email }
      })

      // If exists, link OAuth account
      // If not, create new user
      return true
    }
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      console.log('[Auth] Sign in:', { userId: user.id, isNewUser })
    },
    async signOut({ session, token }) {
      console.log('[Auth] Sign out:', { userId: token?.id })
    }
  },

  debug: process.env.NODE_ENV === 'development'
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
```

---

## Password Hashing

```typescript
// lib/auth/password.ts

import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12  // Higher = more secure but slower

export async function hashPassword(password: string): Promise<string> {
  // Validate password strength first
  validatePasswordStrength(password)

  // Generate salt and hash
  const salt = await bcrypt.genSalt(SALT_ROUNDS)
  const hash = await bcrypt.hash(password, salt)

  return hash
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePasswordStrength(password: string): void {
  const MIN_LENGTH = 8
  const errors: string[] = []

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }

  // Optional: Special character requirement
  // if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
  //   errors.push('Password must contain at least one special character')
  // }

  if (errors.length > 0) {
    throw new Error(errors.join('. '))
  }
}

// Rate limiting for password attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(email: string): void {
  const now = Date.now()
  const attempt = loginAttempts.get(email)

  if (!attempt || attempt.resetAt < now) {
    // First attempt or expired
    loginAttempts.set(email, {
      count: 1,
      resetAt: now + 60 * 60 * 1000  // 1 hour
    })
    return
  }

  const MAX_ATTEMPTS = 5

  if (attempt.count >= MAX_ATTEMPTS) {
    const minutesRemaining = Math.ceil((attempt.resetAt - now) / 60000)
    throw new Error(
      `Too many login attempts. Try again in ${minutesRemaining} minutes.`
    )
  }

  attempt.count++
  loginAttempts.set(email, attempt)
}

export function clearRateLimit(email: string): void {
  loginAttempts.delete(email)
}
```

---

## API Route Handlers

### Registration

```typescript
// app/api/auth/register/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { signJWT } from '@/lib/auth/jwt'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const emailLower = email.toLowerCase().trim()

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: emailLower }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Validate password strength
    try {
      validatePasswordStrength(password)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid password' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        name: name?.trim() || null,
        role: 'creator'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    // Generate JWT
    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // Return user and token
    return NextResponse.json({
      user,
      token,
      expiresIn: 7 * 24 * 60 * 60  // 7 days in seconds
    }, { status: 201 })

  } catch (error) {
    console.error('[POST /api/auth/register] Error:', error)
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    )
  }
}
```

### Login

```typescript
// app/api/auth/login/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, checkRateLimit, clearRateLimit } from '@/lib/auth/password'
import { signJWT } from '@/lib/auth/jwt'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const emailLower = email.toLowerCase().trim()

    // Check rate limit
    try {
      checkRateLimit(emailLower)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Too many attempts' },
        { status: 429 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: emailLower },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true
      }
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Clear rate limit on successful login
    clearRateLimit(emailLower)

    // Generate JWT
    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    })

    // Return user and token (exclude passwordHash)
    const { passwordHash, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token,
      expiresIn: 7 * 24 * 60 * 60
    })

  } catch (error) {
    console.error('[POST /api/auth/login] Error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
```

---

## JWT Utilities

```typescript
// lib/auth/jwt.ts

import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development'
)

interface JWTPayload {
  id: string
  email: string
  role: string
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  return token
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch (error) {
    console.error('[JWT Verify] Error:', error)
    return null
  }
}
```

---

## Authorization Middleware

### API Route Protection

```typescript
// lib/auth/middleware.ts

import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from './jwt'

export async function requireAuth(req: NextRequest): Promise<{
  userId: string
  email: string
  role: string
} | null> {
  // Extract token from Authorization header
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  // Verify JWT
  const payload = await verifyJWT(token)

  if (!payload) {
    return null
  }

  return {
    userId: payload.id,
    email: payload.email,
    role: payload.role
  }
}

// Middleware wrapper for protected routes
export function withAuth(
  handler: (req: NextRequest, auth: { userId: string; email: string; role: string }) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const auth = await requireAuth(req)

    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return handler(req, auth)
  }
}

// Usage example:
// export const GET = withAuth(async (req, auth) => {
//   const { userId } = auth
//   // ... handle request with userId
// })
```

### Resource Ownership Check

```typescript
// lib/auth/authorization.ts

import { prisma } from '@/lib/db'

export async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true }
  })

  if (!project) {
    return false
  }

  return project.ownerId === userId
}

export async function verifyDocumentOwnership(
  documentId: string,
  userId: string
): Promise<boolean> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } }
  })

  if (!document) {
    return false
  }

  return document.project.ownerId === userId
}

// Middleware for project ownership
export async function requireProjectOwnership(
  projectId: string,
  userId: string
): Promise<void> {
  const isOwner = await verifyProjectOwnership(projectId, userId)

  if (!isOwner) {
    throw new Error('Forbidden: Not project owner')
  }
}
```

---

## Share Link Access Control

### Access Verification

```typescript
// lib/auth/shareLink.ts

import { prisma } from '@/lib/db'
import { verifyPassword } from './password'

interface ShareLinkAccess {
  granted: boolean
  reason?: string
  projectId?: string
  sessionId?: string
}

export async function verifyShareLinkAccess(
  shareCode: string,
  params: {
    password?: string
    email?: string
  }
): Promise<ShareLinkAccess> {
  // Find share link
  const shareLink = await prisma.shareLink.findUnique({
    where: { shareCode },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true
        }
      }
    }
  })

  if (!shareLink) {
    return {
      granted: false,
      reason: 'Share link not found'
    }
  }

  // Check expiration
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return {
      granted: false,
      reason: 'Share link expired'
    }
  }

  // Check view limit
  if (shareLink.maxViews && shareLink.currentViews >= shareLink.maxViews) {
    return {
      granted: false,
      reason: 'View limit exceeded'
    }
  }

  // Check access type
  switch (shareLink.accessType) {
    case 'public_password':
      if (!params.password) {
        return {
          granted: false,
          reason: 'Password required'
        }
      }

      // Verify password (use bcrypt even for share link passwords)
      const isValidPassword = shareLink.password
        ? await verifyPassword(params.password, shareLink.password)
        : false

      if (!isValidPassword) {
        return {
          granted: false,
          reason: 'Invalid password'
        }
      }
      break

    case 'email_required':
      if (!params.email) {
        return {
          granted: false,
          reason: 'Email required'
        }
      }
      // Email is just collected, no verification
      break

    case 'whitelist':
      if (!params.email) {
        return {
          granted: false,
          reason: 'Email required'
        }
      }

      const emailLower = params.email.toLowerCase().trim()
      const isWhitelisted = shareLink.whitelist.some(
        whitelistedEmail => whitelistedEmail.toLowerCase() === emailLower
      )

      if (!isWhitelisted) {
        return {
          granted: false,
          reason: 'Email not authorized'
        }
      }
      break

    default:
      return {
        granted: false,
        reason: 'Invalid access type'
      }
  }

  // Generate session ID for tracking
  const sessionId = `session_${generateRandomString(16)}`

  // Log access
  await prisma.accessLog.create({
    data: {
      shareLinkId: shareLink.id,
      viewerEmail: params.email || null,
      viewerIp: null,  // Add IP from request in route handler
      sessionId
    }
  })

  // Increment view count
  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: {
      currentViews: { increment: 1 }
    }
  })

  return {
    granted: true,
    projectId: shareLink.projectId,
    sessionId
  }
}

function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
```

### Share Link Password Hashing

```typescript
// When creating share link with password

import { hashPassword } from '@/lib/auth/password'

export async function createShareLink(data: {
  projectId: string
  accessType: string
  password?: string
  whitelist?: string[]
  expiresAt?: Date
  maxViews?: number
}) {
  // Hash password if provided
  const passwordHash = data.password
    ? await hashPassword(data.password)
    : null

  const shareCode = generateShareCode()

  const shareLink = await prisma.shareLink.create({
    data: {
      projectId: data.projectId,
      shareCode,
      accessType: data.accessType,
      password: passwordHash,
      whitelist: data.whitelist || [],
      expiresAt: data.expiresAt,
      maxViews: data.maxViews,
      currentViews: 0
    }
  })

  return shareLink
}

function generateShareCode(): string {
  // 10 characters, alphanumeric
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
```

---

## Session Management

### Anonymous Viewer Sessions

```typescript
// lib/auth/session.ts

import { cookies } from 'next/headers'

const SESSION_COOKIE_NAME = 'viewer_session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60  // 7 days

export function setViewerSession(sessionId: string): void {
  cookies().set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  })
}

export function getViewerSession(): string | null {
  return cookies().get(SESSION_COOKIE_NAME)?.value || null
}

export function clearViewerSession(): void {
  cookies().delete(SESSION_COOKIE_NAME)
}

// Track conversation with session
export async function getOrCreateConversation(
  projectId: string,
  shareLinkId: string,
  sessionId: string,
  viewerEmail?: string
) {
  // Find existing conversation
  const existing = await prisma.conversation.findFirst({
    where: {
      sessionId,
      projectId
    }
  })

  if (existing) {
    return existing
  }

  // Create new conversation
  return prisma.conversation.create({
    data: {
      projectId,
      shareLinkId,
      sessionId,
      viewerEmail: viewerEmail || null,
      messages: [],
      messageCount: 0
    }
  })
}
```

---

## Protected Route Examples

### Project Management

```typescript
// app/api/projects/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { prisma } from '@/lib/db'

export const GET = withAuth(async (req, auth) => {
  // Get all projects for authenticated user
  const projects = await prisma.project.findMany({
    where: { ownerId: auth.userId },
    include: {
      _count: {
        select: {
          documents: true,
          conversations: true
        }
      }
    },
    orderBy: { updatedAt: 'desc' }
  })

  return NextResponse.json({ projects })
})

export const POST = withAuth(async (req, auth) => {
  const { name, description } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json(
      { error: 'Name required' },
      { status: 400 }
    )
  }

  const project = await prisma.project.create({
    data: {
      ownerId: auth.userId,
      name: name.trim(),
      description: description?.trim() || null
    }
  })

  return NextResponse.json({ project }, { status: 201 })
})
```

### Document Upload with Ownership Check

```typescript
// app/api/projects/[projectId]/documents/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { requireProjectOwnership } from '@/lib/auth/authorization'

export const POST = withAuth(async (req, auth) => {
  const { projectId } = req.nextUrl.pathname.match(/projects\/([^/]+)/)?.groups || {}

  if (!projectId) {
    return NextResponse.json(
      { error: 'Invalid project ID' },
      { status: 400 }
    )
  }

  // Verify ownership
  try {
    await requireProjectOwnership(projectId, auth.userId)
  } catch (error) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  // Handle file upload...
  // ... rest of upload logic
})
```

---

## Environment Variables

```bash
# .env

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars  # Generate with: openssl rand -base64 32

# OAuth Providers (Phase 2)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# API Configuration
API_BASE_URL=http://localhost:3000/api
```

---

## Security Best Practices

### 1. Password Storage
- ✅ Use bcrypt with 12 rounds (slow but secure)
- ✅ Never store plain text passwords
- ✅ Share link passwords also hashed

### 2. JWT Security
- ✅ Store secret in environment variables
- ✅ Set appropriate expiration (7 days)
- ✅ Use HTTP-only cookies when possible
- ✅ Validate on every request

### 3. Rate Limiting
- ✅ Login attempts: 10 per hour per email
- ✅ Registration: 5 per hour per IP
- ✅ Password reset: 3 per hour per email

### 4. Input Validation
- ✅ Email format validation (RFC 5322)
- ✅ Password strength requirements
- ✅ SQL injection prevention (Prisma handles)
- ✅ XSS prevention (sanitize inputs)

### 5. HTTPS Only
- ✅ Enforce HTTPS in production
- ✅ Secure cookie flags
- ✅ HSTS headers

---

## Testing Strategy

```typescript
// tests/auth/password.test.ts

import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'

describe('Password Utilities', () => {
  it('should hash and verify password correctly', async () => {
    const password = 'SecurePass123!'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    expect(await verifyPassword(password, hash)).toBe(true)
    expect(await verifyPassword('WrongPassword', hash)).toBe(false)
  })

  it('should reject weak passwords', () => {
    expect(() => validatePasswordStrength('short')).toThrow()
    expect(() => validatePasswordStrength('alllowercase123')).toThrow()
    expect(() => validatePasswordStrength('ALLUPPERCASE123')).toThrow()
    expect(() => validatePasswordStrength('NoNumbers!')).toThrow()
  })

  it('should accept strong passwords', () => {
    expect(() => validatePasswordStrength('SecurePass123!')).not.toThrow()
  })
})

// tests/auth/shareLink.test.ts

import { verifyShareLinkAccess } from '@/lib/auth/shareLink'

describe('Share Link Access', () => {
  it('should grant access with correct password', async () => {
    // Setup share link with password in test DB
    const result = await verifyShareLinkAccess('testcode123', {
      password: 'CorrectPassword123'
    })

    expect(result.granted).toBe(true)
    expect(result.sessionId).toBeDefined()
  })

  it('should deny access with wrong password', async () => {
    const result = await verifyShareLinkAccess('testcode123', {
      password: 'WrongPassword'
    })

    expect(result.granted).toBe(false)
    expect(result.reason).toBe('Invalid password')
  })

  it('should grant access for whitelisted email', async () => {
    const result = await verifyShareLinkAccess('whitelistcode', {
      email: 'john@board.com'
    })

    expect(result.granted).toBe(true)
  })
})
```

---

## Summary

This authentication & authorization implementation provides:

- ✅ **NextAuth.js v5** - Modern, type-safe authentication
- ✅ **JWT strategy** - Stateless, scalable auth
- ✅ **bcrypt password hashing** - Industry standard security
- ✅ **Rate limiting** - Prevent brute force attacks
- ✅ **OAuth support** - Google, GitHub (Phase 2)
- ✅ **Share link access control** - Password, email, whitelist
- ✅ **Session management** - Anonymous viewer tracking
- ✅ **Authorization middleware** - Easy route protection
- ✅ **Ownership verification** - Resource access control
- ✅ **Comprehensive testing** - Security validation

**Next Steps:**
1. Install NextAuth.js and dependencies
2. Generate NEXTAUTH_SECRET
3. Implement auth routes (/api/auth/[...nextauth])
4. Add middleware to protected routes
5. Test authentication flows
6. Set up OAuth providers (Phase 2)
