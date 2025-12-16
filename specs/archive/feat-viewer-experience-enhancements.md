# Viewer Experience Enhancements

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-04
**Related:**
- `docs/ideation/viewer-experience-enhancements.md` (ideation document)
- `specs/feat-viewer-citation-navigation.md` (prior viewer work)
- `specs/receiver-experience-scaffold.md` (Phase 7-9 spec)

---

## Overview

Implement three tightly-coupled enhancements to the share link viewer experience:

1. **Document Capsule Panel** - Right panel shows document index by default (not empty until citation clicked)
2. **AI Proactive Welcome Message** - AI greets viewer with personalized intro and document summary
3. **Full Document Content Viewer** - Render actual text content, not just document outline

These features transform the viewer experience from passive (user must initiate) to proactive (AI welcomes, documents immediately visible).

---

## Background/Problem Statement

### Current State (Problems)

1. **Empty Document Panel**: Viewers land on the share page and see only the chat panel. The document panel is hidden until they click a citation. This creates confusion - "where are the documents?"

2. **No Welcome Message**: The chat is blank. Viewers must type the first message with no guidance on what to ask or what's available. This violates the "AI representative" concept where the agent should proactively engage.

3. **Outline-Only Document View**: When clicking a citation, DocumentViewer shows only the hierarchical outline (section titles). The actual text content is stored in `DocumentChunk.content` but never rendered. A note says "PDF.js integration pending" but we can render extracted text without PDF.js.

### Target State

1. **Document Capsule Visible Immediately**: Right panel shows "Document Capsule" index listing all documents with titles, summaries, and collapsible outlines. Clicking navigates to full document view.

2. **AI Welcomes Proactively**: First message is from AI, personalized based on context layers, including an LLM-generated summary of the available documents.

3. **Full Content Rendering**: Document view shows actual text content rendered with react-markdown, not just outline titles.

---

## Goals

- Immediate document visibility on page load (capsule index view)
- Proactive AI engagement with personalized welcome message
- Full document content viewing using existing DocumentChunk data
- Seamless navigation between capsule (index) and document (detail) views
- Maintain existing citation navigation and highlight animations

## Non-Goals

- Native PDF rendering (deferred to Phase 2)
- Mobile-responsive single-panel view (tablet/desktop first)
- User-resizable panel widths (fixed 60/40 ratio)
- Document thumbnails in capsule view
- Real-time document collaboration

---

## Technical Dependencies

### Existing Dependencies (No Installation Needed)

| Package | Version | Usage |
|---------|---------|-------|
| `react-resplit` | 1.3.2 | Two-panel layout (already in use) |
| `react-markdown` | 10.1.0 | Content rendering (already installed) |
| `lucide-react` | 0.469.0 | Icons (already in use) |
| `@radix-ui/react-accordion` | 1.2.2 | Collapsible outlines (already installed) |

### New Dependencies

```bash
# For GFM tables in document content
npm install remark-gfm

# Optional: Syntax highlighting for code blocks
npm install react-syntax-highlighter @types/react-syntax-highlighter
```

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SharePage.tsx                                │
│  ┌──────────────────────────────┬──────────────────────────────────┐│
│  │     Chat Panel (60%)          │     Document Panel (40%)         ││
│  │                               │                                  ││
│  │  ┌─────────────────────────┐  │  ┌────────────────────────────┐ ││
│  │  │ [Welcome Message]       │  │  │ panelMode='capsule'        │ ││
│  │  │ AI-generated greeting   │  │  │ ┌────────────────────────┐ │ ││
│  │  │ with doc summary        │  │  │ │ DocumentCapsule        │ │ ││
│  │  └─────────────────────────┘  │  │ │ - Doc 1 (collapsible)  │ │ ││
│  │                               │  │ │ - Doc 2 (collapsible)  │ │ ││
│  │  [User question]              │  │ └────────────────────────┘ │ ││
│  │                               │  └────────────────────────────┘ ││
│  │  [AI response with citation]  │                                  ││
│  │                               │  ┌────────────────────────────┐ ││
│  │                               │  │ panelMode='document'       │ ││
│  │                               │  │ ┌────────────────────────┐ │ ││
│  │  [Input field]                │  │ │ DocumentContentViewer  │ │ ││
│  │                               │  │ │ (full text + outline)  │ │ ││
│  └──────────────────────────────┴──│ └────────────────────────┘ │ ││
│                                     └────────────────────────────┘ ││
└─────────────────────────────────────────────────────────────────────┘
```

### Component Structure

```
frontend/src/
├── pages/
│   └── SharePage.tsx              # MODIFY: Add panelMode state, welcome message
├── components/
│   ├── DocumentCapsule.tsx        # NEW: Index view with all documents
│   ├── DocumentContentViewer.tsx  # NEW: Full content renderer
│   └── DocumentViewer.tsx         # MODIFY: Integrate content viewer
└── lib/
    └── api.ts                     # MODIFY: Add chunks endpoint

backend/src/
├── controllers/
│   └── shareLink.controller.ts    # MODIFY: Include welcome + documents in response
├── services/
│   ├── chatService.ts             # MODIFY: Add generateWelcomeMessage()
│   └── welcomeService.ts          # NEW: Welcome message generation
└── routes/
    └── shareLink.routes.ts        # MODIFY: Add chunks endpoint
```

---

### Feature 1: Document Capsule Panel

#### New Component: `DocumentCapsule.tsx`

```typescript
// frontend/src/components/DocumentCapsule.tsx

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { FileText, ChevronRight } from 'lucide-react'

interface DocumentInfo {
  id: string
  filename: string
  title: string
  summary?: string
  outline?: Array<{ id: string; title: string; level: number }>
}

interface DocumentCapsuleProps {
  documents: DocumentInfo[]
  projectName: string
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
}

export function DocumentCapsule({
  documents,
  projectName,
  onDocumentClick,
  onSectionClick,
}: DocumentCapsuleProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Document Capsule
        </h2>
        <p className="text-sm text-gray-500 mt-1">{projectName}</p>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4">
        <Accordion type="multiple" className="space-y-2">
          {documents.map((doc) => (
            <AccordionItem key={doc.id} value={doc.id} className="border rounded-lg">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-start gap-3 text-left">
                  <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{doc.title || doc.filename}</div>
                    {doc.summary && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-3">
                {/* View Full Document Button */}
                <button
                  onClick={() => onDocumentClick(doc.id)}
                  className="w-full text-left px-3 py-2 mb-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium"
                >
                  View Full Document →
                </button>

                {/* Outline Sections */}
                {doc.outline && doc.outline.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      Sections
                    </div>
                    {doc.outline.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => onSectionClick(doc.id, section.id)}
                        className="w-full text-left px-3 py-1.5 rounded hover:bg-gray-100 text-sm flex items-center gap-2"
                        style={{ paddingLeft: `${(section.level - 1) * 12 + 12}px` }}
                      >
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        {section.title}
                      </button>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {documents.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No documents in this capsule
          </div>
        )}
      </div>
    </div>
  )
}
```

#### SharePage State Changes

```typescript
// frontend/src/pages/SharePage.tsx - Key additions

// NEW: Panel mode state (default to capsule)
const [panelMode, setPanelMode] = useState<'capsule' | 'document'>('capsule')

// NEW: Store all documents for capsule view
const [documents, setDocuments] = useState<DocumentInfo[]>([])

// NEW: Welcome message from API
const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null)

// MODIFY: On access granted, load documents and welcome
const handleAccessGranted = async (response: AccessResponse) => {
  setAccessGranted(true)
  setConversationId(response.conversation.id)
  setDocuments(response.documents)

  // Set welcome message as first chat message
  if (response.welcomeMessage) {
    setWelcomeMessage(response.welcomeMessage)
  }
}

// NEW: Handle document click from capsule
const handleDocumentClick = (documentId: string) => {
  setSelectedDocumentId(documentId)
  setHighlightSectionId(null)
  setPanelMode('document')
}

// NEW: Handle section click from capsule
const handleSectionClick = (documentId: string, sectionId: string) => {
  setSelectedDocumentId(documentId)
  setHighlightSectionId(sectionId)
  setPanelMode('document')
}

// NEW: Handle back to capsule
const handleBackToCapsule = () => {
  setPanelMode('capsule')
  setSelectedDocumentId(null)
  setHighlightSectionId(null)
}

// MODIFY: Update citation click to switch panel mode
const handleCitationClick = useCallback((filename: string, sectionId: string) => {
  const doc = lookupDocumentByFilename(filename)
  if (doc) {
    setSelectedDocumentId(doc.id)
    setHighlightSectionId(sectionId)
    setPanelMode('document')  // Switch to document view
  }
}, [])
```

#### Layout Changes

```tsx
// SharePage.tsx - Document panel section

<Resplit.Pane order={2} initialSize="1fr" minSize="300px" className="bg-white relative">
  {/* Back button header (only in document mode) */}
  {panelMode === 'document' && (
    <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b p-3">
      <button
        onClick={handleBackToCapsule}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to All Documents
      </button>
    </div>
  )}

  {/* Panel content based on mode */}
  {panelMode === 'capsule' ? (
    <DocumentCapsule
      documents={documents}
      projectName={project?.name || ''}
      onDocumentClick={handleDocumentClick}
      onSectionClick={handleSectionClick}
    />
  ) : (
    <div className="pt-12"> {/* Padding for back button */}
      <DocumentContentViewer
        documentId={selectedDocumentId!}
        shareSlug={slug!}
        highlightSectionId={highlightSectionId}
        highlightKey={highlightKey}
      />
    </div>
  )}
</Resplit.Pane>
```

---

### Feature 2: AI Proactive Welcome Message

#### New Service: `welcomeService.ts`

```typescript
// backend/src/services/welcomeService.ts

import { prisma } from '../utils/prisma'
import { getOpenAI } from '../utils/openai'

interface WelcomeContext {
  projectName: string
  documents: Array<{ filename: string; title: string; summary?: string }>
  audienceDescription?: string
  communicationTone?: string
  emphasisAreas?: string[]
}

/**
 * Generate a personalized welcome message for viewers
 * Uses LLM to create engaging, context-aware greeting
 */
export async function generateWelcomeMessage(projectId: string): Promise<string> {
  // Fetch context for personalization
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      documents: {
        where: { status: 'completed' },
        select: { filename: true, title: true },
      },
      contextLayers: {
        where: { isActive: true, category: { in: ['audience', 'communication', 'content'] } },
      },
      agentConfig: true,
    },
  })

  if (!project) {
    return getDefaultWelcome()
  }

  // Extract context layer info
  const audienceLayer = project.contextLayers.find((l) => l.category === 'audience')
  const commLayer = project.contextLayers.find((l) => l.category === 'communication')
  const contentLayer = project.contextLayers.find((l) => l.category === 'content')

  // Build document list for prompt
  const docList = project.documents
    .map((d) => `- ${d.title || d.filename}`)
    .join('\n')

  // Generate personalized welcome via LLM
  const prompt = buildWelcomePrompt({
    projectName: project.name,
    documents: project.documents,
    audienceDescription: audienceLayer?.content,
    communicationTone: commLayer?.content,
    emphasisAreas: contentLayer?.metadata?.emphasis as string[] | undefined,
  })

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant introducing yourself to a viewer who just accessed a document collection.
Be warm, professional, and helpful. Keep the welcome message concise (3-4 paragraphs max).
Use markdown formatting for structure.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return response.choices[0].message.content || getDefaultWelcome()
  } catch (error) {
    console.error('Failed to generate welcome message:', error)
    return getDefaultWelcome()
  }
}

function buildWelcomePrompt(context: WelcomeContext): string {
  let prompt = `Generate a welcome message for a viewer accessing the "${context.projectName}" document collection.

## Available Documents
${context.documents.map((d) => `- **${d.title || d.filename}**${d.summary ? `: ${d.summary}` : ''}`).join('\n')}

## Instructions
1. Briefly introduce yourself as an AI assistant for this specific document collection
2. Provide a 2-3 sentence summary of what's in the documents (the "capsule")
3. Suggest 2-3 things the viewer might want to explore
4. End with an invitation to ask questions`

  if (context.audienceDescription) {
    prompt += `\n\n## Audience Context\n${context.audienceDescription}`
  }

  if (context.communicationTone) {
    prompt += `\n\n## Communication Style\n${context.communicationTone}`
  }

  if (context.emphasisAreas?.length) {
    prompt += `\n\n## Key Topics to Emphasize\n- ${context.emphasisAreas.join('\n- ')}`
  }

  return prompt
}

function getDefaultWelcome(): string {
  return `**Hello! I'm your AI assistant for this document collection.**

I'm here to help you explore and understand the materials shared with you. Feel free to ask me:
- Questions about specific topics in the documents
- Requests for summaries or explanations
- Help finding particular information

What would you like to know?`
}
```

#### Backend Integration

```typescript
// backend/src/controllers/shareLink.controller.ts - MODIFY verifyShareLinkAccess

import { generateWelcomeMessage } from '../services/welcomeService'

export async function verifyShareLinkAccess(req: Request, res: Response) {
  // ... existing validation code ...

  // Create conversation
  const conversation = await prisma.conversation.create({
    data: {
      projectId: shareLink.projectId,
      shareLinkId: shareLink.id,
      viewerEmail: email,
      viewerName: viewerName,
    },
  })

  // Generate welcome message (async but we wait for it)
  const welcomeMessage = await generateWelcomeMessage(shareLink.projectId)

  // Save welcome as first message
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: welcomeMessage,
      metadata: { isWelcomeMessage: true },
    },
  })

  // Fetch documents for capsule
  const documents = await prisma.document.findMany({
    where: { projectId: shareLink.projectId, status: 'completed' },
    select: {
      id: true,
      filename: true,
      title: true,
      outline: true,
    },
  })

  return res.json({
    accessGranted: true,
    projectId: shareLink.projectId,
    projectName: shareLink.project.name,
    shareLinkId: shareLink.id,
    conversation: { id: conversation.id },
    welcomeMessage,
    documents,
  })
}
```

#### Frontend Integration

```typescript
// frontend/src/components/ChatInterface.tsx - MODIFY to accept initial message

interface ChatInterfaceProps {
  conversationId: string
  initialMessage?: string  // NEW: Welcome message from parent
  onCitationClick?: (documentId: string, sectionId: string) => void
}

export function ChatInterface({ conversationId, initialMessage, onCitationClick }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])

  // Initialize with welcome message if provided
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: initialMessage,
        timestamp: new Date(),
      }])
    }
  }, [initialMessage])

  // ... rest of component
}
```

---

### Feature 3: Full Document Content Viewer

#### New Component: `DocumentContentViewer.tsx`

```typescript
// frontend/src/components/DocumentContentViewer.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api'
import { FileText, Download, Loader2 } from 'lucide-react'

interface DocumentChunk {
  id: string
  content: string
  sectionId: string | null
  sectionTitle: string | null
  chunkIndex: number
}

interface DocumentContentViewerProps {
  documentId: string
  shareSlug: string
  highlightSectionId?: string | null
  highlightKey?: number
}

export function DocumentContentViewer({
  documentId,
  shareSlug,
  highlightSectionId,
  highlightKey = 0,
}: DocumentContentViewerProps) {
  const [document, setDocument] = useState<{ title: string; filename: string } | null>(null)
  const [chunks, setChunks] = useState<DocumentChunk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const highlightedRef = useRef<HTMLElement | null>(null)

  // Load document metadata and chunks
  useEffect(() => {
    loadDocument()
  }, [documentId, shareSlug])

  // Handle highlight when section changes
  useEffect(() => {
    if (highlightSectionId && !loading) {
      scrollToAndHighlight(highlightSectionId)
    }
  }, [highlightSectionId, highlightKey, loading])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch document metadata
      const docData = await api.getShareLinkDocument(shareSlug, documentId)
      setDocument({
        title: docData.document.title,
        filename: docData.document.filename,
      })

      // Fetch document chunks for content rendering
      const chunksData = await api.getShareLinkDocumentChunks(shareSlug, documentId)
      setChunks(chunksData.chunks)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const scrollToAndHighlight = useCallback((sectionId: string) => {
    setTimeout(() => {
      const element = sectionRefs.current.get(sectionId)
      if (!element) return

      // Remove previous highlight
      if (highlightedRef.current) {
        highlightedRef.current.classList.remove('citation-highlight')
      }

      // Scroll to section
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })

      // Apply highlight after scroll
      setTimeout(() => {
        element.classList.add('citation-highlight')
        highlightedRef.current = element

        // Remove highlight after animation
        setTimeout(() => {
          element.classList.remove('citation-highlight')
        }, 3000)
      }, 300)
    }, 100)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading document...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-red-500 mb-4">{error}</div>
      </div>
    )
  }

  // Group chunks by section for better rendering
  const sectionedContent = groupChunksBySectionId(chunks)

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Document Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold">{document?.title}</h2>
              <p className="text-sm text-gray-500">{document?.filename}</p>
            </div>
          </div>
          <button
            onClick={() => window.open(`/api/documents/${documentId}/download`, '_blank')}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="prose prose-slate max-w-none p-6">
          {sectionedContent.map((section, idx) => (
            <section
              key={section.sectionId || `chunk-${idx}`}
              id={`section-${section.sectionId}`}
              ref={(el) => {
                if (el && section.sectionId) {
                  sectionRefs.current.set(section.sectionId, el)
                }
              }}
              className="mb-8 scroll-mt-4"
            >
              {section.sectionTitle && (
                <h2 className="text-xl font-semibold text-blue-700 mb-3 flex items-center gap-2">
                  {section.sectionTitle}
                </h2>
              )}

              <div className="text-gray-700 leading-relaxed">
                {section.chunks.map((chunk) => (
                  <ReactMarkdown
                    key={chunk.id}
                    remarkPlugins={[remarkGfm]}
                    className="mb-4"
                  >
                    {chunk.content}
                  </ReactMarkdown>
                ))}
              </div>
            </section>
          ))}

          {chunks.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No content available for this document
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper to group consecutive chunks by section
function groupChunksBySectionId(chunks: DocumentChunk[]) {
  const sections: Array<{
    sectionId: string | null
    sectionTitle: string | null
    chunks: DocumentChunk[]
  }> = []

  let currentSection: typeof sections[0] | null = null

  for (const chunk of chunks) {
    if (!currentSection || currentSection.sectionId !== chunk.sectionId) {
      currentSection = {
        sectionId: chunk.sectionId,
        sectionTitle: chunk.sectionTitle,
        chunks: [],
      }
      sections.push(currentSection)
    }
    currentSection.chunks.push(chunk)
  }

  return sections
}
```

#### Backend: Document Chunks Endpoint

```typescript
// backend/src/controllers/shareLink.controller.ts - NEW endpoint

/**
 * Get document chunks for content rendering (public endpoint for viewers)
 */
export async function getShareLinkDocumentChunks(req: Request, res: Response) {
  const { slug, documentId } = req.params

  // Verify share link exists and is valid
  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: { project: true },
  })

  if (!shareLink) {
    return res.status(404).json({ error: 'Share link not found' })
  }

  // Verify document belongs to this project
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      projectId: shareLink.projectId,
    },
  })

  if (!document) {
    return res.status(404).json({ error: 'Document not found' })
  }

  // Fetch chunks ordered by index
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { chunkIndex: 'asc' },
    select: {
      id: true,
      content: true,
      sectionId: true,
      sectionTitle: true,
      chunkIndex: true,
    },
  })

  return res.json({ chunks })
}
```

```typescript
// backend/src/routes/shareLink.routes.ts - Add route

router.get(
  '/share/:slug/documents/:documentId/chunks',
  asyncHandler(getShareLinkDocumentChunks)
)
```

#### Frontend API Client

```typescript
// frontend/src/lib/api.ts - Add method

export const api = {
  // ... existing methods ...

  async getShareLinkDocumentChunks(slug: string, documentId: string) {
    const response = await fetch(`${API_URL}/api/share/${slug}/documents/${documentId}/chunks`)
    if (!response.ok) throw new Error('Failed to load document chunks')
    return response.json()
  },
}
```

---

## User Experience

### Viewer Journey (After Enhancement)

1. **Access Link** → Enter password/email if required
2. **Page Loads** → See chat panel (left) + Document Capsule (right)
3. **Welcome Message Appears** → AI greets with personalized intro + doc summary
4. **Browse Documents** → Expand capsule items to see outlines, click to view full content
5. **Ask Questions** → AI responds with citations that link to document sections
6. **Navigate** → Click citations to jump to content, use "Back to All Documents" to return

### Interaction Patterns

| User Action | System Response |
|-------------|-----------------|
| Page loads | Capsule panel visible immediately with all documents |
| Welcome auto-displays | First chat message is AI greeting with doc summary |
| Click document in capsule | Panel switches to document view at top |
| Click section in capsule | Panel switches to document view at that section |
| Click citation in chat | Panel switches to document view, highlights section |
| Click "Back to All Documents" | Panel returns to capsule view |

---

## Testing Strategy

### Unit Tests

```typescript
// DocumentCapsule.test.tsx
describe('DocumentCapsule', () => {
  it('renders all documents with titles', () => {
    // Purpose: Verify document list displays correctly
    // Can fail if: documents prop not mapped correctly
  })

  it('expands document to show outline on click', () => {
    // Purpose: Verify accordion behavior
    // Can fail if: Accordion component not wired correctly
  })

  it('calls onDocumentClick when "View Full Document" clicked', () => {
    // Purpose: Verify navigation callback
    // Can fail if: onClick handler not connected
  })

  it('calls onSectionClick with correct IDs when section clicked', () => {
    // Purpose: Verify section navigation
    // Can fail if: section.id not passed correctly
  })
})

// DocumentContentViewer.test.tsx
describe('DocumentContentViewer', () => {
  it('renders document content from chunks', () => {
    // Purpose: Verify content rendering
    // Can fail if: chunks not fetched or ReactMarkdown fails
  })

  it('scrolls to and highlights section when highlightSectionId changes', () => {
    // Purpose: Verify citation navigation
    // Can fail if: ref mapping or scroll logic broken
  })

  it('groups consecutive chunks by sectionId', () => {
    // Purpose: Verify content organization
    // Can fail if: groupChunksBySectionId logic incorrect
  })
})

// welcomeService.test.ts
describe('generateWelcomeMessage', () => {
  it('returns personalized message with document list', () => {
    // Purpose: Verify LLM integration produces useful welcome
    // Can fail if: prompt construction or LLM call fails
  })

  it('falls back to default welcome on LLM error', () => {
    // Purpose: Verify graceful degradation
    // Can fail if: error handling not catching LLM failures
  })
})
```

### Integration Tests

```typescript
// shareLink.integration.test.ts
describe('Share Link Access with Welcome', () => {
  it('returns welcome message and documents on access verification', async () => {
    // Purpose: Verify full flow from access to welcome
    const response = await request(app)
      .post('/api/share/test-slug/access')
      .send({ password: 'test123' })

    expect(response.body.welcomeMessage).toBeDefined()
    expect(response.body.documents).toHaveLength(2)
    expect(response.body.conversation.id).toBeDefined()
  })

  it('fetches document chunks via public endpoint', async () => {
    // Purpose: Verify chunks endpoint works for viewers
    const response = await request(app)
      .get('/api/share/test-slug/documents/doc-id/chunks')

    expect(response.body.chunks).toHaveLength(5)
    expect(response.body.chunks[0].content).toBeDefined()
  })
})
```

### E2E Tests

```typescript
// e2e/viewer-experience.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Viewer Experience Enhancements', () => {
  test('document capsule visible on page load', async ({ page }) => {
    // Purpose: Verify capsule renders immediately
    await page.goto('/s/test-share-slug')
    await page.fill('[data-testid="password-input"]', 'test123')
    await page.click('[data-testid="access-button"]')

    await expect(page.locator('[data-testid="document-capsule"]')).toBeVisible()
    await expect(page.locator('[data-testid="document-item"]')).toHaveCount(2)
  })

  test('welcome message appears without user input', async ({ page }) => {
    // Purpose: Verify proactive AI greeting
    await page.goto('/s/test-share-slug')
    // ... access flow ...

    const welcome = page.locator('[data-testid="chat-message"]').first()
    await expect(welcome).toContainText('Hello')
    await expect(welcome).toContainText('document')
  })

  test('clicking document in capsule shows full content', async ({ page }) => {
    // Purpose: Verify content viewer integration
    await page.goto('/s/test-share-slug')
    // ... access flow ...

    await page.click('[data-testid="document-item"]:first-child')
    await page.click('text=View Full Document')

    await expect(page.locator('[data-testid="document-content"]')).toBeVisible()
    await expect(page.locator('[data-testid="back-to-capsule"]')).toBeVisible()
  })

  test('citation click navigates to document section', async ({ page }) => {
    // Purpose: Verify citation navigation still works
    await page.goto('/s/test-share-slug')
    // ... access flow, send message, get response with citation ...

    await page.click('[data-testid="citation-button"]')

    const highlighted = page.locator('.citation-highlight')
    await expect(highlighted).toBeVisible()
  })
})
```

---

## Performance Considerations

### Welcome Message Generation

**Concern:** LLM call adds latency to access verification (1-2 seconds)

**Mitigation:**
- Cache welcome messages per project (TTL: 1 hour)
- Generate asynchronously if caching enabled
- Fallback to template if LLM times out (5s timeout)

```typescript
// Optional: Caching layer
const welcomeCache = new Map<string, { message: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function getWelcomeMessage(projectId: string): Promise<string> {
  const cached = welcomeCache.get(projectId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.message
  }

  const message = await generateWelcomeMessage(projectId)
  welcomeCache.set(projectId, { message, timestamp: Date.now() })
  return message
}
```

### Document Chunks Loading

**Concern:** Large documents may have 100+ chunks

**Mitigation:**
- Virtualized scrolling for very long documents (future enhancement)
- Chunk content is already extracted, so no parsing overhead
- Pagination if chunks exceed 50 (future enhancement)

---

## Security Considerations

### Public Endpoints

The new chunks endpoint is public (no auth required) but scoped:
- Only accessible via valid share link slug
- Only returns chunks for documents in that project
- No write operations exposed

### Welcome Message

- LLM-generated content is sanitized through ReactMarkdown
- No user input in welcome generation (only project metadata)
- Rate limiting on LLM calls via existing infrastructure

---

## Documentation

### Updates Required

1. **CLAUDE.md** - Add section on viewer experience components
2. **API Reference** - Document new `/api/share/:slug/documents/:id/chunks` endpoint
3. **Developer Guide** - Add viewer experience architecture diagram

---

## Implementation Phases

### Phase 1: Core Features (This Spec)

1. **Document Capsule Component**
   - Create `DocumentCapsule.tsx` with accordion pattern
   - Integrate into SharePage with panel mode state
   - Wire up navigation callbacks

2. **Welcome Message**
   - Create `welcomeService.ts` with LLM generation
   - Modify access verification to include welcome
   - Frontend displays as first chat message

3. **Content Viewer**
   - Create `DocumentContentViewer.tsx` with markdown rendering
   - Add chunks API endpoint
   - Integrate into SharePage document panel

### Phase 2: Enhancements (Future)

- Native PDF rendering toggle (react-pdf integration)
- Welcome message caching
- Document thumbnails in capsule
- Virtualized scrolling for large documents
- Mobile-responsive drawer pattern

---

## Open Questions

1. **Document Summary Field**: The Document model doesn't have a `summary` field. Options:
   - A) Add `summary` field to schema, generate during processing
   - B) Generate summaries on-demand for capsule (slower but no schema change)
   - **Recommendation:** Option A for better UX

2. **Welcome Message Regeneration**: Should creators be able to regenerate the welcome message template?
   - Currently auto-generated from context layers
   - Could add "Regenerate Welcome" button in Testing Dojo

---

## References

- [Ideation Document](../docs/ideation/viewer-experience-enhancements.md)
- [Receiver Experience Scaffold](./receiver-experience-scaffold.md)
- [Citation Navigation Spec](./feat-viewer-citation-navigation.md)
- [react-markdown Documentation](https://github.com/remarkjs/react-markdown)
- [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion)
