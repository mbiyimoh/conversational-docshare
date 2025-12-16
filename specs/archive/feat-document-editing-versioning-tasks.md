# Task Breakdown: Document Editing & Versioning

**Generated:** 2025-12-07
**Source:** specs/feat-document-editing-versioning.md

---

## Overview

Enable project owners to edit text-based documents using TipTap editor with full version history, diff viewing, and rollback capabilities. Foundation for collaborative document improvements based on conversation insights.

---

## Phase 1: Foundation (Database & Backend Setup)

### Task 1.1: Add Database Schema Changes

**Description**: Add DocumentVersion model and update Document model with versioning fields
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: None (must complete first)

**Technical Requirements**:

Add to `backend/prisma/schema.prisma`:

```prisma
model DocumentVersion {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  version    Int      // Sequential version number (1, 2, 3...)
  content    Json     // Full document content snapshot as structured JSON

  // Edit metadata
  editedById  String?  // User ID who made the edit (null for v1 original)
  editedBy    User?    @relation(fields: [editedById], references: [id])
  changeNote  String?  @db.Text  // Optional description of changes

  // Source tracking (for recommendations feature integration)
  source      String?  // "manual" | "recommendation" | "import"
  sourceId    String?  // Reference to recommendation ID if applicable

  createdAt   DateTime @default(now())

  @@unique([documentId, version])
  @@index([documentId])
  @@map("document_versions")
}
```

Modify Document model:
```prisma
model Document {
  // ... existing fields ...

  // Add new fields
  currentVersion  Int  @default(1)
  isEditable      Boolean @default(false)  // Set based on mimeType during processing

  // Add relation
  versions  DocumentVersion[]

  // ... existing relations ...
}
```

**Implementation Steps**:
1. Edit `backend/prisma/schema.prisma` with the new model
2. Add the relation to User model: `documentVersions DocumentVersion[]`
3. Run `cd backend && npm run db:push`
4. Verify with `npx prisma studio`

**Acceptance Criteria**:
- [ ] DocumentVersion model created with all fields
- [ ] Document model has currentVersion and isEditable fields
- [ ] Unique constraint on (documentId, version)
- [ ] Cascade delete configured
- [ ] `npm run db:push` completes without errors

---

### Task 1.2: Create Document Versioning Service

**Description**: Implement backend service for version management logic
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.3

**Technical Requirements**:

Create `backend/src/services/documentVersioning.ts`:

```typescript
import { prisma } from '../utils/prisma'
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors'

interface DocumentContentJSON {
  type: 'doc'
  content: TipTapNode[]
}

interface TipTapNode {
  type: 'paragraph' | 'heading' | 'bulletList' | 'orderedList' | 'listItem' | 'codeBlock' | 'blockquote'
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: TipTapMark[]
}

interface TipTapMark {
  type: 'bold' | 'italic' | 'code' | 'link'
  attrs?: Record<string, unknown>
}

/**
 * Create a new version of a document
 */
export async function createDocumentVersion(
  documentId: string,
  content: DocumentContentJSON,
  userId: string,
  changeNote?: string,
  source: 'manual' | 'recommendation' | 'import' = 'manual',
  sourceId?: string
) {
  // Get current version number
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { currentVersion: true, isEditable: true }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (!document.isEditable) {
    throw new ValidationError('This document type cannot be edited')
  }

  const newVersionNumber = document.currentVersion + 1

  // Create new version and update document in transaction
  const [version, updatedDoc] = await prisma.$transaction([
    prisma.documentVersion.create({
      data: {
        documentId,
        version: newVersionNumber,
        content: content as any,
        editedById: userId,
        changeNote,
        source,
        sourceId
      }
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { currentVersion: newVersionNumber }
    })
  ])

  return { version, document: updatedDoc }
}

/**
 * Get all versions for a document
 */
export async function getDocumentVersions(documentId: string) {
  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
    include: {
      editedBy: {
        select: { id: true, email: true }
      }
    }
  })

  return versions.map(v => ({
    id: v.id,
    version: v.version,
    editedById: v.editedById,
    editedByName: v.editedBy?.email || null,
    changeNote: v.changeNote,
    source: v.source,
    createdAt: v.createdAt
  }))
}

/**
 * Get specific version content
 */
export async function getVersionContent(documentId: string, versionNumber: number) {
  const version = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: { documentId, version: versionNumber }
    },
    include: {
      editedBy: {
        select: { id: true, email: true }
      }
    }
  })

  if (!version) {
    throw new NotFoundError('Version')
  }

  return {
    id: version.id,
    version: version.version,
    content: version.content as DocumentContentJSON,
    editedById: version.editedById,
    editedByName: version.editedBy?.email || null,
    changeNote: version.changeNote,
    createdAt: version.createdAt
  }
}

/**
 * Rollback to a previous version (creates new version with old content)
 */
export async function rollbackToVersion(
  documentId: string,
  targetVersion: number,
  userId: string,
  changeNote?: string
) {
  // Get target version content
  const targetVersionData = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: { documentId, version: targetVersion }
    }
  })

  if (!targetVersionData) {
    throw new NotFoundError('Target version')
  }

  // Create new version with old content
  const result = await createDocumentVersion(
    documentId,
    targetVersionData.content as DocumentContentJSON,
    userId,
    changeNote || `Rollback to version ${targetVersion}`,
    'manual'
  )

  return result
}

/**
 * Convert TipTap JSON to plain text for chunk updates
 */
export function tiptapToPlainText(content: DocumentContentJSON): string {
  const extractText = (nodes: TipTapNode[]): string => {
    return nodes.map(node => {
      if (node.text) return node.text
      if (node.content) return extractText(node.content)
      if (node.type === 'paragraph' || node.type === 'heading') {
        return (node.content ? extractText(node.content) : '') + '\n'
      }
      return ''
    }).join('')
  }

  return extractText(content.content || []).trim()
}

/**
 * Convert plain text to TipTap JSON structure
 */
export function plainTextToTipTap(text: string): DocumentContentJSON {
  const paragraphs = text.split('\n\n').filter(p => p.trim())

  return {
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: p.trim() }]
    }))
  }
}
```

**Implementation Steps**:
1. Create `backend/src/services/documentVersioning.ts`
2. Add proper TypeScript types
3. Implement all five functions
4. Add error handling with custom errors
5. Write unit tests

**Acceptance Criteria**:
- [ ] createDocumentVersion creates version and updates document atomically
- [ ] getDocumentVersions returns list with editor info
- [ ] getVersionContent returns full content for specific version
- [ ] rollbackToVersion creates NEW version (doesn't overwrite history)
- [ ] tiptapToPlainText correctly extracts text from JSON
- [ ] plainTextToTipTap creates valid TipTap structure
- [ ] Unit tests pass

---

### Task 1.3: Create Initial Version During Document Processing

**Description**: Modify document processor to create v1 and set isEditable flag
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.1
**Can run parallel with**: Task 1.2

**Technical Requirements**:

Modify `backend/src/services/documentProcessor.ts` (or equivalent):

```typescript
import { plainTextToTipTap } from './documentVersioning'

// Add after text extraction logic
async function processDocument(documentId: string): Promise<void> {
  // ... existing extraction logic ...

  // Determine if document is editable based on MIME type
  const editableMimeTypes = [
    'text/markdown',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  const isEditable = editableMimeTypes.includes(mimeType)

  // Create initial version (v1) for editable documents
  if (isEditable) {
    const contentAsJSON = plainTextToTipTap(fullText)

    await prisma.documentVersion.create({
      data: {
        documentId,
        version: 1,
        content: contentAsJSON,
        editedById: null,  // Original upload, no editor
        changeNote: 'Original document',
        source: 'import'
      }
    })
  }

  // Update document with editable flag
  await prisma.document.update({
    where: { id: documentId },
    data: {
      isEditable,
      currentVersion: 1
    }
  })
}
```

**Implementation Steps**:
1. Find document processing file
2. Add isEditable determination logic
3. Create v1 DocumentVersion for editable types
4. Update Document with isEditable and currentVersion
5. Test with markdown, txt, and docx uploads

**Acceptance Criteria**:
- [ ] Markdown files get isEditable: true
- [ ] Plain text files get isEditable: true
- [ ] DOCX files get isEditable: true
- [ ] PDF files get isEditable: false
- [ ] v1 DocumentVersion created for editable files
- [ ] Version content is valid TipTap JSON

---

## Phase 2: API Endpoints

### Task 2.1: Implement Update Document Content Endpoint

**Description**: Create PUT /api/documents/:id/content endpoint
**Size**: Large
**Priority**: High
**Dependencies**: Task 1.2, Task 1.3
**Can run parallel with**: Task 2.2

**Technical Requirements**:

Add to `backend/src/controllers/document.controller.ts`:

```typescript
import { createDocumentVersion, tiptapToPlainText } from '../services/documentVersioning'
import { regenerateDocumentEmbeddings } from '../services/embeddingService'

/**
 * Update document content
 * PUT /api/documents/:id/content
 */
export async function updateDocumentContent(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { content, changeNote } = req.body

  // Validate content structure
  if (!content || content.type !== 'doc' || !Array.isArray(content.content)) {
    throw new ValidationError('Invalid content structure')
  }

  // Validate changeNote length
  if (changeNote && changeNote.length > 500) {
    throw new ValidationError('Change note must be 500 characters or less')
  }

  // Verify document exists and user is owner
  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      project: { select: { ownerId: true } }
    }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can edit documents')
  }

  if (!document.isEditable) {
    throw new ValidationError('This document type cannot be edited')
  }

  // Create new version
  const { version, document: updatedDoc } = await createDocumentVersion(
    id,
    content,
    req.user.userId,
    changeNote,
    'manual'
  )

  // Convert to plain text and update chunks
  const plainText = tiptapToPlainText(content)

  // Update DocumentChunk records
  await prisma.documentChunk.updateMany({
    where: { documentId: id },
    data: { content: plainText }
  })

  // Queue async embedding regeneration
  regenerateDocumentEmbeddings(id).catch(err => {
    console.error('Embedding regeneration failed:', err)
  })

  res.json({
    document: {
      id: updatedDoc.id,
      currentVersion: updatedDoc.currentVersion,
      updatedAt: new Date().toISOString()
    },
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt
    }
  })
}
```

Add route in `backend/src/routes/document.routes.ts`:
```typescript
router.put('/:id/content', authenticate, asyncHandler(updateDocumentContent))
```

**Implementation Steps**:
1. Add controller function
2. Add route
3. Implement chunk updates
4. Add embedding regeneration (can be async)
5. Test with Postman/curl

**Acceptance Criteria**:
- [ ] Requires authentication
- [ ] Rejects non-owner requests (403)
- [ ] Rejects non-editable documents (400)
- [ ] Creates new version
- [ ] Updates document chunks
- [ ] Returns new version info
- [ ] Embedding regeneration triggered asynchronously

---

### Task 2.2: Implement Version History Endpoints

**Description**: Create GET versions and rollback endpoints
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2
**Can run parallel with**: Task 2.1

**Technical Requirements**:

Add to `backend/src/controllers/document.controller.ts`:

```typescript
import { getDocumentVersions, getVersionContent, rollbackToVersion } from '../services/documentVersioning'

/**
 * Get version history
 * GET /api/documents/:id/versions
 */
export async function getVersionHistory(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can view version history')
  }

  const versions = await getDocumentVersions(id)

  res.json({
    versions,
    currentVersion: document.currentVersion
  })
}

/**
 * Get specific version content
 * GET /api/documents/:id/versions/:version
 */
export async function getSpecificVersion(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id, version } = req.params
  const versionNumber = parseInt(version, 10)

  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ValidationError('Invalid version number')
  }

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can view versions')
  }

  const versionData = await getVersionContent(id, versionNumber)

  res.json({ version: versionData })
}

/**
 * Rollback to previous version
 * POST /api/documents/:id/rollback
 */
export async function rollbackDocument(req: Request, res: Response) {
  if (!req.user) {
    throw new AuthorizationError()
  }

  const { id } = req.params
  const { targetVersion, changeNote } = req.body

  if (!targetVersion || typeof targetVersion !== 'number') {
    throw new ValidationError('targetVersion is required')
  }

  // Verify ownership
  const document = await prisma.document.findUnique({
    where: { id },
    include: { project: { select: { ownerId: true } } }
  })

  if (!document) {
    throw new NotFoundError('Document')
  }

  if (document.project.ownerId !== req.user.userId) {
    throw new AuthorizationError('Only the project owner can rollback versions')
  }

  const { version, document: updatedDoc } = await rollbackToVersion(
    id,
    targetVersion,
    req.user.userId,
    changeNote
  )

  // Update chunks with rolled-back content
  const plainText = tiptapToPlainText(version.content as any)
  await prisma.documentChunk.updateMany({
    where: { documentId: id },
    data: { content: plainText }
  })

  // Queue embedding regeneration
  regenerateDocumentEmbeddings(id).catch(console.error)

  res.json({
    document: {
      id: updatedDoc.id,
      currentVersion: updatedDoc.currentVersion
    },
    version: {
      id: version.id,
      version: version.version,
      createdAt: version.createdAt
    }
  })
}
```

Add routes:
```typescript
router.get('/:id/versions', authenticate, asyncHandler(getVersionHistory))
router.get('/:id/versions/:version', authenticate, asyncHandler(getSpecificVersion))
router.post('/:id/rollback', authenticate, asyncHandler(rollbackDocument))
```

**Acceptance Criteria**:
- [ ] GET /versions returns list of all versions
- [ ] GET /versions/:version returns specific version content
- [ ] POST /rollback creates NEW version with old content
- [ ] All endpoints require authentication
- [ ] All endpoints verify project ownership
- [ ] Rollback updates chunks and triggers embedding regeneration

---

## Phase 3: Frontend Editor

### Task 3.1: Install TipTap Dependencies

**Description**: Add TipTap packages to frontend
**Size**: Small
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 2.1, 2.2

**Technical Requirements**:

```bash
cd frontend && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-highlight diff
```

**Acceptance Criteria**:
- [ ] All packages installed
- [ ] No peer dependency conflicts
- [ ] Build still works

---

### Task 3.2: Create TipTap Utilities

**Description**: Create utility functions for TipTap JSON conversion
**Size**: Small
**Priority**: High
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.3

**Technical Requirements**:

Create `frontend/src/lib/tiptap-utils.ts`:

```typescript
import { JSONContent } from '@tiptap/react'

export interface DocumentContentJSON {
  type: 'doc'
  content: TipTapNode[]
}

export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  text?: string
  marks?: TipTapMark[]
}

export interface TipTapMark {
  type: string
  attrs?: Record<string, unknown>
}

/**
 * Convert TipTap JSON to plain text for preview
 */
export function tiptapToPlainText(content: JSONContent): string {
  const extractText = (nodes: JSONContent[]): string => {
    if (!nodes) return ''
    return nodes.map(node => {
      if (node.text) return node.text
      if (node.content) return extractText(node.content)
      if (node.type === 'paragraph' || node.type === 'heading') {
        return (node.content ? extractText(node.content) : '') + '\n'
      }
      return ''
    }).join('')
  }

  return extractText(content.content || []).trim()
}

/**
 * Convert plain text to TipTap JSON
 */
export function plainTextToTiptap(text: string): DocumentContentJSON {
  const paragraphs = text.split('\n\n').filter(p => p.trim())

  return {
    type: 'doc',
    content: paragraphs.map(p => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p.trim() }]
    }))
  }
}

/**
 * Check if content has changed
 */
export function contentChanged(a: JSONContent, b: JSONContent): boolean {
  return JSON.stringify(a) !== JSON.stringify(b)
}
```

**Acceptance Criteria**:
- [ ] tiptapToPlainText extracts text correctly
- [ ] plainTextToTiptap creates valid structure
- [ ] contentChanged detects modifications

---

### Task 3.3: Create DocumentEditor Component

**Description**: Build TipTap editor wrapper with toolbar
**Size**: Large
**Priority**: High
**Dependencies**: Task 3.1, Task 3.2
**Can run parallel with**: Task 3.4

**Technical Requirements**:

Create `frontend/src/components/DocumentEditor.tsx`:

```typescript
import { useEditor, EditorContent, JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  List, ListOrdered, Code, Quote, Save, X
} from 'lucide-react'
import { contentChanged } from '@/lib/tiptap-utils'

interface DocumentEditorProps {
  documentId: string
  initialContent: JSONContent
  onSave: (content: JSONContent, changeNote?: string) => Promise<void>
  onClose: () => void
}

export function DocumentEditor({
  documentId,
  initialContent,
  onSave,
  onClose
}: DocumentEditorProps) {
  const [changeNote, setChangeNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing...'
      })
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      setHasUnsavedChanges(contentChanged(initialContent, editor.getJSON()))
    }
  })

  const handleSave = useCallback(async () => {
    if (!editor) return

    setIsSaving(true)
    try {
      await onSave(editor.getJSON(), changeNote || undefined)
      setHasUnsavedChanges(false)
      setChangeNote('')
    } finally {
      setIsSaving(false)
    }
  }, [editor, changeNote, onSave])

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return
      }
    }
    onClose()
  }, [hasUnsavedChanges, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleClose])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {hasUnsavedChanges ? '● Unsaved changes' : 'All changes saved'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Change note (optional)"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-64"
            maxLength={500}
          />
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b">
        <Button
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto p-4">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none min-h-full"
        />
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] TipTap editor renders with initial content
- [ ] Toolbar buttons work (bold, italic, headings, lists, code, quote)
- [ ] Cmd/Ctrl+S triggers save
- [ ] Escape triggers close with confirmation if unsaved
- [ ] Change note input available
- [ ] Unsaved changes indicator works
- [ ] Save button disabled while saving

---

### Task 3.4: Create Version History Components

**Description**: Build version history viewer and diff comparison
**Size**: Large
**Priority**: Medium
**Dependencies**: Task 3.1
**Can run parallel with**: Task 3.3

**Technical Requirements**:

Create `frontend/src/components/DocumentVersionHistory.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { History, Eye, RotateCcw, GitCompare } from 'lucide-react'
import { api } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Version {
  id: string
  version: number
  editedById: string | null
  editedByName: string | null
  changeNote: string | null
  source: string | null
  createdAt: string
}

interface DocumentVersionHistoryProps {
  documentId: string
  currentVersion: number
  onRollback: (version: number) => Promise<void>
}

export function DocumentVersionHistory({
  documentId,
  currentVersion,
  onRollback
}: DocumentVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersions, setSelectedVersions] = useState<[number, number] | null>(null)

  useEffect(() => {
    loadVersions()
  }, [documentId])

  async function loadVersions() {
    setLoading(true)
    try {
      const response = await api.get(`/documents/${documentId}/versions`)
      setVersions(response.data.versions)
    } catch (error) {
      console.error('Failed to load versions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRollback(version: number) {
    if (!window.confirm(`Rollback to version ${version}? This will create a new version with the old content.`)) {
      return
    }
    await onRollback(version)
    await loadVersions()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-2" />
          History (v{currentVersion})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="text-lg font-mono">v{v.version}</div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {format(new Date(v.createdAt), 'MMM d, yyyy h:mm a')}
                      </span>
                      {v.version === currentVersion && (
                        <Badge variant="secondary">Current</Badge>
                      )}
                      {v.version === 1 && (
                        <Badge variant="outline">Original</Badge>
                      )}
                    </div>
                    {v.changeNote && (
                      <span className="text-sm text-muted-foreground">
                        {v.changeNote}
                      </span>
                    )}
                    {v.editedByName && (
                      <span className="text-xs text-muted-foreground">
                        by {v.editedByName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {v.version !== currentVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRollback(v.version)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

Create `frontend/src/components/DocumentDiffViewer.tsx`:

```typescript
import { useMemo } from 'react'
import * as Diff from 'diff'

interface DocumentDiffViewerProps {
  oldContent: string
  newContent: string
  oldVersion: number
  newVersion: number
}

export function DocumentDiffViewer({
  oldContent,
  newContent,
  oldVersion,
  newVersion
}: DocumentDiffViewerProps) {
  const diff = useMemo(() => {
    return Diff.diffLines(oldContent, newContent)
  }, [oldContent, newContent])

  return (
    <div className="font-mono text-sm">
      <div className="flex items-center gap-4 mb-4 text-muted-foreground">
        <span className="text-red-600">- Version {oldVersion}</span>
        <span className="text-green-600">+ Version {newVersion}</span>
      </div>
      <div className="border rounded overflow-auto max-h-96">
        {diff.map((part, index) => (
          <div
            key={index}
            className={`px-4 py-1 whitespace-pre-wrap ${
              part.added
                ? 'bg-green-100 text-green-800'
                : part.removed
                ? 'bg-red-100 text-red-800'
                : ''
            }`}
          >
            {part.value}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Acceptance Criteria**:
- [ ] Version history loads and displays all versions
- [ ] Current version and Original badges shown
- [ ] Rollback button works with confirmation
- [ ] Diff viewer shows additions in green, deletions in red
- [ ] Loading state handled

---

### Task 3.5: Add API Functions and Edit Button

**Description**: Add API functions and integrate Edit button into DocumentUpload
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2, Task 3.3
**Can run parallel with**: Task 3.4

**Technical Requirements**:

Add to `frontend/src/lib/api.ts`:

```typescript
// Document versioning API
export async function updateDocumentContent(
  documentId: string,
  content: JSONContent,
  changeNote?: string
) {
  const response = await api.put(`/documents/${documentId}/content`, {
    content,
    changeNote
  })
  return response.data
}

export async function getDocumentVersions(documentId: string) {
  const response = await api.get(`/documents/${documentId}/versions`)
  return response.data
}

export async function getVersionContent(documentId: string, version: number) {
  const response = await api.get(`/documents/${documentId}/versions/${version}`)
  return response.data
}

export async function rollbackDocument(
  documentId: string,
  targetVersion: number,
  changeNote?: string
) {
  const response = await api.post(`/documents/${documentId}/rollback`, {
    targetVersion,
    changeNote
  })
  return response.data
}
```

Modify DocumentUpload (or document list component) to show Edit button:

```typescript
// Add to document card/row
{document.isEditable && (
  <Button variant="ghost" size="sm" onClick={() => openEditor(document)}>
    <Pencil className="h-4 w-4 mr-2" />
    Edit
  </Button>
)}

{!document.isEditable && (
  <Badge variant="secondary">Read-only</Badge>
)}
```

**Acceptance Criteria**:
- [ ] API functions work correctly
- [ ] Edit button shows for editable documents
- [ ] Read-only badge shows for PDFs
- [ ] Edit button opens DocumentEditor

---

## Phase 4: Embedding Integration

### Task 4.1: Implement Async Embedding Regeneration

**Description**: Create background job for regenerating embeddings after edit
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 2.1
**Can run parallel with**: Phase 3 tasks

**Technical Requirements**:

Add to `backend/src/services/embeddingService.ts`:

```typescript
/**
 * Regenerate embeddings for a document after content change
 * Runs asynchronously to not block the save operation
 */
export async function regenerateDocumentEmbeddings(documentId: string): Promise<void> {
  console.log(`Starting embedding regeneration for document ${documentId}`)

  try {
    // Get all chunks for document
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId }
    })

    if (chunks.length === 0) {
      console.log(`No chunks found for document ${documentId}`)
      return
    }

    // Clear existing embeddings
    await prisma.documentChunk.updateMany({
      where: { documentId },
      data: { embedding: null }
    })

    // Generate new embeddings in batches
    const BATCH_SIZE = 10
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)

      const embeddings = await Promise.all(
        batch.map(chunk => generateEmbedding(chunk.content))
      )

      // Update chunks with new embeddings
      await Promise.all(
        batch.map((chunk, idx) =>
          prisma.documentChunk.update({
            where: { id: chunk.id },
            data: { embedding: embeddings[idx] }
          })
        )
      )
    }

    // Update document processedAt
    await prisma.document.update({
      where: { id: documentId },
      data: { processedAt: new Date() }
    })

    console.log(`Embedding regeneration complete for document ${documentId}`)
  } catch (error) {
    console.error(`Embedding regeneration failed for document ${documentId}:`, error)
    throw error
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  })
  return response.data[0].embedding
}
```

**Acceptance Criteria**:
- [ ] Embeddings cleared before regeneration
- [ ] Batch processing to avoid rate limits
- [ ] Document processedAt updated
- [ ] Errors logged but don't crash the server
- [ ] RAG queries work during regeneration (use old embeddings until complete)

---

## Testing Tasks

### Task T.1: Backend Unit Tests

**Description**: Write unit tests for versioning service
**Size**: Medium
**Priority**: High
**Dependencies**: Task 1.2

Create `backend/src/services/__tests__/documentVersioning.test.ts`:

```typescript
import { createDocumentVersion, rollbackToVersion, tiptapToPlainText } from '../documentVersioning'

describe('DocumentVersioning', () => {
  describe('createDocumentVersion', () => {
    it('should increment version number correctly', async () => {
      // Test implementation
    })

    it('should preserve content in version snapshot', async () => {
      // Test implementation
    })

    it('should set editedById to current user', async () => {
      // Test implementation
    })

    it('should reject edits to non-editable documents', async () => {
      // Test implementation
    })
  })

  describe('rollbackToVersion', () => {
    it('should create new version with old content', async () => {
      // Test implementation
    })

    it('should reject rollback to non-existent version', async () => {
      // Test implementation
    })
  })

  describe('tiptapToPlainText', () => {
    it('should extract text from paragraphs', () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'World' }] }
        ]
      }
      expect(tiptapToPlainText(content)).toBe('Hello\nWorld')
    })
  })
})
```

**Acceptance Criteria**:
- [ ] All unit tests pass
- [ ] Coverage > 80% for versioning service

---

### Task T.2: Integration Tests

**Description**: Write API integration tests
**Size**: Medium
**Priority**: High
**Dependencies**: Task 2.1, Task 2.2

Create `backend/src/controllers/__tests__/document.version.test.ts`:

```typescript
describe('Document Version API', () => {
  describe('PUT /api/documents/:id/content', () => {
    it('should create version and update chunks', async () => {
      // Test implementation
    })

    it('should reject non-owner requests', async () => {
      // Test implementation
    })

    it('should reject edits to PDF documents', async () => {
      // Test implementation
    })
  })

  describe('GET /api/documents/:id/versions', () => {
    it('should return all versions for document', async () => {
      // Test implementation
    })
  })

  describe('POST /api/documents/:id/rollback', () => {
    it('should create new version with target content', async () => {
      // Test implementation
    })
  })
})
```

**Acceptance Criteria**:
- [ ] All integration tests pass
- [ ] Authorization tested for all endpoints
- [ ] Error cases tested

---

## Dependency Graph

```
Task 1.1 (Schema) ──┬──→ Task 1.2 (Service) ──→ Task 2.1 (Update API)
                    │                           │
                    └──→ Task 1.3 (Processing)  └──→ Task 3.5 (Integration)
                                                      │
Task 3.1 (TipTap) ──→ Task 3.2 (Utils) ──→ Task 3.3 (Editor) ──→ Task 3.5
                    │
                    └──→ Task 3.4 (History UI)

Task 2.1 ──→ Task 2.2 (Version API)
          └──→ Task 4.1 (Embeddings)
```

## Parallel Execution Opportunities

- Task 1.2 + Task 1.3 can run in parallel after Task 1.1
- Task 2.1 + Task 2.2 can run in parallel
- Task 3.1 can start immediately (no backend dependency)
- Task 3.3 + Task 3.4 can run in parallel after Task 3.2
- All Phase 4 tasks can run after Phase 2 foundation is complete

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|------------------|
| Phase 1: Foundation | 3 tasks | Large |
| Phase 2: API Endpoints | 2 tasks | Large |
| Phase 3: Frontend | 5 tasks | Large |
| Phase 4: Embeddings | 1 task | Medium |
| Testing | 2 tasks | Medium |

**Total Tasks**: 13
**Critical Path**: 1.1 → 1.2 → 2.1 → 3.5 → Complete
