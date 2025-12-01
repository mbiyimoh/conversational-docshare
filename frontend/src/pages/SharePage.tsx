import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChatInterface } from '../components/ChatInterface'
import { DocumentViewer } from '../components/DocumentViewer'
import { api } from '../lib/api'

interface ShareLink {
  id: string
  slug: string
  accessType: string
  projectId: string
}

interface Project {
  id: string
  name: string
  description?: string
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

  // Document viewer state
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      loadShareLink()
    }
  }, [slug])

  const loadShareLink = async () => {
    try {
      setError('')
      const data = await api.getShareLinkBySlug(slug!)
      setShareLink(data.shareLink as ShareLink)
      setProject(data.project as Project)

      // If public access, grant immediately
      if ((data.shareLink as ShareLink).accessType === 'public') {
        await createConversationAndGrant()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share link')
    } finally {
      setLoading(false)
    }
  }

  const createConversationAndGrant = async () => {
    try {
      // Create conversation for this viewer
      const convData = await api.createConversation(
        shareLink!.projectId,
        email || undefined,
        viewerName || undefined
      )
      setConversationId(convData.conversation.id)
      setAccessGranted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation')
    }
  }

  const handleVerifyAccess = async () => {
    if (!shareLink) return

    // Validation
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
      // Verify access
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

  const handleCitationClick = (documentId: string, sectionId: string) => {
    setSelectedDocumentId(documentId)
    setHighlightSectionId(sectionId)
  }

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
      <div className="flex h-screen bg-gray-50">
        {/* Main chat panel */}
        <div className={`flex flex-col ${selectedDocumentId ? 'w-1/2' : 'w-full'} border-r bg-white transition-all duration-300`}>
          {/* Header */}
          <div className="border-b p-4 bg-white">
            <h1 className="text-xl font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-gray-600 mt-1">{project.description}</p>
            )}
          </div>

          {/* Chat interface */}
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              conversationId={conversationId}
              onCitationClick={handleCitationClick}
            />
          </div>
        </div>

        {/* Document viewer panel (conditionally shown) */}
        {selectedDocumentId && (
          <div className="w-1/2 bg-white relative">
            <button
              onClick={() => setSelectedDocumentId(null)}
              className="absolute top-4 right-4 z-10 text-gray-500 hover:text-gray-700 bg-white rounded-full p-2 shadow"
              aria-label="Close document viewer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <DocumentViewer
              documentId={selectedDocumentId}
              highlightSectionId={highlightSectionId || undefined}
            />
          </div>
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
