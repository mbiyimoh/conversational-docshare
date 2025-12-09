# Task Breakdown: Collaborator Role & Document Comments

**Generated:** 2025-12-07
**Source:** specs/feat-collaborator-role-comments.md
**Spec ID:** feat-collaborator-role-comments

---

## Overview

Implement collaborator role functionality allowing share link recipients to be designated as "collaborators" who can highlight document text and leave inline comments. Comments are stored with positional anchors and displayed in the Analytics dashboard.

---

## Phase 1: Database Schema & Backend Foundation

### Task 1.1: Add RecipientRole Enum and Update ShareLink Model

**Description:** Add RecipientRole enum to Prisma schema and add recipientRole field to ShareLink model
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation task)

**Technical Requirements:**

Add to `backend/prisma/schema.prisma`:

```prisma
enum RecipientRole {
  viewer
  collaborator
}
```

Modify ShareLink model:
```prisma
model ShareLink {
  // ... existing fields
  recipientRole   RecipientRole @default(viewer)
}
```

**Implementation Steps:**
1. Open `backend/prisma/schema.prisma`
2. Add `RecipientRole` enum before ShareLink model
3. Add `recipientRole` field to ShareLink model with default value
4. Run schema validation: `npx prisma validate`

**Acceptance Criteria:**
- [ ] RecipientRole enum defined with `viewer` and `collaborator` values
- [ ] ShareLink model has recipientRole field with default `viewer`
- [ ] Schema validates without errors

---

### Task 1.2: Create DocumentComment Model

**Description:** Add DocumentComment model for storing highlight-anchored comments on documents
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**

Add to `backend/prisma/schema.prisma`:

```prisma
model DocumentComment {
  id              String   @id @default(cuid())
  documentId      String
  document        Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  conversationId  String?
  conversation    Conversation? @relation(fields: [conversationId], references: [id], onDelete: SetNull)

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
```

Also add relations to Document and Conversation models:
```prisma
model Document {
  // ... existing fields
  comments        DocumentComment[]
}

model Conversation {
  // ... existing fields
  documentComments DocumentComment[]
}
```

**Implementation Steps:**
1. Add DocumentComment model to schema
2. Add `comments` relation to Document model
3. Add `documentComments` relation to Conversation model
4. Run `npx prisma validate`

**Acceptance Criteria:**
- [ ] DocumentComment model created with all fields
- [ ] Relations to Document and Conversation established
- [ ] Indexes on documentId, conversationId, and chunkId
- [ ] Schema validates without errors

---

### Task 1.3: Push Schema Changes to Database

**Description:** Apply schema changes to Supabase PostgreSQL database
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2
**Can run parallel with:** None

**Technical Requirements:**

Run database push using direct connection (not pooler):
```bash
DATABASE_URL="postgresql://postgres.zflwtgaustyjpjmawnjw:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" npx prisma db push --schema=backend/prisma/schema.prisma
```

**Implementation Steps:**
1. Ensure DATABASE_URL uses port 5432 (direct connection)
2. Run `npm run db:push` from backend directory
3. Verify tables created in Supabase dashboard
4. Generate Prisma client: `npx prisma generate`

**Acceptance Criteria:**
- [ ] RecipientRole enum created in database
- [ ] recipientRole column added to ShareLink table
- [ ] DocumentComment table created with all columns and indexes
- [ ] Prisma client regenerated

---

### Task 1.4: Create DocumentComment Controller

**Description:** Create backend controller with CRUD operations for document comments
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** Task 1.5

**Technical Requirements:**

Create `backend/src/controllers/documentComment.controller.ts`:

```typescript
import { Request, Response } from 'express'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError } from '../utils/errors'

/**
 * Create a new comment on a document
 * POST /api/documents/:documentId/comments
 *
 * Authorization: Public (for collaborators via share link)
 */
export async function createComment(req: Request, res: Response) {
  const { documentId } = req.params
  const {
    conversationId,
    chunkId,
    startOffset,
    endOffset,
    highlightedText,
    content,
    viewerEmail,
    viewerName
  } = req.body

  // Validate required fields
  if (!chunkId || startOffset === undefined || endOffset === undefined || !highlightedText || !content) {
    throw new ValidationError('Missing required fields: chunkId, startOffset, endOffset, highlightedText, content')
  }

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  // Create comment
  const comment = await prisma.documentComment.create({
    data: {
      documentId,
      conversationId: conversationId || null,
      chunkId,
      startOffset,
      endOffset,
      highlightedText,
      content,
      viewerEmail: viewerEmail || null,
      viewerName: viewerName || null,
      status: 'pending'
    }
  })

  res.status(201).json({
    comment: {
      id: comment.id,
      documentId: comment.documentId,
      highlightedText: comment.highlightedText,
      content: comment.content,
      status: comment.status,
      createdAt: comment.createdAt
    }
  })
}

/**
 * Get all comments for a document
 * GET /api/documents/:documentId/comments
 *
 * Query params:
 * - conversationId (optional): Filter to specific conversation
 * - status (optional): Filter by status
 */
export async function getComments(req: Request, res: Response) {
  const { documentId } = req.params
  const { conversationId, status } = req.query

  // Build where clause
  const where: any = { documentId }
  if (conversationId) where.conversationId = conversationId as string
  if (status) where.status = status as string

  const comments = await prisma.documentComment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      chunkId: true,
      startOffset: true,
      endOffset: true,
      highlightedText: true,
      content: true,
      viewerEmail: true,
      viewerName: true,
      status: true,
      createdAt: true
    }
  })

  res.json({ comments })
}

/**
 * Update comment status
 * PATCH /api/comments/:id/status
 *
 * Authorization: Project owner only
 */
export async function updateCommentStatus(req: Request, res: Response) {
  if (!req.user) {
    throw new ValidationError('Authentication required')
  }

  const { id } = req.params
  const { status } = req.body

  // Validate status
  const validStatuses = ['pending', 'addressed', 'dismissed']
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Status must be one of: ${validStatuses.join(', ')}`)
  }

  // Get comment with document and project info
  const comment = await prisma.documentComment.findUnique({
    where: { id },
    include: {
      document: {
        select: {
          project: {
            select: { ownerId: true }
          }
        }
      }
    }
  })

  if (!comment) {
    throw new NotFoundError('Comment')
  }

  // Verify ownership
  if (comment.document.project.ownerId !== req.user.userId) {
    throw new ValidationError('Only project owner can update comment status')
  }

  // Update status
  const updated = await prisma.documentComment.update({
    where: { id },
    data: { status }
  })

  res.json({
    comment: {
      id: updated.id,
      status: updated.status
    }
  })
}
```

**Acceptance Criteria:**
- [ ] createComment validates required fields
- [ ] createComment stores comment with positional anchors
- [ ] getComments supports filtering by conversationId and status
- [ ] updateCommentStatus verifies project ownership
- [ ] All errors throw appropriate error types

---

### Task 1.5: Create DocumentComment Routes

**Description:** Create Express routes for document comment endpoints
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.4
**Can run parallel with:** Task 1.4

**Technical Requirements:**

Create `backend/src/routes/documentComment.routes.ts`:

```typescript
import { Router } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { optionalAuthenticate, authenticate } from '../middleware/auth'
import {
  createComment,
  getComments,
  updateCommentStatus
} from '../controllers/documentComment.controller'

const router = Router()

// Create comment on document (public for collaborators)
router.post('/documents/:documentId/comments', optionalAuthenticate, asyncHandler(createComment))

// Get comments for document
router.get('/documents/:documentId/comments', optionalAuthenticate, asyncHandler(getComments))

// Update comment status (owner only)
router.patch('/comments/:id/status', authenticate, asyncHandler(updateCommentStatus))

export default router
```

Register in `backend/src/index.ts`:
```typescript
import documentCommentRoutes from './routes/documentComment.routes'
// ...
app.use('/api', documentCommentRoutes)
```

**Acceptance Criteria:**
- [ ] Routes created for POST, GET, and PATCH endpoints
- [ ] optionalAuthenticate middleware used for public endpoints
- [ ] authenticate middleware used for status update
- [ ] Routes registered in main app

---

### Task 1.6: Update ShareLink Controller for RecipientRole

**Description:** Modify share link creation and access verification to handle recipientRole
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.3
**Can run parallel with:** Task 1.4, Task 1.5

**Technical Requirements:**

Modify `backend/src/controllers/shareLink.controller.ts`:

1. Update createShareLink to accept recipientRole:
```typescript
export async function createShareLink(req: Request, res: Response) {
  // ... existing validation
  const {
    projectId,
    accessType,
    password,
    allowedEmails,
    recipientRole = 'viewer'  // NEW: default to viewer
  } = req.body

  // Validate recipientRole
  if (recipientRole && !['viewer', 'collaborator'].includes(recipientRole)) {
    throw new ValidationError('recipientRole must be viewer or collaborator')
  }

  const shareLink = await prisma.shareLink.create({
    data: {
      // ... existing fields
      recipientRole  // NEW
    }
  })
  // ...
}
```

2. Update verifyAccess to return recipientRole:
```typescript
export async function verifyAccess(req: Request, res: Response) {
  // ... existing verification logic

  res.json({
    // ... existing fields
    recipientRole: shareLink.recipientRole  // NEW
  })
}
```

**Acceptance Criteria:**
- [ ] createShareLink accepts recipientRole parameter
- [ ] recipientRole validated (must be viewer or collaborator)
- [ ] Default value is 'viewer' if not specified
- [ ] verifyAccess returns recipientRole in response

---

## Phase 2: Frontend Share Link Configuration

### Task 2.1: Update ShareLinkManager with Role Selector

**Description:** Add recipient role radio buttons to share link creation form
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.6
**Can run parallel with:** None

**Technical Requirements:**

Modify `frontend/src/components/ShareLinkManager.tsx`:

1. Add state for recipientRole:
```typescript
const [recipientRole, setRecipientRole] = useState<'viewer' | 'collaborator'>('viewer')
```

2. Add role selector UI after access type:
```tsx
<div className="mt-4">
  <label className="block text-sm font-medium mb-2">Recipient Role</label>
  <div className="space-y-2">
    <label className="flex items-center">
      <input
        type="radio"
        name="recipientRole"
        value="viewer"
        checked={recipientRole === 'viewer'}
        onChange={() => setRecipientRole('viewer')}
        className="mr-2"
      />
      <span className="font-medium">Viewer</span>
      <span className="text-gray-500 text-sm ml-2">Can chat and view documents</span>
    </label>
    <label className="flex items-center">
      <input
        type="radio"
        name="recipientRole"
        value="collaborator"
        checked={recipientRole === 'collaborator'}
        onChange={() => setRecipientRole('collaborator')}
        className="mr-2"
      />
      <span className="font-medium">Collaborator</span>
      <span className="text-gray-500 text-sm ml-2">Can also leave comments on documents</span>
    </label>
  </div>
</div>
```

3. Include recipientRole in API call:
```typescript
const result = await api.createShareLink(projectId, {
  accessType,
  password,
  allowedEmails,
  recipientRole  // NEW
})
```

**Acceptance Criteria:**
- [ ] Radio buttons show viewer and collaborator options
- [ ] Default selection is viewer
- [ ] Role included when creating share link
- [ ] UI shows description for each role

---

### Task 2.2: Update Frontend API Client

**Description:** Add recipientRole to share link types and API methods
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.6
**Can run parallel with:** Task 2.1

**Technical Requirements:**

Update `frontend/src/lib/api.ts`:

1. Update CreateShareLinkRequest type:
```typescript
interface CreateShareLinkRequest {
  accessType: 'public_password' | 'email_required' | 'whitelist'
  password?: string
  allowedEmails?: string[]
  recipientRole?: 'viewer' | 'collaborator'  // NEW
}
```

2. Update AccessResponse type:
```typescript
interface AccessResponse {
  // ... existing fields
  recipientRole: 'viewer' | 'collaborator'  // NEW
}
```

3. Add document comment API methods:
```typescript
async createDocumentComment(
  documentId: string,
  data: {
    conversationId?: string
    chunkId: string
    startOffset: number
    endOffset: number
    highlightedText: string
    content: string
    viewerEmail?: string
    viewerName?: string
  }
) {
  return this.request<{ comment: DocumentComment }>(
    `documents/${documentId}/comments`,
    { method: 'POST', body: JSON.stringify(data) }
  )
}

async getDocumentComments(
  documentId: string,
  params?: { conversationId?: string; status?: string }
) {
  const query = new URLSearchParams(params as Record<string, string>).toString()
  return this.request<{ comments: DocumentComment[] }>(
    `documents/${documentId}/comments${query ? `?${query}` : ''}`
  )
}

async updateCommentStatus(commentId: string, status: 'pending' | 'addressed' | 'dismissed') {
  return this.request<{ comment: { id: string; status: string } }>(
    `comments/${commentId}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  )
}
```

**Acceptance Criteria:**
- [ ] CreateShareLinkRequest includes recipientRole
- [ ] AccessResponse includes recipientRole
- [ ] Document comment CRUD methods added
- [ ] Types exported for use in components

---

## Phase 3: Collaborator Comment Experience

### Task 3.1: Create CollaboratorCommentPanel Component

**Description:** Build floating panel that appears when collaborator highlights text
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** Task 3.2

**Technical Requirements:**

Create `frontend/src/components/CollaboratorCommentPanel.tsx`:

```tsx
import { useState } from 'react'

interface CollaboratorCommentPanelProps {
  documentId: string
  conversationId: string
  selectedText: string
  selectionRange: { chunkId: string; start: number; end: number }
  position: { x: number; y: number }
  viewerEmail?: string
  viewerName?: string
  onSubmit: (content: string) => Promise<void>
  onCancel: () => void
}

export function CollaboratorCommentPanel({
  documentId,
  conversationId,
  selectedText,
  selectionRange,
  position,
  viewerEmail,
  viewerName,
  onSubmit,
  onCancel
}: CollaboratorCommentPanelProps) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      await onSubmit(content.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-80"
      style={{ left: position.x, top: position.y }}
    >
      {/* Header with highlighted text preview */}
      <div className="px-4 py-3 border-b bg-yellow-50">
        <div className="text-xs text-gray-500 mb-1">Commenting on:</div>
        <div className="text-sm text-gray-700 italic line-clamp-2">
          "{selectedText}"
        </div>
      </div>

      {/* Comment input */}
      <div className="p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your comment..."
          className="w-full h-24 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />

        {error && (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Panel positioned near selection
- [ ] Shows highlighted text preview
- [ ] Textarea for comment input
- [ ] Submit/Cancel buttons with loading state
- [ ] Error handling displayed
- [ ] Disabled state during submission

---

### Task 3.2: Create DocumentCommentMarker Component

**Description:** Build visual indicator for highlighted text with comments
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** Task 3.1

**Technical Requirements:**

Create `frontend/src/components/DocumentCommentMarker.tsx`:

```tsx
interface DocumentCommentMarkerProps {
  highlightedText: string
  commentCount: number
  onClick: () => void
}

export function DocumentCommentMarker({
  highlightedText,
  commentCount,
  onClick
}: DocumentCommentMarkerProps) {
  return (
    <span
      className="bg-yellow-200 hover:bg-yellow-300 cursor-pointer relative inline"
      onClick={onClick}
    >
      {highlightedText}
      {commentCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {commentCount}
        </span>
      )}
    </span>
  )
}
```

**Acceptance Criteria:**
- [ ] Yellow highlight on text with comments
- [ ] Comment count badge displayed
- [ ] Clickable to open comment drawer
- [ ] Hover state for interactivity

---

### Task 3.3: Create DocumentCommentsDrawer Component

**Description:** Build slide-out drawer showing all comments for document
**Size:** Large
**Priority:** High
**Dependencies:** Task 3.2
**Can run parallel with:** None

**Technical Requirements:**

Create `frontend/src/components/DocumentCommentsDrawer.tsx`:

```tsx
interface DocumentComment {
  id: string
  chunkId: string
  startOffset: number
  endOffset: number
  highlightedText: string
  content: string
  viewerEmail: string | null
  viewerName: string | null
  status: string
  createdAt: string
}

interface DocumentCommentsDrawerProps {
  documentId: string
  comments: DocumentComment[]
  isOpen: boolean
  onCommentClick: (comment: DocumentComment) => void
  onClose: () => void
}

export function DocumentCommentsDrawer({
  documentId,
  comments,
  isOpen,
  onCommentClick,
  onClose
}: DocumentCommentsDrawerProps) {
  if (!isOpen) return null

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'addressed': return 'bg-green-100 text-green-800'
      case 'dismissed': return 'bg-gray-100 text-gray-600'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">Comments ({comments.length})</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No comments yet
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => onCommentClick(comment)}
              >
                {/* Highlighted text */}
                <div className="text-xs text-gray-500 mb-1">
                  "{comment.highlightedText.slice(0, 50)}..."
                </div>

                {/* Comment content */}
                <div className="text-sm text-gray-800 mb-2">
                  {comment.content}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {comment.viewerName || comment.viewerEmail || 'Anonymous'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded ${getStatusColor(comment.status)}`}>
                      {comment.status}
                    </span>
                    <span className="text-gray-400">{formatDate(comment.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Slide-out drawer with backdrop
- [ ] Shows all comments with preview
- [ ] Displays commenter name/email
- [ ] Status badge with color coding
- [ ] Click comment to scroll to location
- [ ] Empty state message

---

### Task 3.4: Add Text Selection Handling to SharePage

**Description:** Implement text selection detection and comment panel integration for collaborators
**Size:** Large
**Priority:** High
**Dependencies:** Task 3.1, Task 3.3
**Can run parallel with:** None

**Technical Requirements:**

Modify `frontend/src/pages/SharePage.tsx` and `frontend/src/components/DocumentContentViewer.tsx`:

1. Track recipientRole in SharePage state
2. Pass recipientRole to DocumentContentViewer
3. Add selection handling for collaborators:

```typescript
// In DocumentContentViewer.tsx
const [selection, setSelection] = useState<{
  text: string
  chunkId: string
  startOffset: number
  endOffset: number
  position: { x: number; y: number }
} | null>(null)

const handleMouseUp = useCallback(() => {
  if (recipientRole !== 'collaborator') return

  const windowSelection = window.getSelection()
  if (!windowSelection || windowSelection.isCollapsed) {
    setSelection(null)
    return
  }

  const text = windowSelection.toString().trim()
  if (!text) {
    setSelection(null)
    return
  }

  // Get selection position for panel placement
  const range = windowSelection.getRangeAt(0)
  const rect = range.getBoundingClientRect()

  // Find chunk ID from selection (you'll need to add data-chunk-id to chunk elements)
  const chunkElement = range.startContainer.parentElement?.closest('[data-chunk-id]')
  if (!chunkElement) return

  const chunkId = chunkElement.getAttribute('data-chunk-id')!

  setSelection({
    text,
    chunkId,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    position: { x: rect.right + 10, y: rect.top }
  })
}, [recipientRole])

// Add mouseup listener to document panel
useEffect(() => {
  const container = scrollContainerRef.current
  if (!container) return

  container.addEventListener('mouseup', handleMouseUp)
  return () => container.removeEventListener('mouseup', handleMouseUp)
}, [handleMouseUp])
```

**Acceptance Criteria:**
- [ ] Text selection detected for collaborators only
- [ ] Selection info includes chunk ID and offsets
- [ ] Comment panel shows at selection position
- [ ] Submitting comment clears selection
- [ ] Cancel clears selection

---

## Phase 4: Analytics Integration

### Task 4.1: Create AnalyticsCommentsSection Component

**Description:** Display document comments in Analytics conversation detail view
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 1.4
**Can run parallel with:** Task 4.2

**Technical Requirements:**

Create `frontend/src/components/AnalyticsCommentsSection.tsx`:

```tsx
import { useState } from 'react'
import { api } from '../lib/api'

interface DocumentComment {
  id: string
  highlightedText: string
  content: string
  viewerName: string | null
  viewerEmail: string | null
  status: string
  createdAt: string
}

interface AnalyticsCommentsSectionProps {
  conversationId: string
  comments: DocumentComment[]
  isOwner: boolean
  onStatusUpdate?: (commentId: string, status: string) => void
}

export function AnalyticsCommentsSection({
  conversationId,
  comments,
  isOwner,
  onStatusUpdate
}: AnalyticsCommentsSectionProps) {
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (commentId: string, newStatus: string) => {
    try {
      setUpdating(commentId)
      await api.updateCommentStatus(commentId, newStatus as any)
      onStatusUpdate?.(commentId, newStatus)
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (comments.length === 0) return null

  return (
    <div className="border-t pt-4 mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3">
        Document Comments ({comments.length})
      </h4>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1 italic">
              "{comment.highlightedText.slice(0, 80)}..."
            </div>
            <div className="text-sm text-gray-800 mb-2">
              {comment.content}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {comment.viewerName || comment.viewerEmail || 'Anonymous'}
              </span>
              {isOwner && (
                <select
                  value={comment.status}
                  onChange={(e) => handleStatusChange(comment.id, e.target.value)}
                  disabled={updating === comment.id}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value="pending">Pending</option>
                  <option value="addressed">Addressed</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Shows comments linked to conversation
- [ ] Displays highlighted text preview
- [ ] Shows commenter info
- [ ] Owner can update status via dropdown
- [ ] Loading state during status update

---

### Task 4.2: Integrate Comments into ConversationDetailPanel

**Description:** Add AnalyticsCommentsSection to conversation detail view
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 4.1
**Can run parallel with:** Task 4.1

**Technical Requirements:**

Modify `frontend/src/components/ConversationDetailPanel.tsx`:

1. Add comments to ConversationDetail interface:
```typescript
interface ConversationDetail {
  // ... existing fields
  documentComments?: DocumentComment[]
}
```

2. Fetch comments when loading conversation
3. Add AnalyticsCommentsSection to render:
```tsx
{/* After Recipient Message section */}
{conversation.documentComments && conversation.documentComments.length > 0 && (
  <div className="px-6 py-4 border-b">
    <AnalyticsCommentsSection
      conversationId={conversation.id}
      comments={conversation.documentComments}
      isOwner={true}
      onStatusUpdate={handleCommentStatusUpdate}
    />
  </div>
)}
```

**Acceptance Criteria:**
- [ ] Comments section appears after recipient message
- [ ] Only shows when comments exist
- [ ] Status updates refresh the list
- [ ] Proper styling consistent with panel

---

## Phase 5: Testing & Verification

### Task 5.1: Manual Testing & Bug Fixes

**Description:** Comprehensive manual testing of collaborator role and comment functionality
**Size:** Medium
**Priority:** High
**Dependencies:** All previous tasks
**Can run parallel with:** None

**Test Scenarios:**

1. **Share Link Creation:**
   - Create share link with viewer role → verify viewer experience
   - Create share link with collaborator role → verify comment UI appears

2. **Comment Flow:**
   - Access as collaborator
   - Highlight text in document
   - Submit comment
   - Verify comment saved to database
   - Verify comment appears in drawer

3. **Analytics View:**
   - Open conversation with comments
   - Verify comments displayed
   - Update comment status
   - Verify status persists

4. **Edge Cases:**
   - Long text selection
   - Multiple comments on same text
   - Comment on short text
   - Special characters in comment

**Acceptance Criteria:**
- [ ] All test scenarios pass
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

---

## Summary

| Phase | Tasks | Estimated Size |
|-------|-------|----------------|
| Phase 1: Database & Backend | 6 tasks | Large |
| Phase 2: Share Link Config | 2 tasks | Small |
| Phase 3: Collaborator Experience | 4 tasks | Large |
| Phase 4: Analytics Integration | 2 tasks | Medium |
| Phase 5: Testing | 1 task | Medium |

**Total Tasks:** 15
**Critical Path:** 1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 3.4 → 5.1

**Parallel Execution Opportunities:**
- Task 1.4 and 1.5 can run in parallel
- Task 1.6 can run parallel with 1.4, 1.5
- Task 2.1 and 2.2 can run in parallel
- Task 3.1 and 3.2 can run in parallel
- Task 4.1 and 4.2 can run in parallel
