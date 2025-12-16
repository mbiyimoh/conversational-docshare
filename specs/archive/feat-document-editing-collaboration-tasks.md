# Task Breakdown: Document Editing, Collaboration & AI-Assisted Recommendations

**Generated:** 2025-12-08
**Source:** specs/feat-document-editing-collaboration.md

---

## Overview

This breakdown implements three interconnected features:
1. TipTap-based document editing with version history
2. Collaborator role with highlight-to-comment functionality
3. AI-assisted recommendation application

**Existing Infrastructure:** DocumentVersion model, DocumentComment model, documentVersioning.ts service (all complete)

---

## Phase 1: Document Editing Foundation

### Task 1.1: Install TipTap Dependencies
**Description**: Add TipTap and diff packages to frontend
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.2

**Implementation**:
```bash
cd frontend && npm install @tiptap/react@^2.1.0 @tiptap/starter-kit@^2.1.0 \
  @tiptap/extension-placeholder@^2.1.0 @tiptap/extension-highlight@^2.1.0 diff@^5.1.0
```

**Acceptance Criteria**:
- [ ] All packages in package.json with correct versions
- [ ] No peer dependency warnings
- [ ] TypeScript types resolve correctly

---

### Task 1.2: Create Document Version Routes and Controller
**Description**: Create backend API endpoints for document version management
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 1.1

**Files to Create**:
- `backend/src/routes/documentVersion.routes.ts`
- `backend/src/controllers/documentVersion.controller.ts`

**Route Definitions** (documentVersion.routes.ts):
```typescript
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { authenticate } from '../middleware/auth'
import {
  getDocumentForEdit,
  saveDocumentVersion,
  listDocumentVersions,
  getDocumentVersion,
  rollbackDocumentVersion,
} from '../controllers/documentVersion.controller'

const router = Router()

// GET /api/documents/:documentId/edit - Get document for editing
router.get('/documents/:documentId/edit', authenticate, asyncHandler(getDocumentForEdit))

// POST /api/documents/:documentId/versions - Create new version
router.post('/documents/:documentId/versions', authenticate, asyncHandler(saveDocumentVersion))

// GET /api/documents/:documentId/versions - List all versions
router.get('/documents/:documentId/versions', authenticate, asyncHandler(listDocumentVersions))

// GET /api/documents/:documentId/versions/:versionNum - Get specific version
router.get('/documents/:documentId/versions/:versionNum', authenticate, asyncHandler(getDocumentVersion))

// POST /api/documents/:documentId/rollback/:versionNum - Rollback to version
router.post('/documents/:documentId/rollback/:versionNum', authenticate, asyncHandler(rollbackDocumentVersion))

export { router as documentVersionRoutes }
```

**Controller Implementation** (documentVersion.controller.ts):
```typescript
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

export async function getDocumentForEdit(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params

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

  const versionContent = await getCurrentVersionContent(documentId)

  res.json({
    document: {
      id: document.id,
      filename: document.filename,
      isEditable: document.isEditable,
      currentVersion: document.currentVersion,
    },
    content: versionContent?.content || null,
  })
}

export async function saveDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params
  const { content, changeNote } = req.body

  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) {
    throw new ValidationError('Invalid TipTap content format')
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can edit documents')
  }

  const { version } = await createDocumentVersion(
    documentId,
    content,
    req.user.userId,
    changeNote,
    'manual'
  )

  // Queue embedding regeneration (async)
  const plainText = tipTapToPlainText(content)
  queueEmbeddingRegeneration(documentId, plainText).catch(console.error)

  res.json({
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt,
    },
  })
}

export async function listDocumentVersions(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can view version history')
  }

  const versions = await getDocumentVersions(documentId)

  res.json({
    versions,
    currentVersion: document.currentVersion,
  })
}

export async function getDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId, versionNum } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can view versions')
  }

  const version = await getVersionContent(documentId, parseInt(versionNum, 10))
  if (!version) throw new NotFoundError('Version')

  res.json({ version })
}

export async function rollbackDocumentVersion(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { documentId, versionNum } = req.params

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { project: { select: { ownerId: true } } },
  })

  if (!document) throw new NotFoundError('Document')
  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only project owner can rollback')
  }

  const result = await rollbackToVersion(
    documentId,
    parseInt(versionNum, 10),
    req.user.userId
  )

  // Queue embedding regeneration
  const plainText = tipTapToPlainText(result.content)
  queueEmbeddingRegeneration(documentId, plainText).catch(console.error)

  res.json({
    newVersion: result.newVersion,
    content: result.content,
  })
}

// Helper - Add to embeddingService.ts
async function queueEmbeddingRegeneration(documentId: string, plainText: string) {
  // Placeholder - implement in Task 1.3
  console.log(`[Embedding] Queued regeneration for ${documentId}`)
}
```

**Acceptance Criteria**:
- [ ] All 5 endpoints implemented
- [ ] Authorization checks for project owner
- [ ] PDF documents rejected for editing
- [ ] Version numbers increment correctly

---

### Task 1.3: Add Embedding Regeneration to embeddingService
**Description**: Add queueEmbeddingRegeneration function to regenerate document embeddings after edit
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2

**File to Modify**: `backend/src/services/embeddingService.ts`

**Implementation**:
```typescript
// Add to embeddingService.ts

/**
 * Queue embedding regeneration for edited document
 * Strategy: Full regeneration (simpler, ensures consistency)
 */
export async function queueEmbeddingRegeneration(
  documentId: string,
  plainText: string
): Promise<void> {
  // Run in background, don't block response
  regenerateDocumentEmbeddings(documentId, plainText).catch((error) => {
    console.error(`Embedding regeneration failed for ${documentId}:`, error)
  })
}

async function regenerateDocumentEmbeddings(
  documentId: string,
  plainText: string
): Promise<void> {
  // 1. Delete existing chunks
  await prisma.documentChunk.deleteMany({ where: { documentId } })

  // 2. Re-chunk the plain text
  const chunks = chunkText(plainText, { maxChunkSize: 1500, overlap: 200 })

  // 3. Generate embeddings in batches
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20)
    const embeddings = await generateEmbeddings(batch.map(c => c.content))

    // 4. Store chunks with embeddings
    await prisma.documentChunk.createMany({
      data: batch.map((chunk, idx) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        embedding: embeddings[idx],
      })),
    })
  }

  console.log(`[Embedding] Regenerated ${chunks.length} chunks for ${documentId}`)
}
```

**Acceptance Criteria**:
- [ ] Old chunks deleted before regeneration
- [ ] New chunks created with embeddings
- [ ] Non-blocking (runs async)
- [ ] Error logged but doesn't fail parent operation

---

### Task 1.4: Register Document Version Routes
**Description**: Register routes in backend index.ts
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2

**File to Modify**: `backend/src/index.ts`

**Implementation**:
```typescript
// Add import
import { documentVersionRoutes } from './routes/documentVersion.routes'

// Add route registration (after other routes)
app.use('/api', documentVersionRoutes)
```

**Acceptance Criteria**:
- [ ] Routes accessible at /api/documents/:id/...
- [ ] No conflicts with existing routes

---

### Task 1.5: Create DocumentEditor Component
**Description**: Build TipTap-based rich text editor component
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1

**File to Create**: `frontend/src/components/DocumentEditor.tsx`

**Implementation**:
```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback } from 'react'
import { api } from '../lib/api'

interface DocumentEditorProps {
  documentId: string
  initialContent: any
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
  const [error, setError] = useState('')

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
    setError('')
    try {
      const content = editor.getJSON()
      await api.saveDocumentVersion(documentId, content, changeNote || undefined)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
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

        {error && <span className="text-red-500 text-sm mr-2">{error}</span>}

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

**Acceptance Criteria**:
- [ ] TipTap editor renders with content
- [ ] Bold, italic, heading, list buttons work
- [ ] Save creates new version
- [ ] Error handling displays messages
- [ ] Loading state during save

---

### Task 1.6: Create DocumentVersionHistory Component
**Description**: Component to display version list and diff view
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.5

**File to Create**: `frontend/src/components/DocumentVersionHistory.tsx`

**Implementation**:
```typescript
import { useState, useEffect } from 'react'
import { diffWords } from 'diff'
import { api } from '../lib/api'

interface Version {
  id: string
  version: number
  changeNote: string | null
  source: string | null
  createdAt: string
  editedBy?: { name: string }
}

interface DocumentVersionHistoryProps {
  documentId: string
  currentVersion: number
  onRollback: (version: number) => void
  onClose: () => void
}

export function DocumentVersionHistory({
  documentId,
  currentVersion,
  onRollback,
  onClose,
}: DocumentVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [diffContent, setDiffContent] = useState<{original: string, current: string} | null>(null)

  useEffect(() => {
    loadVersions()
  }, [documentId])

  const loadVersions = async () => {
    setLoading(true)
    try {
      const response = await api.getDocumentVersions(documentId)
      setVersions(response.versions)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDiff = async (version: number) => {
    setSelectedVersion(version)
    const [selected, current] = await Promise.all([
      api.getDocumentVersion(documentId, version),
      api.getDocumentVersion(documentId, currentVersion),
    ])
    setDiffContent({
      original: extractText(selected.version.content),
      current: extractText(current.version.content),
    })
  }

  const extractText = (content: any): string => {
    // Extract plain text from TipTap JSON
    if (!content?.content) return ''
    return content.content
      .map((node: any) => extractNodeText(node))
      .join('\n')
  }

  const extractNodeText = (node: any): string => {
    if (node.text) return node.text
    if (node.content) return node.content.map(extractNodeText).join('')
    return ''
  }

  const renderDiff = () => {
    if (!diffContent) return null
    const diff = diffWords(diffContent.original, diffContent.current)
    return (
      <div className="font-mono text-sm whitespace-pre-wrap p-4 bg-gray-50 rounded">
        {diff.map((part, i) => (
          <span
            key={i}
            className={
              part.added ? 'bg-green-100 text-green-800' :
              part.removed ? 'bg-red-100 text-red-800 line-through' : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-4 bg-white z-50 flex flex-col rounded-xl shadow-2xl">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Version History</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Version List */}
        <div className="w-80 border-r overflow-y-auto">
          {loading ? (
            <div className="p-4 text-gray-500">Loading...</div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedVersion === v.version ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleViewDiff(v.version)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Version {v.version}
                    {v.version === currentVersion && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {v.changeNote && (
                  <p className="text-sm text-gray-600 mt-1">{v.changeNote}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {v.source === 'recommendation' ? 'AI Recommendation' : 'Manual Edit'}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Diff View */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedVersion !== null ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">
                  Comparing Version {selectedVersion} → {currentVersion}
                </h3>
                {selectedVersion !== currentVersion && (
                  <button
                    onClick={() => onRollback(selectedVersion)}
                    className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                  >
                    Rollback to Version {selectedVersion}
                  </button>
                )}
              </div>
              {renderDiff()}
            </>
          ) : (
            <div className="text-gray-500 text-center py-12">
              Select a version to view changes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Version list displays all versions
- [ ] Current version highlighted
- [ ] Diff view shows additions/deletions
- [ ] Rollback button triggers callback

---

### Task 1.7: Add Document Version API Methods to Frontend
**Description**: Add API methods for document versioning
**Size**: Small
**Priority**: High
**Dependencies**: Task 1.2

**File to Modify**: `frontend/src/lib/api.ts`

**Implementation**:
```typescript
// Add to ApiClient class:

async getDocumentForEdit(documentId: string): Promise<{
  document: { id: string; filename: string; isEditable: boolean; currentVersion: number }
  content: any
}> {
  return this.fetch(`/documents/${documentId}/edit`)
}

async saveDocumentVersion(
  documentId: string,
  content: any,
  changeNote?: string
): Promise<{ version: { id: string; version: number; createdAt: string } }> {
  return this.fetch(`/documents/${documentId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ content, changeNote }),
  })
}

async getDocumentVersions(documentId: string): Promise<{
  versions: Array<{
    id: string
    version: number
    changeNote: string | null
    source: string | null
    createdAt: string
  }>
  currentVersion: number
}> {
  return this.fetch(`/documents/${documentId}/versions`)
}

async getDocumentVersion(
  documentId: string,
  versionNum: number
): Promise<{ version: { content: any; changeNote: string | null; createdAt: string } }> {
  return this.fetch(`/documents/${documentId}/versions/${versionNum}`)
}

async rollbackDocument(
  documentId: string,
  versionNum: number
): Promise<{ newVersion: number; content: any }> {
  return this.fetch(`/documents/${documentId}/rollback/${versionNum}`, {
    method: 'POST',
  })
}
```

**Acceptance Criteria**:
- [ ] All methods typed correctly
- [ ] Methods call correct endpoints
- [ ] Error handling propagates

---

### Task 1.8: Add Edit Button to Document List
**Description**: Add Edit button to documents tab that opens DocumentEditor
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.5, Task 1.6, Task 1.7

**File to Modify**: `frontend/src/pages/ProjectPage.tsx` (Documents tab section)

**Implementation**:
```typescript
// Add state
const [editingDocument, setEditingDocument] = useState<{
  id: string
  content: any
} | null>(null)
const [viewingHistory, setViewingHistory] = useState<{
  id: string
  currentVersion: number
} | null>(null)

// Add handlers
const handleEditDocument = async (documentId: string) => {
  try {
    const response = await api.getDocumentForEdit(documentId)
    setEditingDocument({ id: documentId, content: response.content })
  } catch (error) {
    toast.error('Failed to load document for editing')
  }
}

const handleViewHistory = async (documentId: string, currentVersion: number) => {
  setViewingHistory({ id: documentId, currentVersion })
}

const handleRollback = async (version: number) => {
  if (!viewingHistory) return
  try {
    await api.rollbackDocument(viewingHistory.id, version)
    toast.success(`Rolled back to version ${version}`)
    setViewingHistory(null)
    // Refresh document list
  } catch (error) {
    toast.error('Failed to rollback')
  }
}

// In document list render, add Edit button for editable docs:
{document.isEditable && (
  <div className="flex gap-2">
    <button
      onClick={() => handleEditDocument(document.id)}
      className="text-blue-600 hover:text-blue-800 text-sm"
    >
      Edit
    </button>
    <button
      onClick={() => handleViewHistory(document.id, document.currentVersion)}
      className="text-gray-600 hover:text-gray-800 text-sm"
    >
      History
    </button>
  </div>
)}

// Add modals at end of component:
{editingDocument && (
  <DocumentEditor
    documentId={editingDocument.id}
    initialContent={editingDocument.content}
    onSave={() => {
      setEditingDocument(null)
      // Refresh document list
    }}
    onClose={() => setEditingDocument(null)}
  />
)}

{viewingHistory && (
  <DocumentVersionHistory
    documentId={viewingHistory.id}
    currentVersion={viewingHistory.currentVersion}
    onRollback={handleRollback}
    onClose={() => setViewingHistory(null)}
  />
)}
```

**Acceptance Criteria**:
- [ ] Edit button shows only for editable documents (not PDFs)
- [ ] Clicking Edit opens editor with document content
- [ ] History button opens version history modal
- [ ] Rollback works and refreshes

---

## Phase 2: Collaborator Comments

### Task 2.1: Wire CollaboratorCommentPanel to SharePage
**Description**: Show comment UI on share page for collaborator role
**Size**: Medium
**Priority**: High
**Dependencies**: Phase 1 complete

**File to Modify**: `frontend/src/pages/SharePage.tsx`

**Implementation**:
```typescript
// Add check for collaborator role
const isCollaborator = shareLink?.recipientRole === 'collaborator'

// In document viewer section, add comment functionality:
{isCollaborator && (
  <CollaboratorCommentPanel
    documentId={selectedDocument?.id}
    shareLinkId={shareLink.id}
    viewerEmail={verifiedEmail}
    viewerName={verifiedName}
    onCommentAdded={handleCommentAdded}
  />
)}

// Add highlight-to-comment trigger
const handleTextSelection = (selection: Selection) => {
  if (!isCollaborator || !selection.toString().trim()) return

  const range = selection.getRangeAt(0)
  setCommentAnchor({
    text: selection.toString(),
    rect: range.getBoundingClientRect(),
  })
}

// Add comment button popover when text selected
{commentAnchor && (
  <div
    style={{
      position: 'fixed',
      top: commentAnchor.rect.bottom + 8,
      left: commentAnchor.rect.left,
    }}
    className="bg-white shadow-lg rounded-lg p-2 z-50"
  >
    <button
      onClick={() => openCommentInput(commentAnchor.text)}
      className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded text-sm"
    >
      Add Comment
    </button>
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Comment UI only shows for collaborator role
- [ ] Text selection triggers "Add Comment" button
- [ ] Comments saved with anchor data

---

### Task 2.2: Display Comments in Analytics Dashboard
**Description**: Show collaborator comments in conversation detail view
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1

**File to Modify**: `frontend/src/components/ConversationDetailPanel.tsx`

**Implementation**:
```typescript
// Add comments section to conversation detail
const [comments, setComments] = useState<DocumentComment[]>([])

useEffect(() => {
  if (conversation?.projectId) {
    loadCommentsForProject(conversation.projectId)
  }
}, [conversation])

// In render:
{comments.length > 0 && (
  <div className="mt-6 pt-6 border-t">
    <h3 className="font-medium text-gray-900 mb-4">
      Collaborator Comments ({comments.length})
    </h3>
    <div className="space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="bg-yellow-50 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-medium">{comment.viewerName || comment.viewerEmail}</span>
              <span className="text-xs text-gray-500 ml-2">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
            <select
              value={comment.status}
              onChange={(e) => updateCommentStatus(comment.id, e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="pending">Pending</option>
              <option value="addressed">Addressed</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <blockquote className="text-sm italic text-gray-600 mt-2 pl-3 border-l-2 border-yellow-400">
            "{comment.highlightedText}"
          </blockquote>
          <p className="text-sm mt-2">{comment.content}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

**Acceptance Criteria**:
- [ ] Comments display in conversation detail
- [ ] Highlighted text shown as quote
- [ ] Status dropdown updates comment
- [ ] Comments grouped by document

---

## Phase 3: AI-Assisted Recommendations

### Task 3.1: Create recommendationApplicator Service
**Description**: Backend service to generate AI drafts from recommendations
**Size**: Large
**Priority**: High
**Dependencies**: Phase 1 complete

**File to Create**: `backend/src/services/recommendationApplicator.ts`

**Implementation**:
```typescript
import OpenAI from 'openai'
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError } from '../utils/errors'
import {
  createDocumentVersion,
  getCurrentVersionContent,
  tipTapToPlainText,
} from './documentVersioning'
import { queueEmbeddingRegeneration } from './embeddingService'

const openai = new OpenAI()

export async function generateEditDraft(recommendationId: string): Promise<{
  originalText: string
  proposedText: string
  changeNote: string
  targetChunkId: string
}> {
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
            take: 10,
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

  const targetChunk = recommendation.targetSection
    ? recommendation.document.chunks.find(c =>
        c.sectionId === recommendation.targetSection ||
        c.sectionTitle?.toLowerCase().includes(recommendation.targetSection!.toLowerCase())
      )
    : recommendation.document.chunks[0]

  if (!targetChunk) {
    throw new ValidationError('Target section not found in document')
  }

  const conversationContext = recommendation.conversation?.messages
    .map(m => `${m.role === 'user' ? 'Viewer' : 'AI'}: ${m.content}`)
    .join('\n\n') || ''

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
    temperature: 0.3,
    max_tokens: 2000,
  })

  const proposedText = completion.choices[0]?.message?.content?.trim() || ''

  if (!proposedText) {
    throw new Error('AI failed to generate edit')
  }

  return {
    originalText: targetChunk.content,
    proposedText,
    changeNote: `Applied recommendation: ${recommendation.title}`,
    targetChunkId: targetChunk.id,
  }
}

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

  const { content: currentContent } = await getCurrentVersionContent(recommendation.documentId!)

  // Create new version
  const { version } = await createDocumentVersion(
    recommendation.documentId!,
    currentContent, // In MVP, use full proposed content
    userId,
    changeNote,
    'recommendation',
    recommendationId
  )

  // Mark recommendation as applied
  const updatedRecommendation = await prisma.conversationRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: 'applied',
    },
  })

  // Queue embedding regeneration
  const plainText = tipTapToPlainText(currentContent)
  await queueEmbeddingRegeneration(recommendation.documentId!, plainText)

  return { version, recommendation: updatedRecommendation }
}
```

**Acceptance Criteria**:
- [ ] generateEditDraft returns original + proposed text
- [ ] LLM prompt includes conversation context
- [ ] applyRecommendationEdit creates new version
- [ ] Recommendation status updated to applied

---

### Task 3.2: Add Recommendation Apply Endpoints
**Description**: API endpoints for draft generation and application
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3.1

**File to Create**: `backend/src/routes/recommendationApply.routes.ts`

**Routes**:
```typescript
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler'
import { authenticate } from '../middleware/auth'
import { generateDraft, applyDraft } from '../controllers/recommendationApply.controller'

const router = Router()

// POST /api/recommendations/:id/draft - Generate AI draft
router.post('/recommendations/:id/draft', authenticate, asyncHandler(generateDraft))

// POST /api/recommendations/:id/apply - Apply the draft
router.post('/recommendations/:id/apply', authenticate, asyncHandler(applyDraft))

export { router as recommendationApplyRoutes }
```

**Controller**: `backend/src/controllers/recommendationApply.controller.ts`

```typescript
import { Request, Response } from 'express'
import { AuthorizationError } from '../utils/errors'
import { generateEditDraft, applyRecommendationEdit } from '../services/recommendationApplicator'

export async function generateDraft(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { id } = req.params
  const draft = await generateEditDraft(id)

  res.json({ draft })
}

export async function applyDraft(req: Request, res: Response) {
  if (!req.user) throw new AuthorizationError()

  const { id } = req.params
  const { proposedText, changeNote } = req.body

  const result = await applyRecommendationEdit(id, proposedText, changeNote, req.user.userId)

  res.json(result)
}
```

**Acceptance Criteria**:
- [ ] Draft endpoint returns proposed changes
- [ ] Apply endpoint creates new version
- [ ] Authorization checks project ownership

---

### Task 3.3: Create RecommendationApplyModal Component
**Description**: Frontend modal for reviewing and applying AI drafts
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.2

**File to Create**: `frontend/src/components/RecommendationApplyModal.tsx`

**Implementation**:
```typescript
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
              part.removed ? 'bg-red-100 text-red-800 line-through' : ''
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
            <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
          )}

          {draft && !loading && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Proposed Changes</h3>
                <div className="border rounded-lg p-4 bg-gray-50">{renderDiff()}</div>
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

**Acceptance Criteria**:
- [ ] Loading state while generating draft
- [ ] Diff view shows additions/deletions
- [ ] Apply button creates new version
- [ ] Error handling for failures

---

### Task 3.4: Add Apply Button to RecommendationCard
**Description**: Add "Apply to Document" button to recommendation cards
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.3

**File to Modify**: `frontend/src/components/RecommendationCard.tsx`

**Implementation**:
```typescript
// Add state
const [showApplyModal, setShowApplyModal] = useState(false)

// Add button in card actions:
{recommendation.type === 'document_update' && recommendation.status !== 'applied' && (
  <button
    onClick={() => setShowApplyModal(true)}
    className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
  >
    Apply to Document
  </button>
)}

{recommendation.status === 'applied' && (
  <span className="text-sm text-green-600">✓ Applied</span>
)}

// Add modal:
{showApplyModal && (
  <RecommendationApplyModal
    recommendationId={recommendation.id}
    onApply={() => {
      setShowApplyModal(false)
      onStatusChange?.('applied')
    }}
    onClose={() => setShowApplyModal(false)}
  />
)}
```

**Acceptance Criteria**:
- [ ] Button shows only for document_update type
- [ ] Button hidden after applied
- [ ] Modal opens on click

---

### Task 3.5: Add Recommendation API Methods
**Description**: Add frontend API methods for recommendation apply flow
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.2

**File to Modify**: `frontend/src/lib/api.ts`

**Implementation**:
```typescript
async generateRecommendationDraft(recommendationId: string): Promise<{
  draft: {
    originalText: string
    proposedText: string
    changeNote: string
    targetChunkId: string
  }
}> {
  return this.fetch(`/recommendations/${recommendationId}/draft`, {
    method: 'POST',
  })
}

async applyRecommendation(
  recommendationId: string,
  proposedText: string,
  changeNote: string
): Promise<{ version: any; recommendation: any }> {
  return this.fetch(`/recommendations/${recommendationId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ proposedText, changeNote }),
  })
}
```

**Acceptance Criteria**:
- [ ] Methods typed correctly
- [ ] POST requests work

---

## Testing Tasks

### Task T.1: Unit Tests for Document Versioning
**Description**: Tests for version controller functions
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 1.2

**File to Create**: `backend/src/controllers/__tests__/documentVersion.test.ts`

**Test Cases**:
- Version increment on save
- PDF rejection for editing
- Rollback creates new version
- Authorization rejects non-owner

---

### Task T.2: Integration Test for Edit Flow
**Description**: Full edit → save → rollback cycle test
**Size**: Medium
**Priority**: Medium
**Dependencies**: Phase 1 complete

**Test Cases**:
- Create document
- Edit and save version 2
- Verify version 2 is current
- Rollback to version 1
- Verify version 3 created with v1 content

---

### Task T.3: E2E Test for Document Editing
**Description**: Playwright test for editor UI
**Size**: Medium
**Priority**: Low
**Dependencies**: Phase 1 complete

**File to Create**: `e2e/document-editing.spec.ts`

**Test Cases**:
- Owner can open editor
- Text editing works
- Save creates new version
- Version history shows entries

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| Phase 1 | 1.1-1.8 | None (existing infrastructure) |
| Phase 2 | 2.1-2.2 | Phase 1 |
| Phase 3 | 3.1-3.5 | Phase 1 |
| Testing | T.1-T.3 | Respective phases |

**Parallel Opportunities**:
- Task 1.1 and 1.2 can run in parallel
- Task 1.5 and 1.7 can run in parallel
- Phase 2 and Phase 3 can run in parallel after Phase 1

**Total Tasks**: 15 implementation + 3 testing = 18 tasks
