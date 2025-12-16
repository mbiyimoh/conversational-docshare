# Document Editing, Collaboration & AI-Assisted Recommendations

**Status:** Ready for Implementation
**Authors:** Claude Code
**Date:** 2025-12-07 (Updated 2025-12-08)
**Related:** `docs/ideation/collaborative-capsule-enhancements.md`

---

## Overview

This specification covers three interconnected features that enable document collaboration and AI-assisted content improvement:

1. **Document Editing & Versioning** - TipTap-based rich text editor with full version history
2. **Collaborator Role & Document Comments** - Highlight-to-comment pattern for collaborator feedback
3. **AI-Assisted Recommendation Application** - One-click AI-drafted edits from conversation recommendations

These features transform the platform from read-only document sharing to a collaborative editing environment where viewer feedback directly improves document quality.

---

## Background/Problem Statement

### Current State
- Documents are uploaded and processed but remain **read-only**
- The platform generates `ConversationRecommendation` records after conversations, but senders cannot act on them
- All share link recipients have identical capabilities (view + chat)
- No mechanism for viewers to leave inline feedback on specific document sections

### User Pain Points
1. **Friction in improvement loop**: Sender sees recommendations but must manually copy/paste and edit documents externally
2. **Lost context**: Collaborators provide feedback in chat, but it's not anchored to specific document text
3. **No differentiation**: Cannot give trusted reviewers (board advisors, co-founders) enhanced capabilities

### Solution Value
- **Faster iteration**: AI drafts edits based on viewer questions, sender approves with one click
- **Contextual feedback**: Comments anchored to exact document text with highlight preservation
- **Role-based access**: Distinguish between casual viewers and active collaborators

---

## Goals

- Enable in-app editing of text documents (DOCX, MD, TXT) with TipTap editor
- Maintain complete version history with diff view and rollback capability
- Support collaborator role with highlight-to-comment functionality
- Implement AI-assisted recommendation application (draft → review → approve flow)
- Regenerate embeddings after edits to keep RAG search accurate
- Preserve original document content while allowing edits

---

## Non-Goals

- Real-time collaborative editing (Google Docs style)
- PDF editing or annotation (PDFs remain read-only)
- Conflict resolution for concurrent edits
- Comment threading or replies (single-level comments only)
- Mobile-specific optimizations
- Fuzzy comment re-anchoring (MVP uses exact match only; comments warn if text changed)

---

## Existing Infrastructure (Already Implemented)

### Database Models (schema.prisma)

The following models **already exist** and require no changes:

```prisma
// Document model (lines 130-170)
model Document {
  // ... existing fields ...
  currentVersion Int     @default(1)    // ✅ EXISTS
  isEditable     Boolean @default(false) // ✅ EXISTS
  versions       DocumentVersion[]       // ✅ EXISTS
  comments       DocumentComment[]       // ✅ EXISTS
}

// DocumentVersion model (lines 173-195)
model DocumentVersion {
  id         String   @id @default(cuid())
  documentId String
  version    Int
  content    Json     // TipTap JSON format
  editedById String?
  editedBy   User?
  changeNote String?  @db.Text
  source     String?  // "manual" | "recommendation" | "import"
  sourceId   String?
  createdAt  DateTime @default(now())
  @@unique([documentId, version])
}

// DocumentComment model (lines 644-671)
model DocumentComment {
  id              String   @id @default(cuid())
  documentId      String
  conversationId  String?
  chunkId         String
  startOffset     Int
  endOffset       Int
  highlightedText String
  content         String   @db.Text
  viewerEmail     String?
  viewerName      String?
  status          String   @default("pending") // pending | addressed | dismissed
  createdAt       DateTime @default(now())
}

// ShareLink.recipientRole (line 302)
enum RecipientRole { viewer, collaborator }
model ShareLink {
  recipientRole RecipientRole @default(viewer) // ✅ EXISTS
}
```

### Backend Services (Already Implemented)

**`backend/src/services/documentVersioning.ts`** - Complete service with:

| Function | Status | Description |
|----------|--------|-------------|
| `createDocumentVersion()` | ✅ Complete | Creates new version, updates document.currentVersion |
| `getDocumentVersions()` | ✅ Complete | Lists all versions with metadata |
| `getVersionContent()` | ✅ Complete | Gets specific version content |
| `rollbackToVersion()` | ✅ Complete | Non-destructive rollback (creates new version) |
| `getCurrentVersionContent()` | ✅ Complete | Gets current version |
| `initializeDocumentVersion()` | ✅ Complete | Creates v1 from upload |
| `plainTextToTipTap()` | ✅ Complete | Converts plain text to TipTap JSON |
| `tipTapToPlainText()` | ✅ Complete | Extracts plain text for embeddings |

**TipTap JSON Format** (from `documentVersioning.ts:7-21`):

```typescript
interface TipTapNode {
  type: 'paragraph' | 'heading' | 'bulletList' | 'orderedList' |
        'listItem' | 'codeBlock' | 'blockquote' | 'text'
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: Array<{
    type: 'bold' | 'italic' | 'code' | 'link'
    attrs?: Record<string, unknown>
  }>
}

interface DocumentContentJSON {
  type: 'doc'
  content: TipTapNode[]
}
```

### Controllers (Already Implemented)

**`backend/src/controllers/documentComment.controller.ts`** - Complete with:
- `createDocumentComment()` - Add comment with anchor
- `getDocumentComments()` - List comments for document
- `updateCommentStatus()` - Mark as addressed/dismissed

---

## Technical Dependencies

### Frontend Dependencies to Add

```bash
cd frontend && npm install @tiptap/react@^2.1.0 @tiptap/starter-kit@^2.1.0 \
  @tiptap/extension-placeholder@^2.1.0 @tiptap/extension-highlight@^2.1.0 diff@^5.1.0
```

### TipTap Extensions Configuration

```typescript
// DocumentEditor.tsx - Extensions to use
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'

const extensions = [
  StarterKit.configure({
    // Enabled by default in StarterKit:
    // - Document, Paragraph, Text
    // - Bold, Italic, Strike, Code
    // - Heading (h1-h6), Blockquote, CodeBlock
    // - BulletList, OrderedList, ListItem
    // - HorizontalRule, HardBreak
    // - History (undo/redo)
    heading: { levels: [1, 2, 3] }, // Limit to h1-h3
    codeBlock: { HTMLAttributes: { class: 'code-block' } },
  }),
  Placeholder.configure({
    placeholder: 'Start typing your document content...',
  }),
  Highlight.configure({
    multicolor: false, // Single yellow highlight for comments
    HTMLAttributes: { class: 'comment-highlight' },
  }),
]
```

---

## Implementation Details

### 1. API Endpoints to Create

#### Document Editing Endpoints

```typescript
// backend/src/routes/documentVersion.routes.ts (NEW FILE)

// GET /api/documents/:documentId/edit
// Returns document for editing with current version content
// Authorization: Project owner only
// Response: { document: { id, filename, isEditable, currentVersion }, content: TipTapJSON }

// POST /api/documents/:documentId/versions
// Creates new version from TipTap content
// Authorization: Project owner only
// Body: { content: TipTapJSON, changeNote?: string }
// Response: { version: { id, version, createdAt } }
// Side effect: Queues embedding regeneration job

// GET /api/documents/:documentId/versions
// Lists all versions with metadata
// Authorization: Project owner only
// Response: { versions: [...], currentVersion: number }

// GET /api/documents/:documentId/versions/:versionNum
// Gets specific version content for diff view
// Authorization: Project owner only
// Response: { content: TipTapJSON, metadata: {...} }

// POST /api/documents/:documentId/rollback/:versionNum
// Rolls back to previous version (non-destructive)
// Authorization: Project owner only
// Response: { newVersion: number, content: TipTapJSON }
```

#### Controller Implementation

```typescript
// backend/src/controllers/documentVersion.controller.ts (NEW FILE)

import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { AuthorizationError, NotFoundError, ValidationError } from '../utils/errors'
import {
  createDocumentVersion,
  getDocumentVersions,
  getVersionContent,
  rollbackToVersion,
  getCurrentVersionContent,
  tipTapToPlainText,
} from '../services/documentVersioning'
import { queueEmbeddingRegeneration } from '../services/embeddingService'

export async function getDocumentForEdit(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can edit documents')
  }
  if (!document.isEditable) {
    throw new ValidationError('This document type cannot be edited (PDF)')
  }

  // Get current version content
  const versionContent = await getCurrentVersionContent(documentId)

  res.json({
    document: {
      id: document.id,
      filename: document.filename,
      isEditable: document.isEditable,
      currentVersion: document.currentVersion,
    },
    content: versionContent.content,
  })
}

export async function saveDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params
  const { content, changeNote } = req.body

  // Validate content structure
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) {
    throw new ValidationError('Invalid TipTap content format')
  }

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can edit documents')
  }

  // Create new version
  const { version } = await createDocumentVersion(
    documentId,
    content,
    req.user.userId,
    changeNote,
    'manual'
  )

  // Queue embedding regeneration (async, non-blocking)
  const plainText = tipTapToPlainText(content)
  await queueEmbeddingRegeneration(documentId, plainText)

  res.json({
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt,
    },
  })
}

// ... additional handlers for list, get, rollback following same pattern
```

### 2. Embedding Regeneration Strategy

```typescript
// backend/src/services/embeddingService.ts - ADD FUNCTION

import { workerpool } from '../utils/workerpool'

/**
 * Queue embedding regeneration for edited document
 *
 * Strategy: Full regeneration (not incremental)
 * - Simpler to implement and maintain
 * - Ensures consistency after edits
 * - Performance acceptable for typical document sizes (<100 chunks)
 */
export async function queueEmbeddingRegeneration(
  documentId: string,
  plainText: string
): Promise<void> {
  // Add to existing workerpool queue
  workerpool.exec('regenerateDocumentEmbeddings', [documentId, plainText])
    .catch((error) => {
      console.error(`Embedding regeneration failed for ${documentId}:`, error)
      // Non-blocking: Don't fail the edit if embedding fails
      // User can manually retry or embeddings regenerate on next upload
    })
}

// Worker function (runs in workerpool)
export async function regenerateDocumentEmbeddings(
  documentId: string,
  plainText: string
): Promise<void> {
  // 1. Delete existing chunks
  await prisma.documentChunk.deleteMany({ where: { documentId } })

  // 2. Re-chunk the plain text (same logic as initial processing)
  const chunks = chunkText(plainText, { maxChunkSize: 1500, overlap: 200 })

  // 3. Generate embeddings in batches
  for (const batch of batchArray(chunks, 20)) {
    const embeddings = await generateEmbeddings(batch.map(c => c.content))

    // 4. Store chunks with embeddings
    await prisma.documentChunk.createMany({
      data: batch.map((chunk, i) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        embedding: embeddings[i],
      })),
    })
  }
}
```

### 3. AI Draft Generation for Recommendations

```typescript
// backend/src/services/recommendationApplicator.ts (NEW FILE)

import OpenAI from 'openai'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError } from '../utils/errors'
import { createDocumentVersion, tipTapToPlainText } from './documentVersioning'

const openai = new OpenAI()

/**
 * Generate AI-drafted edit based on conversation recommendation
 */
export async function generateEditDraft(recommendationId: string): Promise<{
  originalText: string
  proposedText: string
  changeNote: string
  targetChunkId: string
}> {
  // 1. Load recommendation with related data
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id: recommendationId },
    include: {
      document: {
        include: {
          chunks: { orderBy: { chunkIndex: 'asc' } },
        },
      },
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 10, // Last 10 messages for context
          },
        },
      },
    },
  })

  if (!recommendation) throw new NotFoundError('Recommendation')
  if (recommendation.type !== 'document_update') {
    throw new ValidationError('Only document_update recommendations can be applied')
  }
  if (!recommendation.document) {
    throw new NotFoundError('Target document no longer exists')
  }

  // 2. Find target section in document
  const targetChunk = recommendation.targetSection
    ? recommendation.document.chunks.find(c =>
        c.sectionId === recommendation.targetSection ||
        c.sectionTitle?.toLowerCase().includes(recommendation.targetSection.toLowerCase())
      )
    : recommendation.document.chunks[0] // Default to first chunk

  if (!targetChunk) {
    throw new ValidationError('Target section not found in document')
  }

  // 3. Build conversation context
  const conversationContext = recommendation.conversation?.messages
    .map(m => `${m.role === 'user' ? 'Viewer' : 'AI'}: ${m.content}`)
    .join('\n\n') || ''

  // 4. Generate edit with LLM
  const prompt = `You are editing a professional document based on viewer feedback.

## Context
A viewer asked questions about this document section during a conversation. Based on their questions and the AI's responses, we need to improve the original text to proactively address these concerns.

## Original Document Section
${targetChunk.content}

## Viewer Conversation
${conversationContext}

## Recommendation
${recommendation.title}: ${recommendation.description}

## Your Task
Rewrite the original section to:
1. Preserve all factual information and key points
2. Add clarification that addresses the viewer's questions
3. Maintain the document's professional tone
4. Keep similar length (±20%)

## Output Format
Return ONLY the improved text. Do not include explanations, headers, or formatting instructions.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3, // Low temperature for consistency
    max_tokens: 2000,
  })

  const proposedText = completion.choices[0]?.message?.content?.trim() || ''

  if (!proposedText) {
    throw new Error('AI failed to generate edit')
  }

  // 5. Generate change note
  const changeNote = `Applied recommendation: ${recommendation.title}`

  return {
    originalText: targetChunk.content,
    proposedText,
    changeNote,
    targetChunkId: targetChunk.id,
  }
}

/**
 * Apply approved edit to document
 */
export async function applyRecommendationEdit(
  recommendationId: string,
  proposedText: string,
  changeNote: string,
  userId: string
): Promise<{ version: any; recommendation: any }> {
  const recommendation = await prisma.conversationRecommendation.findUnique({
    where: { id: recommendationId },
    include: { document: true },
  })

  if (!recommendation || !recommendation.document) {
    throw new NotFoundError('Recommendation or document')
  }

  // 1. Get current document content
  const { content: currentContent } = await getCurrentVersionContent(recommendation.documentId!)

  // 2. Find and replace the target section
  // Note: This is a simplified approach - replace first occurrence
  const plainText = tipTapToPlainText(currentContent)
  // For MVP, we create a new version with the full proposed content
  // A more sophisticated approach would do surgical replacement

  // 3. Create new version
  const { version } = await createDocumentVersion(
    recommendation.documentId!,
    currentContent, // In production, merge proposedText into currentContent
    userId,
    changeNote,
    'recommendation',
    recommendationId
  )

  // 4. Mark recommendation as applied
  const updatedRecommendation = await prisma.conversationRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: 'applied',
      appliedToVersion: version.version,
    },
  })

  // 5. Queue embedding regeneration
  await queueEmbeddingRegeneration(recommendation.documentId!, proposedText)

  return { version, recommendation: updatedRecommendation }
}
```

### 4. Frontend Components

#### DocumentEditor.tsx (NEW)

```typescript
// frontend/src/components/DocumentEditor.tsx

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback } from 'react'
import { api } from '../lib/api'

interface DocumentEditorProps {
  documentId: string
  initialContent: any // TipTap JSON
  onSave: () => void
  onClose: () => void
}

export function DocumentEditor({
  documentId,
  initialContent,
  onSave,
  onClose,
}: DocumentEditorProps) {
  const [saving, setSaving] = useState(false)
  const [changeNote, setChangeNote] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  })

  const handleSave = useCallback(async () => {
    if (!editor) return

    setSaving(true)
    try {
      const content = editor.getJSON()
      await api.saveDocumentVersion(documentId, content, changeNote || undefined)
      onSave()
    } catch (error) {
      console.error('Failed to save:', error)
      // Show error toast
    } finally {
      setSaving(false)
    }
  }, [editor, documentId, changeNote, onSave])

  if (!editor) return null

  return (
    <div className="fixed inset-4 bg-white z-50 flex flex-col rounded-xl shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded ${editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded ${editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <em>I</em>
        </button>
        <div className="h-6 w-px bg-gray-300 mx-2" />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          • List
        </button>

        <div className="flex-1" />

        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Change note (optional)"
          className="px-3 py-1 border rounded text-sm w-64"
        />
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Version'}
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
```

#### RecommendationApplyModal.tsx (NEW)

```typescript
// frontend/src/components/RecommendationApplyModal.tsx

import { useState, useEffect } from 'react'
import { diffWords } from 'diff'
import { api } from '../lib/api'

interface RecommendationApplyModalProps {
  recommendationId: string
  onApply: () => void
  onClose: () => void
}

export function RecommendationApplyModal({
  recommendationId,
  onApply,
  onClose,
}: RecommendationApplyModalProps) {
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<{
    originalText: string
    proposedText: string
    changeNote: string
  } | null>(null)

  useEffect(() => {
    generateDraft()
  }, [recommendationId])

  const generateDraft = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.generateRecommendationDraft(recommendationId)
      setDraft(response.draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draft')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!draft) return

    setApplying(true)
    try {
      await api.applyRecommendation(recommendationId, draft.proposedText, draft.changeNote)
      onApply()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setApplying(false)
    }
  }

  // Generate diff visualization
  const renderDiff = () => {
    if (!draft) return null

    const diff = diffWords(draft.originalText, draft.proposedText)

    return (
      <div className="font-mono text-sm whitespace-pre-wrap">
        {diff.map((part, i) => (
          <span
            key={i}
            className={
              part.added ? 'bg-green-100 text-green-800' :
              part.removed ? 'bg-red-100 text-red-800 line-through' :
              ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Apply AI Recommendation</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              <span className="ml-3 text-gray-600">Generating AI draft...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">
              {error}
            </div>
          )}

          {draft && !loading && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Proposed Changes</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  {renderDiff()}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Change Note</h3>
                <p className="text-sm text-gray-700">{draft.changeNote}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!draft || applying}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? 'Applying...' : 'Approve & Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 5. Comment Visibility Rules

```typescript
// Authorization rules for document comments

// WHO CAN CREATE COMMENTS:
// - Only users accessing via ShareLink with recipientRole === 'collaborator'
// - Comment includes viewer's email/name from share link verification

// WHO CAN VIEW COMMENTS:
// - Project owner: Can see ALL comments on their documents
// - Collaborator: Can see ONLY their own comments
// - Regular viewer: Cannot see any comments

// Implementation in documentComment.controller.ts:
export async function getDocumentComments(req: Request, res: Response) {
  const { documentId } = req.params

  // If authenticated user (owner checking from dashboard)
  if (req.user) {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { project: { select: { ownerId: true } } },
    })

    if (document?.project.ownerId === req.user.userId) {
      // Owner sees all comments
      const comments = await prisma.documentComment.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
      })
      return res.json({ comments })
    }
  }

  // If collaborator (via share link)
  if (req.shareLink && req.viewerEmail) {
    // Collaborator sees only their own comments
    const comments = await prisma.documentComment.findMany({
      where: { documentId, viewerEmail: req.viewerEmail },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ comments })
  }

  // No access
  throw new AuthorizationError('Cannot view comments')
}
```

### 6. Chunk Boundary Edit Strategy

```
MVP APPROACH: Document-Level Versioning

When a document is edited:
1. Store FULL document content as TipTap JSON in DocumentVersion.content
2. DocumentChunk table remains SEPARATE - used for RAG search only
3. On save, regenerate ALL chunks from new plain text (full re-chunking)

This means:
- DocumentVersion.content = Source of truth for editing
- DocumentChunk[] = Derived data for embedding search
- Comment anchors reference chunkId + offsets from TIME OF COMMENT
- If document is edited, comment may become orphaned (acceptable for MVP)

COMMENT ORPHANING STRATEGY:
- When displaying comment, check if highlightedText still exists in chunk
- If exact match found: Show highlight at new position
- If no match: Show comment in sidebar with warning "Original text was modified"
- User can manually dismiss orphaned comments
```

---

## User Experience Flows

### Owner Editing Flow

1. Navigate to project → Documents tab
2. See "Edit" button on editable documents (DOCX/MD/TXT only)
3. Click → Document editor opens in modal
4. Edit using familiar rich text controls
5. Add optional change note
6. Click "Save Version" → New version created, embeddings regenerate async
7. Close editor → Return to document list

### Collaborator Comment Flow

1. Access share link with `recipientRole: collaborator`
2. View document in right panel
3. Select/highlight text → "Add Comment" button appears
4. Click → Comment input popover opens
5. Enter comment → Submit
6. See your comment in sidebar (yellow highlight on text)
7. Sender sees comment in Analytics dashboard

### Recommendation Application Flow

1. Sender views ended conversation in Analytics
2. Sees recommendation card with "Apply to Document" button
3. Click → Modal opens, shows "Generating AI draft..."
4. AI generates proposed edit based on conversation context
5. Diff view shows original vs proposed text
6. Sender can review and edit the proposal
7. Click "Approve & Apply" → New document version created
8. Recommendation marked as applied

---

## Testing Strategy

### Unit Tests

```typescript
// backend/src/services/__tests__/documentVersioning.test.ts
describe('createDocumentVersion', () => {
  it('increments version number correctly', async () => {
    // Setup: Document with currentVersion=3
    // Action: createDocumentVersion()
    // Assert: New version is 4, document.currentVersion updated
  })

  it('rejects edits to non-editable documents', async () => {
    // Setup: PDF document (isEditable=false)
    // Action: Attempt createDocumentVersion()
    // Assert: Throws ValidationError
  })
})

describe('tipTapToPlainText', () => {
  it('extracts all text from nested structure', () => {
    // Purpose: Ensure embedding content is complete
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
      ],
    }
    expect(tipTapToPlainText(doc)).toBe('Title\nBody text')
  })
})
```

### Integration Tests

```typescript
// backend/src/controllers/__tests__/documentVersion.test.ts
describe('Document Version API', () => {
  it('full edit → save → rollback cycle', async () => {
    // 1. Create document
    // 2. POST new version
    // 3. Verify version 2 is current
    // 4. POST rollback to version 1
    // 5. Verify version 3 created with v1 content
  })

  it('rejects unauthorized edit attempts', async () => {
    // Non-owner tries to edit
    // Assert: 403 Forbidden
  })
})
```

### E2E Tests

```typescript
// e2e/document-editing.spec.ts
test('owner can edit document and see version history', async ({ page }) => {
  // 1. Login as owner
  // 2. Navigate to project → Documents
  // 3. Click Edit on DOCX
  // 4. Modify content
  // 5. Save with change note
  // 6. Verify version history shows new entry
})

test('collaborator can add comment on highlighted text', async ({ page }) => {
  // 1. Access collaborator share link
  // 2. Select text in document
  // 3. Click "Add Comment"
  // 4. Enter and submit comment
  // 5. Verify highlight appears
})
```

---

## Implementation Phases

### Phase 1: Document Editing Foundation (3-4 days)
1. Install TipTap dependencies
2. Create DocumentEditor.tsx component
3. Create document version API endpoints/controller
4. Wire embedding regeneration job
5. Add "Edit" button to document list UI
6. Unit + integration tests

### Phase 2: Collaborator Comments (2 days)
1. Wire existing CollaboratorCommentPanel to SharePage
2. Add role-based UI visibility (show comment button only for collaborators)
3. Display comments in Analytics conversation detail
4. E2E tests for comment flow

### Phase 3: AI-Assisted Recommendations (2-3 days)
1. Create recommendationApplicator.ts service
2. Add draft generation + apply endpoints
3. Build RecommendationApplyModal with diff view
4. Add "Apply to Document" button to recommendation cards
5. End-to-end flow tests

---

## Performance Considerations

- **Embedding Regeneration**: Async via workerpool, non-blocking to user
- **Large Documents**: TipTap handles well up to ~50k characters; beyond that, consider paginated editing
- **Version History**: Paginate to 20 most recent; lazy-load content on diff request
- **Comment Display**: Batch-load comments with document; don't re-fetch on each interaction

---

## Security Considerations

- **Document Editing**: Only project owner can edit (verified via project.ownerId)
- **Comment Creation**: Only collaborator role on active share link
- **Comment Viewing**: Owner sees all; collaborator sees only own
- **Rate Limits**: Version creation 30/hour; AI drafts 10/hour; comments 50/hour
- **Input Validation**: TipTap content sanitized; comment content HTML-escaped, max 10k chars

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Autosave vs explicit save? | Explicit save to avoid version spam |
| Offline edit handling? | Show error, keep content in editor, manual retry |
| Comment notifications? | Deferred to email notifications feature |
| Chunk boundary edits? | Full re-chunk on save; accept comment orphaning in MVP |
| plainText field in schema? | Compute on-demand via tipTapToPlainText(); no schema change needed |

---

## Files to Create

| File | Type | Description |
|------|------|-------------|
| `backend/src/routes/documentVersion.routes.ts` | NEW | Version management API routes |
| `backend/src/controllers/documentVersion.controller.ts` | NEW | Version CRUD handlers |
| `backend/src/services/recommendationApplicator.ts` | NEW | AI draft generation + apply |
| `frontend/src/components/DocumentEditor.tsx` | NEW | TipTap editor component |
| `frontend/src/components/DocumentVersionHistory.tsx` | NEW | Version list + diff view |
| `frontend/src/components/RecommendationApplyModal.tsx` | NEW | Draft review modal |

## Files to Modify

| File | Change |
|------|--------|
| `frontend/package.json` | Add TipTap + diff dependencies |
| `backend/src/index.ts` | Register documentVersion routes |
| `backend/src/services/embeddingService.ts` | Add queueEmbeddingRegeneration() |
| `frontend/src/components/SharePage.tsx` | Show comment UI for collaborator role |
| `frontend/src/components/RecommendationCard.tsx` | Add "Apply to Document" button |
| `frontend/src/lib/api.ts` | Add version + recommendation API methods |
