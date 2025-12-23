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
import {
  ViewerPreferencesProvider,
  ViewerPreferencesOnboarding,
  useViewerPreferencesContext
} from '../components/viewer-prefs'
import { api } from '../lib/api'
import { Card, Button, Input, AccentText, GlowPulse } from '../components/ui'
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
        viewerName || undefined,
        targetLink.id
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading...
        </div>
      </div>
    )
  }

  // Error state
  if (error && !shareLink) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="text-center max-w-md">
          <h2 className="font-display text-2xl text-foreground">Access Error</h2>
          <p className="mt-2 text-muted">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Go Home
          </Button>
        </Card>
      </div>
    )
  }

  // Access gate (before conversation starts)
  if (!accessGranted && shareLink && project) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden">
        {/* Atmospheric glow */}
        <GlowPulse className="w-96 h-96 -top-48 -right-48" />
        <GlowPulse className="w-80 h-80 -bottom-40 -left-40" color="purple" />

        <Card className="relative max-w-md w-full">
          <h1 className="font-display text-2xl text-foreground mb-2">
            <AccentText>{project.name}</AccentText>
          </h1>
          {project.description && (
            <p className="text-muted mb-6">{project.description}</p>
          )}

          <div className="border-t border-border pt-6">
            <h2 className="font-display text-lg text-foreground mb-4">Access Required</h2>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            {shareLink.accessType === 'password' && (
              <div className="space-y-4">
                <Input
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyAccess()}
                  placeholder="Enter password"
                  disabled={verifying}
                />
              </div>
            )}

            {shareLink.accessType === 'email' && (
              <div className="space-y-4">
                <Input
                  type="email"
                  label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={verifying}
                />
                <Input
                  type="text"
                  label="Name (optional)"
                  value={viewerName}
                  onChange={(e) => setViewerName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyAccess()}
                  placeholder="Your name"
                  disabled={verifying}
                />
              </div>
            )}

            <Button
              onClick={handleVerifyAccess}
              disabled={verifying}
              isLoading={verifying}
              className="mt-6 w-full"
            >
              {verifying ? 'Verifying...' : 'Access Documents'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Main viewer experience (after access granted)
  if (accessGranted && conversationId && project) {
    return (
      <ViewerPreferencesProvider>
        <SharePageContent
          project={project}
          conversationId={conversationId}
          conversationStartedAt={conversationStartedAt}
          messages={messages}
          setMessages={setMessages}
          showEndModal={showEndModal}
          setShowEndModal={setShowEndModal}
          chatPanelFr={chatPanelFr}
          handleChatPanelResize={handleChatPanelResize}
          handleCitationClick={handleCitationClick}
          panelMode={panelMode}
          handleBackToCapsule={handleBackToCapsule}
          documents={documents}
          handleDocumentClick={handleDocumentClick}
          handleSectionClick={handleSectionClick}
          selectedDocumentId={selectedDocumentId}
          slug={slug!}
          highlightSectionId={highlightSectionId}
          highlightKey={highlightKey}
          isCollaborator={isCollaborator}
          handleAddComment={handleAddComment}
          comments={comments}
          commentsDrawerOpen={commentsDrawerOpen}
          setCommentsDrawerOpen={setCommentsDrawerOpen}
          handleCommentClick={handleCommentClick}
          pendingComment={pendingComment}
          email={email}
          viewerName={viewerName}
          handleSubmitComment={handleSubmitComment}
          setPendingComment={setPendingComment}
        />
      </ViewerPreferencesProvider>
    )
  }

  // Fallback
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-muted">Something went wrong. Please try again.</div>
    </div>
  )
}

// Inner component that uses ViewerPreferencesContext
interface SharePageContentProps {
  project: Project
  conversationId: string
  conversationStartedAt: Date | null
  messages: Array<{ role: string; content: string }>
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>
  showEndModal: boolean
  setShowEndModal: React.Dispatch<React.SetStateAction<boolean>>
  chatPanelFr: number
  handleChatPanelResize: (size: `${number}fr`) => void
  handleCitationClick: (filenameOrId: string, sectionId: string) => void
  panelMode: 'capsule' | 'document'
  handleBackToCapsule: () => void
  documents: DocumentInfo[]
  handleDocumentClick: (documentId: string) => void
  handleSectionClick: (documentId: string, sectionId: string) => void
  selectedDocumentId: string | null
  slug: string
  highlightSectionId: string | null
  highlightKey: number
  isCollaborator: boolean
  handleAddComment: (selection: { chunkId: string; startOffset: number; endOffset: number; text: string }) => void
  comments: DocumentComment[]
  commentsDrawerOpen: boolean
  setCommentsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleCommentClick: (comment: DocumentComment) => void
  pendingComment: { chunkId: string; startOffset: number; endOffset: number; text: string; position: { x: number; y: number } } | null
  email: string
  viewerName: string
  handleSubmitComment: (content: string) => Promise<void>
  setPendingComment: React.Dispatch<React.SetStateAction<{ chunkId: string; startOffset: number; endOffset: number; text: string; position: { x: number; y: number } } | null>>
}

function SharePageContent({
  project,
  conversationId,
  conversationStartedAt,
  messages,
  setMessages,
  showEndModal,
  setShowEndModal,
  chatPanelFr,
  handleChatPanelResize,
  handleCitationClick,
  panelMode,
  handleBackToCapsule,
  documents,
  handleDocumentClick,
  handleSectionClick,
  selectedDocumentId,
  slug,
  highlightSectionId,
  highlightKey,
  isCollaborator,
  handleAddComment,
  comments,
  commentsDrawerOpen,
  setCommentsDrawerOpen,
  handleCommentClick,
  pendingComment,
  email,
  viewerName,
  handleSubmitComment,
  setPendingComment
}: SharePageContentProps) {
  const { preferences } = useViewerPreferencesContext()
  const [showOnboarding, setShowOnboarding] = useState(!preferences.onboardingComplete)

  // Show onboarding if not complete
  if (showOnboarding && !preferences.onboardingComplete) {
    return (
      <ViewerPreferencesOnboarding
        onComplete={() => setShowOnboarding(false)}
      />
    )
  }

  return (
    <div className="h-screen bg-background overflow-hidden">
      <Resplit.Root direction="horizontal" className="h-full">
          {/* Main chat panel */}
          <Resplit.Pane
            order={0}
            initialSize={`${chatPanelFr}fr`}
            minSize="400px"
            className="flex flex-col bg-background-elevated border-r border-border min-h-0 overflow-hidden"
            onResize={handleChatPanelResize}
          >
            {/* Header */}
            <div className="border-b border-border p-4 bg-background-elevated shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="font-display text-xl text-foreground">
                    <AccentText>{project.name}</AccentText>
                  </h1>
                  {project.description && (
                    <p className="text-sm text-muted mt-1">{project.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {/* Comments button for collaborators */}
                  {isCollaborator && selectedDocumentId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCommentsDrawerOpen(true)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Comments {comments.length > 0 && `(${comments.length})`}
                    </Button>
                  )}
                  {conversationId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowEndModal(true)}
                      data-testid="end-conversation-button"
                    >
                      End Conversation
                    </Button>
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
            className="bg-border hover:bg-accent cursor-col-resize transition-colors"
          />

          {/* Document panel - always visible, shows capsule or document */}
          <Resplit.Pane
            order={2}
            initialSize="1fr"
            minSize="300px"
            className="bg-background-elevated relative flex flex-col min-h-0 overflow-hidden"
          >
            {/* Back button header (only in document mode) */}
            {panelMode === 'document' && (
              <div className="border-b border-border p-3 bg-background-elevated shrink-0">
                <button
                  onClick={handleBackToCapsule}
                  className="flex items-center gap-2 text-accent hover:text-accent/80 text-sm font-medium transition-colors"
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
