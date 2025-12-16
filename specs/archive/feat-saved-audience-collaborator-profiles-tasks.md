# Task Breakdown: Saved Audience & Collaborator Profiles

**Generated:** 2025-12-07
**Source:** specs/feat-saved-audience-collaborator-profiles.md

---

## Overview

Implement saved audience and collaborator profiles feature allowing users to save reusable profile templates on their Dashboard and import them when creating share links. This involves:
- Two new Prisma models (AudienceProfile, CollaboratorProfile)
- Backend CRUD APIs for both profile types
- Dashboard UI sections for profile management
- ShareLink creation integration for importing profiles

---

## Phase 1: Database Foundation

### Task 1.1: Add Prisma Models for AudienceProfile and CollaboratorProfile

**Description**: Add two new Prisma models to schema.prisma with User relations
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must complete first)

**Technical Requirements**:

Add to `backend/prisma/schema.prisma`:

```prisma
// Saved audience profiles (templates for audience types)
model AudienceProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation("UserAudienceProfiles", fields: [ownerId], references: [id], onDelete: Cascade)

  name        String                    // "Board Members", "Series A Investors"
  description String?  @db.Text         // Optional notes about this audience

  // Configuration fields (match interview/context layer data)
  audienceDescription   String?  @db.Text  // Who they are, background
  communicationStyle    String?  @db.Text  // Formal, casual, technical level
  topicsEmphasis        String?  @db.Text  // What to focus on
  accessType            String   @default("password")  // Default access type

  timesUsed   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}

// Saved individual collaborator profiles
model CollaboratorProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation("UserCollaboratorProfiles", fields: [ownerId], references: [id], onDelete: Cascade)

  name        String                    // "John Smith"
  email       String?                   // Contact email
  description String?  @db.Text         // Role, relationship notes

  // Collaborator-specific preferences
  communicationNotes  String?  @db.Text  // How to communicate with this person
  expertiseAreas      String[]           // What they're experts in
  feedbackStyle       String?            // "direct", "gentle", "detailed", "high-level"

  timesUsed   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
  @@index([email])
}
```

Update User model to add relations:

```prisma
model User {
  // ... existing fields ...
  audienceProfiles     AudienceProfile[]     @relation("UserAudienceProfiles")
  collaboratorProfiles CollaboratorProfile[] @relation("UserCollaboratorProfiles")
}
```

**Implementation Steps**:
1. Open `backend/prisma/schema.prisma`
2. Add AudienceProfile model after existing models
3. Add CollaboratorProfile model after AudienceProfile
4. Add relations to User model
5. Run `cd backend && npm run db:push` to push schema

**Acceptance Criteria**:
- [ ] AudienceProfile model added with all fields
- [ ] CollaboratorProfile model added with all fields
- [ ] User model has both relations
- [ ] `npm run db:push` succeeds without errors
- [ ] Tables visible in database

---

## Phase 2: Backend API

### Task 2.1: Create AudienceProfile Controller

**Description**: Implement CRUD operations for audience profiles
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.2

**Technical Requirements**:

Create `backend/src/controllers/audienceProfile.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'

/**
 * List all audience profiles for the authenticated user
 * GET /api/audience-profiles
 */
export async function getAudienceProfiles(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const profiles = await prisma.audienceProfile.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ profiles })
}

/**
 * Create a new audience profile
 * POST /api/audience-profiles
 */
export async function createAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required')
  }

  // Validate accessType if provided
  const validAccessTypes = ['open', 'email', 'password', 'domain']
  if (accessType && !validAccessTypes.includes(accessType)) {
    throw new ValidationError(`accessType must be one of: ${validAccessTypes.join(', ')}`)
  }

  const profile = await prisma.audienceProfile.create({
    data: {
      ownerId: req.user.userId,
      name: name.trim(),
      description: description || null,
      audienceDescription: audienceDescription || null,
      communicationStyle: communicationStyle || null,
      topicsEmphasis: topicsEmphasis || null,
      accessType: accessType || 'password',
    },
  })

  res.status(201).json({ profile })
}

/**
 * Update an audience profile
 * PATCH /api/audience-profiles/:id
 */
export async function updateAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { name, description, audienceDescription, communicationStyle, topicsEmphasis, accessType } = req.body

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty')
  }

  // Validate accessType if provided
  const validAccessTypes = ['open', 'email', 'password', 'domain']
  if (accessType && !validAccessTypes.includes(accessType)) {
    throw new ValidationError(`accessType must be one of: ${validAccessTypes.join(', ')}`)
  }

  const profile = await prisma.audienceProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(audienceDescription !== undefined && { audienceDescription }),
      ...(communicationStyle !== undefined && { communicationStyle }),
      ...(topicsEmphasis !== undefined && { topicsEmphasis }),
      ...(accessType !== undefined && { accessType }),
    },
  })

  res.json({ profile })
}

/**
 * Delete an audience profile
 * DELETE /api/audience-profiles/:id
 */
export async function deleteAudienceProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  await prisma.audienceProfile.delete({ where: { id } })

  res.status(204).send()
}

/**
 * Increment usage count for a profile
 * POST /api/audience-profiles/:id/use
 */
export async function incrementAudienceProfileUsage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.audienceProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Audience profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  const profile = await prisma.audienceProfile.update({
    where: { id },
    data: { timesUsed: { increment: 1 } },
  })

  res.json({ profile })
}
```

**Acceptance Criteria**:
- [ ] GET /api/audience-profiles returns user's profiles
- [ ] POST /api/audience-profiles creates new profile
- [ ] PATCH /api/audience-profiles/:id updates profile
- [ ] DELETE /api/audience-profiles/:id deletes profile
- [ ] POST /api/audience-profiles/:id/use increments usage
- [ ] All endpoints validate ownership
- [ ] All endpoints require authentication

---

### Task 2.2: Create CollaboratorProfile Controller

**Description**: Implement CRUD operations for collaborator profiles
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 2.1

**Technical Requirements**:

Create `backend/src/controllers/collaboratorProfile.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'

/**
 * List all collaborator profiles for the authenticated user
 * GET /api/collaborator-profiles
 */
export async function getCollaboratorProfiles(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const profiles = await prisma.collaboratorProfile.findMany({
    where: { ownerId: req.user.userId },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({ profiles })
}

/**
 * Create a new collaborator profile
 * POST /api/collaborator-profiles
 */
export async function createCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { name, email, description, communicationNotes, expertiseAreas, feedbackStyle } = req.body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Name is required')
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format')
  }

  // Validate feedbackStyle if provided
  const validFeedbackStyles = ['direct', 'gentle', 'detailed', 'high-level']
  if (feedbackStyle && !validFeedbackStyles.includes(feedbackStyle)) {
    throw new ValidationError(`feedbackStyle must be one of: ${validFeedbackStyles.join(', ')}`)
  }

  // Validate expertiseAreas is array of strings
  if (expertiseAreas && !Array.isArray(expertiseAreas)) {
    throw new ValidationError('expertiseAreas must be an array')
  }

  const profile = await prisma.collaboratorProfile.create({
    data: {
      ownerId: req.user.userId,
      name: name.trim(),
      email: email || null,
      description: description || null,
      communicationNotes: communicationNotes || null,
      expertiseAreas: expertiseAreas || [],
      feedbackStyle: feedbackStyle || null,
    },
  })

  res.status(201).json({ profile })
}

/**
 * Update a collaborator profile
 * PATCH /api/collaborator-profiles/:id
 */
export async function updateCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { name, email, description, communicationNotes, expertiseAreas, feedbackStyle } = req.body

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  // Validate name if provided
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    throw new ValidationError('Name cannot be empty')
  }

  // Validate email format if provided
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError('Invalid email format')
  }

  // Validate feedbackStyle if provided
  const validFeedbackStyles = ['direct', 'gentle', 'detailed', 'high-level']
  if (feedbackStyle && !validFeedbackStyles.includes(feedbackStyle)) {
    throw new ValidationError(`feedbackStyle must be one of: ${validFeedbackStyles.join(', ')}`)
  }

  const profile = await prisma.collaboratorProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(email !== undefined && { email }),
      ...(description !== undefined && { description }),
      ...(communicationNotes !== undefined && { communicationNotes }),
      ...(expertiseAreas !== undefined && { expertiseAreas }),
      ...(feedbackStyle !== undefined && { feedbackStyle }),
    },
  })

  res.json({ profile })
}

/**
 * Delete a collaborator profile
 * DELETE /api/collaborator-profiles/:id
 */
export async function deleteCollaboratorProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  await prisma.collaboratorProfile.delete({ where: { id } })

  res.status(204).send()
}

/**
 * Increment usage count for a profile
 * POST /api/collaborator-profiles/:id/use
 */
export async function incrementCollaboratorProfileUsage(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const existing = await prisma.collaboratorProfile.findUnique({
    where: { id },
    select: { ownerId: true },
  })

  if (!existing) {
    throw new NotFoundError('Collaborator profile')
  }

  if (existing.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this profile')
  }

  const profile = await prisma.collaboratorProfile.update({
    where: { id },
    data: { timesUsed: { increment: 1 } },
  })

  res.json({ profile })
}
```

**Acceptance Criteria**:
- [ ] GET /api/collaborator-profiles returns user's profiles
- [ ] POST /api/collaborator-profiles creates new profile
- [ ] PATCH /api/collaborator-profiles/:id updates profile
- [ ] DELETE /api/collaborator-profiles/:id deletes profile
- [ ] POST /api/collaborator-profiles/:id/use increments usage
- [ ] Email validation works correctly
- [ ] expertiseAreas stored as array
- [ ] All endpoints validate ownership

---

### Task 2.3: Create Routes and Register in App

**Description**: Create route files and register in Express app
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2
**Can run parallel with**: None

**Technical Requirements**:

Create `backend/src/routes/audienceProfile.routes.ts`:

```typescript
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { authenticate } from '../middleware/auth'
import {
  getAudienceProfiles,
  createAudienceProfile,
  updateAudienceProfile,
  deleteAudienceProfile,
  incrementAudienceProfileUsage,
} from '../controllers/audienceProfile.controller'

const router = Router()

router.get('/audience-profiles', authenticate, asyncHandler(getAudienceProfiles))
router.post('/audience-profiles', authenticate, asyncHandler(createAudienceProfile))
router.patch('/audience-profiles/:id', authenticate, asyncHandler(updateAudienceProfile))
router.delete('/audience-profiles/:id', authenticate, asyncHandler(deleteAudienceProfile))
router.post('/audience-profiles/:id/use', authenticate, asyncHandler(incrementAudienceProfileUsage))

export default router
```

Create `backend/src/routes/collaboratorProfile.routes.ts`:

```typescript
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { authenticate } from '../middleware/auth'
import {
  getCollaboratorProfiles,
  createCollaboratorProfile,
  updateCollaboratorProfile,
  deleteCollaboratorProfile,
  incrementCollaboratorProfileUsage,
} from '../controllers/collaboratorProfile.controller'

const router = Router()

router.get('/collaborator-profiles', authenticate, asyncHandler(getCollaboratorProfiles))
router.post('/collaborator-profiles', authenticate, asyncHandler(createCollaboratorProfile))
router.patch('/collaborator-profiles/:id', authenticate, asyncHandler(updateCollaboratorProfile))
router.delete('/collaborator-profiles/:id', authenticate, asyncHandler(deleteCollaboratorProfile))
router.post('/collaborator-profiles/:id/use', authenticate, asyncHandler(incrementCollaboratorProfileUsage))

export default router
```

Update `backend/src/index.ts` to register routes:

```typescript
// Add imports
import audienceProfileRoutes from './routes/audienceProfile.routes'
import collaboratorProfileRoutes from './routes/collaboratorProfile.routes'

// Register routes (add near other route registrations)
app.use('/api', audienceProfileRoutes)
app.use('/api', collaboratorProfileRoutes)
```

**Acceptance Criteria**:
- [ ] Both route files created
- [ ] Routes registered in index.ts
- [ ] All endpoints accessible via correct HTTP methods
- [ ] Authentication middleware applied to all routes

---

## Phase 3: Frontend API Integration

### Task 3.1: Add API Client Methods

**Description**: Add methods to frontend API client for profile operations
**Size**: Small
**Priority**: High
**Dependencies**: Task 2.3
**Can run parallel with**: None

**Technical Requirements**:

Add to `frontend/src/lib/api.ts`:

```typescript
// Types
export interface AudienceProfile {
  id: string
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: string
  timesUsed: number
  createdAt: string
  updatedAt: string
}

export interface CollaboratorProfile {
  id: string
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: string | null
  timesUsed: number
  createdAt: string
  updatedAt: string
}

export interface CreateAudienceProfileInput {
  name: string
  description?: string
  audienceDescription?: string
  communicationStyle?: string
  topicsEmphasis?: string
  accessType?: string
}

export interface CreateCollaboratorProfileInput {
  name: string
  email?: string
  description?: string
  communicationNotes?: string
  expertiseAreas?: string[]
  feedbackStyle?: string
}

// Add methods to ApiClient class

// Audience Profiles
async getAudienceProfiles() {
  return this.request<{ profiles: AudienceProfile[] }>('/api/audience-profiles')
}

async createAudienceProfile(data: CreateAudienceProfileInput) {
  return this.request<{ profile: AudienceProfile }>('/api/audience-profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

async updateAudienceProfile(id: string, data: Partial<CreateAudienceProfileInput>) {
  return this.request<{ profile: AudienceProfile }>(`/api/audience-profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

async deleteAudienceProfile(id: string) {
  return this.request<void>(`/api/audience-profiles/${id}`, { method: 'DELETE' })
}

async incrementAudienceProfileUsage(id: string) {
  return this.request<{ profile: AudienceProfile }>(`/api/audience-profiles/${id}/use`, {
    method: 'POST',
  })
}

// Collaborator Profiles
async getCollaboratorProfiles() {
  return this.request<{ profiles: CollaboratorProfile[] }>('/api/collaborator-profiles')
}

async createCollaboratorProfile(data: CreateCollaboratorProfileInput) {
  return this.request<{ profile: CollaboratorProfile }>('/api/collaborator-profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

async updateCollaboratorProfile(id: string, data: Partial<CreateCollaboratorProfileInput>) {
  return this.request<{ profile: CollaboratorProfile }>(`/api/collaborator-profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

async deleteCollaboratorProfile(id: string) {
  return this.request<void>(`/api/collaborator-profiles/${id}`, { method: 'DELETE' })
}

async incrementCollaboratorProfileUsage(id: string) {
  return this.request<{ profile: CollaboratorProfile }>(`/api/collaborator-profiles/${id}/use`, {
    method: 'POST',
  })
}
```

**Acceptance Criteria**:
- [ ] Types exported for both profile types
- [ ] All CRUD methods implemented
- [ ] Usage increment methods implemented
- [ ] Methods follow existing API client patterns

---

## Phase 4: Frontend UI Components

### Task 4.1: Create SavedProfilesSection Component

**Description**: Create Dashboard section showing both profile types side-by-side
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 4.2, Task 4.3

**Technical Requirements**:

Create `frontend/src/components/SavedProfilesSection.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { api, AudienceProfile, CollaboratorProfile } from '../lib/api'
import { AudienceProfileModal } from './AudienceProfileModal'
import { CollaboratorProfileModal } from './CollaboratorProfileModal'
import { Users, User, Lock, Mail, Globe, Shield, Trash2, Edit2 } from 'lucide-react'

interface SavedProfilesSectionProps {
  onError?: (error: string) => void
}

export function SavedProfilesSection({ onError }: SavedProfilesSectionProps) {
  const [audienceProfiles, setAudienceProfiles] = useState<AudienceProfile[]>([])
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [showAudienceModal, setShowAudienceModal] = useState(false)
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [editingAudience, setEditingAudience] = useState<AudienceProfile | null>(null)
  const [editingCollaborator, setEditingCollaborator] = useState<CollaboratorProfile | null>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      setLoading(true)
      const [audienceRes, collaboratorRes] = await Promise.all([
        api.getAudienceProfiles(),
        api.getCollaboratorProfiles(),
      ])
      setAudienceProfiles(audienceRes.profiles)
      setCollaboratorProfiles(collaboratorRes.profiles)
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAudience = async (id: string) => {
    if (!confirm('Delete this audience profile?')) return
    try {
      await api.deleteAudienceProfile(id)
      setAudienceProfiles(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to delete profile')
    }
  }

  const handleDeleteCollaborator = async (id: string) => {
    if (!confirm('Delete this collaborator profile?')) return
    try {
      await api.deleteCollaboratorProfile(id)
      setCollaboratorProfiles(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to delete profile')
    }
  }

  const getAccessTypeIcon = (accessType: string) => {
    switch (accessType) {
      case 'password': return <Lock className="w-3 h-3" />
      case 'email': return <Mail className="w-3 h-3" />
      case 'domain': return <Shield className="w-3 h-3" />
      default: return <Globe className="w-3 h-3" />
    }
  }

  if (loading) {
    return (
      <section className="mb-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="animate-pulse bg-gray-100 rounded-lg h-48" />
          <div className="animate-pulse bg-gray-100 rounded-lg h-48" />
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Saved Audiences */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Saved Audiences
            </h2>
            <button
              onClick={() => {
                setEditingAudience(null)
                setShowAudienceModal(true)
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + New
            </button>
          </div>
          {audienceProfiles.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow border border-gray-200">
              <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No saved audiences yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Create profiles for common audience types
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {audienceProfiles.map(profile => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{profile.name}</h3>
                      {profile.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{profile.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          {getAccessTypeIcon(profile.accessType)}
                          {profile.accessType}
                        </span>
                        <span>Used {profile.timesUsed} times</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setEditingAudience(profile)
                          setShowAudienceModal(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAudience(profile.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Collaborators */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5" />
              My Collaborators
            </h2>
            <button
              onClick={() => {
                setEditingCollaborator(null)
                setShowCollaboratorModal(true)
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              + New
            </button>
          </div>
          {collaboratorProfiles.length === 0 ? (
            <div className="rounded-lg bg-white p-8 text-center shadow border border-gray-200">
              <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No collaborators saved yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Save profiles for people you work with often
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {collaboratorProfiles.map(profile => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{profile.name}</h3>
                      {profile.email && (
                        <p className="text-sm text-gray-500">{profile.email}</p>
                      )}
                      {profile.expertiseAreas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {profile.expertiseAreas.slice(0, 3).map((area, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {area}
                            </span>
                          ))}
                          {profile.expertiseAreas.length > 3 && (
                            <span className="text-xs text-gray-400">
                              +{profile.expertiseAreas.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {profile.feedbackStyle && (
                          <span className="capitalize">{profile.feedbackStyle}</span>
                        )}
                        <span>Used {profile.timesUsed} times</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => {
                          setEditingCollaborator(profile)
                          setShowCollaboratorModal(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCollaborator(profile.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAudienceModal && (
        <AudienceProfileModal
          profile={editingAudience}
          onClose={() => setShowAudienceModal(false)}
          onSave={async (data) => {
            if (editingAudience) {
              const { profile } = await api.updateAudienceProfile(editingAudience.id, data)
              setAudienceProfiles(prev => prev.map(p => p.id === profile.id ? profile : p))
            } else {
              const { profile } = await api.createAudienceProfile(data)
              setAudienceProfiles(prev => [profile, ...prev])
            }
            setShowAudienceModal(false)
          }}
        />
      )}

      {showCollaboratorModal && (
        <CollaboratorProfileModal
          profile={editingCollaborator}
          onClose={() => setShowCollaboratorModal(false)}
          onSave={async (data) => {
            if (editingCollaborator) {
              const { profile } = await api.updateCollaboratorProfile(editingCollaborator.id, data)
              setCollaboratorProfiles(prev => prev.map(p => p.id === profile.id ? profile : p))
            } else {
              const { profile } = await api.createCollaboratorProfile(data)
              setCollaboratorProfiles(prev => [profile, ...prev])
            }
            setShowCollaboratorModal(false)
          }}
        />
      )}
    </section>
  )
}
```

**Acceptance Criteria**:
- [ ] Component renders two columns on desktop
- [ ] Empty states show for both profile types
- [ ] Profile cards display all relevant info
- [ ] Edit and delete buttons work
- [ ] Modals open for create/edit
- [ ] Loading state shown while fetching

---

### Task 4.2: Create AudienceProfileModal Component

**Description**: Create modal for creating/editing audience profiles
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 4.1, Task 4.3

**Technical Requirements**:

Create `frontend/src/components/AudienceProfileModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { AudienceProfile, CreateAudienceProfileInput } from '../lib/api'

interface AudienceProfileModalProps {
  profile: AudienceProfile | null
  onClose: () => void
  onSave: (data: CreateAudienceProfileInput) => Promise<void>
}

export function AudienceProfileModal({ profile, onClose, onSave }: AudienceProfileModalProps) {
  const [name, setName] = useState(profile?.name || '')
  const [description, setDescription] = useState(profile?.description || '')
  const [audienceDescription, setAudienceDescription] = useState(profile?.audienceDescription || '')
  const [communicationStyle, setCommunicationStyle] = useState(profile?.communicationStyle || '')
  const [topicsEmphasis, setTopicsEmphasis] = useState(profile?.topicsEmphasis || '')
  const [accessType, setAccessType] = useState(profile?.accessType || 'password')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    try {
      setSaving(true)
      setError('')
      await onSave({
        name: name.trim(),
        description: description || undefined,
        audienceDescription: audienceDescription || undefined,
        communicationStyle: communicationStyle || undefined,
        topicsEmphasis: topicsEmphasis || undefined,
        accessType,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {profile ? 'Edit Audience Profile' : 'New Audience Profile'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Board Members, Series A Investors"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief notes about this audience"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Access Type
            </label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="password">Password Protected</option>
              <option value="email">Email Required</option>
              <option value="domain">Domain Restricted</option>
              <option value="open">Open Access</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Audience Background
            </label>
            <textarea
              value={audienceDescription}
              onChange={(e) => setAudienceDescription(e.target.value)}
              placeholder="Who are they? What's their background and expertise?"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Communication Style
            </label>
            <textarea
              value={communicationStyle}
              onChange={(e) => setCommunicationStyle(e.target.value)}
              placeholder="How should the AI communicate? Formal, casual, technical level..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topics to Emphasize
            </label>
            <textarea
              value={topicsEmphasis}
              onChange={(e) => setTopicsEmphasis(e.target.value)}
              placeholder="What topics matter most to this audience?"
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : profile ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Modal opens for create and edit
- [ ] Form pre-fills when editing
- [ ] Name validation works
- [ ] Save button shows loading state
- [ ] Modal closes on backdrop click
- [ ] Error messages display correctly

---

### Task 4.3: Create CollaboratorProfileModal Component

**Description**: Create modal for creating/editing collaborator profiles
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 4.1, Task 4.2

**Technical Requirements**:

Create `frontend/src/components/CollaboratorProfileModal.tsx`:

```tsx
import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { CollaboratorProfile, CreateCollaboratorProfileInput } from '../lib/api'

interface CollaboratorProfileModalProps {
  profile: CollaboratorProfile | null
  onClose: () => void
  onSave: (data: CreateCollaboratorProfileInput) => Promise<void>
}

export function CollaboratorProfileModal({ profile, onClose, onSave }: CollaboratorProfileModalProps) {
  const [name, setName] = useState(profile?.name || '')
  const [email, setEmail] = useState(profile?.email || '')
  const [description, setDescription] = useState(profile?.description || '')
  const [communicationNotes, setCommunicationNotes] = useState(profile?.communicationNotes || '')
  const [expertiseAreas, setExpertiseAreas] = useState<string[]>(profile?.expertiseAreas || [])
  const [newExpertise, setNewExpertise] = useState('')
  const [feedbackStyle, setFeedbackStyle] = useState(profile?.feedbackStyle || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addExpertise = () => {
    if (newExpertise.trim() && !expertiseAreas.includes(newExpertise.trim())) {
      setExpertiseAreas([...expertiseAreas, newExpertise.trim()])
      setNewExpertise('')
    }
  }

  const removeExpertise = (area: string) => {
    setExpertiseAreas(expertiseAreas.filter(a => a !== area))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format')
      return
    }

    try {
      setSaving(true)
      setError('')
      await onSave({
        name: name.trim(),
        email: email || undefined,
        description: description || undefined,
        communicationNotes: communicationNotes || undefined,
        expertiseAreas: expertiseAreas.length > 0 ? expertiseAreas : undefined,
        feedbackStyle: feedbackStyle || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {profile ? 'Edit Collaborator' : 'New Collaborator'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role / Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Advisor, Legal Counsel"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Style
            </label>
            <select
              value={feedbackStyle}
              onChange={(e) => setFeedbackStyle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a style...</option>
              <option value="direct">Direct - Straightforward feedback</option>
              <option value="gentle">Gentle - Diplomatic approach</option>
              <option value="detailed">Detailed - Comprehensive analysis</option>
              <option value="high-level">High-Level - Big picture focus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expertise Areas
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newExpertise}
                onChange={(e) => setNewExpertise(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
                placeholder="Add expertise area"
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={addExpertise}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {expertiseAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {expertiseAreas.map((area, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded"
                  >
                    {area}
                    <button
                      type="button"
                      onClick={() => removeExpertise(area)}
                      className="hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Communication Notes
            </label>
            <textarea
              value={communicationNotes}
              onChange={(e) => setCommunicationNotes(e.target.value)}
              placeholder="How should the AI communicate with this person?"
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : profile ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Modal opens for create and edit
- [ ] Form pre-fills when editing
- [ ] Name and email validation works
- [ ] Expertise areas can be added/removed
- [ ] Save button shows loading state
- [ ] Modal closes on backdrop click

---

### Task 4.4: Integrate SavedProfilesSection into DashboardPage

**Description**: Add the SavedProfilesSection to the Dashboard
**Size**: Small
**Priority**: High
**Dependencies**: Task 4.1
**Can run parallel with**: None

**Technical Requirements**:

Update `frontend/src/pages/DashboardPage.tsx`:

```tsx
// Add import
import { SavedProfilesSection } from '../components/SavedProfilesSection'

// Add to component (after "My Projects" section, around line 172):
{/* Saved Profiles Section */}
<SavedProfilesSection onError={(err) => setError(err)} />
```

**Implementation Steps**:
1. Import SavedProfilesSection component
2. Add component after My Projects section
3. Pass error handler prop
4. Test that section renders correctly

**Acceptance Criteria**:
- [ ] SavedProfilesSection appears on Dashboard
- [ ] Positioned after My Projects section
- [ ] Error handling connected to Dashboard error state
- [ ] Loading states work correctly

---

## Phase 5: Share Link Integration

### Task 5.1: Add Profile Import to ShareLinkManager

**Description**: Add dropdowns to import profiles when creating share links
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 4.4
**Can run parallel with**: None

**Technical Requirements**:

Find the share link creation form (likely in ProjectPage.tsx or a ShareLinkManager component) and add:

```tsx
// State for profiles
const [audienceProfiles, setAudienceProfiles] = useState<AudienceProfile[]>([])
const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([])
const [selectedAudienceId, setSelectedAudienceId] = useState<string>('')
const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('')

// Load profiles on mount
useEffect(() => {
  const loadProfiles = async () => {
    try {
      const [audienceRes, collaboratorRes] = await Promise.all([
        api.getAudienceProfiles(),
        api.getCollaboratorProfiles(),
      ])
      setAudienceProfiles(audienceRes.profiles)
      setCollaboratorProfiles(collaboratorRes.profiles)
    } catch (err) {
      console.error('Failed to load profiles:', err)
    }
  }
  loadProfiles()
}, [])

// Import handlers
const handleImportAudience = (profileId: string) => {
  const profile = audienceProfiles.find(p => p.id === profileId)
  if (profile) {
    setAccessType(profile.accessType)
    // Set other fields if form has them
    setSelectedAudienceId(profileId)
  }
}

const handleImportCollaborator = (profileId: string) => {
  const profile = collaboratorProfiles.find(p => p.id === profileId)
  if (profile && profile.email) {
    // Add email to allowed emails list
    setAllowedEmails(prev =>
      prev.includes(profile.email!) ? prev : [...prev, profile.email!]
    )
    setSelectedCollaboratorId(profileId)
  }
}

// On successful share link creation
const handleCreateShareLink = async () => {
  // ... existing creation logic ...

  // After successful creation, increment usage counts
  if (selectedAudienceId) {
    await api.incrementAudienceProfileUsage(selectedAudienceId)
  }
  if (selectedCollaboratorId) {
    await api.incrementCollaboratorProfileUsage(selectedCollaboratorId)
  }
}

// Add to form JSX (before access type selector):
{/* Import from saved profiles */}
{(audienceProfiles.length > 0 || collaboratorProfiles.length > 0) && (
  <div className="flex gap-4 mb-4">
    {audienceProfiles.length > 0 && (
      <select
        value={selectedAudienceId}
        onChange={(e) => handleImportAudience(e.target.value)}
        className="flex-1 border rounded px-3 py-2 text-sm"
      >
        <option value="">Import Audience Profile...</option>
        {audienceProfiles.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    )}

    {recipientRole === 'collaborator' && collaboratorProfiles.length > 0 && (
      <select
        value={selectedCollaboratorId}
        onChange={(e) => handleImportCollaborator(e.target.value)}
        className="flex-1 border rounded px-3 py-2 text-sm"
      >
        <option value="">Add Collaborator...</option>
        {collaboratorProfiles.map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.email ? ` (${p.email})` : ''}</option>
        ))}
      </select>
    )}
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Audience profile dropdown appears in share link form
- [ ] Collaborator dropdown appears only when recipientRole is 'collaborator'
- [ ] Selecting audience profile sets access type
- [ ] Selecting collaborator adds email to allowed list
- [ ] Usage counts increment on successful share link creation
- [ ] Dropdowns hidden when no profiles exist

---

## Summary

| Phase | Tasks | Can Parallelize |
|-------|-------|-----------------|
| Phase 1: Database | 1 task | No |
| Phase 2: Backend API | 3 tasks | Tasks 2.1 & 2.2 parallel |
| Phase 3: Frontend API | 1 task | No |
| Phase 4: Frontend UI | 4 tasks | Tasks 4.1, 4.2, 4.3 parallel |
| Phase 5: Integration | 1 task | No |

**Total Tasks:** 10
**Estimated Parallel Execution:** Can reduce effective tasks to ~7 with parallelization
**Critical Path:** Task 1.1 → Task 2.1/2.2 → Task 2.3 → Task 3.1 → Task 4.1 → Task 4.4 → Task 5.1
