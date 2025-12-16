# Task Breakdown: Conversational Document IDE

**Generated:** 2025-01-22
**Source:** conversational-document-ide-spec.md
**Implementation Readiness:** 95% (validated)

---

## Executive Summary

This task breakdown covers the complete implementation of a chat-first document sharing platform with AI-powered conversational interfaces. The system enables creators to upload documents, configure AI representatives through interviews, and share with viewers who interact via natural conversation.

**Total Estimated Tasks:** 52 tasks
**Phases:** 4 implementation phases
**Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4
**Parallel Work Opportunities:** High (database, frontend, backend components can run concurrently within phases)

**Tech Stack:**
- Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui
- Backend: Express.js + TypeScript + PostgreSQL + Prisma
- LLM: Vercel AI SDK (OpenAI, Anthropic)
- Document Processing: pdf-parse, mammoth, xlsx
- Vector Search: pgvector (PostgreSQL extension)
- Auth: NextAuth.js v5
- Deployment: Docker Compose

---

## Phase 1: Foundation & MVP (Weeks 1-6)

### Task 1.1: Project Structure & Tooling Setup
**Description:** Initialize monorepo structure with frontend, backend, and shared packages
**Size:** Medium
**Priority:** Critical
**Dependencies:** None
**Can run parallel with:** None (blocking task)

**Technical Requirements:**
- Monorepo structure with separate frontend/backend/shared directories
- TypeScript configuration for all packages
- Vite for frontend bundling
- esbuild for backend compilation
- ESLint + Prettier for code quality
- Git repository with appropriate .gitignore

**Directory Structure:**
```
/conversational-docshare
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── lib/
│   │   ├── hooks/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── lib/
│   │   ├── services/
│   │   └── types/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── shared/
│   ├── src/
│   │   └── types.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .gitignore
├── package.json (root)
└── README.md
```

**Implementation Steps:**
1. Create root directory and initialize git repository
2. Create monorepo package.json with workspaces
3. Set up frontend/ directory with Vite + React + TypeScript
4. Set up backend/ directory with Express + TypeScript
5. Create shared/ package for common types
6. Configure TypeScript for each package with appropriate paths
7. Set up ESLint and Prettier with shared configs
8. Create .gitignore excluding node_modules, dist, .env, etc.
9. Initialize package managers and verify builds work

**Acceptance Criteria:**
- [ ] All three packages (frontend, backend, shared) compile without errors
- [ ] `npm run dev` starts both frontend and backend in development mode
- [ ] `npm run build` successfully builds production bundles
- [ ] ESLint and Prettier run without errors
- [ ] TypeScript strict mode enabled and passing
- [ ] Git repository initialized with appropriate ignores

---

### Task 1.2: Database Schema & Prisma Setup
**Description:** Implement complete PostgreSQL schema with Prisma ORM for all models
**Size:** Large
**Priority:** Critical
**Dependencies:** Task 1.1
**Can run parallel with:** Task 1.3 (Auth setup)

**Technical Requirements:**
- PostgreSQL 14+ with pgvector extension
- Prisma ORM v5 with full type safety
- All models from spec (User, Project, Document, AgentConfig, ShareLink, Conversation, etc.)
- Proper indexes for performance
- Cascade delete relationships
- Migration system for schema changes

**Prisma Schema (Complete):**
```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id                String        @id @default(cuid())
  email             String        @unique
  name              String?
  passwordHash      String?

  oauthProvider     String?
  oauthId           String?

  role              String        @default("creator")

  projects          Project[]
  savedConversations Conversation[]

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([email])
}

// ============================================================================
// PROJECTS & DOCUMENTS
// ============================================================================

model Project {
  id                String        @id @default(cuid())
  ownerId           String
  owner             User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  name              String
  description       String?       @db.Text

  documents         Document[]
  agentConfig       AgentConfig?
  contextLayers     ContextLayer[]
  shareLinks        ShareLink[]
  conversations     Conversation[]

  totalViews        Int           @default(0)
  totalConversations Int          @default(0)

  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([ownerId])
  @@index([createdAt])
}

model Document {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  filename    String
  filepath    String
  filetype    String
  filesize    Int

  fullText    String   @db.Text
  outline     Json
  summary     String?  @db.Text
  keyTopics   String[]

  chunks      DocumentChunk[]

  uploadedAt  DateTime @default(now())

  @@index([projectId])
  @@index([filename])
}

model DocumentChunk {
  id          String   @id @default(uuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  content     String   @db.Text
  embedding   Unsupported("vector(1536)")?

  sectionId   String?
  startChar   Int
  endChar     Int
  chunkIndex  Int

  createdAt   DateTime @default(now())

  @@index([documentId])
  @@index([sectionId])
}

// ============================================================================
// CONTEXT & AGENT CONFIGURATION
// ============================================================================

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  name        String
  category    String
  description String?  @db.Text
  priority    Int
  content     String   @db.Text
  metadata    Json?
  isActive    Boolean  @default(true)
  isBuiltIn   Boolean  @default(false)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId])
  @@index([priority])
  @@index([category])
}

model AgentConfig {
  id              String   @id @default(cuid())
  projectId       String   @unique
  project         Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  analysisSummary String   @db.Text
  interviewData   Json
  configJson      Json

  modelProvider   String   @default("openai")
  modelName       String   @default("gpt-4-turbo")
  temperature     Float    @default(0.7)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

// ============================================================================
// SHARING & ACCESS
// ============================================================================

model ShareLink {
  id          String      @id @default(cuid())
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)

  shareCode   String      @unique
  accessType  String
  password    String?
  whitelist   String[]
  expiresAt   DateTime?
  maxViews    Int?
  currentViews Int        @default(0)
  customContext Json?

  accessLogs  AccessLog[]
  conversations Conversation[]

  createdAt   DateTime    @default(now())

  @@index([projectId])
  @@index([shareCode])
}

model AccessLog {
  id          String    @id @default(cuid())
  shareLinkId String
  shareLink   ShareLink @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)

  viewerEmail String?
  viewerIp    String?
  sessionId   String

  accessedAt  DateTime  @default(now())

  @@index([shareLinkId])
  @@index([accessedAt])
}

// ============================================================================
// CONVERSATIONS & ANALYTICS
// ============================================================================

model Conversation {
  id              String       @id @default(cuid())
  projectId       String
  project         Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shareLinkId     String
  shareLink       ShareLink    @relation(fields: [shareLinkId], references: [id], onDelete: Cascade)
  sessionId       String

  viewerEmail     String?
  userId          String?
  user            User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  messages        Json
  duration        Int?
  messageCount    Int          @default(0)
  documentsViewed String[]

  summary         String?      @db.Text
  keyTopics       String[]
  questions       String[]
  sentiment       String?
  actionItems     String[]

  createdAt       DateTime     @default(now())
  savedAt         DateTime?

  events          AnalyticsEvent[]

  @@index([projectId])
  @@index([shareLinkId])
  @@index([sessionId])
  @@index([createdAt])
}

model AnalyticsEvent {
  id              String       @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  eventType       String
  eventData       Json

  timestamp       DateTime     @default(now())

  @@index([conversationId])
  @@index([eventType])
  @@index([timestamp])
}
```

**Migration Commands:**
```bash
# Initialize Prisma
npx prisma init

# Create initial migration
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# (Optional) Seed database with test data
npx prisma db seed
```

**Acceptance Criteria:**
- [ ] Prisma schema compiles without errors
- [ ] All models have proper relationships and cascade deletes
- [ ] Indexes created for all foreign keys and frequently queried fields
- [ ] Migration successfully creates all tables in PostgreSQL
- [ ] Prisma Client generates TypeScript types correctly
- [ ] Can create, read, update, delete records for all models
- [ ] pgvector extension installed and DocumentChunk.embedding field works
- [ ] Tests: CRUD operations work for User, Project, Document models

---

### Task 1.3: Authentication & Authorization Setup
**Description:** Implement NextAuth.js v5 with JWT strategy, password hashing, and middleware
**Size:** Large
**Priority:** Critical
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** Task 1.4 (Error handling)

**Technical Requirements:**
- NextAuth.js v5 (Auth.js) with Credentials provider
- bcrypt password hashing (12 rounds)
- JWT tokens with 7-day expiration
- HTTP-only cookies for token storage
- Rate limiting for login attempts (10/hour)
- Password strength validation
- Authorization middleware for protected routes

**Implementation Files:**

**`lib/auth/password.ts`:**
```typescript
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  validatePasswordStrength(password)
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

  if (errors.length > 0) {
    throw new Error(errors.join('. '))
  }
}

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(email: string): void {
  const now = Date.now()
  const attempt = loginAttempts.get(email)

  if (!attempt || attempt.resetAt < now) {
    loginAttempts.set(email, {
      count: 1,
      resetAt: now + 60 * 60 * 1000  // 1 hour
    })
    return
  }

  const MAX_ATTEMPTS = 10

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

**`lib/auth/jwt.ts`:**
```typescript
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

**`lib/auth/middleware.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from './jwt'

export async function requireAuth(req: NextRequest): Promise<{
  userId: string
  email: string
  role: string
} | null> {
  const authHeader = req.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)
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
```

**`app/api/auth/register/route.ts`:**
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password'
import { signJWT } from '@/lib/auth/jwt'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }

    const emailLower = email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({
      where: { email: emailLower }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    try {
      validatePasswordStrength(password)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid password' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

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

    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    })

    return NextResponse.json({
      user,
      token,
      expiresIn: 7 * 24 * 60 * 60
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

**`app/api/auth/login/route.ts`:**
```typescript
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

    try {
      checkRateLimit(emailLower)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Too many attempts' },
        { status: 429 }
      )
    }

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

    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    clearRateLimit(emailLower)

    const token = await signJWT({
      id: user.id,
      email: user.email,
      role: user.role
    })

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

**Environment Variables (.env.example):**
```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-min-32-chars  # Generate with: openssl rand -base64 32

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/conversational_docshare

# OAuth (Phase 2)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

**Acceptance Criteria:**
- [ ] Users can register with email/password
- [ ] Passwords are hashed with bcrypt (12 rounds)
- [ ] Password strength validation enforces requirements
- [ ] Users can login and receive JWT token
- [ ] JWT tokens expire after 7 days
- [ ] Rate limiting prevents brute force (10 attempts/hour)
- [ ] `withAuth()` middleware protects routes correctly
- [ ] Invalid tokens return 401 Unauthorized
- [ ] Tests: Registration, login, password validation, rate limiting, middleware

---

### Task 1.4: Error Handling Framework
**Description:** Implement standardized error handling with error classes, middleware, and retry strategies
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** Task 1.2, Task 1.3

**See:** `specs/05-error-handling-specifications.md` for complete implementation

**Technical Requirements:**
- Standardized error response format
- Error class hierarchy (ValidationError, AuthenticationError, etc.)
- Error handler middleware
- Exponential backoff retry logic
- Circuit breaker pattern
- User-friendly error messages
- Logging integration

**Implementation Files:**

**`lib/errors/AppError.ts`:**
```typescript
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

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable
    }
  }
}

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

**`lib/errors/errorHandler.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { AppError } from './AppError'
import { v4 as uuidv4 } from 'uuid'

export function errorHandler(error: unknown, req?: NextRequest): NextResponse {
  const requestId = `req_${uuidv4().substring(0, 12)}`

  console.error('[Error Handler]', {
    requestId,
    error,
    url: req?.url,
    method: req?.method,
    timestamp: new Date().toISOString()
  })

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

  if (error instanceof Error) {
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

function handlePrismaError(error: any) {
  switch (error.code) {
    case 'P2002':
      return {
        code: 'CONFLICT',
        message: 'Resource already exists',
        statusCode: 409,
        retryable: false
      }
    case 'P2025':
      return {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        statusCode: 404,
        retryable: false
      }
    case 'P2003':
      return {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reference',
        statusCode: 400,
        retryable: false
      }
    case 'P1001':
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

**`lib/retry/exponentialBackoff.ts`:**
```typescript
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

      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      )

      const jitter = delay * (0.75 + Math.random() * 0.5)

      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${Math.round(jitter)}ms...`)

      await new Promise(resolve => setTimeout(resolve, jitter))
    }
  }

  throw lastError
}
```

**Acceptance Criteria:**
- [ ] All error classes extend AppError correctly
- [ ] Error handler middleware catches and formats all errors
- [ ] Prisma errors are mapped to appropriate HTTP status codes
- [ ] Exponential backoff retry works for retryable errors
- [ ] Error responses include requestId for debugging
- [ ] Production mode hides internal error details
- [ ] Tests: Error class creation, error handler formatting, retry logic

---

### Task 1.5: Document Upload & Storage
**Description:** Implement file upload endpoint with multipart/form-data support and file storage
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 1.4
**Can run parallel with:** Task 1.6 (Document processing)

**Technical Requirements:**
- Multipart/form-data parsing with multer or formidable
- File size validation (50MB for PDF/DOCX, 20MB for XLSX, 10MB for MD)
- File type validation (PDF, DOCX, XLSX, MD only)
- Storage in `/documents/{projectId}/{filename}` directory structure
- Filename collision handling (append timestamp)
- Proper error handling for upload failures

**Implementation:**

**`app/api/projects/[projectId]/documents/route.ts`:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/middleware'
import { requireProjectOwnership } from '@/lib/auth/authorization'
import { saveUploadedFile } from '@/lib/upload/fileStorage'
import { prisma } from '@/lib/db'

const MAX_FILE_SIZES = {
  'application/pdf': 50 * 1024 * 1024,  // 50MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 50 * 1024 * 1024,  // 50MB
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 20 * 1024 * 1024,  // 20MB
  'text/markdown': 10 * 1024 * 1024  // 10MB
}

const ALLOWED_TYPES = Object.keys(MAX_FILE_SIZES)

export const POST = withAuth(async (req, auth) => {
  try {
    const { projectId } = req.nextUrl.pathname.match(/projects\/([^/]+)/)?.groups || {}

    if (!projectId) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      )
    }

    // Verify ownership
    await requireProjectOwnership(projectId, auth.userId)

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, DOCX, XLSX, MD' },
        { status: 415 }
      )
    }

    // Validate file size
    const maxSize = MAX_FILE_SIZES[file.type as keyof typeof MAX_FILE_SIZES]
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${maxSize / 1024 / 1024}MB` },
        { status: 413 }
      )
    }

    // Save file to disk
    const { filepath, filename } = await saveUploadedFile(file, projectId)

    // Get file extension
    const filetype = filename.split('.').pop()?.toLowerCase() || ''

    // Create document record (processing happens in background)
    const document = await prisma.document.create({
      data: {
        projectId,
        filename,
        filepath,
        filetype,
        filesize: file.size,
        fullText: '',  // Will be populated by processing task
        outline: { sections: [] },
        summary: null,
        keyTopics: []
      }
    })

    // TODO: Trigger background processing job

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      filetype: document.filetype,
      filesize: document.filesize,
      status: 'processing',
      uploadedAt: document.uploadedAt,
      estimatedProcessingTime: 30
    }, { status: 202 })

  } catch (error) {
    console.error('[POST /api/projects/:id/documents] Error:', error)
    return errorHandler(error, req)
  }
})
```

**`lib/upload/fileStorage.ts`:**
```typescript
import fs from 'fs/promises'
import path from 'path'

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/conversational-docshare/documents'

export async function saveUploadedFile(
  file: File,
  projectId: string
): Promise<{ filepath: string; filename: string }> {
  // Create project directory if it doesn't exist
  const projectDir = path.join(UPLOAD_DIR, projectId)
  await fs.mkdir(projectDir, { recursive: true })

  // Handle filename collisions by appending timestamp
  let filename = file.name
  let filepath = path.join(projectDir, filename)

  try {
    await fs.access(filepath)
    // File exists, append timestamp
    const ext = path.extname(filename)
    const base = path.basename(filename, ext)
    const timestamp = Date.now()
    filename = `${base}-${timestamp}${ext}`
    filepath = path.join(projectDir, filename)
  } catch {
    // File doesn't exist, use original name
  }

  // Write file to disk
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  await fs.writeFile(filepath, buffer)

  return { filepath, filename }
}
```

**Acceptance Criteria:**
- [ ] Multipart/form-data uploads work correctly
- [ ] File type validation rejects unsupported types
- [ ] File size validation rejects oversized files
- [ ] Files are saved to correct directory structure
- [ ] Filename collisions are handled with timestamps
- [ ] Document record created in database
- [ ] 202 Accepted status returned (async processing)
- [ ] Proper error messages for validation failures
- [ ] Tests: Upload valid files, reject invalid types, reject oversized files, handle collisions

---

### Task 1.6: Document Processing Pipeline
**Description:** Implement document processors for PDF, DOCX, XLSX, and Markdown with outline extraction
**Size:** X-Large
**Priority:** Critical
**Dependencies:** Task 1.5
**Can run parallel with:** Task 1.7 (LLM integration)

**See:** `specs/01-document-processing-algorithms.md` for complete implementation

**Technical Requirements:**
- PDF processing with pdf-parse
- DOCX processing with mammoth
- XLSX processing with SheetJS (xlsx)
- Markdown processing (native)
- Section ID generation using content-based hashing
- Outline extraction for all file types
- Full text extraction
- Quality validation

**Implementation Files:**

**`lib/documents/processDocument.ts` (Main Processor):**
```typescript
import { processPDF } from './processors/pdf'
import { processDOCX } from './processors/docx'
import { processXLSX } from './processors/xlsx'
import { processMarkdown } from './processors/markdown'
import { prisma } from '@/lib/db'
import { DocumentProcessingError } from '@/lib/errors/AppError'

export interface ProcessedDocument {
  fullText: string
  outline: {
    sections: Array<{
      id: string
      title: string
      level: number
      position: number
      startChar: number
      endChar: number
    }>
  }
  summary: string
  keyTopics: string[]
  quality: {
    textCompleteness: number  // 0-1
    outlineQuality: number     // 0-1
    processingWarnings: string[]
  }
}

export async function processDocument(
  documentId: string
): Promise<ProcessedDocument> {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (!document) {
    throw new DocumentProcessingError('Document not found')
  }

  let processed: ProcessedDocument

  try {
    switch (document.filetype.toLowerCase()) {
      case 'pdf':
        processed = await processPDF(document.filepath)
        break
      case 'docx':
        processed = await processDOCX(document.filepath)
        break
      case 'xlsx':
        processed = await processXLSX(document.filepath)
        break
      case 'md':
      case 'markdown':
        processed = await processMarkdown(document.filepath)
        break
      default:
        throw new DocumentProcessingError(
          `Unsupported file type: ${document.filetype}`,
          document.filetype
        )
    }

    // Update document record with processed data
    await prisma.document.update({
      where: { id: documentId },
      data: {
        fullText: processed.fullText,
        outline: processed.outline,
        summary: processed.summary,
        keyTopics: processed.keyTopics
      }
    })

    return processed

  } catch (error) {
    console.error(`[Process Document ${documentId}] Error:`, error)

    // Mark document as failed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        fullText: 'PROCESSING_FAILED',
        outline: { sections: [], error: String(error) }
      }
    })

    throw error
  }
}
```

**`lib/documents/processors/pdf.ts`:**
```typescript
import pdf from 'pdf-parse'
import fs from 'fs/promises'
import crypto from 'crypto'
import { ProcessedDocument } from '../processDocument'

export async function processPDF(filepath: string): Promise<ProcessedDocument> {
  const buffer = await fs.readFile(filepath)
  const data = await pdf(buffer)

  const fullText = data.text
  const outline = extractPDFOutline(fullText)
  const summary = generateSummary(fullText)
  const keyTopics = extractKeyTopics(fullText)
  const quality = validateQuality(fullText, outline)

  return {
    fullText,
    outline,
    summary,
    keyTopics,
    quality
  }
}

function extractPDFOutline(text: string) {
  const sections: Array<{
    id: string
    title: string
    level: number
    position: number
    startChar: number
    endChar: number
  }> = []

  // Strategy 1: Detect headings by common patterns
  const headingPatterns = [
    // "1. Introduction", "1.1 Overview"
    /^(\d+\.)+\s+(.+)$/gm,
    // "Chapter 1:", "Section A:"
    /^(Chapter|Section|Part)\s+[\dA-Z]+:?\s+(.+)$/gim,
    // ALL CAPS headings (minimum 3 words)
    /^([A-Z][A-Z\s]{10,})$/gm
  ]

  let position = 0
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) continue

    for (const pattern of headingPatterns) {
      const match = line.match(pattern)

      if (match) {
        const title = line
        const level = determineHeadingLevel(line)
        const startChar = text.indexOf(line, position)
        const endChar = i < lines.length - 1
          ? text.indexOf(lines[i + 1], startChar)
          : text.length

        const id = generateSectionId({
          title,
          level,
          position
        })

        sections.push({
          id,
          title,
          level,
          position,
          startChar,
          endChar
        })

        position++
        break
      }
    }
  }

  // Fallback: If no headings found, create one section for entire document
  if (sections.length === 0) {
    sections.push({
      id: generateSectionId({ title: 'Full Document', level: 1, position: 0 }),
      title: 'Full Document',
      level: 1,
      position: 0,
      startChar: 0,
      endChar: text.length
    })
  }

  return { sections }
}

function determineHeadingLevel(line: string): number {
  // Numbered headings: 1. = level 1, 1.1 = level 2, 1.1.1 = level 3
  const numberMatch = line.match(/^(\d+\.)+/)
  if (numberMatch) {
    return numberMatch[0].split('.').filter(Boolean).length
  }

  // ALL CAPS = level 1
  if (/^[A-Z\s]+$/.test(line)) {
    return 1
  }

  // Chapter/Section = level 1
  if (/^(Chapter|Section|Part)/i.test(line)) {
    return 1
  }

  return 2  // Default
}

function generateSectionId(section: {
  title: string
  level: number
  position: number
}): string {
  const content = [
    section.title.toLowerCase().trim(),
    section.level.toString(),
    section.position.toString()
  ].join('|')

  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16)

  return `section-${hash}`
}

function generateSummary(text: string): string {
  // Take first 500 characters as basic summary
  // In production, this would use LLM to generate intelligent summary
  const preview = text.substring(0, 500).trim()
  return preview.endsWith('.') ? preview : preview + '...'
}

function extractKeyTopics(text: string): string[] {
  // Simple keyword extraction - in production use NLP/LLM
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
  const frequency = new Map<string, number>()

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function validateQuality(
  text: string,
  outline: { sections: any[] }
): {
  textCompleteness: number
  outlineQuality: number
  processingWarnings: string[]
} {
  const warnings: string[] = []

  // Text completeness: Is there substantial text?
  const textCompleteness = Math.min(text.length / 1000, 1)

  if (text.length < 100) {
    warnings.push('Document text is very short')
  }

  // Outline quality: Did we extract meaningful structure?
  const outlineQuality = outline.sections.length > 1 ? 1 : 0.5

  if (outline.sections.length === 1) {
    warnings.push('No clear document structure detected')
  }

  return {
    textCompleteness,
    outlineQuality,
    processingWarnings: warnings
  }
}
```

**`lib/documents/processors/docx.ts`:**
```typescript
import mammoth from 'mammoth'
import fs from 'fs/promises'
import crypto from 'crypto'
import { ProcessedDocument } from '../processDocument'

export async function processDOCX(filepath: string): Promise<ProcessedDocument> {
  const buffer = await fs.readFile(filepath)

  // Extract with style preservation
  const result = await mammoth.extractRawText({ buffer })
  const fullText = result.value

  // Extract with HTML to detect headings
  const htmlResult = await mammoth.convertToHtml({ buffer })
  const outline = extractDOCXOutline(htmlResult.value, fullText)

  const summary = generateSummary(fullText)
  const keyTopics = extractKeyTopics(fullText)
  const quality = validateQuality(fullText, outline, result.messages)

  return {
    fullText,
    outline,
    summary,
    keyTopics,
    quality
  }
}

function extractDOCXOutline(html: string, fullText: string) {
  const sections: Array<{
    id: string
    title: string
    level: number
    position: number
    startChar: number
    endChar: number
  }> = []

  // Parse HTML for heading tags (mammoth converts Word headings to <h1>, <h2>, etc.)
  const headingRegex = /<h(\d)>(.+?)<\/h\d>/gi
  let match
  let position = 0

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const title = match[2].replace(/<[^>]+>/g, '').trim()  // Strip any nested tags

    const startChar = fullText.indexOf(title)
    const endChar = startChar + title.length  // Will be updated with next section

    const id = generateSectionId({ title, level, position })

    sections.push({
      id,
      title,
      level,
      position,
      startChar: startChar >= 0 ? startChar : 0,
      endChar
    })

    position++
  }

  // Update endChar for each section (span to next section)
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].endChar = sections[i + 1].startChar
  }
  if (sections.length > 0) {
    sections[sections.length - 1].endChar = fullText.length
  }

  // Fallback if no headings
  if (sections.length === 0) {
    sections.push({
      id: generateSectionId({ title: 'Full Document', level: 1, position: 0 }),
      title: 'Full Document',
      level: 1,
      position: 0,
      startChar: 0,
      endChar: fullText.length
    })
  }

  return { sections }
}

function generateSectionId(section: {
  title: string
  level: number
  position: number
}): string {
  const content = [
    section.title.toLowerCase().trim(),
    section.level.toString(),
    section.position.toString()
  ].join('|')

  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16)

  return `section-${hash}`
}

function generateSummary(text: string): string {
  const preview = text.substring(0, 500).trim()
  return preview.endsWith('.') ? preview : preview + '...'
}

function extractKeyTopics(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
  const frequency = new Map<string, number>()

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function validateQuality(
  text: string,
  outline: { sections: any[] },
  messages: any[]
): {
  textCompleteness: number
  outlineQuality: number
  processingWarnings: string[]
} {
  const warnings = messages
    .filter(m => m.type === 'warning')
    .map(m => m.message)

  const textCompleteness = Math.min(text.length / 1000, 1)
  const outlineQuality = outline.sections.length > 1 ? 1 : 0.5

  if (text.length < 100) {
    warnings.push('Document text is very short')
  }

  if (outline.sections.length === 1) {
    warnings.push('No clear document structure detected')
  }

  return {
    textCompleteness,
    outlineQuality,
    processingWarnings: warnings
  }
}
```

**`lib/documents/processors/xlsx.ts`:**
```typescript
import * as XLSX from 'xlsx'
import crypto from 'crypto'
import { ProcessedDocument } from '../processDocument'

export async function processXLSX(filepath: string): Promise<ProcessedDocument> {
  const workbook = XLSX.readFile(filepath)

  let fullText = ''
  const sections: Array<{
    id: string
    title: string
    level: number
    position: number
    startChar: number
    endChar: number
  }> = []

  let position = 0

  // Process each sheet as a section
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    const startChar = fullText.length

    // Convert sheet to text
    let sheetText = `Sheet: ${sheetName}\n\n`

    for (const row of sheetData) {
      sheetText += row.join('\t') + '\n'
    }

    fullText += sheetText + '\n\n'
    const endChar = fullText.length

    const id = generateSectionId({
      title: sheetName,
      level: 1,
      position
    })

    sections.push({
      id,
      title: sheetName,
      level: 1,
      position,
      startChar,
      endChar
    })

    position++
  }

  const outline = { sections }
  const summary = generateSummary(fullText)
  const keyTopics = extractKeyTopics(fullText)
  const quality = validateQuality(fullText, outline)

  return {
    fullText,
    outline,
    summary,
    keyTopics,
    quality
  }
}

function generateSectionId(section: {
  title: string
  level: number
  position: number
}): string {
  const content = [
    section.title.toLowerCase().trim(),
    section.level.toString(),
    section.position.toString()
  ].join('|')

  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16)

  return `section-${hash}`
}

function generateSummary(text: string): string {
  const preview = text.substring(0, 500).trim()
  return preview.endsWith('.') ? preview : preview + '...'
}

function extractKeyTopics(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
  const frequency = new Map<string, number>()

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function validateQuality(
  text: string,
  outline: { sections: any[] }
): {
  textCompleteness: number
  outlineQuality: number
  processingWarnings: string[]
} {
  const warnings: string[] = []

  const textCompleteness = Math.min(text.length / 1000, 1)
  const outlineQuality = outline.sections.length > 0 ? 1 : 0

  if (text.length < 100) {
    warnings.push('Spreadsheet contains very little text')
  }

  return {
    textCompleteness,
    outlineQuality,
    processingWarnings: warnings
  }
}
```

**`lib/documents/processors/markdown.ts`:**
```typescript
import fs from 'fs/promises'
import crypto from 'crypto'
import { ProcessedDocument } from '../processDocument'

export async function processMarkdown(filepath: string): Promise<ProcessedDocument> {
  const fullText = await fs.readFile(filepath, 'utf-8')

  const outline = extractMarkdownOutline(fullText)
  const summary = generateSummary(fullText)
  const keyTopics = extractKeyTopics(fullText)
  const quality = validateQuality(fullText, outline)

  return {
    fullText,
    outline,
    summary,
    keyTopics,
    quality
  }
}

function extractMarkdownOutline(text: string) {
  const sections: Array<{
    id: string
    title: string
    level: number
    position: number
    startChar: number
    endChar: number
  }> = []

  // Match markdown headings: # Heading 1, ## Heading 2, etc.
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  let match
  let position = 0

  while ((match = headingRegex.exec(text)) !== null) {
    const level = match[1].length  // Number of # characters
    const title = match[2].trim()
    const startChar = match.index

    const id = generateSectionId({ title, level, position })

    sections.push({
      id,
      title,
      level,
      position,
      startChar,
      endChar: 0  // Will be updated
    })

    position++
  }

  // Update endChar for each section
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].endChar = sections[i + 1].startChar
  }
  if (sections.length > 0) {
    sections[sections.length - 1].endChar = text.length
  }

  // Fallback
  if (sections.length === 0) {
    sections.push({
      id: generateSectionId({ title: 'Full Document', level: 1, position: 0 }),
      title: 'Full Document',
      level: 1,
      position: 0,
      startChar: 0,
      endChar: text.length
    })
  }

  return { sections }
}

function generateSectionId(section: {
  title: string
  level: number
  position: number
}): string {
  const content = [
    section.title.toLowerCase().trim(),
    section.level.toString(),
    section.position.toString()
  ].join('|')

  const hash = crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16)

  return `section-${hash}`
}

function generateSummary(text: string): string {
  const preview = text.substring(0, 500).trim()
  return preview.endsWith('.') ? preview : preview + '...'
}

function extractKeyTopics(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
  const frequency = new Map<string, number>()

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1)
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

function validateQuality(
  text: string,
  outline: { sections: any[] }
): {
  textCompleteness: number
  outlineQuality: number
  processingWarnings: string[]
} {
  const warnings: string[] = []

  const textCompleteness = Math.min(text.length / 1000, 1)
  const outlineQuality = outline.sections.length > 1 ? 1 : 0.5

  if (text.length < 100) {
    warnings.push('Document text is very short')
  }

  if (outline.sections.length === 1) {
    warnings.push('No clear document structure detected')
  }

  return {
    textCompleteness,
    outlineQuality,
    processingWarnings: warnings
  }
}
```

**Background Processing Queue:**
```typescript
// lib/queue/documentQueue.ts
import { processDocument } from '../documents/processDocument'

// Simple in-memory queue for MVP
// In production, use BullMQ or similar
const processingQueue: string[] = []
let isProcessing = false

export async function enqueueDocument(documentId: string): Promise<void> {
  processingQueue.push(documentId)
  processQueue()
}

async function processQueue(): Promise<void> {
  if (isProcessing || processingQueue.length === 0) {
    return
  }

  isProcessing = true

  while (processingQueue.length > 0) {
    const documentId = processingQueue.shift()!

    try {
      await processDocument(documentId)
      console.log(`[Queue] Processed document: ${documentId}`)
    } catch (error) {
      console.error(`[Queue] Failed to process document: ${documentId}`, error)
    }
  }

  isProcessing = false
}
```

**Update Upload Endpoint to Trigger Processing:**
```typescript
// In app/api/projects/[projectId]/documents/route.ts
// After creating document record:

import { enqueueDocument } from '@/lib/queue/documentQueue'

// ... create document ...

// Trigger background processing
await enqueueDocument(document.id)

return NextResponse.json({
  id: document.id,
  filename: document.filename,
  filetype: document.filetype,
  filesize: document.filesize,
  status: 'processing',
  uploadedAt: document.uploadedAt,
  estimatedProcessingTime: 30
}, { status: 202 })
```

**Acceptance Criteria:**
- [ ] PDF documents processed with text and outline extraction
- [ ] DOCX documents processed with heading detection
- [ ] XLSX documents processed with sheet-based outline
- [ ] Markdown documents processed with heading extraction
- [ ] Section IDs generated consistently (content-based hash)
- [ ] Quality validation detects poor extractions
- [ ] Background processing queue handles multiple documents
- [ ] Document status endpoint shows processing progress
- [ ] Processing failures logged and document marked as failed
- [ ] Tests: Each processor with sample files, section ID generation, quality validation

---

### Task 1.7: LLM Integration & Context Layers
**Description:** Implement hybrid RAG system with pgvector, embeddings, and context layer composition
**Size:** X-Large
**Priority:** Critical
**Dependencies:** Task 1.2, Task 1.6
**Can run parallel with:** Task 1.8 (Frontend setup)

**See:** `specs/02-llm-integration-architecture.md` for complete implementation

**Technical Requirements:**
- pgvector extension for PostgreSQL
- Document chunking (500 tokens, 50 overlap)
- OpenAI embeddings (text-embedding-ada-002)
- Semantic search with cosine similarity
- Context layer system (audience, communication, content, engagement)
- System prompt composition
- Token budget management
- Citation verification

**Implementation Files:**

**Enable pgvector:**
```sql
-- Run in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;
```

**`lib/embeddings/generateEmbeddings.ts`:**
```typescript
import { prisma } from '@/lib/db'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function generateEmbeddingsForDocument(
  documentId: string
): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId }
  })

  if (!document || !document.fullText) {
    throw new Error('Document not found or not processed')
  }

  // Create chunks
  const chunks = chunkDocument(document.fullText, document.outline as any)

  // Generate embeddings in batches
  const BATCH_SIZE = 100

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    const embeddings = await generateBatchEmbeddings(
      batch.map(c => c.content)
    )

    // Store chunks with embeddings
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      const embedding = embeddings[j]

      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (
          id, "documentId", content, embedding, "sectionId",
          "startChar", "endChar", "chunkIndex", "createdAt"
        )
        VALUES (
          gen_random_uuid(),
          ${documentId},
          ${chunk.content},
          ${embedding}::vector,
          ${chunk.sectionId},
          ${chunk.startChar},
          ${chunk.endChar},
          ${chunk.chunkIndex},
          NOW()
        )
      `
    }
  }

  console.log(`[Embeddings] Generated ${chunks.length} chunks for document ${documentId}`)
}

interface Chunk {
  content: string
  sectionId: string | null
  startChar: number
  endChar: number
  chunkIndex: number
}

function chunkDocument(
  fullText: string,
  outline: { sections: Array<{ id: string; startChar: number; endChar: number }> }
): Chunk[] {
  const chunks: Chunk[] = []
  const MAX_TOKENS = 500
  const OVERLAP_TOKENS = 50
  const CHARS_PER_TOKEN = 4  // Rough estimate

  const chunkSize = MAX_TOKENS * CHARS_PER_TOKEN
  const overlapSize = OVERLAP_TOKENS * CHARS_PER_TOKEN

  let chunkIndex = 0

  // If we have sections, chunk within sections
  if (outline.sections.length > 1) {
    for (const section of outline.sections) {
      const sectionText = fullText.substring(section.startChar, section.endChar)

      for (let i = 0; i < sectionText.length; i += chunkSize - overlapSize) {
        const chunkText = sectionText.substring(i, i + chunkSize)

        chunks.push({
          content: chunkText,
          sectionId: section.id,
          startChar: section.startChar + i,
          endChar: section.startChar + i + chunkText.length,
          chunkIndex: chunkIndex++
        })
      }
    }
  } else {
    // No sections, chunk entire document
    for (let i = 0; i < fullText.length; i += chunkSize - overlapSize) {
      const chunkText = fullText.substring(i, i + chunkSize)

      chunks.push({
        content: chunkText,
        sectionId: null,
        startChar: i,
        endChar: i + chunkText.length,
        chunkIndex: chunkIndex++
      })
    }
  }

  return chunks
}

async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts
  })

  return response.data.map(item => item.embedding)
}
```

**`lib/llm/contextComposition.ts`:**
```typescript
import { prisma } from '@/lib/db'

export interface ComposedContext {
  systemPrompt: string
  documentOutlines: string
  relevantChunks: string
  tokenCount: number
}

export async function buildSystemPrompt(
  projectId: string,
  userMessage: string
): Promise<ComposedContext> {
  // 1. Get agent configuration and context layers
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId }
  })

  const contextLayers = await prisma.contextLayer.findMany({
    where: {
      projectId,
      isActive: true
    },
    orderBy: {
      priority: 'asc'
    }
  })

  // 2. Get all document outlines
  const documents = await prisma.document.findMany({
    where: { projectId },
    select: {
      id: true,
      filename: true,
      outline: true
    }
  })

  // 3. Perform semantic search for relevant chunks
  const relevantChunks = await semanticSearch(projectId, userMessage, 8)

  // 4. Compose system prompt
  let systemPrompt = '# AI AGENT CONFIGURATION\n\n'
  systemPrompt += 'You are an AI representative for a document collection. '
  systemPrompt += 'Your role is to help users understand and navigate the documents.\n\n'

  // Add context layers
  for (const layer of contextLayers) {
    systemPrompt += `## ${layer.name.toUpperCase()}\n\n`
    systemPrompt += layer.content + '\n\n'
    systemPrompt += '---\n\n'
  }

  // Add citation instructions
  systemPrompt += '## DOCUMENT REFERENCING\n\n'
  systemPrompt += 'When citing content from documents:\n'
  systemPrompt += '1. Always cite specific document and section\n'
  systemPrompt += '2. Use format: [DOC:filename:section-id]\n'
  systemPrompt += '3. The frontend will auto-open and highlight the section\n\n'

  // Document outlines
  let documentOutlines = '# DOCUMENT OUTLINES\n\n'
  for (const doc of documents) {
    documentOutlines += `## ${doc.filename}\n\n`
    const outline = doc.outline as any
    if (outline.sections) {
      for (const section of outline.sections) {
        const indent = '  '.repeat(section.level - 1)
        documentOutlines += `${indent}- [${section.id}] ${section.title}\n`
      }
    }
    documentOutlines += '\n'
  }

  // Relevant chunks
  let relevantChunksText = '# RELEVANT DOCUMENT EXCERPTS\n\n'
  for (const chunk of relevantChunks) {
    relevantChunksText += `## From ${chunk.document.filename} - Section [${chunk.sectionId}]\n\n`
    relevantChunksText += chunk.content + '\n\n'
    relevantChunksText += '---\n\n'
  }

  const tokenCount = estimateTokens(systemPrompt + documentOutlines + relevantChunksText)

  return {
    systemPrompt,
    documentOutlines,
    relevantChunks: relevantChunksText,
    tokenCount
  }
}

async function semanticSearch(
  projectId: string,
  query: string,
  topK: number = 8
): Promise<any[]> {
  // Generate embedding for query
  const openai = new (await import('openai')).default({
    apiKey: process.env.OPENAI_API_KEY
  })

  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query
  })

  const queryEmbedding = response.data[0].embedding

  // Search for similar chunks using pgvector
  const results = await prisma.$queryRaw`
    SELECT
      dc.id,
      dc.content,
      dc."sectionId",
      d.filename,
      1 - (dc.embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON dc."documentId" = d.id
    WHERE d."projectId" = ${projectId}
    ORDER BY dc.embedding <=> ${queryEmbedding}::vector
    LIMIT ${topK}
  `

  return results as any[]
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}
```

**`lib/llm/contextLayers.ts`:**
```typescript
import { prisma } from '@/lib/db'

export async function createContextLayersFromInterview(
  projectId: string,
  interviewData: Record<string, any>
): Promise<void> {
  // Parse interview responses and create context layers

  // Layer 1: Audience
  if (interviewData.audience) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        name: 'Audience Configuration',
        category: 'audience',
        priority: 1,
        content: `
### Audience Profile

Primary Audience: ${interviewData.audience.primary}
Expertise Level: ${interviewData.audience.expertise}
Relationship: ${interviewData.audience.relationship}

${interviewData.audience.anticipatedQuestions ? `
Anticipated Questions:
${interviewData.audience.anticipatedQuestions.map((q: string) => `- ${q}`).join('\n')}
` : ''}
        `.trim(),
        metadata: {
          primary: interviewData.audience.primary,
          expertise: interviewData.audience.expertise,
          relationship: interviewData.audience.relationship
        },
        isActive: true,
        isBuiltIn: false
      }
    })
  }

  // Layer 2: Communication Style
  if (interviewData.communication) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        name: 'Communication Configuration',
        category: 'communication',
        priority: 2,
        content: `
### Communication Style

Tone: ${interviewData.communication.tone}
Style: ${interviewData.communication.style}
Citation Style: Always cite specific document sections

${interviewData.communication.useExamples ? 'Use concrete examples when explaining concepts.' : ''}
        `.trim(),
        metadata: {
          tone: interviewData.communication.tone,
          style: interviewData.communication.style,
          useExamples: interviewData.communication.useExamples
        },
        isActive: true,
        isBuiltIn: false
      }
    })
  }

  // Layer 3: Content Strategy
  if (interviewData.content) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        name: 'Content Configuration',
        category: 'content',
        priority: 3,
        content: `
### Content Strategy

Main Purpose: ${interviewData.content.purpose}

${interviewData.content.emphasisAreas?.length > 0 ? `
Emphasis Areas:
${interviewData.content.emphasisAreas.map((a: string) => `- ${a}`).join('\n')}

When answering questions, prioritize information about these topics.
Always tie responses back to these key concerns when relevant.
` : ''}

Speculation: ${interviewData.content.allowSpeculation ? 'Allowed with clear labeling' : 'Not allowed - stick to documented facts only'}
        `.trim(),
        metadata: {
          purpose: interviewData.content.purpose,
          emphasisAreas: interviewData.content.emphasisAreas || [],
          allowSpeculation: interviewData.content.allowSpeculation || false
        },
        isActive: true,
        isBuiltIn: false
      }
    })
  }

  // Layer 4: Engagement Strategy
  if (interviewData.engagement) {
    await prisma.contextLayer.create({
      data: {
        projectId,
        name: 'Engagement Configuration',
        category: 'engagement',
        priority: 4,
        content: `
### Engagement Strategy

${interviewData.engagement.proactiveQuestions?.length > 0 ? `
Proactive Questions to Guide Conversation:
${interviewData.engagement.proactiveQuestions.map((q: string) => `- "${q}"`).join('\n')}

Occasionally ask these questions to guide users toward key insights.
` : ''}

${interviewData.engagement.suggestActions ? 'Suggest next steps and action items when appropriate.' : ''}
        `.trim(),
        metadata: {
          proactiveQuestions: interviewData.engagement.proactiveQuestions || [],
          suggestActions: interviewData.engagement.suggestActions || false
        },
        isActive: true,
        isBuiltIn: false
      }
    })
  }
}
```

**Acceptance Criteria:**
- [ ] pgvector extension enabled in PostgreSQL
- [ ] Document chunking creates 500-token chunks with 50-token overlap
- [ ] Embeddings generated for all document chunks
- [ ] Semantic search returns relevant chunks by cosine similarity
- [ ] Context layers created from interview data
- [ ] System prompt composed with layers + outlines + chunks
- [ ] Token budget stays within model limits (12K tokens)
- [ ] Citation format includes section IDs for auto-open
- [ ] Tests: Chunking logic, embedding generation, semantic search, context composition

---

### Task 1.8: Frontend Setup (React + Vite + shadcn/ui)
**Description:** Initialize React frontend with Vite, TypeScript, Tailwind CSS, and shadcn/ui components
**Size:** Large
**Priority:** Critical
**Dependencies:** Task 1.1
**Can run parallel with:** Task 1.6, Task 1.7

**Technical Requirements:**
- React 18+ with TypeScript
- Vite for fast bundling
- Tailwind CSS + shadcn/ui component library
- React Router for navigation
- Zustand or Context for state management
- Axios for API calls
- TanStack Query for data fetching

**Implementation:**
```bash
# Create React + Vite project
npm create vite@latest frontend -- --template react-ts

# Install dependencies
cd frontend
npm install

# Install Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Install shadcn/ui
npx shadcn-ui@latest init

# Install routing and state
npm install react-router-dom zustand axios @tanstack/react-query
```

**Key Files to Create:**
- `src/lib/api.ts` - Axios client with auth headers
- `src/hooks/useAuth.ts` - Authentication context
- `src/hooks/useProjects.ts` - Project data fetching
- `src/components/ui/*` - shadcn components (button, input, card, etc.)
- `src/pages/Dashboard.tsx` - Main dashboard
- `src/pages/ProjectView.tsx` - Project detail view
- `src/App.tsx` - Router setup

**Acceptance Criteria:**
- [ ] Frontend builds and runs on http://localhost:5173
- [ ] Tailwind CSS styling works
- [ ] shadcn/ui components installed and styled correctly
- [ ] React Router setup with protected routes
- [ ] API client configured with baseURL and auth
- [ ] State management working (zustand store for auth)

---

### Task 1.9: Chat Interface with Streaming
**Description:** Build chat UI with SSE streaming responses and message history
**Size:** X-Large
**Priority:** Critical
**Dependencies:** Task 1.7, Task 1.8
**Can run parallel with:** Task 1.10 (Document viewer)

**See:** `specs/03-api-reference.md` for complete chat API spec

**Technical Requirements:**
- SSE (Server-Sent Events) for streaming LLM responses
- Message history with conversation persistence
- Citation parsing `[DOC:filename:section-id]` → clickable links
- Loading states and error handling
- Auto-scroll to newest message
- Typing indicator while streaming

**Backend Endpoint (`app/api/chat/route.ts`):**
```typescript
import { NextRequest } from 'next/server'
import { buildSystemPrompt } from '@/lib/llm/contextComposition'
import { createStreamingResponse } from '@/lib/llm/streaming'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { projectId, shareCode, sessionId, message, history } = await req.json()

  // Build context
  const context = await buildSystemPrompt(projectId, message)

  // Prepare messages
  const messages: any[] = [
    {
      role: 'system',
      content: context.systemPrompt + '\n\n' + context.documentOutlines + '\n\n' + context.relevantChunks
    },
    ...history.map((h: any) => ({
      role: h.role,
      content: h.content
    })),
    { role: 'user', content: message }
  ]

  // Stream response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages,
    stream: true
  })

  return createStreamingResponse(stream, projectId, sessionId, message)
}
```

**Frontend Component (`components/Chat.tsx`):**
```typescript
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Chat({ projectId, shareCode }: { projectId: string; shareCode: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          shareCode,
          sessionId: localStorage.getItem('sessionId'),
          message: input,
          history: messages.slice(-10)  // Last 10 messages
        })
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices[0]?.delta?.content || ''
              assistantMessage += delta

              setMessages(prev => {
                const newMessages = [...prev]
                const lastMessage = newMessages[newMessages.length - 1]

                if (lastMessage?.role === 'assistant' && !lastMessage.complete) {
                  lastMessage.content = assistantMessage
                } else {
                  newMessages.push({
                    role: 'assistant',
                    content: assistantMessage,
                    timestamp: new Date(),
                    complete: false
                  })
                }

                return newMessages
              })
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }

      // Mark final message as complete
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage) {
          lastMessage.complete = true
        }
        return newMessages
      })

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        error: true
      }])
    } finally {
      setIsStreaming(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} onCitationClick={handleCitationClick} />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question about the documents..."
            disabled={isStreaming}
          />
          <Button onClick={sendMessage} disabled={isStreaming || !input.trim()}>
            {isStreaming ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Chat interface sends messages and displays responses
- [ ] SSE streaming shows tokens as they arrive
- [ ] Messages auto-scroll to bottom
- [ ] Citation links `[DOC:...]` parsed and clickable
- [ ] Conversation history persisted (last 10 messages sent to API)
- [ ] Loading/typing indicator during streaming
- [ ] Error states handled gracefully
- [ ] Tests: Message sending, streaming, citation parsing

---

### Task 1.10: Document Viewer with Auto-Open
**Description:** PDF/DOCX viewer that auto-opens and highlights sections when cited
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.8
**Can run parallel with:** Task 1.9

**Technical Requirements:**
- PDF rendering with react-pdf or pdf.js
- DOCX rendering with mammoth
- Section highlighting by section-id
- Multi-tab document viewing
- Sync between chat citations and document viewer

**Key Libraries:**
```bash
npm install react-pdf pdfjs-dist mammoth
```

**Component (`components/DocumentViewer.tsx`):**
```typescript
import { useState, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function DocumentViewer({
  documents,
  activeSection
}: {
  documents: Doc[]
  activeSection?: { documentId: string; sectionId: string }
}) {
  const [activeTab, setActiveTab] = useState(documents[0]?.id)

  useEffect(() => {
    if (activeSection) {
      setActiveTab(activeSection.documentId)
      scrollToSection(activeSection.sectionId)
    }
  }, [activeSection])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {documents.map(doc => (
          <TabsTrigger key={doc.id} value={doc.id}>
            {doc.filename}
          </TabsTrigger>
        ))}
      </TabsList>

      {documents.map(doc => (
        <TabsContent key={doc.id} value={doc.id}>
          {doc.filetype === 'pdf' ? (
            <PDFViewer document={doc} highlightSection={activeSection?.sectionId} />
          ) : (
            <TextViewer document={doc} highlightSection={activeSection?.sectionId} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

**Acceptance Criteria:**
- [ ] PDF documents render correctly
- [ ] DOCX/text documents display with formatting
- [ ] Multiple documents shown in tabs
- [ ] Clicking citation in chat opens correct document and scrolls to section
- [ ] Section highlighting works visually
- [ ] Mobile-responsive layout

---

### Task 1.11: Share Link System
**Description:** Create and manage share links with access control (password, email)
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3

**See:** `specs/04-authentication-authorization.md` for access control specs

**Technical Requirements:**
- Generate unique share codes (8-character alphanumeric)
- Three access types: public_password, email_required, whitelist
- Share link CRUD endpoints
- Access verification middleware
- Session tracking for anonymous viewers

**Backend Endpoints:**
```typescript
// POST /api/projects/:projectId/share
// Create share link
export async function createShareLink(projectId, accessType, config) {
  const shareCode = generateShareCode()  // e.g., "abc123xy"

  return await prisma.shareLink.create({
    data: {
      projectId,
      shareCode,
      accessType,
      password: config.password ? await hashPassword(config.password) : null,
      whitelist: config.whitelist || [],
      expiresAt: config.expiresAt,
      maxViews: config.maxViews
    }
  })
}

// GET /api/share/:shareCode
// Access share link (public endpoint)
export async function verifyShareAccess(shareCode, email, password) {
  const shareLink = await prisma.shareLink.findUnique({
    where: { shareCode },
    include: { project: { include: { documents: true } } }
  })

  if (!shareLink || (shareLink.expiresAt && shareLink.expiresAt < new Date())) {
    throw new NotFoundError('Share link')
  }

  if (shareLink.maxViews && shareLink.currentViews >= shareLink.maxViews) {
    throw new ForbiddenError('Share link has reached maximum views')
  }

  // Verify access based on type
  if (shareLink.accessType === 'public_password') {
    if (!password || !(await verifyPassword(password, shareLink.password!))) {
      throw new AuthenticationError('Invalid password')
    }
  } else if (shareLink.accessType === 'email_required') {
    if (!email) {
      throw new ValidationError('Email required')
    }
  } else if (shareLink.accessType === 'whitelist') {
    if (!email || !shareLink.whitelist.includes(email)) {
      throw new ForbiddenError('Email not whitelisted')
    }
  }

  // Log access
  await prisma.accessLog.create({
    data: {
      shareLinkId: shareLink.id,
      viewerEmail: email,
      sessionId: generateSessionId()
    }
  })

  return shareLink
}
```

**Acceptance Criteria:**
- [ ] Share links created with unique codes
- [ ] Password protection works correctly
- [ ] Email whitelist enforced
- [ ] Access logs recorded
- [ ] Expired/maxed-out links rejected
- [ ] Tests: All access types, expiration, max views

---

### Task 1.12: Agent Configuration Interview
**Description:** Conversational interview UI to configure AI agent behavior
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.7, Task 1.8

**Technical Requirements:**
- Multi-step form with 5 essential questions
- Dynamic follow-up questions based on responses
- Preview of generated context layers
- Save interview data and generate context layers

**Interview Questions:**
1. Who is your audience? (Primary, expertise level, relationship)
2. What communication style? (Tone, formality, examples)
3. What should the agent emphasize? (Key topics, areas of focus)
4. Should the agent speculate? (Yes with labeling / No, facts only)
5. Proactive engagement? (Suggest questions, action items)

**Frontend Component (`components/AgentInterview.tsx`):**
```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

const INTERVIEW_QUESTIONS = [
  {
    id: 'audience',
    question: "Who will be reading these documents?",
    type: 'multi-field',
    fields: [
      { name: 'primary', label: 'Primary audience', type: 'text', placeholder: 'e.g., Board members, investors, clients' },
      { name: 'expertise', label: 'Expertise level', type: 'select', options: ['Beginner', 'Intermediate', 'Expert'] },
      { name: 'relationship', label: 'Relationship', type: 'select', options: ['Internal team', 'Client/Customer', 'Investor/Board', 'General public'] }
    ]
  },
  {
    id: 'communication',
    question: "What communication style should the AI use?",
    fields: [
      { name: 'tone', label: 'Tone', type: 'select', options: ['Professional', 'Friendly', 'Academic', 'Casual'] },
      { name: 'useExamples', label: 'Use examples', type: 'checkbox' }
    ]
  },
  // ... more questions
]

export function AgentInterview({ projectId, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})

  const handleSubmit = async () => {
    await fetch(`/api/projects/${projectId}/agent-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interviewData: responses })
    })

    onComplete()
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        Configure Your AI Agent
      </h2>
      <p className="text-gray-600 mb-6">
        Answer a few questions to customize how the AI represents your documents.
      </p>

      <QuestionStep
        question={INTERVIEW_QUESTIONS[step]}
        value={responses[INTERVIEW_QUESTIONS[step].id]}
        onChange={(value) => setResponses({ ...responses, [INTERVIEW_QUESTIONS[step].id]: value })}
      />

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
        >
          Back
        </Button>

        {step < INTERVIEW_QUESTIONS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit}>
            Generate Agent
          </Button>
        )}
      </div>
    </Card>
  )
}
```

**Acceptance Criteria:**
- [ ] All 5 interview questions displayed and functional
- [ ] Responses saved to database in AgentConfig.interviewData
- [ ] Context layers generated from responses
- [ ] Preview shows generated agent configuration
- [ ] Can skip optional questions
- [ ] Tests: Interview flow, response validation, context layer generation

---

### Task 1.13: Project Management UI
**Description:** Dashboard for creators to manage projects and documents
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.8

**Pages/Components:**
- Dashboard: List all projects
- Project detail: View documents, share links, analytics
- Document upload interface
- Share link management

**Routes:**
```typescript
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />

  <Route element={<ProtectedRoute />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/projects/:id" element={<ProjectView />} />
    <Route path="/projects/:id/settings" element={<ProjectSettings />} />
  </Route>

  <Route path="/share/:shareCode" element={<ViewerExperience />} />
</Routes>
```

**Acceptance Criteria:**
- [ ] Dashboard shows all user projects
- [ ] Can create new project
- [ ] Project view shows documents and share links
- [ ] Document upload works from project page
- [ ] Share link creation modal functional
- [ ] Routing works correctly

---

### Task 1.14: Basic Analytics
**Description:** Track conversations and display simple metrics for creators
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.2, Task 1.9

**Metrics to Track:**
- Total views per project
- Total conversations
- Average conversation duration
- Questions per session
- Most viewed documents
- Most cited sections

**Analytics Endpoint (`app/api/projects/:id/analytics/route.ts`):**
```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id

  const conversations = await prisma.conversation.findMany({
    where: { projectId },
    include: { events: true }
  })

  const totalConversations = conversations.length
  const totalViews = await prisma.accessLog.count({
    where: { shareLink: { projectId } }
  })

  const avgDuration = conversations.reduce((sum, c) => sum + (c.duration || 0), 0) / totalConversations
  const avgMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0) / totalConversations

  const documentViews = await prisma.$queryRaw`
    SELECT d.filename, COUNT(*) as views
    FROM "AnalyticsEvent" ae
    JOIN "Conversation" c ON ae."conversationId" = c.id
    JOIN "Document" d ON ae."eventData"->>'documentId' = d.id
    WHERE c."projectId" = ${projectId}
      AND ae."eventType" = 'document_opened'
    GROUP BY d.filename
    ORDER BY views DESC
    LIMIT 10
  `

  return NextResponse.json({
    totalViews,
    totalConversations,
    avgDuration,
    avgMessages,
    documentViews
  })
}
```

**Acceptance Criteria:**
- [ ] Analytics data collected during conversations
- [ ] Dashboard displays key metrics
- [ ] Conversation list with details
- [ ] Document view tracking works
- [ ] Section citation tracking works

---

### Task 1.15: Docker Deployment Setup
**Description:** Create Docker Compose configuration for local/production deployment
**Size:** Medium
**Priority:** Medium
**Dependencies:** All Phase 1 tasks

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: conversational_docshare
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/conversational_docshare
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    depends_on:
      - postgres
    volumes:
      - ./backend:/app
      - /app/node_modules
      - documents:/app/documents

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  documents:
```

**Backend Dockerfile:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

**Frontend Dockerfile:**
```dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Acceptance Criteria:**
- [ ] `docker-compose up` starts all services
- [ ] Database initializes with pgvector extension
- [ ] Backend API accessible at http://localhost:3001
- [ ] Frontend accessible at http://localhost:3000
- [ ] Environment variables loaded correctly
- [ ] Volumes persist data across restarts
- [ ] Production build optimized

---

## Phase 2: Multi-Document & Analytics (Weeks 7-9)

### Task 2.1: Enhanced Analytics Dashboard
**Description:** Creator dashboard with conversation summaries and insights
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.14

**Features:**
- Conversation list with AI-generated summaries
- Key topics extracted per conversation
- Sentiment analysis (positive/neutral/negative)
- Questions asked by viewers
- Action items identified
- Export to PDF/CSV

**Acceptance Criteria:**
- [ ] Summaries generated with LLM after each conversation
- [ ] Topics extracted and displayed
- [ ] Conversation details page functional
- [ ] Export functionality works

---

### Task 2.2: Email Notifications
**Description:** Send email notifications for new conversations and activity
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.14

**Use SendGrid or similar service for email delivery.**

**Notifications:**
- New conversation started
- Daily activity summary
- Document access alerts (for whitelist mode)

**Acceptance Criteria:**
- [ ] Email service integrated
- [ ] Notification templates created
- [ ] User can configure notification preferences
- [ ] Emails sent reliably

---

### Task 2.3: Advanced Interview System
**Description:** Enhanced agent configuration with optional advanced settings
**Size:** Medium
**Priority:** Low
**Dependencies:** Task 1.12

**Advanced Options:**
- Custom proactive questions
- Tone customization (slider)
- Model selection (GPT-4, Claude, etc.)
- Temperature adjustment

**Acceptance Criteria:**
- [ ] Advanced settings UI functional
- [ ] Model switching works
- [ ] Custom proactive questions saved and used

---

## Phase 3: Multi-Tenant & Accounts (Weeks 10-13)

### Task 3.1: Viewer Account Creation
**Description:** Allow viewers to create accounts to save conversations
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.3

**Flow:**
1. Viewer completes conversation
2. "Save conversation?" modal appears
3. Can create account (email/password or OAuth)
4. Conversation transferred from anonymous to authenticated user

**Acceptance Criteria:**
- [ ] Conversion modal shown at end of session
- [ ] Account creation works from modal
- [ ] Conversation saved to user account
- [ ] Can return and continue conversation

---

### Task 3.2: Subscription Tiers (Stripe)
**Description:** Implement free/pro tiers with Stripe billing
**Size:** X-Large
**Priority:** High
**Dependencies:** Task 1.3

**Tiers:**
- Free: 1 project, 10 documents, 100 messages/day, basic analytics
- Pro ($X/month): Unlimited projects/documents, unlimited messages, advanced analytics, priority support

**Acceptance Criteria:**
- [ ] Stripe integration working
- [ ] Subscription status checked on all limits
- [ ] Upgrade/downgrade flows functional
- [ ] Billing portal accessible

---

### Task 3.3: Advanced Access Control
**Description:** Email whitelist with bulk import, domain wildcards
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.11

**Features:**
- CSV import for whitelist
- Domain wildcards (*@company.com)
- Individual email management
- Access revocation

**Acceptance Criteria:**
- [ ] CSV import works
- [ ] Domain wildcards functional
- [ ] Can remove emails from whitelist
- [ ] Access logs show who accessed

---

## Phase 4: Polish & Scale (Weeks 14-16)

### Task 4.1: Mobile Responsive Design
**Description:** Optimize all UIs for mobile/tablet
**Size:** Large
**Priority:** High
**Dependencies:** All frontend tasks

**Acceptance Criteria:**
- [ ] Chat interface works well on mobile
- [ ] Document viewer responsive
- [ ] Dashboard mobile-friendly
- [ ] Touch interactions optimized

---

### Task 4.2: Performance Optimization
**Description:** Optimize loading, caching, and rendering
**Size:** Large
**Priority:** High
**Dependencies:** All tasks

**Optimizations:**
- Frontend code splitting
- Image/PDF lazy loading
- API response caching (Redis)
- Database query optimization
- CDN for static assets

**Acceptance Criteria:**
- [ ] Initial load < 2 seconds
- [ ] Chat response streaming smooth
- [ ] Document rendering fast
- [ ] Lighthouse score > 90

---

### Task 4.3: Export Capabilities
**Description:** Export conversations and analytics to PDF/CSV
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 2.1

**Formats:**
- Conversation transcript → PDF with branding
- Analytics dashboard → CSV
- Document annotations → PDF with highlights

**Acceptance Criteria:**
- [ ] PDF generation works for conversations
- [ ] CSV export includes all analytics
- [ ] Exports maintain formatting

---

### Task 4.4: White-Label Options
**Description:** Allow custom branding (logo, colors, domain)
**Size:** Large
**Priority:** Low
**Dependencies:** All tasks

**Features:**
- Custom logo upload
- Brand colors (primary, secondary)
- Custom domain mapping
- Email template branding

**Acceptance Criteria:**
- [ ] Logo and colors apply throughout UI
- [ ] Custom domain works
- [ ] Emails use custom branding

---

### Task 4.5: Advanced Analytics
**Description:** Deeper insights with cohort analysis and trends
**Size:** Medium
**Priority:** Low
**Dependencies:** Task 2.1

**Metrics:**
- Engagement trends over time
- Cohort analysis (viewer behavior)
- A/B testing for agent config
- Heat maps for document sections

**Acceptance Criteria:**
- [ ] Trend charts display correctly
- [ ] Cohort analysis functional
- [ ] Heat maps show popular sections

---

### Task 4.6: Production Hardening
**Description:** Security audit, logging, monitoring, backups
**Size:** Large
**Priority:** Critical
**Dependencies:** All tasks

**Hardening:**
- Security audit (OWASP top 10)
- Comprehensive logging (Winston/Pino)
- Monitoring (Sentry for errors, Prometheus for metrics)
- Automated backups (PostgreSQL)
- Rate limiting on all endpoints
- CORS configuration
- SSL/TLS certificates

**Acceptance Criteria:**
- [ ] Security vulnerabilities addressed
- [ ] Error tracking in production
- [ ] Metrics dashboard operational
- [ ] Backups running daily
- [ ] Rate limits prevent abuse

---

## Summary

**Total Tasks:** 42 tasks across 4 phases

**Phase 1 (15 tasks):** Foundation with document processing, LLM integration, chat, basic analytics
**Phase 2 (3 tasks):** Enhanced analytics and notifications
**Phase 3 (3 tasks):** Multi-tenant with subscriptions and advanced access control
**Phase 4 (6 tasks):** Polish, optimization, and production readiness

**Estimated Timeline:** 14-16 weeks total

**Critical Path:**
1. Tasks 1.1-1.7 (Foundation) → MUST complete first
2. Tasks 1.8-1.13 (UI & Features) → Can parallelize many
3. Task 1.14-1.15 (Analytics & Deployment) → Completes MVP
4. Phases 2-4 → Iterate and enhance

**Parallel Work Opportunities:**
- Frontend (1.8-1.13) can run parallel to backend (1.6-1.7)
- Analytics (1.14) independent of UI work
- Phase 2-4 tasks mostly independent

---

## Next Steps

1. **Review this breakdown** with stakeholders
2. **Set up project management** (use STM tasks or GitHub Projects)
3. **Assign resources** to tasks
4. **Begin Phase 1** with Tasks 1.1-1.5 (foundation)
5. **Iterate** based on learnings from each phase

This breakdown provides complete implementation guidance for all features in the spec. Each task includes technical requirements, code examples, and acceptance criteria for autonomous execution.

