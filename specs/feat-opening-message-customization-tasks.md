# Task Breakdown: Opening Message Customization & Share Page Reorganization

**Generated**: 2025-12-22
**Source**: specs/feat-opening-message-customization.md

## Overview

Enable users to pre-compose, preview, and refine the AI agent's opening message before sharing. Reorganize ShareLinkManager into 4 logical sections (Audience, Access, Opening Message, Customize Link).

## Execution Strategy

**Parallel Opportunities:**
- Phase 1 tasks can run sequentially (schema → backend → frontend API)
- Phase 2 tasks 2.1-2.3 can run in parallel after Phase 1
- Task 2.4 depends on 2.1-2.3

**Critical Path:** 1.1 → 1.2 → 1.3 → 2.1/2.2/2.3 → 2.4 → 3.1

---

## Phase 1: Foundation (Backend Infrastructure)

### Task 1.1: Add Opening Message Fields to ShareLink Schema

**Description**: Add three new fields to ShareLink model for storing opening messages and version history
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (foundation task)

**Technical Requirements**:

Add to `backend/prisma/schema.prisma` in the ShareLink model:

```prisma
model ShareLink {
  // ... existing fields (after isActive) ...

  // Opening message fields
  openingMessage         String?  @db.Text  // Current active message
  openingMessageVersions Json?              // Array of { version, content, source, createdAt }
  openingMessageSource   String?            // "generated" | "manual" | "refined"
}
```

**Implementation Steps**:
1. Open `backend/prisma/schema.prisma`
2. Locate the ShareLink model (around line 297)
3. Add the three fields after the `isActive` field
4. Run `cd backend && npm run db:push` to apply changes
5. Restart backend server
6. Verify with health check: `curl localhost:4000/health`

**Acceptance Criteria**:
- [ ] Three new fields added to ShareLink model
- [ ] `npm run db:push` completes without errors
- [ ] Backend starts successfully after schema change
- [ ] Health check returns 200 OK

---

### Task 1.2: Add Opening Message API Endpoints

**Description**: Create three API endpoints for generating, refining, and updating opening messages
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1 (schema must be updated first)
**Can run parallel with**: None

**Technical Requirements**:

**Type Definition** (add to `backend/src/types/index.ts` or top of controller):
```typescript
interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}
```

**File**: `backend/src/controllers/shareLink.controller.ts`

**Endpoint 1: Generate Opening Message**
```typescript
import { generateWelcomeMessage } from '../services/welcomeService'
import { getOpenAI } from '../utils/openai'

export async function generateOpeningMessage(req: Request, res: Response) {
  const { id } = req.params
  const shareLink = await prisma.shareLink.findUnique({
    where: { id },
    include: { project: true }
  })

  if (!shareLink) {
    throw new NotFoundError('Share link not found')
  }

  try {
    // Use existing welcomeService.generateWelcomeMessage()
    const message = await generateWelcomeMessage(shareLink.projectId)

    // Save with version history
    const versions = (shareLink.openingMessageVersions as OpeningMessageVersion[] || [])
    const newVersion: OpeningMessageVersion = {
      version: versions.length + 1,
      content: message,
      source: 'generated',
      createdAt: new Date().toISOString()
    }

    // Keep last 10 versions
    const updatedVersions = [...versions, newVersion].slice(-10)

    await prisma.shareLink.update({
      where: { id },
      data: {
        openingMessage: message,
        openingMessageVersions: updatedVersions,
        openingMessageSource: 'generated'
      }
    })

    res.json({ message, versions: updatedVersions })
  } catch (error) {
    console.error('Failed to generate opening message:', error)
    const defaultMessage = `**Hello! I'm your AI assistant for this document collection.**

I'm here to help you explore and understand the materials shared with you. Feel free to ask me questions about specific topics, request summaries, or help finding particular information.

What would you like to know?`

    res.status(503).json({
      error: 'Failed to generate message. Using default.',
      message: defaultMessage,
      isDefault: true
    })
  }
}
```

**Endpoint 2: Refine Opening Message**
```typescript
export async function refineOpeningMessage(req: Request, res: Response) {
  const { id } = req.params
  const { prompt } = req.body

  if (!prompt || typeof prompt !== 'string') {
    throw new ValidationError('Refinement prompt is required')
  }

  const shareLink = await prisma.shareLink.findUnique({ where: { id } })

  if (!shareLink) {
    throw new NotFoundError('Share link not found')
  }

  if (!shareLink.openingMessage) {
    throw new ValidationError('No opening message to refine. Generate one first.')
  }

  try {
    const refinedMessage = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You refine opening messages for document sharing. Maintain markdown formatting. Keep it concise (3-4 paragraphs max). Make targeted changes based on the request.'
        },
        {
          role: 'user',
          content: `Current message:\n${shareLink.openingMessage}\n\nRefinement request: ${prompt}`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const message = refinedMessage.choices[0].message.content

    const versions = (shareLink.openingMessageVersions as OpeningMessageVersion[] || [])
    const newVersion: OpeningMessageVersion = {
      version: versions.length + 1,
      content: message,
      source: 'refined',
      createdAt: new Date().toISOString()
    }
    const updatedVersions = [...versions, newVersion].slice(-10)

    await prisma.shareLink.update({
      where: { id },
      data: {
        openingMessage: message,
        openingMessageVersions: updatedVersions,
        openingMessageSource: 'refined'
      }
    })

    res.json({ message, versions: updatedVersions })
  } catch (error) {
    console.error('Failed to refine opening message:', error)
    res.status(503).json({
      error: 'Failed to refine message. Please try again.'
    })
  }
}
```

**Endpoint 3: Update Opening Message (Manual Edit)**
```typescript
export async function updateOpeningMessage(req: Request, res: Response) {
  const { id } = req.params
  const { message } = req.body

  if (typeof message !== 'string') {
    throw new ValidationError('Message must be a string')
  }

  const shareLink = await prisma.shareLink.findUnique({ where: { id } })

  if (!shareLink) {
    throw new NotFoundError('Share link not found')
  }

  // Save with version history
  const versions = (shareLink.openingMessageVersions as OpeningMessageVersion[] || [])

  // Only add version if message changed
  if (message !== shareLink.openingMessage) {
    const newVersion: OpeningMessageVersion = {
      version: versions.length + 1,
      content: message,
      source: 'manual',
      createdAt: new Date().toISOString()
    }
    const updatedVersions = [...versions, newVersion].slice(-10)

    await prisma.shareLink.update({
      where: { id },
      data: {
        openingMessage: message || null, // Allow clearing
        openingMessageVersions: updatedVersions,
        openingMessageSource: message ? 'manual' : null
      }
    })

    res.json({ message, versions: updatedVersions })
  } else {
    res.json({ message, versions })
  }
}
```

**File**: `backend/src/routes/shareLink.routes.ts`

Add routes (inside authenticated router):
```typescript
import { generateOpeningMessage, refineOpeningMessage, updateOpeningMessage } from '../controllers/shareLink.controller'

// Opening message routes
router.post('/:id/opening-message/generate', asyncHandler(generateOpeningMessage))
router.post('/:id/opening-message/refine', asyncHandler(refineOpeningMessage))
router.patch('/:id/opening-message', asyncHandler(updateOpeningMessage))
```

**Implementation Steps**:
1. Add `OpeningMessageVersion` type definition
2. Add imports for `generateWelcomeMessage` and `getOpenAI`
3. Add three controller functions
4. Register routes in shareLink.routes.ts
5. Test each endpoint manually

**Acceptance Criteria**:
- [ ] POST `/api/share-links/:id/opening-message/generate` returns generated message
- [ ] POST `/api/share-links/:id/opening-message/refine` returns refined message
- [ ] PATCH `/api/share-links/:id/opening-message` updates message
- [ ] All endpoints return version history array
- [ ] Error handling returns appropriate status codes (404, 400, 503)
- [ ] Version history limited to 10 entries

---

### Task 1.3: Update chatService to Use Stored Opening Message

**Description**: Modify createConversation to use stored opening message when available, falling back to dynamic generation
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2

**Technical Requirements**:

**File**: `backend/src/services/chatService.ts`

Modify the `createConversation` function (around line 373):

```typescript
export async function createConversation(
  projectId: string,
  shareLinkId?: string,
  viewerEmail?: string,
  viewerName?: string,
  generateWelcome: boolean = true
) {
  // Import dynamically to avoid circular dependency
  const { generateWelcomeMessage } = await import('./welcomeService')

  const conversation = await prisma.conversation.create({
    data: {
      projectId,
      shareLinkId,
      viewerEmail,
      viewerName,
    },
  })

  // Generate and save welcome message
  if (generateWelcome) {
    try {
      let welcomeMessage: string
      let messageSource: 'stored' | 'generated' = 'generated'

      // NEW: Check for stored opening message on share link
      if (shareLinkId) {
        const shareLink = await prisma.shareLink.findUnique({
          where: { id: shareLinkId },
          select: { openingMessage: true }
        })

        if (shareLink?.openingMessage) {
          welcomeMessage = shareLink.openingMessage
          messageSource = 'stored'
        } else {
          // Fall back to dynamic generation
          welcomeMessage = await generateWelcomeMessage(projectId)
        }
      } else {
        // No share link - use dynamic generation
        welcomeMessage = await generateWelcomeMessage(projectId)
      }

      await prisma.$transaction([
        prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'assistant',
            content: welcomeMessage,
            metadata: {
              isWelcomeMessage: true,
              source: messageSource,
            },
          },
        }),
        prisma.conversation.update({
          where: { id: conversation.id },
          data: { messageCount: { increment: 1 } },
        }),
      ])
    } catch (error) {
      console.error('Failed to generate welcome message:', error)
      // Don't fail conversation creation if welcome message fails
    }
  }

  return conversation
}
```

**Implementation Steps**:
1. Locate `createConversation` function in chatService.ts
2. Add shareLink lookup before generating welcome message
3. Use stored message if available, otherwise fall back to dynamic
4. Add `source` metadata to track message origin
5. Test with share links with and without opening messages

**Acceptance Criteria**:
- [ ] Conversations with stored opening message use that message
- [ ] Conversations without stored message fall back to dynamic generation
- [ ] Message metadata includes `source: 'stored'` or `source: 'generated'`
- [ ] Backward compatible - existing share links continue working

---

### Task 1.4: Add Frontend API Methods

**Description**: Add API methods for opening message operations in frontend
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 1.3

**Technical Requirements**:

**File**: `frontend/src/lib/api.ts`

Add these methods to the api object:

```typescript
// Opening message API methods
async generateOpeningMessage(shareLinkId: string): Promise<{ message: string; versions: OpeningMessageVersion[]; isDefault?: boolean }> {
  const response = await fetch(`${API_URL}/api/share-links/${shareLinkId}/opening-message/generate`, {
    method: 'POST',
    headers: this.getHeaders(),
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json()
    // Return default message on error
    if (error.message && error.isDefault) {
      return { message: error.message, versions: [], isDefault: true }
    }
    throw new Error(error.error || 'Failed to generate message')
  }
  return response.json()
},

async refineOpeningMessage(shareLinkId: string, prompt: string): Promise<{ message: string; versions: OpeningMessageVersion[] }> {
  const response = await fetch(`${API_URL}/api/share-links/${shareLinkId}/opening-message/refine`, {
    method: 'POST',
    headers: this.getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to refine message')
  }
  return response.json()
},

async updateOpeningMessage(shareLinkId: string, message: string): Promise<{ message: string; versions: OpeningMessageVersion[] }> {
  const response = await fetch(`${API_URL}/api/share-links/${shareLinkId}/opening-message`, {
    method: 'PATCH',
    headers: this.getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ message }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update message')
  }
  return response.json()
},
```

Also add the type near the top of the file:
```typescript
interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}
```

**Acceptance Criteria**:
- [ ] `api.generateOpeningMessage()` calls generate endpoint
- [ ] `api.refineOpeningMessage()` calls refine endpoint
- [ ] `api.updateOpeningMessage()` calls update endpoint
- [ ] All methods handle errors gracefully
- [ ] Types are properly defined

---

## Phase 2: Frontend Components

### Task 2.1: Create ShareLinkSection Component

**Description**: Create a reusable collapsible section component following 33 Strategies design system
**Size**: Small
**Priority**: High
**Dependencies**: None (UI component)
**Can run parallel with**: Task 2.2, 2.3

**Technical Requirements**:

**File**: `frontend/src/components/share-link/ShareLinkSection.tsx`

```tsx
import { useState, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ShareLinkSectionProps {
  number: string
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export function ShareLinkSection({ number, title, children, defaultOpen = true }: ShareLinkSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="bg-card-bg border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-mono text-xs uppercase tracking-widest text-accent">
          {number} — {title}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          <div className="pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Component renders with section number and title in 33 Strategies style
- [ ] Chevron rotates on expand/collapse
- [ ] Default open state configurable
- [ ] Smooth transitions on open/close
- [ ] Follows design system colors (accent for number, muted for chevron)

---

### Task 2.2: Create OpeningMessageSection Component

**Description**: Create the opening message editor component with generate, refine, and version history
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.4 (frontend API methods)
**Can run parallel with**: Task 2.1, 2.3

**Technical Requirements**:

**File**: `frontend/src/components/share-link/OpeningMessageSection.tsx`

```tsx
import { useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { Button } from '../ui'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}

interface OpeningMessageSectionProps {
  shareLinkId: string | null // null when creating new link
  projectId: string
  value: string
  versions: OpeningMessageVersion[]
  onMessageChange: (message: string) => void
  onVersionsChange: (versions: OpeningMessageVersion[]) => void
}

export function OpeningMessageSection({
  shareLinkId,
  projectId,
  value,
  versions,
  onMessageChange,
  onVersionsChange
}: OpeningMessageSectionProps) {
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Find current version number
  const currentVersion = versions.length > 0 ? versions[versions.length - 1].version : 0

  const handleGenerate = useCallback(async () => {
    if (!shareLinkId) {
      setError('Save the share link first to generate a message')
      return
    }

    setGenerating(true)
    setError(null)

    try {
      const result = await api.generateOpeningMessage(shareLinkId)
      onMessageChange(result.message)
      onVersionsChange(result.versions)
      if (result.isDefault) {
        setError('Using default message. AI generation temporarily unavailable.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate message')
    } finally {
      setGenerating(false)
    }
  }, [shareLinkId, onMessageChange, onVersionsChange])

  const handleRefine = useCallback(async () => {
    if (!shareLinkId || !refinePrompt.trim()) return

    setRefining(true)
    setError(null)

    try {
      const result = await api.refineOpeningMessage(shareLinkId, refinePrompt.trim())
      onMessageChange(result.message)
      onVersionsChange(result.versions)
      setRefinePrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine message')
    } finally {
      setRefining(false)
    }
  }, [shareLinkId, refinePrompt, onMessageChange, onVersionsChange])

  const handleRestoreVersion = useCallback((version: OpeningMessageVersion) => {
    onMessageChange(version.content)
  }, [onMessageChange])

  const handleManualChange = useCallback((newValue: string) => {
    onMessageChange(newValue)
    setError(null)
  }, [onMessageChange])

  const isLoading = generating || refining

  return (
    <div className="space-y-4">
      {/* Message textarea */}
      <div>
        <textarea
          value={value}
          onChange={(e) => handleManualChange(e.target.value)}
          disabled={isLoading}
          className={cn(
            "w-full min-h-[150px] bg-card-bg border border-border rounded-lg p-3 text-sm text-foreground placeholder:text-muted resize-y",
            "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          placeholder="Click 'Generate' to create an opening message, or write your own..."
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted">{value.length}/1000 characters</span>
          {value.length > 1000 && (
            <span className="text-xs text-destructive">Message too long</span>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* AI Tools */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading || !shareLinkId}
          variant="secondary"
          size="sm"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {value ? 'Regenerate' : 'Generate'}
            </>
          )}
        </Button>
      </div>

      {/* Refine with AI */}
      {value && (
        <div className="bg-background/50 rounded-lg p-3 border border-border/50 space-y-2">
          <label className="text-xs text-dim font-mono uppercase tracking-wide">
            Refine with AI
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              disabled={isLoading}
              placeholder="e.g., Make it more formal, add bullet points..."
              className={cn(
                "flex-1 bg-card-bg border border-border rounded-lg px-3 py-2 text-sm",
                "focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && refinePrompt.trim() && !isLoading) {
                  handleRefine()
                }
              }}
            />
            <Button
              type="button"
              onClick={handleRefine}
              disabled={!refinePrompt.trim() || isLoading || !shareLinkId}
              variant="secondary"
              size="sm"
            >
              {refining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-dim">History:</span>
          {versions.map((v) => (
            <button
              key={v.version}
              type="button"
              onClick={() => handleRestoreVersion(v)}
              className={cn(
                "px-2 py-1 text-xs rounded font-mono transition-colors",
                v.version === currentVersion
                  ? "bg-accent text-background"
                  : "bg-card-bg text-muted hover:text-foreground hover:bg-white/[0.05]"
              )}
              title={`${v.source} - ${new Date(v.createdAt).toLocaleTimeString()}`}
            >
              v{v.version}
            </button>
          ))}
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-muted">
        Tip: Leave empty to auto-generate a personalized message when recipient arrives
      </p>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Textarea displays and edits opening message
- [ ] Generate button creates message via API
- [ ] Regenerate button appears when message exists
- [ ] Refine with AI input and button work
- [ ] Version history pills display and restore on click
- [ ] Loading states show during API calls
- [ ] Error messages display on failure
- [ ] Character count shows with warning over 1000
- [ ] Disabled state when no shareLinkId (new link)

---

### Task 2.3: Refactor ShareLinkManager into Sections

**Description**: Reorganize ShareLinkManager into 4 collapsible sections using ShareLinkSection component
**Size**: Large
**Priority**: High
**Dependencies**: Task 2.1 (ShareLinkSection), Task 2.2 (OpeningMessageSection)
**Can run parallel with**: None (requires 2.1, 2.2)

**Technical Requirements**:

**File**: `frontend/src/components/ShareLinkManager.tsx`

Major refactor to organize existing fields into 4 sections:

**Section 01 - AUDIENCE**:
- Import from Saved Profile (existing dropdowns for audience/collaborator profiles)
- Recipient Role (existing radio buttons for viewer/collaborator)

**Section 02 - ACCESS**:
- Access Type (existing dropdown: public, password, email)
- Password field (conditional, existing)
- Allowed emails field (conditional, existing - if any)

**Section 03 - OPENING MESSAGE**:
- OpeningMessageSection component (new)

**Section 04 - CUSTOMIZE LINK**:
- Link Name (existing input)
- Custom URL (existing collapsible with input)

**Key Changes**:

1. Add imports:
```tsx
import { ShareLinkSection } from './share-link/ShareLinkSection'
import { OpeningMessageSection } from './share-link/OpeningMessageSection'
```

2. Add state for opening message:
```tsx
const [openingMessage, setOpeningMessage] = useState('')
const [openingMessageVersions, setOpeningMessageVersions] = useState<OpeningMessageVersion[]>([])
```

3. Wrap existing UI in sections:
```tsx
{/* Creation Form */}
<div className="space-y-4">
  {/* Section 01: Audience */}
  <ShareLinkSection number="01" title="AUDIENCE">
    {/* Move profile import dropdowns here */}
    {/* Move recipient role radio buttons here */}
  </ShareLinkSection>

  {/* Section 02: Access */}
  <ShareLinkSection number="02" title="ACCESS">
    {/* Move access type dropdown here */}
    {/* Move password field here (conditional) */}
  </ShareLinkSection>

  {/* Section 03: Opening Message */}
  <ShareLinkSection number="03" title="OPENING MESSAGE">
    <OpeningMessageSection
      shareLinkId={null} // null for new links, set after creation
      projectId={projectId}
      value={openingMessage}
      versions={openingMessageVersions}
      onMessageChange={setOpeningMessage}
      onVersionsChange={setOpeningMessageVersions}
    />
  </ShareLinkSection>

  {/* Section 04: Customize Link */}
  <ShareLinkSection number="04" title="CUSTOMIZE LINK">
    {/* Move link name input here */}
    {/* Move custom URL section here */}
  </ShareLinkSection>

  {/* Create button */}
  <Button onClick={handleCreate} disabled={creating}>
    {creating ? 'Creating...' : 'Create Share Link'}
  </Button>
</div>
```

4. Update handleCreate to include opening message:
```tsx
const handleCreate = async () => {
  // ... existing validation ...

  try {
    setCreating(true)
    const data = await api.createShareLink(projectId, {
      accessType,
      password: accessType === 'password' ? password : undefined,
      recipientRole,
      name: linkName || undefined,
      customSlug: customSlug || undefined,
      profileName: selectedProfile?.name,
      openingMessage: openingMessage || undefined, // Add this
    })

    // ... rest of existing logic ...
  }
}
```

5. Also need to update api.createShareLink to pass openingMessage (if not already)

**Implementation Steps**:
1. Create the share-link directory: `frontend/src/components/share-link/`
2. Import new section components
3. Add opening message state
4. Restructure JSX into 4 sections
5. Move existing fields into appropriate sections
6. Update handleCreate to include openingMessage
7. Test all existing functionality still works
8. Test new section layout and collapsibility

**Acceptance Criteria**:
- [ ] UI displays 4 collapsible sections in correct order
- [ ] Section headers show "01 — AUDIENCE" style formatting
- [ ] All existing fields work in new locations
- [ ] Opening message section integrates properly
- [ ] Share link creation includes opening message
- [ ] Sections are collapsible with smooth animation
- [ ] No functionality regressions from existing features

---

## Phase 3: Integration & Testing

### Task 3.1: End-to-End Testing

**Description**: Verify complete flow from creating share link with opening message to recipient viewing it
**Size**: Medium
**Priority**: High
**Dependencies**: All Phase 1 and Phase 2 tasks
**Can run parallel with**: None

**Test Scenarios**:

1. **Generate and save opening message**:
   - Create new share link
   - Click Generate → message appears
   - Create the link
   - Verify message saved in database

2. **Refine opening message**:
   - Create share link with generated message
   - Enter refinement prompt
   - Click Apply → message updated
   - Verify version history shows both versions

3. **Manual edit opening message**:
   - Create share link
   - Type directly in textarea
   - Create the link
   - Verify manual message saved

4. **Version restore**:
   - Create share link with multiple versions
   - Click older version pill
   - Verify message content restored

5. **Recipient sees stored message**:
   - Create share link with custom opening message
   - Access share link as recipient
   - Verify first chat message matches stored opening message

6. **Empty fallback**:
   - Create share link without opening message
   - Access share link as recipient
   - Verify dynamically generated welcome message appears

7. **10 version limit**:
   - Generate message 11+ times
   - Verify only last 10 versions stored

**Acceptance Criteria**:
- [ ] All 7 test scenarios pass
- [ ] No console errors during flows
- [ ] UI feedback (loading, success, errors) works correctly
- [ ] Backward compatibility: existing share links work

---

## Summary

| Phase | Tasks | Size | Parallel Opportunities |
|-------|-------|------|------------------------|
| Phase 1: Foundation | 4 tasks | 3 Small, 1 Medium | 1.3 can run with 1.2; 1.4 can run with 1.3 |
| Phase 2: Frontend | 3 tasks | 1 Small, 2 Large | 2.1, 2.2 can run in parallel |
| Phase 3: Testing | 1 task | Medium | None |

**Total Tasks**: 8
**Critical Path**: 1.1 → 1.2 → 2.2 → 2.3 → 3.1
