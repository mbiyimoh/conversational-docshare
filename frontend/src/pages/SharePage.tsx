import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { Resplit } from 'react-resplit'
import { ArrowLeft, MessageSquare } from 'lucide-react'
import { ChatInterface } from '../components/ChatInterface'
import { DocumentCapsule } from '../components/DocumentCapsule'
import { DocumentContentViewer } from '../components/DocumentContentViewer'
import { EndSessionModal } from '../components/EndSessionModal'
import { DocumentCommentsDrawer } from '../components/DocumentCommentsDrawer'
import { CollaboratorCommentPanel } from '../components/CollaboratorCommentPanel'
import { api } from '../lib/api'
import {
  initDocumentLookup,
  lookupDocumentByFilename,
  clearDocumentCache,
} from '../lib/documentLookup'

// Storage key for panel ratio persistence
const PANEL_RATIO_STORAGE_KEY = 'viewer-chat-panel-fr'
const DEFAULT_CHAT_PANEL_FR = 1.5 // Chat panel gets 1.5fr, document gets 1fr (60/40 ratio)

interface ShareLink {
  id: string
  slug: string
  accessType: string
  projectId: string
  recipientRole: 'viewer' | 'collaborator'
}

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

interface Project {
  id: string
  name: string
  description?: string
}

interface DocumentInfo {
  id: string
  filename: string
  title: string
  mimeType: string
  outline: Array<{ id: string; title: string; level: number; position: number }>
  status: string
}

export function SharePage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  // Access control state
  const [shareLink, setShareLink] = useState<ShareLink | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [accessGranted, setAccessGranted] = useState(false)

  // Access gate form state
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [viewerName, setViewerName] = useState('')
  const [verifying, setVerifying] = useState(false)

  // Conversation state
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationStartedAt, setConversationStartedAt] = useState<Date | null>(null)
  const [showEndModal, setShowEndModal] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])

  // Document panel state
  const [panelMode, setPanelMode] = useState<'capsule' | 'document'>('capsule')
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null)
  const [highlightKey, setHighlightKey] = useState(0)

  // Panel size state (persisted to localStorage)
  const [chatPanelFr, setChatPanelFr] = useState(() => {
    const stored = localStorage.getItem(PANEL_RATIO_STORAGE_KEY)
    return stored ? parseFloat(stored) : DEFAULT_CHAT_PANEL_FR
  })

  // Document lookup initialization state
  const [documentsLoaded, setDocumentsLoaded] = useState(false)

  // Collaborator comments state
  const [comments, setComments] = useState<DocumentComment[]>([])
  const [commentsDrawerOpen, setCommentsDrawerOpen] = useState(false)
  const [pendingComment, setPendingComment] = useState<{
    chunkId: string
    startOffset: number
    endOffset: number
    text: string
    position: { x: number; y: number }
  } | null>(null)

  // Helper to check if current user is a collaborator
  const isCollaborator = shareLink?.recipientRole === 'collaborator'

  useEffect(() => {
    if (slug) {
      loadShareLink()
    }

    return () => {
      clearDocumentCache()
    }
  }, [slug])

  // Initialize document lookup and load documents list after access is granted
  useEffect(() => {
    if (accessGranted && slug && !documentsLoaded) {
      // Initialize lookup for citation resolution
      initDocumentLookup(slug)
        .then(() => setDocumentsLoaded(true))
        .catch((err) => console.error('Failed to load documents for lookup:', err))

      // Load documents for capsule view
      loadDocuments()
    }
  }, [accessGranted, slug, documentsLoaded])

  // Load comments when a document is selected (for collaborators)
  useEffect(() => {
    if (isCollaborator && selectedDocumentId) {
      loadComments(selectedDocumentId)
    }
  }, [isCollaborator, selectedDocumentId])

  // Beforeunload handler (BACKUP only - unreliable)
  useEffect(() => {
    if (!conversationId || !accessGranted) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome requires returnValue to be set
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [conversationId, accessGranted])

  const loadShareLink = async () => {
    try {
      setError('')
      const data = await api.getShareLinkBySlug(slug!)
      setShareLink(data.shareLink as ShareLink)
      setProject(data.project as Project)

      // If open access, grant immediately
      if ((data.shareLink as ShareLink).accessType === 'open') {
        await createConversationAndGrant(data.shareLink as ShareLink)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share link')
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async () => {
    if (!slug) return
    try {
      const data = await api.getShareLinkDocuments(slug)
      setDocuments(data.documents)
    } catch (err) {
      console.error('Failed to load documents:', err)
    }
  }

  const loadComments = useCallback(async (documentId: string) => {
    try {
      const data = await api.getDocumentComments(documentId)
      setComments(data.comments)
    } catch (err) {
      console.error('Failed to load comments:', err)
    }
  }, [])

  const createConversationAndGrant = async (link?: ShareLink) => {
    const targetLink = link || shareLink
    if (!targetLink) return

    try {
      const convData = await api.createConversation(
        targetLink.projectId,
        email || undefined,
        viewerName || undefined
      )
      setConversationId(convData.conversation.id)
      setConversationStartedAt(new Date())
      setAccessGranted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation')
    }
  }

  const handleVerifyAccess = async () => {
    if (!shareLink) return

    if (shareLink.accessType === 'password' && !password) {
      setError('Password is required')
      return
    }
    if (shareLink.accessType === 'email' && !email) {
      setError('Email is required')
      return
    }

    setVerifying(true)
    setError('')

    try {
      const result = await api.verifyShareLinkAccess(slug!, {
        password: shareLink.accessType === 'password' ? password : undefined,
        email: shareLink.accessType === 'email' ? email : undefined,
      })

      if (result.accessGranted) {
        await createConversationAndGrant()
      } else {
        setError('Access denied. Please check your credentials.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify access')
    } finally {
      setVerifying(false)
    }
  }

  // Handle citation click from chat messages
  const handleCitationClick = useCallback(
    (filenameOrId: string, sectionId: string) => {
      const docInfo = lookupDocumentByFilename(filenameOrId)

      if (docInfo) {
        if (selectedDocumentId === docInfo.id && highlightSectionId === sectionId) {
          setHighlightKey((prev) => prev + 1)
        } else {
          setSelectedDocumentId(docInfo.id)
          setHighlightSectionId(sectionId)
        }
        setPanelMode('document')
      } else {
        if (selectedDocumentId === filenameOrId && highlightSectionId === sectionId) {
          setHighlightKey((prev) => prev + 1)
        } else {
          setSelectedDocumentId(filenameOrId)
          setHighlightSectionId(sectionId)
        }
        setPanelMode('document')
      }
    },
    [selectedDocumentId, highlightSectionId]
  )

  // Handle document click from capsule
  const handleDocumentClick = useCallback((documentId: string) => {
    setSelectedDocumentId(documentId)
    setHighlightSectionId(null)
    setPanelMode('document')
  }, [])

  // Handle section click from capsule
  const handleSectionClick = useCallback((documentId: string, sectionId: string) => {
    setSelectedDocumentId(documentId)
    setHighlightSectionId(sectionId)
    setPanelMode('document')
  }, [])

  // Handle back to capsule
  const handleBackToCapsule = useCallback(() => {
    setPanelMode('capsule')
    setSelectedDocumentId(null)
    setHighlightSectionId(null)
  }, [])

  // Handle chat panel resize
  const handleChatPanelResize = useCallback((size: `${number}fr`) => {
    const frValue = parseFloat(size.replace('fr', ''))
    setChatPanelFr(frValue)
    localStorage.setItem(PANEL_RATIO_STORAGE_KEY, frValue.toString())
  }, [])

  // Handle comment click - scroll to highlighted text in document
  const handleCommentClick = useCallback((_comment: DocumentComment) => {
    // For now, just close the drawer - full scroll-to-highlight requires DocumentContentViewer changes
    // TODO: Implement scroll-to-chunk when DocumentContentViewer supports chunk-level navigation
    setCommentsDrawerOpen(false)
  }, [])

  // Handle adding a new comment from text selection
  const handleAddComment = useCallback((selection: { chunkId: string; startOffset: number; endOffset: number; text: string }) => {
    setPendingComment({
      ...selection,
      position: { x: 300, y: 200 }, // Default position, will be positioned by the panel
    })
  }, [])

  // Submit the comment to the API
  const handleSubmitComment = useCallback(async (content: string) => {
    if (!pendingComment || !selectedDocumentId) return

    await api.createDocumentComment(selectedDocumentId, {
      conversationId: conversationId || undefined,
      chunkId: pendingComment.chunkId,
      startOffset: pendingComment.startOffset,
      endOffset: pendingComment.endOffset,
      highlightedText: pendingComment.text,
      content,
      viewerEmail: email || undefined,
      viewerName: viewerName || undefined,
    })

    // Refresh comments
    await loadComments(selectedDocumentId)
    setPendingComment(null)
  }, [pendingComment, selectedDocumentId, conversationId, email, viewerName, loadComments])

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Error state
  if (error && !shareLink) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Access Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  // Access gate (before conversation starts)
  if (!accessGranted && shareLink && project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mb-6">{project.description}</p>
          )}

          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Access Required</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                {error}
              </div>
            )}

            {shareLink.accessType === 'password' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyAccess()}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    disabled={verifying}
                  />
                </div>
              </div>
            )}

            {shareLink.accessType === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your@email.com"
                    disabled={verifying}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={viewerName}
                    onChange={(e) => setViewerName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyAccess()}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                    disabled={verifying}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleVerifyAccess}
              disabled={verifying}
              className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {verifying ? 'Verifying...' : 'Access Documents'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main viewer experience (after access granted)
  if (accessGranted && conversationId && project) {
    return (
      <div className="h-screen bg-gray-50 overflow-hidden">
        <Resplit.Root direction="horizontal" className="h-full">
          {/* Main chat panel */}
          <Resplit.Pane
            order={0}
            initialSize={`${chatPanelFr}fr`}
            minSize="400px"
            className="flex flex-col bg-white border-r min-h-0 overflow-hidden"
            onResize={handleChatPanelResize}
          >
            {/* Header */}
            <div className="border-b p-4 bg-white shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-xl font-bold">{project.name}</h1>
                  {project.description && (
                    <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {/* Comments button for collaborators */}
                  {isCollaborator && selectedDocumentId && (
                    <button
                      onClick={() => setCommentsDrawerOpen(true)}
                      className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Comments {comments.length > 0 && `(${comments.length})`}
                    </button>
                  )}
                  {accessGranted && conversationId && (
                    <button
                      onClick={() => setShowEndModal(true)}
                      data-testid="end-conversation-button"
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      End Conversation
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Chat interface */}
            <div className="flex-1 overflow-hidden min-h-0">
              <ChatInterface
                conversationId={conversationId}
                onCitationClick={handleCitationClick}
                onMessagesChange={setMessages}
              />
            </div>
          </Resplit.Pane>

          {/* Splitter - always visible now since panel is always shown */}
          <Resplit.Splitter
            order={1}
            size="4px"
            className="bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
          />

          {/* Document panel - always visible, shows capsule or document */}
          <Resplit.Pane
            order={2}
            initialSize="1fr"
            minSize="300px"
            className="bg-white relative flex flex-col min-h-0 overflow-hidden"
          >
            {/* Back button header (only in document mode) */}
            {panelMode === 'document' && (
              <div className="border-b p-3 bg-white shrink-0">
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
            <div className="flex-1 overflow-hidden min-h-0">
              {panelMode === 'capsule' ? (
                <DocumentCapsule
                  documents={documents}
                  projectName={project.name}
                  onDocumentClick={handleDocumentClick}
                  onSectionClick={handleSectionClick}
                />
              ) : selectedDocumentId && slug ? (
                <DocumentContentViewer
                  documentId={selectedDocumentId}
                  shareSlug={slug}
                  highlightSectionId={highlightSectionId}
                  highlightKey={highlightKey}
                  isCollaborator={isCollaborator}
                  onAddComment={isCollaborator ? handleAddComment : undefined}
                />
              ) : null}
            </div>
          </Resplit.Pane>
        </Resplit.Root>

        {/* End Session Modal */}
        {showEndModal && conversationId && conversationStartedAt && (
          <EndSessionModal
            conversationId={conversationId}
            messageCount={messages.length}
            startedAt={conversationStartedAt}
            projectName={project.name}
            onClose={() => setShowEndModal(false)}
            onEnded={() => setShowEndModal(false)}
          />
        )}

        {/* Comments Drawer for Collaborators */}
        {isCollaborator && selectedDocumentId && (
          <DocumentCommentsDrawer
            documentId={selectedDocumentId}
            comments={comments}
            isOpen={commentsDrawerOpen}
            onCommentClick={handleCommentClick}
            onClose={() => setCommentsDrawerOpen(false)}
          />
        )}

        {/* Collaborator Comment Panel - shown when adding a new comment */}
        {pendingComment && selectedDocumentId && conversationId && (
          <CollaboratorCommentPanel
            documentId={selectedDocumentId}
            conversationId={conversationId}
            selectedText={pendingComment.text}
            selectionRange={{
              chunkId: pendingComment.chunkId,
              start: pendingComment.startOffset,
              end: pendingComment.endOffset,
            }}
            position={pendingComment.position}
            viewerEmail={email || undefined}
            viewerName={viewerName || undefined}
            onSubmit={handleSubmitComment}
            onCancel={() => setPendingComment(null)}
          />
        )}
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-500">Something went wrong. Please try again.</div>
    </div>
  )
}
