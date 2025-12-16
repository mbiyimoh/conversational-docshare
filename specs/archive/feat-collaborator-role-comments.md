# Feature: Collaborator Role & Document Comments

**Spec ID:** feat-collaborator-role-comments
**Status:** Validated
**Priority:** High
**Depends On:** feat-document-editing-versioning (Spec 1) - COMPLETED

---

## 1. Problem Statement

Currently all share link recipients have the same experience - they can chat with the AI and view documents. There's no way for senders to designate certain recipients as "collaborators" who can provide direct feedback on documents through inline comments.

### Business Need
- Senders want to distinguish between passive viewers and active collaborators
- Collaborators should be able to highlight text and leave comments directly on documents
- Comments should be visible in the sender's Analytics view
- Comments provide more direct/specific feedback than just conversation analysis

---

## 2. Solution Overview

Add a `recipientRole` field to ShareLink (viewer vs collaborator). Collaborators get an enhanced experience where they can highlight text in documents to leave inline comments. These comments are stored with positional anchors and displayed in the Analytics dashboard.

### Key Components
1. **RecipientRole enum** on ShareLink model
2. **DocumentComment model** for storing highlight-anchored comments
3. **CollaboratorCommentPanel** component for leaving comments
4. **Comment display** in SharePage document panel
5. **Comment listing** in Analytics conversation view

---

## 3. Database Schema

### New Enum
```prisma
enum RecipientRole {
  viewer
  collaborator
}
```

### Modify ShareLink Model
```prisma
model ShareLink {
  // ... existing fields
  recipientRole   RecipientRole @default(viewer)
}
```

### New Model: DocumentComment
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

---

## 4. API Endpoints

### 4.1 ShareLink Updates (Existing endpoints - modify)

**Modify POST /api/share-links** - Add recipientRole field
```typescript
interface CreateShareLinkRequest {
  // ... existing fields
  recipientRole?: 'viewer' | 'collaborator'
}
```

**Modify GET /api/share/:slug/access** - Return role in response
```typescript
interface AccessResponse {
  // ... existing fields
  recipientRole: 'viewer' | 'collaborator'
}
```

### 4.2 Document Comments (New endpoints)

**POST /api/documents/:documentId/comments**
Create a new comment on a document highlight

Request:
```typescript
{
  conversationId?: string
  chunkId: string
  startOffset: number
  endOffset: number
  highlightedText: string
  content: string
}
```

Response:
```typescript
{
  comment: {
    id: string
    documentId: string
    highlightedText: string
    content: string
    status: string
    createdAt: string
  }
}
```

Authorization: Public (for share page viewers with collaborator role)

**GET /api/documents/:documentId/comments**
Get all comments for a document

Query params:
- `conversationId` (optional): Filter to specific conversation
- `status` (optional): Filter by status

Response:
```typescript
{
  comments: Array<{
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
  }>
}
```

Authorization: Authenticated project owner OR public for collaborator viewer

**PATCH /api/comments/:id/status**
Update comment status (for project owner)

Request:
```typescript
{
  status: 'pending' | 'addressed' | 'dismissed'
}
```

Authorization: Project owner only

---

## 5. Frontend Components

### 5.1 ShareLinkManager.tsx (Modify)

Add recipient role selector to share link creation form:

```tsx
// Add after access type selector
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
      <span>Viewer</span>
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
      <span>Collaborator</span>
      <span className="text-gray-500 text-sm ml-2">Can also leave comments on documents</span>
    </label>
  </div>
</div>
```

### 5.2 SharePage.tsx (Modify)

Pass recipientRole to DocumentContentViewer and show comment UI for collaborators.

### 5.3 CollaboratorCommentPanel.tsx (New)

Floating panel that appears when collaborator highlights text:

```tsx
interface CollaboratorCommentPanelProps {
  documentId: string
  conversationId: string
  selectedText: string
  selectionRange: { chunkId: string; start: number; end: number }
  position: { x: number; y: number }
  onSubmit: (content: string) => void
  onCancel: () => void
}
```

Features:
- Positioned near the selection
- Shows highlighted text preview
- Textarea for comment
- Submit/Cancel buttons
- Loading state during submission

### 5.4 DocumentCommentMarker.tsx (New)

Visual indicator on document text that has comments:

```tsx
interface DocumentCommentMarkerProps {
  highlightedText: string
  commentCount: number
  onClick: () => void
}
```

Renders as yellow highlight with comment icon badge.

### 5.5 DocumentCommentsDrawer.tsx (New)

Slide-out drawer showing all comments for current document:

```tsx
interface DocumentCommentsDrawerProps {
  documentId: string
  comments: DocumentComment[]
  onCommentClick: (comment: DocumentComment) => void
  onClose: () => void
}
```

### 5.6 AnalyticsCommentsSection.tsx (New)

Display comments in Analytics conversation detail view:

```tsx
interface AnalyticsCommentsSectionProps {
  conversationId: string
  comments: DocumentComment[]
}
```

---

## 6. Implementation Plan

### Phase 1: Database & API (Backend)
1. Add RecipientRole enum to schema
2. Add recipientRole to ShareLink model
3. Create DocumentComment model
4. Run `npm run db:push`
5. Create `documentComment.controller.ts` with CRUD endpoints
6. Create `documentComment.routes.ts`
7. Modify `shareLink.controller.ts` to handle recipientRole

### Phase 2: Share Link Config (Frontend)
1. Update `ShareLinkManager.tsx` with role selector
2. Update `api.ts` with new fields
3. Test role creation in share links

### Phase 3: Collaborator Experience (Frontend)
1. Create `CollaboratorCommentPanel.tsx`
2. Add text selection handling to `DocumentContentViewer.tsx`
3. Create `DocumentCommentMarker.tsx` for visual highlights
4. Create `DocumentCommentsDrawer.tsx`
5. Wire up comment submission to API

### Phase 4: Analytics Integration (Frontend)
1. Create `AnalyticsCommentsSection.tsx`
2. Integrate into `ConversationDetailPanel.tsx`
3. Add comment status management for owners

---

## 7. Success Criteria

- [ ] Share links can be created with viewer or collaborator role
- [ ] Collaborators see comment UI when highlighting document text
- [ ] Comments are saved with positional anchors
- [ ] Comments are visible on document with highlight markers
- [ ] Comments drawer shows all comments for document
- [ ] Project owner can view comments in Analytics
- [ ] Project owner can update comment status (addressed/dismissed)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes

---

## 8. Testing Approach

1. **Manual Testing:**
   - Create share link with collaborator role
   - Access as collaborator, verify comment UI appears
   - Highlight text, leave comment
   - Verify comment appears in Analytics
   - Test status updates

2. **Edge Cases:**
   - Comment on edited document (text moved)
   - Multiple comments on same text
   - Long highlight across chunks

---

## 9. Rollback Plan

If issues arise:
1. Set all recipientRole to 'viewer' in database
2. Hide collaborator UI behind feature flag
3. Comments remain in database but hidden from UI
