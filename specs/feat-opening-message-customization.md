# Opening Message Customization & Share Page Reorganization

## Status
Draft

## Authors
Claude Code - 2025-12-22

## Overview
Enable users to pre-compose, preview, and refine the AI agent's opening message before sharing a capsule. Reorganize the ShareLinkManager into four logical sections (Audience, Access, Opening Message, Customize Link) for better information architecture.

## Problem Statement
Currently, welcome messages are generated dynamically when a recipient opens a share link. This means:
1. **No preview**: Senders cannot see what the first message will be before sharing
2. **No control**: The most important message of the interaction is left entirely to AI generation
3. **Poor UX**: ShareLinkManager has a flat structure that doesn't reflect logical groupings

The opening message is the first impression and sets the tone for how recipients engage with the capsule. Users need control over this crucial touchpoint.

## Goals
- Allow users to generate, edit, and refine opening messages before creating share links
- Provide AI-assisted editing via "Refine with AI" prompt-based iteration
- Maintain version history (10 versions) for safe experimentation
- Reorganize ShareLinkManager into 4 collapsible sections: Audience, Access, Opening Message, Customize Link
- Fall back to dynamic generation if no message is set (backward compatible)

## Success Criteria
- User can preview exact opening message before sharing
- User can generate, manually edit, and AI-refine opening messages
- Version history allows restoring any of the last 10 versions
- Share links without opening messages continue to work (backward compatible)
- UI is organized into 4 logical sections matching the specified order

## Non-Goals
- Multi-language support for opening messages
- A/B testing multiple opening messages per share link
- Conditional opening messages based on recipient email/domain
- Full chat widget preview (simple text preview is sufficient)
- Auto-generation when section opens (explicit button required)
- Opening message analytics/performance tracking

## Technical Approach

### Database Changes
Add three fields to the `ShareLink` model in `backend/prisma/schema.prisma`:

```prisma
model ShareLink {
  // ... existing fields ...

  openingMessage         String?  @db.Text  // Current active message
  openingMessageVersions Json?              // Array of { version, content, source, createdAt }
  openingMessageSource   String?            // "generated" | "manual" | "refined"
}
```

### Key Files Changed

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add 3 fields to ShareLink model |
| `backend/src/controllers/shareLink.controller.ts` | Add opening message endpoints |
| `backend/src/routes/shareLink.routes.ts` | Add opening message routes |
| `backend/src/services/chatService.ts` | Use stored message if available |
| `frontend/src/components/ShareLinkManager.tsx` | Refactor into sectioned layout |
| `frontend/src/components/share-link/OpeningMessageSection.tsx` | New component |
| `frontend/src/lib/api.ts` | Add opening message API methods |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/share-links/:id/opening-message/generate` | Generate message using existing welcomeService logic |
| POST | `/api/share-links/:id/opening-message/refine` | Refine message with user prompt |
| PATCH | `/api/share-links/:id/opening-message` | Update message manually |

### Core Logic Change

```typescript
// chatService.ts - createConversation()
async function createConversation(...) {
  // NEW: Check for stored opening message
  if (shareLinkId) {
    const shareLink = await prisma.shareLink.findUnique({ where: { id: shareLinkId } })
    if (shareLink?.openingMessage) {
      // Use stored message
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: shareLink.openingMessage,
          metadata: { isWelcomeMessage: true, source: 'stored' }
        }
      })
      return conversation
    }
  }

  // EXISTING: Fall back to dynamic generation
  const welcomeMessage = await generateWelcomeMessage(projectId)
  // ... save message
}
```

## Implementation Details

### Type Definitions

```typescript
// Shared type for opening message versions
interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}
```

### 1. Database Schema Update

Run after schema change:
```bash
cd backend && npm run db:push
```

### 2. Opening Message Generation Endpoint

```typescript
// shareLink.controller.ts
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
    // Return default message as fallback
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

### 3. Refine with AI Endpoint

```typescript
export async function refineOpeningMessage(req: Request, res: Response) {
  const { id } = req.params
  const { prompt } = req.body // e.g., "Make it more formal"

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

    // Update with version history (same pattern as generate)
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

### 4. ShareLinkManager Reorganization

Refactor into collapsible sections following 33 Strategies design system:

```tsx
// ShareLinkManager.tsx structure
<Card>
  <SectionHeader number="01" title="AUDIENCE" />
  <SectionContent>
    {/* Profile import dropdowns */}
    {/* Recipient role radio buttons */}
  </SectionContent>
</Card>

<Card>
  <SectionHeader number="02" title="ACCESS" />
  <SectionContent>
    {/* Access type dropdown */}
    {/* Password field (conditional) */}
  </SectionContent>
</Card>

<Card>
  <SectionHeader number="03" title="OPENING MESSAGE" />
  <SectionContent>
    <OpeningMessageSection
      projectId={projectId}
      onMessageChange={setOpeningMessage}
    />
  </SectionContent>
</Card>

<Card>
  <SectionHeader number="04" title="CUSTOMIZE LINK" />
  <SectionContent>
    {/* Link name input */}
    {/* Custom URL input */}
  </SectionContent>
</Card>
```

### 5. OpeningMessageSection Component

```tsx
// frontend/src/components/share-link/OpeningMessageSection.tsx
interface OpeningMessageSectionProps {
  projectId: string
  value: string
  versions: Version[]
  onMessageChange: (message: string) => void
  onVersionsChange: (versions: Version[]) => void
}

export function OpeningMessageSection({ ... }) {
  const [generating, setGenerating] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')

  return (
    <div className="space-y-4">
      {/* Message textarea */}
      <textarea
        value={value}
        onChange={(e) => onMessageChange(e.target.value)}
        className="w-full min-h-[150px] bg-card-bg border border-border rounded-lg p-3"
        placeholder="Click 'Generate' to create an opening message..."
      />
      <div className="text-xs text-muted">{value.length}/1000 characters</div>

      {/* AI Tools */}
      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : 'Generate'}
        </Button>
        <Button variant="secondary" onClick={handleRegenerate} disabled={!value || generating}>
          Regenerate
        </Button>
      </div>

      {/* Refine with AI */}
      <div className="bg-background-elevated rounded-lg p-3 border border-border">
        <label className="text-xs text-dim font-mono uppercase">Refine with AI</label>
        <input
          value={refinePrompt}
          onChange={(e) => setRefinePrompt(e.target.value)}
          placeholder="e.g., Make it more formal"
          className="w-full mt-1 bg-card-bg border border-border rounded-lg px-3 py-2"
        />
        <Button size="sm" onClick={handleRefine} disabled={!refinePrompt || !value}>
          Apply
        </Button>
      </div>

      {/* Version History */}
      {versions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-dim">History:</span>
          {versions.map((v) => (
            <button
              key={v.version}
              onClick={() => handleRestoreVersion(v.version)}
              className={cn(
                "px-2 py-1 text-xs rounded font-mono",
                v.version === currentVersion ? "bg-accent text-background" : "bg-card-bg text-muted"
              )}
            >
              v{v.version}
            </button>
          ))}
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-muted">
        Tip: Leave empty to auto-generate when recipient arrives
      </p>
    </div>
  )
}
```

## User Experience

### Section Layout
Four collapsible sections with 33 Strategies design system styling:
- `01 — AUDIENCE`: Profile import + Recipient role
- `02 — ACCESS`: Access type + Password (if applicable)
- `03 — OPENING MESSAGE`: Message editor with AI tools
- `04 — CUSTOMIZE LINK`: Link name + Custom URL

### Opening Message Flow
1. User expands "Opening Message" section
2. Clicks "Generate" to create initial message using AI
3. Reviews message, optionally edits directly
4. Optionally uses "Refine with AI" for prompt-based changes
5. Version pills show history, click to restore
6. Leave empty to fall back to dynamic generation

## Testing Approach

### Key Scenarios to Validate
1. **Generate message**: Click Generate → message appears → saved to state
2. **Refine message**: Enter prompt → click Apply → message updated → version added
3. **Manual edit**: Type in textarea → changes saved
4. **Version restore**: Click version pill → message restored
5. **Empty fallback**: Create link without message → recipient sees dynamically generated message
6. **10 version limit**: Generate 11+ times → only last 10 versions kept

### Integration Test
1. Create share link with custom opening message
2. Access share link as recipient
3. Verify first message matches stored opening message

## Open Questions
None - all clarifications resolved in ideation phase.

---

## Future Improvements and Enhancements

**Note: Everything below is OUT OF SCOPE for initial implementation.**

### Enhanced Features
- **Multi-language support**: Store multiple language versions of opening message
- **A/B testing**: Allow multiple opening message variants with analytics
- **Conditional messages**: Different messages based on recipient email domain
- **Full chat widget preview**: Render actual chat UI instead of plain text preview
- **Voice recording**: Record opening message as audio

### Advanced AI Features
- **Template library**: Pre-built opening message templates by use case
- **Tone analysis**: Show tone meter (formal ↔ casual) for the message
- **Auto-suggestions**: Suggest refinements based on audience profile

### Analytics
- **Message performance**: Track which opening message versions lead to longer conversations
- **Engagement metrics**: Measure read time, first response latency

### UX Improvements
- **Inline markdown preview**: Show rendered markdown as user types
- **Character limit enforcement**: Hard limit instead of soft warning
- **Keyboard shortcuts**: Cmd+Enter to generate, Cmd+S to save

### Technical Improvements
- **Streaming generation**: Stream message generation for perceived speed
- **Optimistic updates**: Show message immediately, sync in background
- **Offline support**: Queue generations for when connection restored

---

## References
- Ideation document: `docs/ideation/opening-message-customization-share-page-reorganization.md`
- Related spec: `specs/feat-share-link-identifiability.md`
- Developer guide: `developer-guides/share-link-access-guide.md`
- Current implementation: `backend/src/services/welcomeService.ts`
