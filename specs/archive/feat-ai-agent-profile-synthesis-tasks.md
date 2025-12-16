# Task Breakdown: AI Agent Profile Synthesis and Display
Generated: 2025-11-26
Source: specs/feat-ai-agent-profile-synthesis.md

## Overview
Add a profile synthesis step after the AI agent interview that creates a comprehensive, human-readable description of the AI agent's persona. The profile consists of 5 editable sections derived from interview answers via LLM synthesis.

## Dependency Graph
```
Task 1.1 (Schema) ─┐
                   ├─► Task 1.2 (Service) ─► Task 1.3 (Controller) ─► Task 1.4 (Routes)
Task 1.2 (Service) ┘                              │
                                                  ▼
                                            Task 1.5 (Tests)
                                                  │
Task 2.1 (API Client) ◄───────────────────────────┘
        │
        ▼
Task 2.2 (AgentProfile Component)
        │
        ▼
Task 2.3 (Integration)
        │
        ▼
Task 3.1 (Auto-regeneration)
        │
        ▼
Task 3.2 (E2E Tests)
```

---

## Phase 1: Backend Infrastructure

### Task 1.1: Add Profile Fields to AgentConfig Schema
**Description**: Extend the AgentConfig Prisma model to store synthesized profile data
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (blocking)

**Technical Requirements**:
- Add 3 new fields to AgentConfig model
- Field `profile` stores JSON with 5 sections
- Field `profileGeneratedAt` tracks synthesis time
- Field `profileSource` tracks origin ("interview" | "manual" | "feedback")

**Implementation - Schema Changes**:
```prisma
model AgentConfig {
  id        String  @id @default(cuid())
  projectId String  @unique
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Interview responses
  interviewData Json

  // Configuration status
  status          String @default("incomplete")
  completionLevel Float  @default(0)

  // AI model preferences
  preferredModel String @default("gpt-4-turbo")
  temperature    Float  @default(0.7)

  // NEW: Synthesized profile
  profile            Json?      // Structured profile sections
  profileGeneratedAt DateTime?  // When profile was last synthesized
  profileSource      String?    // "interview" | "manual" | "feedback" - tracks origin

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("agent_configs")
}
```

**Implementation Steps**:
1. Open `backend/prisma/schema.prisma`
2. Locate the AgentConfig model
3. Add the three new fields after the existing fields
4. Run `npx prisma migrate dev --name add-profile-fields`
5. Run `npx prisma generate` to update the client

**Acceptance Criteria**:
- [ ] Schema updated with 3 new fields
- [ ] Migration runs without errors
- [ ] Prisma client regenerated
- [ ] Existing data is preserved (nullable fields)

---

### Task 1.2: Implement Profile Synthesizer Service
**Description**: Create the backend service that generates profiles using OpenAI GPT-4
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: None

**Technical Requirements**:
- Use OpenAI GPT-4-turbo for synthesis
- 15-second timeout with AbortController
- Max 2000 character content validation
- Structured JSON output format
- Two exported functions: `synthesizeProfile` and `regenerateProfile`

**Implementation - Full Service File**:
Create `backend/src/services/profileSynthesizer.ts`:
```typescript
import { getOpenAI } from '../utils/openai'
import { prisma } from '../utils/prisma'

interface InterviewData {
  audience?: string
  purpose?: string
  tone?: string
  emphasis?: string
  questions?: string
}

interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
}

interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string
  source: 'interview' | 'manual' | 'feedback'
}

// Constants
const MAX_SECTION_LENGTH = 2000
const LLM_TIMEOUT_MS = 15000

const SYNTHESIS_PROMPT = `You are an expert at synthesizing AI agent configurations into clear, human-readable profiles.

Given the following interview responses about an AI agent, synthesize a comprehensive profile with 5 sections.
Each section should be 2-4 sentences of clear, actionable prose written in second person ("Your agent will...").

Interview Responses:
- Target Audience: {audience}
- Primary Purpose: {purpose}
- Communication Tone: {tone}
- Areas to Emphasize: {emphasis}
- Proactive Questions: {questions}

Generate a JSON response with this exact structure:
{
  "identityRole": "Your agent represents... Its primary role is to...",
  "communicationStyle": "Your agent communicates in a... When responding...",
  "contentPriorities": "Your agent prioritizes and emphasizes... When discussing these topics...",
  "engagementApproach": "To guide productive conversations, your agent will... It looks for opportunities to...",
  "keyFramings": "Based on your configuration, your agent frames conversations around... It positions..."
}

Be specific and actionable. Reference the actual values provided, don't use generic placeholders.
If a field is empty or undefined, make reasonable inferences based on the other fields.`

export async function synthesizeProfile(
  interviewData: InterviewData
): Promise<AgentProfile> {
  const openai = getOpenAI()

  const prompt = SYNTHESIS_PROMPT
    .replace('{audience}', interviewData.audience || 'Not specified')
    .replace('{purpose}', interviewData.purpose || 'Not specified')
    .replace('{tone}', interviewData.tone || 'Not specified')
    .replace('{emphasis}', interviewData.emphasis || 'Not specified')
    .replace('{questions}', interviewData.questions || 'Not specified')

  // Create abort controller for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates JSON responses.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1000,
    }, { signal: controller.signal })

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to generate profile: Empty response')
    }

    const generated = JSON.parse(content)

    // Validate and truncate section content
    const validateSection = (content: string): string => {
      if (!content || typeof content !== 'string') {
        return 'Content could not be generated. Please regenerate the profile.'
      }
      return content.length > MAX_SECTION_LENGTH
        ? content.substring(0, MAX_SECTION_LENGTH) + '...'
        : content
    }

    const now = new Date().toISOString()

    return {
      sections: {
        identityRole: {
          id: 'identityRole',
          title: 'Identity & Role',
          content: validateSection(generated.identityRole),
          isEdited: false,
        },
        communicationStyle: {
          id: 'communicationStyle',
          title: 'Communication Style',
          content: validateSection(generated.communicationStyle),
          isEdited: false,
        },
        contentPriorities: {
          id: 'contentPriorities',
          title: 'Content Priorities',
          content: validateSection(generated.contentPriorities),
          isEdited: false,
        },
        engagementApproach: {
          id: 'engagementApproach',
          title: 'Engagement Approach',
          content: validateSection(generated.engagementApproach),
          isEdited: false,
        },
        keyFramings: {
          id: 'keyFramings',
          title: 'Key Framings',
          content: validateSection(generated.keyFramings),
          isEdited: false,
        },
      },
      generatedAt: now,
      source: 'interview',
    }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Profile generation timed out. Please try again.')
    }
    throw error
  }
}

export async function regenerateProfile(projectId: string): Promise<AgentProfile> {
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new Error('Agent config not found')
  }

  const interviewData = agentConfig.interviewData as InterviewData
  const profile = await synthesizeProfile(interviewData)

  await prisma.agentConfig.update({
    where: { projectId },
    data: {
      profile,
      profileGeneratedAt: new Date(),
      profileSource: 'interview',
    },
  })

  return profile
}
```

**Acceptance Criteria**:
- [ ] File created at correct path
- [ ] Both functions exported
- [ ] Timeout handling works (15s)
- [ ] Content validation truncates >2000 chars
- [ ] All 5 sections populated
- [ ] Error handling covers timeout and empty response

---

### Task 1.3: Add Profile Controller Endpoints
**Description**: Create 3 API endpoints for profile operations (generate, get, update)
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: None

**Technical Requirements**:
- POST endpoint for generate/regenerate
- GET endpoint to retrieve profile
- PATCH endpoint to update single section
- All endpoints verify project ownership
- Content validation (max 2000 chars, valid section IDs)

**Implementation - Controller Functions**:
Add to `backend/src/controllers/agent.controller.ts`:
```typescript
import { synthesizeProfile, regenerateProfile } from '../services/profileSynthesizer'

/**
 * Generate or regenerate AI agent profile from interview data
 * POST /api/projects/:projectId/agent/profile
 */
export async function generateAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { force } = req.body // Force regeneration even if profile exists

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  // Check if profile exists and force is false
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig) {
    throw new NotFoundError('Agent configuration')
  }

  if (agentConfig.profile && !force) {
    return res.json({ profile: agentConfig.profile, cached: true })
  }

  // Generate new profile
  const profile = await regenerateProfile(projectId)

  res.json({ profile, cached: false })
}

/**
 * Get AI agent profile
 * GET /api/projects/:projectId/agent/profile
 */
export async function getAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Agent profile')
  }

  res.json({
    profile: agentConfig.profile,
    generatedAt: agentConfig.profileGeneratedAt,
    source: agentConfig.profileSource,
  })
}

/**
 * Update a specific profile section
 * PATCH /api/projects/:projectId/agent/profile
 */
export async function updateAgentProfile(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { projectId } = req.params
  const { sectionId, content } = req.body

  if (!sectionId || !content) {
    throw new ValidationError('sectionId and content are required')
  }

  // Validate content length
  if (content.length > 2000) {
    throw new ValidationError('Section content cannot exceed 2000 characters')
  }

  // Validate sectionId is valid
  const validSections = ['identityRole', 'communicationStyle', 'contentPriorities', 'engagementApproach', 'keyFramings']
  if (!validSections.includes(sectionId)) {
    throw new ValidationError(`Invalid section: ${sectionId}. Must be one of: ${validSections.join(', ')}`)
  }

  // Verify project ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    throw new NotFoundError('Project')
  }

  if (project.ownerId !== req.user.userId) {
    throw new AuthorizationError('You do not own this project')
  }

  const agentConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (!agentConfig?.profile) {
    throw new NotFoundError('Agent profile')
  }

  // Update the specific section
  const profile = agentConfig.profile as AgentProfile
  const section = profile.sections[sectionId as keyof typeof profile.sections]

  section.content = content
  section.isEdited = true
  section.editedAt = new Date().toISOString()

  // Update profile source to 'manual' if any section is manually edited
  profile.source = 'manual'

  await prisma.agentConfig.update({
    where: { projectId },
    data: { profile },
  })

  res.json({
    section: section,
    message: 'Section updated successfully',
  })
}
```

**Acceptance Criteria**:
- [ ] All 3 endpoints implemented
- [ ] Authentication required (401 if not logged in)
- [ ] Ownership check (403 if not owner)
- [ ] Validation errors return 400
- [ ] Generate returns cached:true when profile exists
- [ ] PATCH updates isEdited and editedAt

---

### Task 1.4: Register Profile Routes
**Description**: Add profile routes to Express router
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.3
**Can run parallel with**: None

**Implementation - Routes File**:
Update `backend/src/routes/agent.routes.ts`:
```typescript
import {
  saveAgentConfig,
  getAgentConfig,
  updateAgentPreferences,
  getProjectContextLayers,
  updateContextLayer,
  generateAgentProfile,  // NEW
  getAgentProfile,       // NEW
  updateAgentProfile,    // NEW
} from '../controllers/agent.controller'

// ... existing routes ...

// Profile routes
router.post('/projects/:projectId/agent/profile', authenticate, generateAgentProfile)
router.get('/projects/:projectId/agent/profile', authenticate, getAgentProfile)
router.patch('/projects/:projectId/agent/profile', authenticate, updateAgentProfile)
```

**Acceptance Criteria**:
- [ ] All 3 routes registered
- [ ] authenticate middleware applied
- [ ] Routes use correct HTTP methods (POST, GET, PATCH)

---

### Task 1.5: Write Backend Unit and Integration Tests
**Description**: Create comprehensive tests for profile synthesizer and endpoints
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.4
**Can run parallel with**: Task 2.1 (after routes done)

**Implementation - Unit Tests**:
Create `backend/src/services/__tests__/profileSynthesizer.test.ts`:
```typescript
import { synthesizeProfile, regenerateProfile } from '../profileSynthesizer'
import { prisma } from '../../utils/prisma'

// Mock OpenAI
jest.mock('../../utils/openai', () => ({
  getOpenAI: () => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                identityRole: 'Test identity content',
                communicationStyle: 'Test communication content',
                contentPriorities: 'Test priorities content',
                engagementApproach: 'Test engagement content',
                keyFramings: 'Test framings content',
              })
            }
          }]
        })
      }
    }
  })
}))

describe('profileSynthesizer', () => {
  describe('synthesizeProfile', () => {
    // Purpose: Verify LLM call produces valid profile structure
    it('should generate all 5 sections from interview data', async () => {
      const interviewData = {
        audience: 'Board members',
        purpose: 'Quarterly review',
        tone: 'Professional',
        emphasis: 'ROI metrics',
        questions: 'How does this align with goals?',
      }

      const profile = await synthesizeProfile(interviewData)

      expect(profile.sections).toHaveProperty('identityRole')
      expect(profile.sections).toHaveProperty('communicationStyle')
      expect(profile.sections).toHaveProperty('contentPriorities')
      expect(profile.sections).toHaveProperty('engagementApproach')
      expect(profile.sections).toHaveProperty('keyFramings')
      expect(profile.generatedAt).toBeDefined()
      expect(profile.source).toBe('interview')
    })

    // Purpose: Verify graceful handling of missing data
    it('should handle partial interview data', async () => {
      const interviewData = {
        audience: 'Investors',
        // Other fields undefined
      }

      const profile = await synthesizeProfile(interviewData)

      expect(profile.sections).toBeDefined()
      expect(profile.sections.identityRole.content).toBeDefined()
    })

    // Purpose: Verify empty interview produces valid profile
    it('should handle empty interview data', async () => {
      const profile = await synthesizeProfile({})

      expect(profile.sections).toBeDefined()
      expect(profile.source).toBe('interview')
    })

    // Purpose: Verify content truncation works
    it('should truncate content exceeding 2000 characters', async () => {
      // Mock response with long content
      const longContent = 'A'.repeat(3000)
      jest.spyOn(require('../../utils/openai'), 'getOpenAI').mockReturnValue({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: JSON.stringify({
                    identityRole: longContent,
                    communicationStyle: 'Short',
                    contentPriorities: 'Short',
                    engagementApproach: 'Short',
                    keyFramings: 'Short',
                  })
                }
              }]
            })
          }
        }
      })

      const profile = await synthesizeProfile({})

      expect(profile.sections.identityRole.content.length).toBeLessThanOrEqual(2003) // 2000 + '...'
    })
  })

  describe('regenerateProfile', () => {
    // Purpose: Verify error handling for missing config
    it('should throw if agent config not found', async () => {
      jest.spyOn(prisma.agentConfig, 'findUnique').mockResolvedValue(null)

      await expect(regenerateProfile('nonexistent')).rejects.toThrow('Agent config not found')
    })
  })
})
```

**Implementation - Integration Tests**:
Create `backend/src/controllers/__tests__/agent.profile.test.ts`:
```typescript
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../utils/prisma'

describe('Profile Endpoints', () => {
  let token: string
  let projectId: string
  let otherUserToken: string

  beforeAll(async () => {
    // Setup test user and project
  })

  describe('POST /api/projects/:projectId/agent/profile', () => {
    // Purpose: Verify auth requirement
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/projects/123/agent/profile')

      expect(response.status).toBe(401)
    })

    // Purpose: Verify ownership check
    it('should return 403 if user does not own project', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(response.status).toBe(403)
    })

    // Purpose: Verify successful generation
    it('should generate profile for valid request', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.profile.sections).toBeDefined()
      expect(response.body.cached).toBe(false)
    })

    // Purpose: Verify caching behavior
    it('should return cached profile if exists and force=false', async () => {
      // Second request should return cached
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.body.cached).toBe(true)
    })

    // Purpose: Verify force regeneration
    it('should regenerate when force=true', async () => {
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({ force: true })

      expect(response.body.cached).toBe(false)
    })
  })

  describe('GET /api/projects/:projectId/agent/profile', () => {
    // Purpose: Verify profile retrieval
    it('should return profile with metadata', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.profile).toBeDefined()
      expect(response.body.generatedAt).toBeDefined()
      expect(response.body.source).toBeDefined()
    })

    // Purpose: Verify 404 when no profile
    it('should return 404 if profile does not exist', async () => {
      // Create new project without profile
      const response = await request(app)
        .get(`/api/projects/no-profile-project/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
    })
  })

  describe('PATCH /api/projects/:projectId/agent/profile', () => {
    // Purpose: Verify section update
    it('should update specific section content', async () => {
      const response = await request(app)
        .patch(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sectionId: 'communicationStyle',
          content: 'Updated content here',
        })

      expect(response.status).toBe(200)
      expect(response.body.section.content).toBe('Updated content here')
      expect(response.body.section.isEdited).toBe(true)
    })

    // Purpose: Verify invalid section handling
    it('should return 400 for invalid section ID', async () => {
      const response = await request(app)
        .patch(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sectionId: 'invalidSection',
          content: 'Content',
        })

      expect(response.status).toBe(400)
    })

    // Purpose: Verify content length validation
    it('should return 400 if content exceeds 2000 chars', async () => {
      const response = await request(app)
        .patch(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sectionId: 'identityRole',
          content: 'A'.repeat(2001),
        })

      expect(response.status).toBe(400)
    })
  })
})
```

**Acceptance Criteria**:
- [ ] Unit tests for synthesizeProfile cover all scenarios
- [ ] Unit tests for regenerateProfile cover error cases
- [ ] Integration tests verify auth (401, 403)
- [ ] Integration tests verify CRUD operations
- [ ] Integration tests verify validation errors (400)
- [ ] All tests pass

---

## Phase 2: Frontend Profile Display

### Task 2.1: Add Profile API Methods to Frontend Client
**Description**: Extend the API client with profile endpoints
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.4
**Can run parallel with**: Task 1.5

**Implementation**:
Add to `frontend/src/lib/api.ts`:
```typescript
// Profile endpoints
async generateAgentProfile(projectId: string, force: boolean = false) {
  return this.request<{ profile: AgentProfile; cached: boolean }>(
    `/api/projects/${projectId}/agent/profile`,
    {
      method: 'POST',
      body: JSON.stringify({ force }),
    }
  )
}

async getAgentProfile(projectId: string) {
  return this.request<{ profile: AgentProfile; generatedAt: string; source: string }>(
    `/api/projects/${projectId}/agent/profile`
  )
}

async updateAgentProfileSection(projectId: string, sectionId: string, content: string) {
  return this.request<{ section: ProfileSection; message: string }>(
    `/api/projects/${projectId}/agent/profile`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sectionId, content }),
    }
  )
}
```

**Type Definitions to add**:
```typescript
interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
}

interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string
  source: 'interview' | 'manual' | 'feedback'
}
```

**Acceptance Criteria**:
- [ ] Three API methods added
- [ ] Type definitions included
- [ ] Methods use correct HTTP methods
- [ ] Methods handle response types correctly

---

### Task 2.2: Create AgentProfile Component
**Description**: Build the full AgentProfile React component with loading, editing, and error states
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1
**Can run parallel with**: None

**Implementation - Full Component**:
Create `frontend/src/components/AgentProfile.tsx`:
```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
}

interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string
  source: 'interview' | 'manual' | 'feedback'
}

interface AgentProfileProps {
  projectId: string
  onContinueToTesting: () => void
  onEditInterview: () => void
}

export function AgentProfile({ projectId, onContinueToTesting, onEditInterview }: AgentProfileProps) {
  const [profile, setProfile] = useState<AgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [projectId])

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getAgentProfile(projectId)
      setProfile(response.profile)
    } catch (err) {
      // Profile doesn't exist yet, generate it
      if (err instanceof Error && err.message.includes('not found')) {
        await generateProfile()
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      }
    } finally {
      setLoading(false)
    }
  }

  const generateProfile = async (force: boolean = false) => {
    try {
      setGenerating(true)
      setError('')
      const response = await api.generateAgentProfile(projectId, force)
      setProfile(response.profile)
      if (!response.cached) {
        showNotification('Profile generated successfully')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate profile')
    } finally {
      setGenerating(false)
    }
  }

  const handleEditSection = (sectionId: string, content: string) => {
    setEditingSection(sectionId)
    setEditContent(content)
  }

  const handleSaveSection = async () => {
    if (!editingSection) return

    try {
      setSaving(true)
      await api.updateAgentProfileSection(projectId, editingSection, editContent)

      // Update local state
      if (profile) {
        const updatedProfile = { ...profile }
        const section = updatedProfile.sections[editingSection as keyof typeof updatedProfile.sections]
        section.content = editContent
        section.isEdited = true
        section.editedAt = new Date().toISOString()
        setProfile(updatedProfile)
      }

      setEditingSection(null)
      showNotification('Section saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setEditContent('')
  }

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  const sectionOrder: (keyof AgentProfile['sections'])[] = [
    'identityRole',
    'communicationStyle',
    'contentPriorities',
    'engagementApproach',
    'keyFramings',
  ]

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading profile...</div>
        </div>
      </div>
    )
  }

  if (generating) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <div className="text-gray-600">Generating your AI agent profile...</div>
          <div className="text-sm text-gray-400 mt-2">This usually takes 3-5 seconds</div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">AI Agent Profile</h1>
        <p className="mt-2 text-gray-600">
          Review how your AI agent will communicate with recipients. Edit any section to fine-tune the behavior.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Profile Sections */}
      {profile && (
        <div className="space-y-6">
          {sectionOrder.map((sectionKey) => {
            const section = profile.sections[sectionKey]
            const isEditing = editingSection === sectionKey

            return (
              <div
                key={sectionKey}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                data-testid={`profile-section-${sectionKey}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                    {section.isEdited && (
                      <span className="text-xs text-gray-400">
                        Manually edited
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => handleEditSection(sectionKey, section.content)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                      data-testid={`edit-${sectionKey}`}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSection}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        data-testid="save-section"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{section.content}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => generateProfile(true)}
          disabled={generating}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Regenerate profile from interview
        </button>
      </div>

      {/* Tip */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Tip:</p>
        <p className="mt-1">
          This profile shapes how your AI agent communicates. Test it in the Testing Dojo,
          then return here to make adjustments based on what you observe.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onEditInterview}
          className="rounded-lg px-6 py-2 text-gray-600 hover:bg-gray-100"
        >
          Edit Interview
        </button>

        <button
          onClick={onContinueToTesting}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
          data-testid="continue-to-testing"
        >
          Continue to Testing
        </button>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Component renders 5 profile sections
- [ ] Loading state shows spinner
- [ ] Generating state shows progress message
- [ ] Edit button reveals textarea
- [ ] Save updates local state optimistically
- [ ] Cancel resets edit state
- [ ] Error banner displays on failure
- [ ] Notification toast appears on success
- [ ] All data-testid attributes present for E2E

---

### Task 2.3: Integrate AgentProfile into AgentInterview Flow
**Description**: Add profile view to AgentInterview component and update navigation
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.2
**Can run parallel with**: None

**Implementation - AgentInterview Changes**:
Modify `frontend/src/components/AgentInterview.tsx`:
```typescript
import { AgentProfile } from './AgentProfile'

// Change view type to include 'profile'
const [view, setView] = useState<'interview' | 'summary' | 'profile'>('interview')

// Add handler for profile navigation
const handleContinueToProfile = () => {
  setView('profile')
}

// In summary view, change button to go to profile instead of share
// Replace existing "Continue to Share" button with:
<button
  onClick={handleContinueToProfile}
  className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
  data-testid="continue-to-profile"
>
  Continue to Profile
</button>

// Add profile view rendering before the interview view return
if (view === 'profile') {
  return (
    <AgentProfile
      projectId={projectId}
      onContinueToTesting={() => onComplete?.('navigate-to-test')}
      onEditInterview={() => {
        setCurrentStep(0)
        setView('interview')
      }}
    />
  )
}
```

**Implementation - ProjectPage Changes**:
Modify `frontend/src/pages/ProjectPage.tsx`:
```typescript
// Update AgentInterview onComplete handler to support new action
<AgentInterview
  projectId={projectId!}
  onComplete={(action) => {
    if (action === 'navigate-to-share') {
      setActiveTab('share')
    } else if (action === 'navigate-to-test') {
      setActiveTab('test')  // New tab from Spec 2
    }
  }}
/>
```

**Acceptance Criteria**:
- [ ] View state includes 'profile' option
- [ ] Summary view navigates to profile
- [ ] Profile view renders AgentProfile component
- [ ] "Edit Interview" returns to interview step 0
- [ ] "Continue to Testing" calls onComplete with 'navigate-to-test'
- [ ] ProjectPage handles 'navigate-to-test' action

---

## Phase 3: Integration & Polish

### Task 3.1: Add Profile Auto-Regeneration on Interview Change
**Description**: Automatically regenerate profile when interview answers are saved
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.2

**Implementation**:
Update `backend/src/controllers/agent.controller.ts` in `saveAgentConfig`:
```typescript
import { regenerateProfile } from '../services/profileSynthesizer'

export async function saveAgentConfig(req: Request, res: Response) {
  // ... existing logic for saving agent config ...

  // After saving, check if profile exists and regenerate
  const existingConfig = await prisma.agentConfig.findUnique({
    where: { projectId },
  })

  if (existingConfig?.profile) {
    // Regenerate profile asynchronously (don't block response)
    regenerateProfile(projectId).catch(console.error)
  }

  // ... rest of response ...
}
```

**Acceptance Criteria**:
- [ ] Profile regenerates when interview is saved
- [ ] Regeneration is async (doesn't block response)
- [ ] Errors are logged but don't break the save

---

### Task 3.2: Write E2E Tests for Profile Flow
**Description**: Create Playwright tests for the complete profile workflow
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.3
**Can run parallel with**: Task 3.1

**Implementation**:
Create `e2e/profile-flow.spec.ts`:
```typescript
import { test, expect } from '@playwright/test'

test.describe('AI Agent Profile Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login with test credentials
    await page.goto('/login')
    await page.fill('[data-testid="email"]', 'mbiyimoh@gmail.com')
    await page.fill('[data-testid="password"]', 'MGinfinity09!')
    await page.click('[data-testid="login-button"]')
    await page.waitForURL('/dashboard')
  })

  // Purpose: Verify complete flow from interview to profile
  test('should display profile after completing interview', async ({ page }) => {
    // Navigate to project
    await page.click('[data-testid="project-card"]')
    await page.click('[data-testid="tab-agent"]')

    // Complete interview (if not already complete)
    const interviewInput = page.locator('[data-testid="interview-input"]')
    if (await interviewInput.isVisible()) {
      await page.fill('[data-testid="interview-input"]', 'Board members')
      await page.click('[data-testid="next-button"]')
      // Complete remaining questions...
      await page.click('[data-testid="complete-button"]')
    }

    // Click continue to profile
    await page.click('[data-testid="continue-to-profile"]')

    // Should see profile with 5 sections
    await expect(page.locator('[data-testid^="profile-section-"]')).toHaveCount(5)
    await expect(page.locator('text=Identity & Role')).toBeVisible()
    await expect(page.locator('text=Communication Style')).toBeVisible()
    await expect(page.locator('text=Content Priorities')).toBeVisible()
    await expect(page.locator('text=Engagement Approach')).toBeVisible()
    await expect(page.locator('text=Key Framings')).toBeVisible()
  })

  // Purpose: Verify inline editing works
  test('should allow editing profile sections', async ({ page }) => {
    // Navigate to profile
    await page.click('[data-testid="project-card"]')
    await page.click('[data-testid="tab-agent"]')
    await page.click('[data-testid="continue-to-profile"]')

    // Wait for profile to load
    await expect(page.locator('[data-testid="profile-section-identityRole"]')).toBeVisible()

    // Click edit on first section
    await page.click('[data-testid="edit-identityRole"]')

    // Should show textarea
    await expect(page.locator('textarea')).toBeVisible()

    // Modify content
    await page.fill('textarea', 'Updated identity content for E2E test')
    await page.click('[data-testid="save-section"]')

    // Should show success notification
    await expect(page.locator('text=Section saved')).toBeVisible()

    // Content should be updated
    await expect(page.locator('text=Updated identity content for E2E test')).toBeVisible()
    await expect(page.locator('text=Manually edited')).toBeVisible()
  })

  // Purpose: Verify regeneration works
  test('should regenerate profile from interview', async ({ page }) => {
    // Navigate to profile
    await page.click('[data-testid="project-card"]')
    await page.click('[data-testid="tab-agent"]')
    await page.click('[data-testid="continue-to-profile"]')

    // Click regenerate
    await page.click('text=Regenerate profile from interview')

    // Should show generating state then success
    await expect(page.locator('text=Profile generated successfully')).toBeVisible({ timeout: 10000 })
  })

  // Purpose: Verify navigation to Testing Dojo
  test('should navigate to Testing Dojo on continue', async ({ page }) => {
    // Navigate to profile
    await page.click('[data-testid="project-card"]')
    await page.click('[data-testid="tab-agent"]')
    await page.click('[data-testid="continue-to-profile"]')

    // Click continue to testing
    await page.click('[data-testid="continue-to-testing"]')

    // Should be on Test tab (placeholder until Spec 2)
    await expect(page.locator('[data-testid="tab-test"]')).toHaveAttribute('aria-selected', 'true')
  })
})
```

**Acceptance Criteria**:
- [ ] Test covers full interview → profile flow
- [ ] Test verifies all 5 sections display
- [ ] Test verifies inline editing
- [ ] Test verifies regeneration
- [ ] Test verifies navigation to testing
- [ ] All tests pass

---

## Summary

| Phase | Task | Size | Priority | Dependencies |
|-------|------|------|----------|--------------|
| 1 | 1.1 Schema Changes | Small | High | None |
| 1 | 1.2 Profile Synthesizer Service | Large | High | 1.1 |
| 1 | 1.3 Controller Endpoints | Medium | High | 1.2 |
| 1 | 1.4 Route Registration | Small | High | 1.3 |
| 1 | 1.5 Backend Tests | Medium | High | 1.4 |
| 2 | 2.1 API Client Methods | Small | High | 1.4 |
| 2 | 2.2 AgentProfile Component | Large | High | 2.1 |
| 2 | 2.3 Integration | Medium | High | 2.2 |
| 3 | 3.1 Auto-Regeneration | Small | Medium | 2.3 |
| 3 | 3.2 E2E Tests | Medium | Medium | 2.3 |

**Total Tasks**: 10
**Critical Path**: 1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3
**Parallel Opportunities**:
- Task 1.5 can run parallel with Task 2.1 (after 1.4)
- Task 3.1 can run parallel with Task 3.2

**Estimated Total Size**:
- Small: 3 tasks
- Medium: 4 tasks
- Large: 3 tasks
