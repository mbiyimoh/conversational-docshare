# Collaborative Capsule Enhancements

**Slug:** collaborative-capsule-enhancements
**Author:** Claude Code
**Date:** 2025-12-07
**Branch:** preflight/collaborative-capsule-enhancements
**Related:**
- `docs/ideation/conversation-continuation-feature.md`
- `docs/ideation/viewer-experience-enhancements.md`
- `specs/feat-recommendation-engine.md`
- `backend/prisma/schema.prisma`

---

## 1) Intent & Assumptions

**Task brief:** Implement a comprehensive set of collaborative features for the document capsule platform:
1. Make uploaded text documents editable within the app
2. Generate post-conversation recommendations for sender (document updates + considerations)
3. Maintain audience-level aggregate synthesis across all conversations with versioning
4. Add recipient roles (Viewer vs Collaborator) with different capabilities
5. Add "Leave a message" modal at end of session for all recipients
6. Enable saving/reusing audience profiles across projects
7. Enable saving/reusing individual recipient profiles (collaborators)

**Assumptions:**
- Text documents (DOCX, Markdown, plain text) will be editable first; PDF editing is out of scope for MVP
- Documents are stored as extracted text in `DocumentChunk` model - we'll edit chunks, not original files
- Existing `TestComment` model pattern can be adapted for collaborator document comments
- Existing `ProfileRecommendation` pattern can be adapted for document update recommendations
- Recipient roles are per-share-link, not per-user globally
- Audience profiles are user-owned templates that can be applied to new projects
- Individual collaborator profiles may be used in multiple contexts (as standalone or part of group)

**Out of scope:**
- Real-time collaborative editing (Google Docs style)
- PDF annotation/editing
- Conflict resolution for concurrent edits
- Mobile-specific optimizations
- Team/organization accounts

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `backend/prisma/schema.prisma` | Core models exist: Document, DocumentChunk, Conversation, Message, ShareLink. Need new models for: DocumentVersion, DocumentComment, RecipientProfile, AudienceProfile, AudienceSummary |
| `frontend/src/pages/SharePage.tsx` | Viewer experience with panelMode capsule/document, EndSessionModal integration. Good foundation for role-based experience |
| `frontend/src/components/EndSessionModal.tsx` | Current flow: confirm → register → success. Need to add "leave a message" step before confirm |
| `backend/src/services/conversationAnalysis.ts` | Generates conversation summary with topics/sentiment. Extend for recommendations |
| `backend/src/services/recommendationEngine.ts` | Profile recommendation pattern with LLM analysis. Adapt for document recommendations |
| `frontend/src/pages/DashboardPage.tsx` | User projects list + saved conversations. Add sections for Audiences and Collaborators |
| `frontend/src/pages/ProjectPage.tsx` | Tabs: Documents, Agent, Test, Share, Analytics. Add role config to Share tab |
| `backend/src/services/documentProcessor.ts` | Extracts text from PDF/DOCX/XLSX/MD. For editable docs, we'll modify chunks not original |

---

## 3) Codebase Map

### Primary Components/Modules to Create or Modify

| Component | Type | Purpose |
|-----------|------|---------|
| `DocumentEditor.tsx` | NEW | TipTap-based rich text editor for document content |
| `DocumentVersionHistory.tsx` | NEW | Version history viewer with diff and rollback |
| `CollaboratorCommentPanel.tsx` | NEW | Inline comments on document sections |
| `LeaveMessageModal.tsx` | NEW | End-of-session message prompt for sender |
| `RecipientRoleConfig.tsx` | NEW | Configure viewer vs collaborator per share link |
| `AudienceProfileManager.tsx` | NEW | CRUD for saved audience templates |
| `CollaboratorManager.tsx` | NEW | CRUD for saved individual collaborator profiles |
| `AudienceSynthesis.tsx` | NEW | Display aggregate insights across conversations |
| `ConversationRecommendations.tsx` | NEW | Show post-conversation suggestions for sender |
| `EndSessionModal.tsx` | MODIFY | Add "leave a message" step |
| `SharePage.tsx` | MODIFY | Role-based experience (viewer vs collaborator) |
| `ShareLinkManager.tsx` | MODIFY | Add recipient role configuration |
| `DashboardPage.tsx` | MODIFY | Add Audiences and Collaborators sections |

### New Database Models Required

```prisma
// Document editing & versioning
model DocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id])
  version     Int
  content     Json     // Full document content snapshot
  editedById  String?  // User who made the edit (null for original)
  changeNote  String?  // Description of changes
  createdAt   DateTime @default(now())

  @@unique([documentId, version])
  @@index([documentId])
}

// Collaborator comments on documents (highlight-to-comment pattern)
model DocumentComment {
  id              String   @id @default(cuid())
  documentId      String
  document        Document @relation(fields: [documentId], references: [id])
  conversationId  String?
  conversation    Conversation? @relation(fields: [conversationId], references: [id])

  // Anchor (supports highlight-to-comment)
  chunkId         String        // Which chunk contains the highlight
  startOffset     Int           // Character offset within chunk
  endOffset       Int           // Character offset within chunk
  highlightedText String        // Exact text that was highlighted (for fuzzy re-anchor)

  // Comment content
  content         String   @db.Text
  viewerEmail     String?
  viewerName      String?

  // Status
  status          String   @default("pending") // pending, addressed, dismissed
  createdAt       DateTime @default(now())

  @@index([documentId])
  @@index([conversationId])
  @@index([chunkId])
}

// Recipient role per share link
enum RecipientRole {
  viewer
  collaborator
}

// Add to ShareLink model
model ShareLink {
  // ... existing fields ...
  recipientRole   RecipientRole @default(viewer)
}

// Leave a message from recipient to sender
model RecipientMessage {
  id             String   @id @default(cuid())
  conversationId String   @unique
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  content        String   @db.Text
  createdAt      DateTime @default(now())
}

// Post-conversation recommendations for sender
model ConversationRecommendation {
  id             String   @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])

  type           String   // "document_update" | "consideration" | "follow_up"
  targetDocumentId String? // For document_update type
  targetSection  String?  // For document_update type
  content        String   @db.Text
  rationale      String   @db.Text

  status         String   @default("pending") // pending, applied, dismissed
  createdAt      DateTime @default(now())

  @@index([conversationId])
}

// Audience-level aggregate synthesis
model AudienceSynthesis {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id])

  version      Int

  // Aggregate insights
  overview            String   @db.Text
  commonQuestions     Json     // Array of frequent question patterns
  knowledgeGaps       Json     // Areas where audience struggles
  documentSuggestions Json     // Aggregate doc improvement suggestions
  sentimentTrend      String   // overall trend: improving, stable, declining

  // Metadata
  conversationCount   Int
  totalMessages       Int
  dateRange           Json     // { from: Date, to: Date }

  createdAt    DateTime @default(now())

  @@unique([projectId, version])
  @@index([projectId])
}

// Saved audience profiles (templates)
model AudienceProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])

  name        String
  description String?  @db.Text

  // Audience configuration (matches AgentConfig interview data structure)
  audienceDescription   String?  @db.Text
  communicationStyle    String?  @db.Text
  topicsEmphasis        String?  @db.Text
  accessType            String   @default("password")

  // Usage tracking
  timesUsed   Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
}

// Saved individual collaborator profiles
model CollaboratorProfile {
  id          String   @id @default(cuid())
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])

  name        String
  email       String?
  description String?  @db.Text

  // Collaborator-specific preferences
  communicationNotes  String?  @db.Text  // How to communicate with this person
  expertiseAreas      String[] // What they're experts in
  feedbackStyle       String?  // direct, gentle, detailed, high-level

  // Usage tracking
  timesUsed   Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([ownerId])
  @@index([email])
}
```

### Data Flow

**Document Editing Flow:**
```
User edits document chunk → Save creates new DocumentVersion
                         → Update DocumentChunk.content
                         → Re-generate embeddings for RAG
                         → Update outline if structure changed
```

**Post-Conversation Recommendations Flow:**
```
Recipient ends session → Generate conversation summary (existing)
                      → Generate recommendations (new LLM call)
                      → Store ConversationRecommendation records
                      → If collaborator: include DocumentComment analysis
                      → Update AudienceSynthesis (incremental)
```

**Audience Synthesis Flow:**
```
New conversation ends → Load previous AudienceSynthesis
                     → Fetch all conversations (or just new + summary)
                     → LLM generates updated synthesis
                     → Store new version with version++
                     → Maintain version history for "flip through"
```

### Potential Blast Radius

**Safe to modify (isolated):**
- `EndSessionModal.tsx` - Add leave message step
- `ShareLinkManager.tsx` - Add role configuration
- `DashboardPage.tsx` - Add new sections

**Caution (shared functionality):**
- `SharePage.tsx` - Core viewer experience, add role-based conditionals carefully
- `chatService.ts` - If modifying conversation end logic
- `conversationAnalysis.ts` - If extending summary generation

**New files (no blast radius):**
- All new components and services
- New database models

---

## 4) Root Cause Analysis

*N/A - These are new features, not bug fixes.*

---

## 5) Research Findings

### Feature 1: Document Editing

**Recommended Approach: TipTap Editor**

| Aspect | Recommendation |
|--------|----------------|
| Editor | TipTap (headless, built on ProseMirror) |
| Implementation time | 1-2 days |
| Versioning | PostgreSQL history table with triggers |
| Storage | Store as structured JSON, render to HTML |

**Why TipTap:**
- Headless - full control over UI
- TypeScript-native
- Extensions for markdown, tables, code blocks
- Active community, well-maintained
- Works well with React

**Versioning Strategy:**
```typescript
// On save:
1. Create DocumentVersion with current content
2. Update DocumentChunk records
3. Trigger embedding regeneration (async)
4. Update document outline if headers changed
```

### Feature 2: Post-Conversation Recommendations

**Recommended Approach: Batch Analysis on Conversation End**

Extend the existing `generateConversationSummary` to also produce recommendations:

```typescript
interface ConversationAnalysisExtended {
  summary: string
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'

  // NEW: Recommendations for sender
  recommendations: Array<{
    type: 'document_update' | 'consideration' | 'follow_up'
    targetDocument?: string  // filename
    targetSection?: string   // section ID
    content: string          // What to do
    rationale: string        // Why
    priority: 'high' | 'medium' | 'low'
  }>
}
```

**For Collaborator conversations:** Include analysis of `DocumentComment` records to generate document-specific update suggestions.

### Feature 3: Audience-Level Synthesis

**Recommended Approach: Incremental LLM Summarization**

Don't re-process all conversations each time. Instead:

```typescript
// On each conversation end:
1. Load previous AudienceSynthesis (version N)
2. Load new conversation summary + recommendations
3. LLM prompt: "Given previous synthesis and new conversation, update synthesis"
4. Store as version N+1

// Benefits:
- Faster (only processes delta)
- Cost-effective (fewer tokens)
- Maintains consistency with previous versions
```

**Synthesis Structure:**
```json
{
  "overview": "Overall pattern of how audience engages with this capsule",
  "commonQuestions": [
    { "pattern": "How does X work?", "frequency": 8, "documents": ["doc1", "doc2"] },
    { "pattern": "What about Y?", "frequency": 5, "documents": ["doc3"] }
  ],
  "knowledgeGaps": [
    { "topic": "Implementation details", "severity": "high", "suggestion": "Add more examples" }
  ],
  "documentSuggestions": [
    { "document": "business-plan.pdf", "section": "financials", "suggestion": "More detail needed" }
  ],
  "sentimentTrend": "improving",
  "insights": [
    "Users frequently ask about pricing before reading pricing section",
    "Technical users engage more deeply with API documentation"
  ]
}
```

### Feature 4: Recipient Roles (Viewer vs Collaborator)

**Recommended Approach: Role on ShareLink, Experience Switch in Frontend**

| Role | Capabilities |
|------|--------------|
| Viewer | Chat, view docs, leave end-session message |
| Collaborator | All viewer caps + inline document comments |

**Implementation:**
1. Add `recipientRole` enum to ShareLink model
2. Pass role to frontend in access verification response
3. Frontend conditionally renders comment UI for collaborators
4. Comments stored in `DocumentComment` with link to conversation

### Feature 5: Leave a Message Modal

**Recommended Approach: Modal Step Before End Confirmation**

Flow change:
```
Current:  End button → Confirm modal → (optional) Register
Proposed: End button → Leave message modal → Confirm modal → (optional) Register
```

Modal prompt: "Is there anything specific you'd like me to share with [sender name] now that you've explored this document capsule?"

- Text area (optional, can skip)
- Store in `RecipientMessage` model
- Show to sender in Analytics dashboard

### Feature 6 & 7: Saved Audience & Collaborator Profiles

**Recommended Approach: Template Models with Application**

**AudienceProfile** stores:
- Audience description (who they are)
- Communication style preferences
- Topic emphasis
- Default access type

**CollaboratorProfile** stores:
- Individual's name, email
- Communication notes
- Expertise areas
- Feedback style preference

**Usage Flow:**
1. User creates profile in Dashboard
2. When creating project, can "Import from saved audience"
3. Copies profile data into AgentConfig.interviewData
4. Can still customize for specific project

**Relationship between Individual and Group:**
- For MVP: Keep them separate
- CollaboratorProfile is for known individuals you work with often
- AudienceProfile is for types of audiences (investors, board, clients)
- Same person could be in multiple audiences (they just get re-added)

---

## 6) Clarification Questions

### 1. Document Editing Scope

**Question:** Should document editing modify the original uploaded file, or maintain a separate "edited version" within the app?

**Options:**
- A) Edit in-place, replace original content in DocumentChunks
- B) Maintain "original" and "edited" versions, show edited by default
- C) Never modify original, edits create a new document version layer

**Recommendation:** Option B - preserves original for reference while allowing edits

>> option B. and we should have versioning for all of these rounds of edits too (the documents may go through 3 or 4 rounds of edits from applied recommendations if its something that people are collaborating on)

---

### 2. Collaborator Comment Visibility

**Question:** Can collaborators see each other's comments, or only sender + that specific collaborator?

**Options:**
- A) Only sender and the commenting collaborator can see
- B) All collaborators on the same share link can see each other's comments
- C) Configurable per share link

**Recommendation:** Option A for MVP - simpler, avoids coordination complexity

>> agreed, option A for now

---

### 3. Recommendation Application

**Question:** How should document update recommendations be applied?

**Options:**
- A) Manual only - sender reads suggestion, manually edits
- B) One-click apply - like current profile recommendations
- C) AI-assisted - click to have AI draft the change, sender approves

**Recommendation:** Option A for MVP, Option C as enhancement

>> option C. more on this in my prompt at the end

---

### 4. Audience Synthesis Trigger

**Question:** When should audience synthesis be updated?

**Options:**
- A) After every conversation ends (real-time)
- B) Daily batch job
- C) Manual trigger by sender
- D) After N new conversations

**Recommendation:** Option A - keeps insights fresh, user expectation from requirement

>> option A

---

### 5. Collaborator Profile Inheritance

**Question:** When a collaborator profile is applied to a share link, what happens?

**Options:**
- A) Their preferences are copied to the share link settings
- B) Share link references the profile (linked)
- C) Both - copy with reference for updates

**Recommendation:** Option A for MVP - simpler, avoids sync issues

>> option A

---

### 6. Leave Message Prompt Customization

**Question:** Should sender be able to customize the "leave a message" prompt?

**Options:**
- A) Fixed system prompt
- B) Sender can customize per project
- C) Sender can customize per share link

**Recommendation:** Option A for MVP - faster to ship, can enhance later

>> option A

---

## 7) UI/UX Changes Summary

### 7.1 Dashboard Page Changes

**BEFORE:**
```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                          [New Project] [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Saved Threads                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Thread 1... Thread 2...                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  My Projects                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │Project 1 │ │Project 2 │ │Project 3 │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**AFTER:**
```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                          [New Project] [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Saved Threads                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Thread 1... Thread 2...                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  My Projects                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │Project 1 │ │Project 2 │ │Project 3 │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
│                                                             │
│  ┌─────────────────────────┬─────────────────────────┐     │
│  │ Saved Audiences    [+]  │ My Collaborators   [+]  │     │
│  │                         │                         │     │
│  │ 👥 Board Members        │ 👤 John Smith          │     │
│  │    3 projects used      │    Advisor, 5 projects  │     │
│  │                         │                         │     │
│  │ 👥 Investors            │ 👤 Sarah Jones         │     │
│  │    2 projects used      │    Legal, 3 projects    │     │
│  └─────────────────────────┴─────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Project Page - Share Tab Changes

**BEFORE:**
```
┌─────────────────────────────────────────────────────────────┐
│  Share Links                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Access Type: [Password ▼]                            │   │
│  │ Password: [••••••••]                                │   │
│  │                              [Create Share Link]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Active Links:                                              │
│  • abc123 - Password protected                              │
│  • def456 - Email required                                  │
└─────────────────────────────────────────────────────────────┘
```

**AFTER:**
```
┌─────────────────────────────────────────────────────────────┐
│  Share Links                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Access Type: [Password ▼]                            │   │
│  │ Password: [••••••••]                                │   │
│  │                                                      │   │
│  │ ┌─────────────────────────────────────────────────┐ │   │
│  │ │ Recipient Role:                                  │ │   │
│  │ │ ○ Viewer - Can chat and view documents          │ │   │
│  │ │ ● Collaborator - Can also leave comments on docs │ │   │
│  │ └─────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │ [Import Audience Profile ▼] [Add Collaborator ▼]    │   │
│  │                              [Create Share Link]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Active Links:                                              │
│  • abc123 - Password, Viewer                                │
│  • def456 - Email, Collaborator (John Smith)               │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Project Page - Documents Tab Changes (Editable)

**BEFORE:**
```
┌─────────────────────────────────────────────────────────────┐
│  Documents                                    [Upload +]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 business-plan.pdf                    [View] [🗑]  │   │
│  │    12 pages • Uploaded Dec 5                         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 📄 ip-framework.docx                    [View] [🗑]  │   │
│  │    8 pages • Uploaded Dec 5                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**AFTER:**
```
┌─────────────────────────────────────────────────────────────┐
│  Documents                                    [Upload +]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📄 business-plan.pdf            [View] [History] [🗑] │   │
│  │    12 pages • Uploaded Dec 5 • PDF (read-only)       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 📝 ip-framework.docx             [Edit] [History] [🗑] │   │
│  │    8 pages • Uploaded Dec 5 • Editable               │   │
│  │    └── 3 versions, last edited Dec 7                 │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Document Editor (New Page/Modal)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Documents    ip-framework.docx    [Save] [Close] │
├─────────────────────────────────────────────────────────────┤
│  Version: 3 (Dec 7)  [View History ▼]                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  # IP Framework                                      │   │
│  │                                                      │   │
│  │  ## Overview                                         │   │
│  │                                                      │   │
│  │  This document outlines our intellectual property    │   │
│  │  protection strategy and implementation guidelines. │   │
│  │                                                      │   │
│  │  ## Core Components                                  │   │
│  │                                                      │   │
│  │  1. Patent Portfolio                                 │   │
│  │  2. Trade Secret Management                          │   │
│  │  3. Copyright Protection                             │   │
│  │                                                      │   │
│  │  [TipTap rich text editor with formatting toolbar]  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 7.5 SharePage - Collaborator Experience (Highlight-to-Comment)

**Interaction Pattern:** Collaborators can **highlight any text** to leave a comment, following the familiar Google Docs / Word pattern. This leverages existing DocumentChunk structure for anchoring.

**BEFORE (Viewer):**
```
┌────────────────────────────┬───────────────────────────────┐
│     Chat Panel (60%)       │     Document Panel (40%)      │
│                            │                               │
│ [AI message]               │ ## Section Title              │
│                            │                               │
│ [User message]             │ Content text here that the    │
│                            │ user can read but not edit    │
│ [AI response with          │ or comment on...              │
│  citation]                 │                               │
│                            │                               │
│ [...........................│                               │
└────────────────────────────┴───────────────────────────────┘
```

**AFTER (Collaborator - Highlight to Comment):**
```
┌────────────────────────────┬───────────────────────────────┐
│     Chat Panel (60%)       │  Document Panel (40%)         │
│                            │  ┌───────────────────────────┐│
│ [AI message]               │  │ [💬 3] Comments     [Hide]││
│                            │  └───────────────────────────┘│
│ [User message]             │                               │
│                            │  ## Financial Projections     │
│ [AI response with          │                               │
│  citation]                 │  Our revenue model assumes    │
│                            │  ████████████████████████     │
│                            │  ↑ highlighted text           │
│                            │                               │
│                            │  ┌─ Add Comment ────────────┐ │
│                            │  │ "20% growth quarterly"   │ │
│                            │  │ ┌───────────────────────┐│ │
│                            │  │ │ Can we add more       ││ │
│                            │  │ │ scenarios here?       ││ │
│                            │  │ └───────────────────────┘│ │
│                            │  │      [Cancel] [Comment]  │ │
│                            │  └──────────────────────────┘ │
│                            │                               │
│                            │  ───────────────────────────  │
│                            │  Existing Comments:           │
│                            │                               │
│                            │  📍 "revenue model" (para 1)  │
│                            │  │ Need clearer breakdown     │
│                            │  │ of assumptions.  - John    │
│                            │  └────────────────────────────│
│ [...........................│                               │
└────────────────────────────┴───────────────────────────────┘
```

**Technical Implementation:**
- Use `window.getSelection()` to capture highlighted text range
- Store anchor as: `{ chunkId, startOffset, endOffset, highlightedText }`
- Comments survive minor edits if anchor text still exists (fuzzy match)
- Show comment markers (yellow highlight) on text with comments
- Click marker to scroll to comment in sidebar

### 7.6 End Session Flow - Leave Message Modal

**NEW MODAL (Before existing confirmation):**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│    Before you go...                                         │
│                                                             │
│    Is there anything specific you'd like me to share       │
│    with [Sender Name] now that you've explored this        │
│    document capsule?                                        │
│                                                             │
│    ┌─────────────────────────────────────────────────┐     │
│    │                                                  │     │
│    │ [Optional message text area]                     │     │
│    │                                                  │     │
│    │                                                  │     │
│    └─────────────────────────────────────────────────┘     │
│                                                             │
│    Examples: Feedback, questions for follow-up,            │
│    clarifications you'd like, suggestions...               │
│                                                             │
│              [Skip]                    [Send & Continue]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.7 Analytics Tab - Conversation Recommendations

**NEW SECTION in Analytics:**
```
┌─────────────────────────────────────────────────────────────┐
│  Conversation: John Smith - Dec 7, 2025                     │
├─────────────────────────────────────────────────────────────┤
│  Summary: John explored the financial projections and       │
│  asked several questions about revenue assumptions...       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💡 Recommendations                                   │   │
│  │                                                      │   │
│  │ 📄 Document Update (business-plan.pdf, Financials)  │   │
│  │    Add more examples of revenue scenario modeling    │   │
│  │    Rationale: John asked 3 questions about this     │   │
│  │    [View in Document] [Dismiss]                      │   │
│  │                                                      │   │
│  │ 💭 Consideration                                     │   │
│  │    John seemed uncertain about the competitive      │   │
│  │    landscape section. Consider adding more context.  │   │
│  │    [Dismiss]                                         │   │
│  │                                                      │   │
│  │ 📨 Message from John:                                │   │
│  │    "Great overview! Would love to see more detail    │   │
│  │    on the go-to-market timeline."                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Collaborator Comments (3):                                 │
│  • Section "Financials": "Need clearer breakdown"          │
│  • Section "Timeline": "Missing Q2 milestones"             │
│  • Section "Team": "Add advisory board"                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.8 Analytics Tab - Audience Synthesis

**NEW SECTION in Analytics:**
```
┌─────────────────────────────────────────────────────────────┐
│  Audience Insights                 [Version 5 ▼] [Refresh] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Overview (12 conversations analyzed)                       │
│  Your audience primarily focuses on financial projections   │
│  and competitive positioning. Most conversations start      │
│  with high-level questions before diving into details.      │
│                                                             │
│  ┌──────────────────────┬──────────────────────────────┐   │
│  │ Common Questions     │ Knowledge Gaps               │   │
│  │                      │                              │   │
│  │ • Revenue model (8)  │ ⚠️ Implementation timeline   │   │
│  │ • Team background(6) │    (5 people struggled)      │   │
│  │ • Market size (5)    │                              │   │
│  │ • Competition (4)    │ ⚠️ Technical architecture    │   │
│  │                      │    (3 asked for more detail) │   │
│  └──────────────────────┴──────────────────────────────┘   │
│                                                             │
│  Document Suggestions                                       │
│  • business-plan.pdf: Add visual timeline in Milestones    │
│  • tech-spec.pdf: Simplify architecture diagram            │
│                                                             │
│  Sentiment Trend: ↗️ Improving (was neutral, now positive) │
│                                                             │
│  ── Version History ────────────────────────────────────   │
│  v5: Dec 7 (current) - 2 new conversations                 │
│  v4: Dec 5 - Added tech-spec analysis                      │
│  v3: Dec 3 - Initial synthesis after 5 conversations       │
└─────────────────────────────────────────────────────────────┘
```

---

## 7.9 Document Recommendation System (Adapted from Existing Spec)

**Reference:** `docs/ideation/recommendation-generation-system-spec.md`

Your existing recommendation system is well-architected. Here's how we adapt it for **section-level document updates** rather than corpus-level ADD/EDIT/DELETE:

### Adapted Schema

```typescript
// Extends pattern from recommendation-generation-system-spec.md
interface DocumentRecommendation {
  id: string;
  conversationId: string;         // Source: the ended conversation

  // CHANGED: Section-level targeting (not document-level)
  action: "ADD_CONTENT" | "EDIT_CONTENT" | "ADD_SECTION" | "CLARIFY";
  targetDocumentId: string;
  targetSectionId: string | null;  // null for ADD_SECTION
  targetChunkId: string | null;    // Specific chunk to modify

  // Content (aligned with your spec)
  title: string;                   // "Add revenue scenario examples"
  description: string;             // 1-2 sentence summary

  // ENHANCED: Show original + proposed for diff view
  originalContent: string | null;  // Current section/chunk text
  proposedContent: string;         // Production-ready replacement
  changeHighlight: string;         // Just the delta for quick preview

  // ENHANCED: Evidence from conversation (split reasoning)
  evidenceQuotes: string[];        // Exact excerpts from conversation
  reasoning: string;               // Why change is warranted

  // Scoring (unchanged from your spec)
  confidence: number;              // 0.0-1.0
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
  priority: number;

  // Workflow (unchanged from your spec)
  status: "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";
  reviewedAt?: Date;
  appliedAt?: Date;
  appliedToVersion?: number;       // Links to DocumentVersion created

  createdAt: Date;
}
```

### Action Types Explained

| Action | Use Case | Example |
|--------|----------|---------|
| `ADD_CONTENT` | Append to existing section | "Add 3 more revenue scenarios after existing ones" |
| `EDIT_CONTENT` | Modify existing text | "Clarify the timeline language in paragraph 2" |
| `ADD_SECTION` | Create new section | "Add 'Implementation Risks' section after Timeline" |
| `CLARIFY` | Non-edit suggestion | "Consider addressing X in follow-up conversation" |

### Prompt Adaptation

```typescript
const documentRecommendationPrompt = `
You are analyzing a conversation to generate document improvement recommendations.

## Conversation Summary
${conversationSummary}

## Collaborator Comments (if any)
${collaboratorComments.map(c => `- "${c.highlightedText}": ${c.content}`).join('\n')}

## Document Being Discussed
${documentContent}

## Generate Recommendations

For each recommendation, provide:
1. **action**: ADD_CONTENT, EDIT_CONTENT, ADD_SECTION, or CLARIFY
2. **targetSectionId**: Which section to modify (use section IDs from document)
3. **title**: Clear 5-10 word title
4. **description**: 1-2 sentence summary of change
5. **originalContent**: Current text being modified (null for ADD)
6. **proposedContent**: COMPLETE production-ready new/updated text
7. **changeHighlight**: Just the new/changed portion for quick preview
8. **evidenceQuotes**: 2-3 EXACT quotes from conversation supporting this
9. **reasoning**: Why this change improves the document
10. **confidence**: 0.0-1.0 based on strength of evidence
11. **impactLevel**: LOW/MEDIUM/HIGH

CRITICAL: proposedContent must be PRODUCTION-READY, not placeholder text.
`;
```

### Integration with Document Versioning

```
Recommendation Applied
        ↓
┌───────────────────────────────────────┐
│  1. Create DocumentVersion snapshot   │
│  2. Update DocumentChunk.content      │
│  3. Mark recommendation as APPLIED    │
│  4. Link to version: appliedToVersion │
│  5. Regenerate embeddings (async)     │
└───────────────────────────────────────┘
        ↓
If user wants to undo: Rollback to previous DocumentVersion
```

### UI Flow (Sender Reviews Recommendations)

```
┌─────────────────────────────────────────────────────────────┐
│  Recommendations from: John's conversation (Dec 7)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📝 EDIT_CONTENT    Confidence: 87%    Impact: HIGH  │   │
│  │                                                      │   │
│  │ "Clarify revenue growth assumptions"                 │   │
│  │                                                      │   │
│  │ Target: business-plan.pdf → Financials (section 3)  │   │
│  │                                                      │   │
│  │ Evidence from conversation:                          │   │
│  │ • "I'm confused about the 20% number"               │   │
│  │ • "Where does that assumption come from?"           │   │
│  │                                                      │   │
│  │ ┌─ Change Preview ───────────────────────────────┐  │   │
│  │ │ - We project 20% quarterly growth.             │  │   │
│  │ │ + We project 20% quarterly growth based on:    │  │   │
│  │ │ +   - Historical SaaS benchmarks (15-25%)     │  │   │
│  │ │ +   - Our pipeline conversion rates            │  │   │
│  │ │ +   - Seasonal adjustment factors              │  │   │
│  │ └────────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │ [View Full Context]  [Approve & Apply]  [Dismiss]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💭 CLARIFY         Confidence: 72%    Impact: MED   │   │
│  │                                                      │   │
│  │ "Consider adding competitive analysis"               │   │
│  │                                                      │   │
│  │ John asked about competitors 3 times but the        │   │
│  │ document doesn't address this. Consider adding      │   │
│  │ a competitive landscape section.                     │   │
│  │                                                      │   │
│  │ [Note for Later]  [Dismiss]                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Improvements Over Base Spec

| Improvement | Why |
|-------------|-----|
| **evidenceQuotes** separate from reasoning | User can verify AI isn't hallucinating |
| **changeHighlight** for quick preview | Don't need to read full proposedContent |
| **CLARIFY action type** | Not all insights are edit-able |
| **appliedToVersion** link | Clear audit trail to version history |
| **targetChunkId** granularity | Enables precise embedding regeneration |

---

## 8) Spec Decomposition Strategy

Given the scope of these features, I recommend splitting into **5 independent specs** that can be worked on in parallel where possible:

### Spec 1: Document Editing & Versioning
**Priority:** High (enables Spec 2)
**Dependencies:** None
**Scope:**
- TipTap editor integration
- DocumentVersion model and API
- Version history UI
- Edit permissions (owner only)
- Embedding regeneration on edit

**Files affected:**
- NEW: `DocumentEditor.tsx`, `DocumentVersionHistory.tsx`
- NEW: `document.controller.ts` - add version endpoints
- MODIFY: `DocumentUpload.tsx` - add edit button for supported types
- MODIFY: `schema.prisma` - add DocumentVersion model

**Estimated effort:** 3-4 days

---

### Spec 2: Collaborator Role & Document Comments
**Priority:** High
**Dependencies:** Spec 1 (for document viewing context)
**Scope:**
- RecipientRole enum on ShareLink
- DocumentComment model and API
- Collaborator comment UI in SharePage
- Comment display in Analytics

**Files affected:**
- NEW: `CollaboratorCommentPanel.tsx`
- MODIFY: `SharePage.tsx` - role-based UI
- MODIFY: `ShareLinkManager.tsx` - role configuration
- MODIFY: `schema.prisma` - add RecipientRole, DocumentComment
- NEW: `documentComment.controller.ts`

**Estimated effort:** 2-3 days

---

### Spec 3: Post-Conversation Recommendations & Leave Message
**Priority:** Medium-High
**Dependencies:** None (can run parallel to Specs 1-2)
**Scope:**
- LeaveMessageModal in end session flow
- RecipientMessage model and API
- Extended conversation analysis with recommendations
- ConversationRecommendation model and UI
- Display in Analytics

**Files affected:**
- NEW: `LeaveMessageModal.tsx`
- MODIFY: `EndSessionModal.tsx` - add leave message step
- NEW: `ConversationRecommendations.tsx`
- MODIFY: `conversationAnalysis.ts` - add recommendation generation
- MODIFY: `AnalyticsDashboard.tsx` - show recommendations
- MODIFY: `schema.prisma` - add RecipientMessage, ConversationRecommendation

**Estimated effort:** 3-4 days

---

### Spec 4: Audience Synthesis & Versioning
**Priority:** Medium
**Dependencies:** Spec 3 (needs conversation analysis infrastructure)
**Scope:**
- AudienceSynthesis model and incremental update logic
- Version history with flip-through UI
- Display in Analytics tab
- Automatic trigger on conversation end

**Files affected:**
- NEW: `AudienceSynthesis.tsx`
- NEW: `audienceSynthesis.service.ts`
- MODIFY: `AnalyticsDashboard.tsx` - add synthesis section
- MODIFY: `conversation.controller.ts` - trigger synthesis update
- MODIFY: `schema.prisma` - add AudienceSynthesis

**Estimated effort:** 2-3 days

---

### Spec 5: Saved Audience & Collaborator Profiles
**Priority:** Medium-Low (nice-to-have for MVP)
**Dependencies:** Spec 2 (for collaborator context)
**Scope:**
- AudienceProfile model and CRUD
- CollaboratorProfile model and CRUD
- Dashboard sections for managing profiles
- Import from profile when creating share link

**Files affected:**
- NEW: `AudienceProfileManager.tsx`, `CollaboratorManager.tsx`
- MODIFY: `DashboardPage.tsx` - add profile sections
- MODIFY: `ShareLinkManager.tsx` - add import from profile
- NEW: `audienceProfile.controller.ts`, `collaboratorProfile.controller.ts`
- MODIFY: `schema.prisma` - add AudienceProfile, CollaboratorProfile

**Estimated effort:** 2-3 days

---

### Parallelization Strategy

```
Week 1:
├── Spec 1: Document Editing (Days 1-4)
├── Spec 3: Recommendations & Leave Message (Days 1-4) [PARALLEL]
└── Spec 2: Collaborator Role (Days 3-5, after Spec 1 foundation)

Week 2:
├── Spec 4: Audience Synthesis (Days 1-3)
└── Spec 5: Saved Profiles (Days 1-3) [PARALLEL]
```

**Total estimated time:** 10-14 days with parallel execution

---

## 9) Success Criteria

### Spec 1: Document Editing
- [ ] Owner can edit text documents (DOCX, MD, TXT) inline
- [ ] Edits create new versions with history
- [ ] Can view and rollback to previous versions
- [ ] Embeddings regenerate after edit
- [ ] PDF remains read-only (clearly indicated)

### Spec 2: Collaborator Role
- [ ] Share link can be configured as Viewer or Collaborator
- [ ] Collaborators see comment icons on document sections
- [ ] Comments are saved and linked to conversation
- [ ] Comments visible in sender's Analytics view

### Spec 3: Recommendations & Leave Message
- [ ] "Leave a message" modal appears before end confirmation
- [ ] Message is optional (can skip)
- [ ] AI generates recommendations after conversation ends
- [ ] Recommendations categorized: document_update, consideration, follow_up
- [ ] Sender can view recommendations in Analytics
- [ ] Sender can view recipient messages in Analytics

### Spec 4: Audience Synthesis
- [ ] Synthesis updates after each conversation ends
- [ ] Shows common questions, knowledge gaps, doc suggestions
- [ ] Version history allows "flipping through" past versions
- [ ] Sentiment trend tracking

### Spec 5: Saved Profiles
- [ ] User can create/edit/delete audience profiles from Dashboard
- [ ] User can create/edit/delete collaborator profiles from Dashboard
- [ ] Can import audience profile when creating share link
- [ ] Can assign collaborator profile to share link
- [ ] Usage count tracked

---

## 10) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TipTap learning curve | Low | Medium | Well-documented, many examples |
| Embedding regeneration slow | Medium | Medium | Run async, show progress indicator |
| Recommendation quality varies | Medium | Low | Include rationale, allow dismiss |
| Incremental synthesis drift | Low | Medium | Allow full regeneration option |
| Profile duplication confusion | Medium | Low | Clear UI distinction, usage counts |

---

*Ready for spec creation and implementation upon clarification resolution.*
