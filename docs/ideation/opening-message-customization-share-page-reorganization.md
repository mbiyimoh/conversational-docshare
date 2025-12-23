# Opening Message Customization & Share Page Reorganization

**Slug:** opening-message-customization-share-page-reorganization
**Author:** Claude Code
**Date:** 2025-12-22
**Branch:** preflight/opening-message-customization
**Related:** `developer-guides/share-link-access-guide.md`, `welcomeService.ts`

---

## 1) Intent & Assumptions

### Task Brief
Create a pre-composed opening message editing experience in the Share tab that enables users to refine the AI agent's first message before sharing. This is the most crucial message of the entire interaction as it sets the tone for how recipients engage with the capsule. Additionally, reorganize the Share page content into four logical sections: Audience, Access, Opening Message, and Customize Link.

### Assumptions
- The welcome message system already exists (`welcomeService.ts`) and generates messages dynamically per conversation
- We want to shift from dynamic generation to **pre-composed + stored** messages that are editable
- The current ShareLinkManager UI is functional but needs better information architecture
- Users want control over the exact first impression without needing to be technical writers
- LLM-assisted editing is preferred over purely manual editing for speed and quality
- Version history is valuable for experimentation without fear of losing good versions

### Out of Scope
- Multi-language support for opening messages (future enhancement)
- A/B testing multiple opening messages per share link
- Conditional opening messages based on recipient email/domain
- Voice/audio recording for opening messages
- Opening message analytics (which version performs best)

---

## 2) Pre-reading Log

| File | Key Takeaway |
|------|--------------|
| `frontend/src/components/ShareLinkManager.tsx` | Current UI has flat structure with Profile Import, Access Type, Recipient Role, Link Name, and Custom URL sections. No opening message controls. |
| `frontend/src/pages/SharePage.tsx` | Viewer experience loads via `loadConversationHistory()` which retrieves messages from DB. ChatInterface handles message display. |
| `backend/src/services/welcomeService.ts` | Generates welcome messages dynamically using LLM at conversation creation time. Uses project context, documents, and context layers. |
| `backend/src/services/chatService.ts` | `createConversation()` calls `generateWelcomeMessage()` and saves as first message with `isWelcomeMessage: true` metadata. |
| `backend/prisma/schema.prisma` | `ShareLink` model has basic fields but no `openingMessage` field. `Message.metadata` can store `isWelcomeMessage: true`. |
| `developer-guides/share-link-access-guide.md` | Documents current share link flow: create → verify → grant access → conversation created. |
| `developer-guides/context-layer-system-guide.md` | Context layers (audience, communication, content, engagement) inform AI behavior including welcome messages. |

---

## 3) Codebase Map

### Primary Components/Modules

| Component | File Path | Role |
|-----------|-----------|------|
| ShareLinkManager | `frontend/src/components/ShareLinkManager.tsx:37-525` | Creator-side UI for share link configuration |
| SharePage | `frontend/src/pages/SharePage.tsx:64-716` | Viewer-side share link access and chat experience |
| welcomeService | `backend/src/services/welcomeService.ts:1-118` | LLM-powered welcome message generation |
| chatService | `backend/src/services/chatService.ts:373-419` | Conversation creation with welcome message |
| shareLink.controller | `backend/src/controllers/shareLink.controller.ts` | API endpoints for share link CRUD |
| shareLink.routes | `backend/src/routes/shareLink.routes.ts` | Route definitions |

### Shared Dependencies

| Dependency | Usage |
|------------|-------|
| `@/components/ui` | Card, Button, Input, Badge components |
| `lucide-react` | Icons (Link, Copy, Trash2, Users, etc.) |
| `prisma` | Database ORM for ShareLink, Message models |
| `getOpenAI()` | LLM calls for message generation |
| `buildSystemPrompt()` | Context assembly from layers |

### Data Flow

```
Creator Side:
  ShareLinkManager
       │
       ├─ loadProfiles() → api.getAudienceProfiles()
       ├─ handleCreate() → api.createShareLink()
       │                      └─ POST /api/projects/:id/share-links
       └─ handleProfileImport() → sets accessType, recipientRole
                                      │
                                      ▼
                              shareLink.controller.ts
                                      │
                                      └─ prisma.shareLink.create()

Viewer Side:
  SharePage
       │
       ├─ loadShareLink() → api.getShareLinkBySlug()
       ├─ handleVerifyAccess() → api.verifyShareLinkAccess()
       └─ createConversationAndGrant()
                │
                └─ api.createConversation()
                         │
                         └─ chatService.createConversation()
                                  │
                                  └─ welcomeService.generateWelcomeMessage() ← CURRENT: Dynamic
                                            │
                                            └─ Saved as first Message with isWelcomeMessage: true
```

### Feature Flags/Config
- None currently for welcome messages

### Potential Blast Radius

| Area | Impact |
|------|--------|
| ShareLinkManager.tsx | Major refactor for section organization + new Opening Message component |
| shareLink.controller.ts | New fields: `openingMessage`, `openingMessageVersions` |
| schema.prisma | ShareLink model needs new fields |
| chatService.ts | Logic change: use stored message vs. generate dynamically |
| welcomeService.ts | May become utility for "Generate" button rather than auto-generation |
| API routes | New endpoints for opening message refinement |

---

## 4) Root Cause Analysis

**Not applicable** - This is a new feature, not a bug fix.

---

## 5) Research

### Research Summary

Comprehensive research was conducted on three interconnected areas (see `/tmp/research_20251222_ai_opening_message_editing_patterns.md`):

### Potential Solutions

#### Solution 1: AI-First with Manual Override (Recommended)

**How it works:**
- AI generates default opening message using existing `welcomeService.ts` logic
- User sees message in editable text area with live preview
- "Refine with AI" feature allows prompt-based iteration
- Version history tracks all changes for undo/exploration
- Message stored on ShareLink model, used at conversation creation

**Pros:**
- Fast initial setup (AI generates quality default)
- Users can refine incrementally without starting from scratch
- Version history enables safe experimentation
- Balances automation with control
- Non-destructive editing

**Cons:**
- Requires backend AI integration (already exists)
- May need retry logic for API failures
- Users might over-rely on AI without understanding the message

#### Solution 2: Manual-First with AI Suggestions

**How it works:**
- User starts with blank text area or minimal template
- "Suggest with AI" button offers improvements
- AI acts as assistant, not driver

**Pros:**
- User has full control from start
- Simpler backend (optional AI)
- Users understand their message deeply

**Cons:**
- Slower initial creation (blank page problem)
- Higher cognitive load upfront
- Users may not discover AI features

#### Solution 3: Template Library with AI Enhancement

**How it works:**
- User picks from pre-built templates (e.g., "Formal Introduction", "Friendly Greeting")
- Template populates text area
- AI refinement available for customization

**Pros:**
- Fastest time-to-value
- Users see proven examples
- No AI required for basic setup

**Cons:**
- Template maintenance overhead
- May feel generic/impersonal
- Template explosion as needs diversify

### Recommendation

**Solution 1: AI-First with Manual Override** is recommended because:

1. **Leverages existing infrastructure** - `welcomeService.ts` already has the LLM logic
2. **Matches user mental model** - They expect AI to help, not do everything
3. **Research-backed UX patterns** - Claude Artifacts, Jasper AI, and Notion AI all use this pattern
4. **Version history** addresses fear of losing good versions during experimentation
5. **Progressive disclosure** - Advanced features hidden until needed

### Key UX Patterns from Research

1. **Split-View Editing**: Edit panel (left) + Live preview (right)
2. **Regenerate without penalty**: Users should freely try alternatives
3. **Version selector**: Click any version to restore
4. **Accordion sections**: Organize related settings, expand on demand
5. **"Refine with AI"**: Natural language prompt for targeted changes

---

## 6) Clarifications

### Questions for User Decision

1. **Opening Message Storage Granularity**
   - **Option A**: Store on `ShareLink` model (one message per share link)
   - **Option B**: Store on `AgentConfig` model (one default per project, optionally override per link)
   - **Recommendation**: Option A - each share link gets its own message since audiences may differ
   >> go with your recommendation

2. **Version History Depth**
   - **Option A**: Last 5 versions (simpler, lower storage)
   - **Option B**: Last 10 versions
   - **Option C**: Unlimited (with pagination)
   - **Recommendation**: Option B - 10 versions balances utility with simplicity
   >> go with your recommendation

3. **Live Preview Scope**
   - **Option A**: Simple text preview (how message will appear)
   - **Option B**: Full chat widget mockup (more realistic but complex)
   - **Recommendation**: Option A for MVP, Option B as enhancement
   >> option A is sufficient

4. **Section Order Preference**
   Proposed order (per requirements):
   ```
   1. Audience (Import Profile + Recipient Role)
   2. Access (Access Type + Password)
   3. Opening Message (new section with editor)
   4. Customize Link (Link Name + Custom URL)
   ```
   - **Confirm**: Is this the desired order?
   >> yes

5. **Default Message Generation Trigger**
   - **Option A**: Auto-generate when user opens "Opening Message" section
   - **Option B**: Generate only when user clicks "Generate Message" button
   - **Recommendation**: Option B - explicit action, no surprise API calls
   >> go with your recommendation

6. **Empty Opening Message Behavior**
   - **Option A**: Require opening message (cannot create link without it)
   - **Option B**: Fall back to dynamic generation (current behavior) if empty
   - **Recommendation**: Option B - backward compatible, gentle onboarding
   >> go with your recommendation

---

## 7) Proposed UI Design

### ShareLinkManager Reorganization

```
┌─────────────────────────────────────────────────────────────────┐
│  Create Share Link                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ▼ 01 — AUDIENCE                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Import from Saved Profile                               │   │
│  │  ┌─────────────────────────┬─────────────────────────┐   │   │
│  │  │ Audience Profile   [▼]  │ Collaborator Profile [▼]│   │   │
│  │  └─────────────────────────┴─────────────────────────┘   │   │
│  │                                                          │   │
│  │  Recipient Role                                          │   │
│  │  ┌───────────────────────────────────────────────────┐   │   │
│  │  │ ○ Viewer    Can chat and view documents           │   │   │
│  │  │ ● Collaborator  Can also leave comments           │   │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ 02 — ACCESS                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Access Type                                             │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Password Protected                          [▼]  │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  Password                                                │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ ••••••••                                          │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ 03 — OPENING MESSAGE                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  ┌───────────────────────────────────────────────────┐   │   │
│  │  │ Hi! I'm your AI assistant for the Board Memo.    │   │   │
│  │  │                                                   │   │   │
│  │  │ I can help you explore the key decisions,        │   │   │
│  │  │ financial projections, and strategic priorities  │   │   │
│  │  │ outlined in these materials.                     │   │   │
│  │  │                                                   │   │   │
│  │  │ What would you like to know?                     │   │   │
│  │  └───────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ ✨ Refine with AI                                │    │   │
│  │  │ ┌──────────────────────────────────────────────┐ │    │   │
│  │  │ │ Make it more formal and mention investor...  │ │    │   │
│  │  │ └──────────────────────────────────────────────┘ │    │   │
│  │  │ [Apply]                                          │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  [🔄 Regenerate]  [⏪ v3] [v2] [v1]                      │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▼ 04 — CUSTOMIZE LINK                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Link Name                                               │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Board Memo - Investors - Dec 22                  │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  ▸ Customize URL                                         │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ yoursite.com/share/ [investor-memo-dec   ]       │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  [Create Share Link]                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Opening Message Section Detail

```
┌─────────────────────────────────────────────────────────────────┐
│  03 — OPENING MESSAGE                                           │
│  First impression matters. Craft the perfect greeting.          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Opening Message                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │ **Hi! I'm your AI assistant for the Board Memo.**       │   │
│  │                                                          │   │
│  │ I can help you explore the key decisions, financial     │   │
│  │ projections, and strategic priorities outlined in       │   │
│  │ these materials.                                         │   │
│  │                                                          │   │
│  │ **Here are some things you might want to explore:**     │   │
│  │ - Revenue assumptions for Q2 2025                       │   │
│  │ - Key risks identified by the team                      │   │
│  │ - Recommended actions for the board                     │   │
│  │                                                          │   │
│  │ What would you like to know?                            │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Characters: 412/1000                                          │
│                                                                 │
│  ── AI Tools ──────────────────────────────────────────────    │
│                                                                 │
│  [✨ Generate New]  [🔄 Regenerate]                             │
│                                                                 │
│  Refine with AI (optional)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Make it more concise, focus on the Q2 financials       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Apply Refinement]                                            │
│                                                                 │
│  ── Version History ───────────────────────────────────────    │
│                                                                 │
│  [v3 ●]  [v2]  [v1]   current • 2 min ago                     │
│                                                                 │
│  ? Tip: Leave empty to auto-generate when recipient arrives   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8) Technical Implementation Overview

### Database Schema Changes

```prisma
model ShareLink {
  // ... existing fields ...

  // Opening message fields
  openingMessage         String?  @db.Text  // Current active message
  openingMessageVersions Json?              // Array of { version, content, source, createdAt }
  openingMessageSource   String?            // "generated" | "manual" | "refined"
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/share-links/:id/opening-message/generate` | Generate new opening message using LLM |
| POST | `/api/share-links/:id/opening-message/refine` | Refine existing message with prompt |
| PATCH | `/api/share-links/:id/opening-message` | Update message (manual edit) |
| GET | `/api/share-links/:id/opening-message/versions` | Get version history |
| POST | `/api/share-links/:id/opening-message/restore/:version` | Restore specific version |

### Modified Flow

```
Current Flow:
  createConversation()
       → generateWelcomeMessage() [dynamic, every time]
       → save to Message

New Flow:
  createConversation(shareLinkId)
       → if (shareLink.openingMessage)
            → use stored message
         else
            → generateWelcomeMessage() [fallback to dynamic]
       → save to Message
```

### Component Structure

```
frontend/src/components/
├── ShareLinkManager.tsx          (refactored: sections wrapper)
├── share-link/
│   ├── ShareLinkSection.tsx      (collapsible section container)
│   ├── AudienceSection.tsx       (profile import + recipient role)
│   ├── AccessSection.tsx         (access type + password)
│   ├── OpeningMessageSection.tsx (new: message editor + AI tools)
│   └── CustomizeLinkSection.tsx  (link name + custom URL)
```

---

## 9) Design System Alignment

Following the 33 Strategies design system:

### Section Labels
```tsx
<span className="font-mono text-xs uppercase tracking-widest text-accent">
  01 — AUDIENCE
</span>
```

### Collapsible Sections
```tsx
<Card className="bg-card-bg border border-border">
  <button onClick={toggle} className="w-full p-4 flex items-center justify-between">
    <span className="font-mono text-xs uppercase tracking-widest text-accent">
      {sectionNumber} — {title}
    </span>
    <ChevronDown className={cn("w-4 h-4 text-muted transition-transform", open && "rotate-180")} />
  </button>
  {open && (
    <div className="px-4 pb-4 space-y-4">
      {children}
    </div>
  )}
</Card>
```

### AI Refinement Input
```tsx
<div className="bg-background-elevated rounded-lg p-3 border border-border">
  <label className="block text-xs text-dim mb-1 font-mono uppercase tracking-wide">
    Refine with AI
  </label>
  <input
    className="w-full bg-card-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted"
    placeholder="e.g., Make it more formal and mention the Q2 projections"
  />
  <Button variant="secondary" size="sm" className="mt-2">
    Apply Refinement
  </Button>
</div>
```

### Version Pills
```tsx
<div className="flex items-center gap-2">
  {versions.map((v, i) => (
    <button
      key={v.version}
      onClick={() => restoreVersion(v.version)}
      className={cn(
        "px-2 py-1 text-xs rounded font-mono",
        v.isCurrent
          ? "bg-accent text-background"
          : "bg-card-bg text-muted hover:text-foreground"
      )}
    >
      v{v.version}
    </button>
  ))}
</div>
```

---

## 10) Next Steps

1. **User clarification** on the 6 questions in Section 6
2. **Create specification** with detailed implementation tasks
3. **Schema migration** for ShareLink.openingMessage fields
4. **Build OpeningMessageSection component** with AI integration
5. **Refactor ShareLinkManager** into sectioned layout
6. **Update chatService** to use stored opening message
7. **Test end-to-end** flow from creation to viewer experience

---

## Appendix: Research Sources

See `/tmp/research_20251222_ai_opening_message_editing_patterns.md` for complete research report with 40+ sources covering:
- Pre-composed AI greeting message patterns (HubSpot, Intercom, Drift, Chatbase)
- LLM-assisted content editing UX (Claude Artifacts, Jasper AI, Notion AI)
- Form section organization best practices (Nielsen Norman Group, W3C)
