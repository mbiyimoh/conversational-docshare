# AI Agent Profile Synthesis and Display

## Status
Draft

## Authors
Claude Code - November 26, 2025

## Overview

Add a profile synthesis step after the AI agent interview that creates a comprehensive, human-readable description of the AI agent's persona. The profile is derived from interview answers via LLM synthesis and provides creators with a "finger to the wind" check before testing their agent with recipients.

The profile consists of 5 editable sections: Identity & Role, Communication Style, Content Priorities, Engagement Approach, and Key Framings. Creators can manually edit any section, and the profile auto-regenerates when interview answers change.

## Background/Problem Statement

### Current State
After completing the AI agent interview, creators see a summary of their raw answers but have no way to understand how those answers translate into actual agent behavior. The interview answers are technical inputs; creators need a human-readable output that describes "who" the agent will be.

### Problem
1. **Abstraction Gap**: Raw interview answers don't clearly communicate how the AI will behave
2. **No Preview Before Testing**: Creators must test to understand if their configuration is correct
3. **No Refinement Loop**: No mechanism to iteratively improve agent persona based on feedback
4. **Cognitive Load**: Creators must mentally translate answers → behavior, which is error-prone

### Solution
A synthesized profile that transforms interview inputs into a cohesive persona description, giving creators confidence before entering the testing phase.

## Goals

- Automatically generate a human-readable AI agent profile from interview answers
- Display profile after interview completion as a review step before testing
- Allow creators to manually edit any profile section inline
- Auto-regenerate profile when interview answers change with visual notification
- Provide clear navigation to Testing Dojo (Spec 2) and back to interview editing
- Complete profile generation in under 5 seconds
- Support future integration with testing feedback application (Spec 2)

## Non-Goals

- Creating a new data entry point (profile is derived from interview)
- Replacing the interview system
- Adding new interview questions
- Building the Testing Dojo (covered in Spec 2)
- Implementing recommendation engine (covered in Spec 3)
- Version history or rollback for profiles
- Collaborative editing

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Profile generation time | < 5 seconds | Backend timer from request to response |
| All sections populated | 100% | No empty/null sections in generated profile |
| Section edit persistence | Immediate | Update reflected after page refresh |
| Profile auto-regeneration | Within 2s of interview save | Async job completion time |
| Error rate | < 1% | Failed profile generations / total requests |

## Technical Dependencies

### External Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| OpenAI SDK | ^4.x | LLM-powered profile synthesis |
| Prisma | ^5.x | Database ORM for profile storage |
| React | ^18.x | Frontend UI components |
| Tailwind CSS | ^3.x | Styling |

### Internal Dependencies
| Component | Path | Purpose |
|-----------|------|---------|
| OpenAI Client | `backend/src/utils/openai.ts` | Singleton LLM client |
| Agent Controller | `backend/src/controllers/agent.controller.ts` | Existing agent config endpoints |
| API Client | `frontend/src/lib/api.ts` | Frontend API communication |
| AgentInterview | `frontend/src/components/AgentInterview.tsx` | Interview completion flow |

## Detailed Design

### Architecture Changes

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PROFILE SYNTHESIS FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

Interview Completion
        │
        ▼
┌───────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ AgentInterview    │────▶│ api.saveAgentConfig │────▶│ Backend:         │
│ (view: 'summary') │     │ + generateProfile   │     │ agent.controller │
└───────────────────┘     └─────────────────────┘     └────────┬─────────┘
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ profileSynthesizer│
                                                      │ .synthesize()    │
                                                      └────────┬─────────┘
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ OpenAI GPT-4     │
                                                      │ Generate profile │
                                                      └────────┬─────────┘
                                                                │
                                                                ▼
                                                      ┌──────────────────┐
                                                      │ AgentConfig.     │
                                                      │ profile (JSON)   │
                                                      └────────┬─────────┘
                                                                │
        ┌───────────────────────────────────────────────────────┘
        ▼
┌───────────────────┐
│ AgentProfile.tsx  │──── Display 5 sections with edit capability
│ (new component)   │
└───────────────────┘
```

### Database Schema Changes

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

### Profile Data Structure

```typescript
interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string  // ISO timestamp
  source: 'interview' | 'manual' | 'feedback'
}

interface ProfileSection {
  id: string           // 'identityRole' | 'communicationStyle' | etc.
  title: string        // Display title
  content: string      // The synthesized prose
  isEdited: boolean    // True if manually edited
  editedAt?: string    // When last edited
}
```

### Backend Implementation

#### New File: `backend/src/services/profileSynthesizer.ts`

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

#### Extended: `backend/src/controllers/agent.controller.ts`

Add three new endpoints:

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

#### Extended: `backend/src/routes/agent.routes.ts`

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

### Frontend Implementation

#### Extended: `frontend/src/lib/api.ts`

```typescript
// Add to ApiClient class

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

#### New File: `frontend/src/components/AgentProfile.tsx`

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
        >
          Continue to Testing
        </button>
      </div>
    </div>
  )
}
```

#### Modified: `frontend/src/components/AgentInterview.tsx`

Add new view state for profile:

```typescript
// Change view type to include 'profile'
const [view, setView] = useState<'interview' | 'summary' | 'profile'>('interview')

// After summary, navigate to profile
const handleContinueToProfile = () => {
  setView('profile')
}

// In summary view, change button text and handler
<button
  onClick={handleContinueToProfile}
  className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
>
  Continue to Profile
</button>

// Add profile view rendering
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

#### Modified: `frontend/src/pages/ProjectPage.tsx`

Update to handle navigation to Test tab:

```typescript
// In AgentInterview onComplete handler
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

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:projectId/agent/profile` | Generate/regenerate profile |
| GET | `/api/projects/:projectId/agent/profile` | Retrieve current profile |
| PATCH | `/api/projects/:projectId/agent/profile` | Update specific section |

### Integration with Interview Changes

When interview answers change (via `saveAgentConfig`), the profile should auto-regenerate:

```typescript
// In saveAgentConfig controller
export async function saveAgentConfig(req: Request, res: Response) {
  // ... existing logic ...

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

## User Experience

### Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Interview  │────▶│   Summary   │────▶│   Profile   │────▶│ Testing Dojo│
│  Questions  │     │   Review    │     │   Review    │     │  (Spec 2)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       └───────────────────┴───────────────────┘                   │
                    Edit Interview                                  │
                                                                   │
       ┌───────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Share     │
│  (Tab)      │
└─────────────┘
```

### Profile Display States

1. **Loading**: Spinner while fetching profile
2. **Generating**: Spinner with message while LLM synthesizes
3. **Viewing**: Display all 5 sections with Edit buttons
4. **Editing**: Inline textarea for selected section
5. **Error**: Red banner with error message

### Edit Interaction

1. User clicks "Edit" on a section
2. Content becomes editable textarea
3. User modifies text
4. User clicks "Save" → Shows "Saving..." → Shows toast "Section saved"
5. Section updates with "Manually edited" indicator

## Testing Strategy

### Unit Tests

```typescript
// backend/src/services/__tests__/profileSynthesizer.test.ts

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

      // Should still generate all sections with reasonable defaults
      expect(profile.sections.identityRole.content).toContain('Investors')
    })

    // Purpose: Verify empty interview produces valid (if generic) profile
    it('should handle empty interview data', async () => {
      const profile = await synthesizeProfile({})

      expect(profile.sections).toBeDefined()
      expect(profile.source).toBe('interview')
    })
  })

  describe('regenerateProfile', () => {
    // Purpose: Verify database update after regeneration
    it('should update AgentConfig with new profile', async () => {
      // Mock prisma and verify update called with correct structure
    })

    // Purpose: Verify error handling for missing config
    it('should throw if agent config not found', async () => {
      await expect(regenerateProfile('nonexistent')).rejects.toThrow()
    })
  })
})
```

### Integration Tests

```typescript
// backend/src/controllers/__tests__/agent.controller.test.ts

describe('Profile Endpoints', () => {
  describe('POST /api/projects/:projectId/agent/profile', () => {
    // Purpose: Verify auth requirement
    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .post('/api/projects/123/agent/profile')

      expect(response.status).toBe(401)
    })

    // Purpose: Verify ownership check
    it('should return 403 if user does not own project', async () => {
      // Setup: Create project owned by different user
      const response = await request(app)
        .post('/api/projects/123/agent/profile')
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(response.status).toBe(403)
    })

    // Purpose: Verify successful generation
    it('should generate profile for valid request', async () => {
      // Setup: Create project with agent config
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.profile.sections).toBeDefined()
    })

    // Purpose: Verify caching behavior
    it('should return cached profile if exists and force=false', async () => {
      // First request generates
      await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      // Second request returns cached
      const response = await request(app)
        .post(`/api/projects/${projectId}/agent/profile`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.body.cached).toBe(true)
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
  })
})
```

### E2E Tests

```typescript
// e2e/profile-flow.spec.ts

import { test, expect } from '@playwright/test'

test.describe('AI Agent Profile Flow', () => {
  // Purpose: Verify complete flow from interview to profile
  test('should display profile after completing interview', async ({ page }) => {
    // Login and navigate to project
    await page.goto('/dashboard')
    await page.click('[data-testid="project-card"]')
    await page.click('[data-testid="tab-agent"]')

    // Complete interview
    await page.fill('[data-testid="interview-input"]', 'Board members')
    await page.click('[data-testid="next-button"]')
    // ... complete remaining questions ...
    await page.click('[data-testid="complete-button"]')

    // Should see summary, then click continue
    await page.click('[data-testid="continue-to-profile"]')

    // Should see profile with 5 sections
    await expect(page.locator('[data-testid="profile-section"]')).toHaveCount(5)
    await expect(page.locator('text=Identity & Role')).toBeVisible()
    await expect(page.locator('text=Communication Style')).toBeVisible()
  })

  // Purpose: Verify inline editing works
  test('should allow editing profile sections', async ({ page }) => {
    // Navigate to profile
    // ...

    // Click edit on first section
    await page.click('[data-testid="edit-identityRole"]')

    // Should show textarea
    await expect(page.locator('textarea')).toBeVisible()

    // Modify content
    await page.fill('textarea', 'Updated identity content')
    await page.click('[data-testid="save-section"]')

    // Should show success notification
    await expect(page.locator('text=Section saved')).toBeVisible()

    // Content should be updated
    await expect(page.locator('text=Updated identity content')).toBeVisible()
    await expect(page.locator('text=Manually edited')).toBeVisible()
  })

  // Purpose: Verify navigation to Testing Dojo
  test('should navigate to Testing Dojo on continue', async ({ page }) => {
    // Navigate to profile
    // ...

    await page.click('[data-testid="continue-to-testing"]')

    // Should be on Test tab (placeholder for now)
    await expect(page.url()).toContain('test')
  })
})
```

## Performance Considerations

### LLM Latency
- Target: < 5 seconds for profile generation
- Mitigation: Use GPT-4-turbo (faster than GPT-4)
- Mitigation: Set max_tokens to 1000 (sufficient for profile)
- Mitigation: Cache generated profiles in database

### Database Queries
- Profile stored as JSON in AgentConfig (single read/write)
- No additional joins required
- Index on projectId already exists

### Frontend
- Profile loaded once on component mount
- Edits are optimistic with local state update
- Toast notifications are non-blocking

## Security Considerations

### Authorization
- All endpoints verify project ownership
- Profile data only accessible to project owner
- No PII stored in profile (synthesized from interview)

### Input Validation
- Section IDs validated against whitelist
- Content length limits enforced (max 2000 chars per section)
- JSON structure validated before database write

### LLM Safety
- Prompt injection mitigated by structured prompt template
- Response format enforced via `response_format: { type: 'json_object' }`
- Content moderation not required (no user-facing LLM output)

## Documentation

### Files to Create/Update

1. **API Documentation**: Add profile endpoints to `specs/03-api-reference.md`
2. **Component Storybook**: Add AgentProfile component stories
3. **User Guide**: Document profile editing workflow

## Implementation Phases

### Phase 1: Backend Infrastructure
- Add profile fields to AgentConfig schema
- Run Prisma migration
- Implement profileSynthesizer service
- Add profile controller endpoints
- Write unit tests for synthesizer
- Write integration tests for endpoints

### Phase 2: Frontend Profile Display
- Create AgentProfile component
- Add profile view to AgentInterview
- Implement profile loading and error states
- Add inline editing functionality
- Add notification toasts
- Write component tests

### Phase 3: Integration & Polish
- Integrate with interview completion flow
- Add profile auto-regeneration on interview change
- Update ProjectPage navigation
- E2E tests for complete flow
- Performance optimization if needed

## Open Questions

1. **Resolved**: Profile editability → Editable by section, tracks manual edits
2. **Resolved**: Navigation flow → Interview → Summary → Profile → Test tab
3. **Future**: How will testing feedback integrate? → Covered in Spec 2

## References

- Ideation document: `docs/ideation/ai-agent-testing-dojo-with-profile.md`
- Existing interview spec: `specs/feat-interview-completion-flow-lean.md`
- Agent controller: `backend/src/controllers/agent.controller.ts`
- OpenAI SDK: https://platform.openai.com/docs/api-reference
- Prisma JSON fields: https://www.prisma.io/docs/orm/prisma-schema/data-model/supported-types#json
