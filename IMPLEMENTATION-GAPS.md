# Phase 1 Implementation Gaps & Remediation Plan

**Date:** November 2025
**Status:** 85% Complete - Frontend Page Orchestration Needed

---

## Executive Summary

**Good News:** Backend is 100% complete. All components are 100% complete. Infrastructure is fully operational.

**Gap:** Two frontend pages (ProjectPage and SharePage) are empty stubs. These pages need to orchestrate existing components to deliver the full user experience.

**Impact:** User can register and create projects but cannot upload documents, configure AI agent, or access share links.

**Effort to Complete:** 5-8 hours of focused frontend development

---

## Detailed Gap Analysis

### ✅ What Works Today

1. **User can register and login** ✅
   - Navigate to http://localhost:3033
   - Create account
   - Login successfully
   - See dashboard

2. **User can create projects** ✅
   - Click "Create Project"
   - Enter name/description
   - Project appears in dashboard

3. **User can click on project** ✅
   - Clicks project card
   - Navigates to `/projects/:projectId`
   - **STOPS HERE** - sees "under construction"

### ❌ What's Blocked

**Creator Workflow (Blocked at Step 3):**
1. ✅ Register → Login → Dashboard → Create Project
2. ❌ Upload documents
3. ❌ Configure AI agent
4. ❌ Generate share link
5. ❌ View analytics

**Viewer Workflow (Fully Blocked):**
1. ❌ Access share link
2. ❌ Chat with AI
3. ❌ View documents

---

## Implementation Tasks

### Task 1: Implement ProjectPage

**File:** `frontend/src/pages/ProjectPage.tsx`

**Current State:**
```typescript
export function ProjectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">Project</h1>
        <p className="mt-4 text-gray-600">Project details page is under construction.</p>
      </div>
    </div>
  )
}
```

**Target State:**
```typescript
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { DocumentUpload } from '../components/DocumentUpload'
import { AgentInterview } from '../components/AgentInterview'
import { AnalyticsDashboard } from '../components/AnalyticsDashboard'
import { api } from '../lib/api'

export function ProjectPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [projectId])

  const loadProject = async () => {
    try {
      const data = await api.projects.get(projectId)
      setProject(data.project)
    } catch (error) {
      console.error('Failed to load project:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!project) {
    return <div className="flex items-center justify-center min-h-screen">Project not found</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="mt-2 text-gray-600">{project.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-4 border-b-2 ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              className={`px-3 py-4 border-b-2 ${
                activeTab === 'agent'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              AI Agent
            </button>
            <button
              onClick={() => setActiveTab('share')}
              className={`px-3 py-4 border-b-2 ${
                activeTab === 'share'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Share
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-4 border-b-2 ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analytics
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'documents' && (
          <DocumentUpload projectId={projectId} />
        )}
        {activeTab === 'agent' && (
          <AgentInterview projectId={projectId} />
        )}
        {activeTab === 'share' && (
          <ShareLinkManager projectId={projectId} />  {/* NEW COMPONENT NEEDED */}
        )}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard projectId={projectId} />
        )}
      </div>
    </div>
  )
}
```

**New Component Needed:**
- `ShareLinkManager.tsx` - Create/list/delete share links (simple CRUD UI)

**Estimated Time:** 2 hours

---

### Task 2: Implement SharePage

**File:** `frontend/src/pages/SharePage.tsx`

**Current State:**
```typescript
export function SharePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold">Shared Document</h1>
        <p className="mt-4 text-gray-600">Share page is under construction.</p>
      </div>
    </div>
  )
}
```

**Target State:**
```typescript
import { useParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChatInterface } from '../components/ChatInterface'
import { DocumentViewer } from '../components/DocumentViewer'
import { api } from '../lib/api'

export function SharePage() {
  const { slug } = useParams()
  const [shareLink, setShareLink] = useState(null)
  const [conversationId, setConversationId] = useState(null)
  const [accessGranted, setAccessGranted] = useState(false)
  const [password, setPassword] = useState('')
  const [selectedDocument, setSelectedDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadShareLink()
  }, [slug])

  const loadShareLink = async () => {
    try {
      const data = await api.share.getBySlug(slug)
      setShareLink(data.shareLink)

      // Check if access control required
      if (data.shareLink.accessType === 'public') {
        setAccessGranted(true)
        await createConversation(data.shareLink.projectId)
      }
    } catch (error) {
      setError('Share link not found or expired')
    } finally {
      setLoading(false)
    }
  }

  const handleAccessSubmit = async (e) => {
    e.preventDefault()
    try {
      await api.share.verifyAccess(slug, { password })
      setAccessGranted(true)
      await createConversation(shareLink.projectId)
    } catch (error) {
      setError('Invalid password')
    }
  }

  const createConversation = async (projectId) => {
    try {
      const data = await api.chat.createConversation(projectId)
      setConversationId(data.conversation.id)
    } catch (error) {
      setError('Failed to start conversation')
    }
  }

  const handleCitationClick = (documentId, sectionId) => {
    setSelectedDocument({ id: documentId, sectionId })
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (error && !shareLink) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Share Link Not Found</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  // Access gate
  if (!accessGranted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Access Required
          </h2>
          <form onSubmit={handleAccessSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
              />
            </div>
            {error && (
              <p className="text-red-600 text-sm mb-4">{error}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Access
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Main chat interface
  return (
    <div className="flex h-screen bg-white">
      {/* Chat Panel */}
      <div className={`flex-1 ${selectedDocument ? 'w-2/3' : 'w-full'}`}>
        {conversationId && (
          <ChatInterface
            conversationId={conversationId}
            onCitationClick={handleCitationClick}
          />
        )}
      </div>

      {/* Document Viewer Panel */}
      {selectedDocument && (
        <div className="w-1/3 border-l border-gray-200">
          <DocumentViewer
            documentId={selectedDocument.id}
            highlightSectionId={selectedDocument.sectionId}
          />
        </div>
      )}
    </div>
  )
}
```

**Estimated Time:** 3 hours

---

### Task 3: Add Document Reference Parser

**File:** `frontend/src/lib/documentReferences.ts` (NEW)

```typescript
interface DocumentReference {
  filename: string
  documentId: string
  sectionId: string
}

export function parseDocumentReferences(content: string): DocumentReference[] {
  // Parse [DOC:filename:section-id] markers
  const regex = /\[DOC:([^:]+):([^\]]+)\]/g
  const references: DocumentReference[] = []

  let match
  while ((match = regex.exec(content)) !== null) {
    references.push({
      filename: match[1],
      documentId: match[1], // Will need to resolve filename → ID
      sectionId: match[2]
    })
  }

  return references
}

export function replaceReferencesWithLinks(
  content: string,
  onClick: (ref: DocumentReference) => void
): React.ReactNode {
  // Replace [DOC:...] with clickable links
  const parts = content.split(/(\[DOC:[^\]]+\])/)

  return parts.map((part, i) => {
    const match = part.match(/\[DOC:([^:]+):([^\]]+)\]/)
    if (match) {
      const ref = {
        filename: match[1],
        documentId: match[1],
        sectionId: match[2]
      }
      return (
        <button
          key={i}
          onClick={() => onClick(ref)}
          className="text-blue-600 hover:underline"
        >
          📄 {match[1]}
        </button>
      )
    }
    return <span key={i}>{part}</span>
  })
}
```

**Usage in ChatMessage.tsx:**
```typescript
import { replaceReferencesWithLinks } from '../lib/documentReferences'

export function ChatMessage({ role, content, onCitationClick }) {
  return (
    <div className={`message ${role}`}>
      <div className="content">
        {replaceReferencesWithLinks(content, onCitationClick)}
      </div>
    </div>
  )
}
```

**Estimated Time:** 1 hour

---

### Task 4: Create ShareLinkManager Component

**File:** `frontend/src/components/ShareLinkManager.tsx` (NEW)

```typescript
import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface ShareLinkManagerProps {
  projectId: string
}

export function ShareLinkManager({ projectId }: ShareLinkManagerProps) {
  const [shareLinks, setShareLinks] = useState([])
  const [creating, setCreating] = useState(false)
  const [accessType, setAccessType] = useState('password')
  const [password, setPassword] = useState('')

  useEffect(() => {
    loadShareLinks()
  }, [projectId])

  const loadShareLinks = async () => {
    try {
      const data = await api.share.list(projectId)
      setShareLinks(data.shareLinks)
    } catch (error) {
      console.error('Failed to load share links:', error)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const data = await api.share.create(projectId, {
        accessType,
        password: accessType === 'password' ? password : undefined
      })
      setShareLinks([...shareLinks, data.shareLink])
      setPassword('')
    } catch (error) {
      console.error('Failed to create share link:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (linkId) => {
    try {
      await api.share.delete(linkId)
      setShareLinks(shareLinks.filter(link => link.id !== linkId))
    } catch (error) {
      console.error('Failed to delete share link:', error)
    }
  }

  const copyToClipboard = (slug) => {
    const url = `${window.location.origin}/share/${slug}`
    navigator.clipboard.writeText(url)
    alert('Link copied to clipboard!')
  }

  return (
    <div className="space-y-6">
      {/* Create New Link */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Create Share Link</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Access Type</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="password">Password Protected</option>
              <option value="email">Email Required</option>
              <option value="public">Public</option>
            </select>
          </div>

          {accessType === 'password' && (
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Enter password"
              />
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || (accessType === 'password' && !password)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Link'}
          </button>
        </div>
      </div>

      {/* Existing Links */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Existing Links</h2>
        </div>

        {shareLinks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No share links yet. Create one above!
          </div>
        ) : (
          <div className="divide-y">
            {shareLinks.map(link => (
              <div key={link.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">
                    {window.location.origin}/share/{link.slug}
                  </p>
                  <p className="text-sm text-gray-500">
                    {link.accessType} • {link.currentViews} views
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(link.slug)}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Estimated Time:** 2 hours

---

## Priority Order

1. **Task 1: ProjectPage** (Highest Priority - Unlocks Creator Workflow)
   - 2 hours
   - Enables document upload, interview, basic analytics

2. **Task 4: ShareLinkManager** (Medium Priority - Required by Task 1)
   - 2 hours
   - Enables share link creation

3. **Task 2: SharePage** (High Priority - Unlocks Viewer Workflow)
   - 3 hours
   - Enables full viewer experience

4. **Task 3: Document References** (Medium Priority - Enhancement)
   - 1 hour
   - Improves UX but not blocking

**Total Time:** 8 hours

---

## Testing Plan

### After Task 1 + 4 (Creator Workflow)
- [ ] Create project
- [ ] Upload PDF document
- [ ] Wait for processing complete
- [ ] Complete agent interview
- [ ] Verify ContextLayers created in database
- [ ] Generate share link
- [ ] Copy link

### After Task 2 (Viewer Workflow)
- [ ] Open share link in incognito
- [ ] Enter password
- [ ] See chat interface
- [ ] Send message
- [ ] Verify streaming response
- [ ] Check conversation saved in database

### After Task 3 (Document References)
- [ ] Chat: Ask "What does section 3 say?"
- [ ] AI response includes [DOC:report.pdf:section-3]
- [ ] Click citation link
- [ ] DocumentViewer opens
- [ ] Scrolls to section 3

---

## Success Criteria

Phase 1 MVP is **COMPLETE** when:
- ✅ User can register, login, create project
- ✅ User can upload documents and see processing complete
- ✅ User can configure AI agent via interview
- ✅ User can generate and copy share link
- ✅ Viewer can access share link and chat with AI
- ✅ AI responses include document citations
- ✅ Document viewer opens on citation click
- ✅ Analytics dashboard shows conversation metrics

---

**Next Action:** Implement tasks in priority order (1 → 4 → 2 → 3)
