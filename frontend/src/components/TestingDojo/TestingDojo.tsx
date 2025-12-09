import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { SessionManager } from './SessionManager'
import { DojoChat } from './DojoChat'
import { CommentSidebar } from './CommentSidebar'
import { NavigationModal } from './NavigationModal'
import { RecommendationPanel } from '../RecommendationPanel'
import type { TestSessionSummary, TestMessage, TestComment } from '../../types/testing'

interface TestSessionWithMessages {
  id: string
  projectId: string
  name: string | null
  status: 'active' | 'ended'
  createdAt: string
  updatedAt: string
  endedAt: string | null
  messages: TestMessage[]
}

interface TestingDojoProps {
  projectId: string
  onNavigateAway?: (destination: string) => void
}

export function TestingDojo({ projectId, onNavigateAway }: TestingDojoProps) {
  const [sessions, setSessions] = useState<TestSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<TestSessionWithMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showNavigationModal, setShowNavigationModal] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showRecommendations, setShowRecommendations] = useState(false)

  useEffect(() => {
    loadSessions()
  }, [projectId])

  useEffect(() => {
    if (activeSessionId) {
      loadSession(activeSessionId)
    }
  }, [activeSessionId])

  // Handle browser navigation/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && activeSession?.status === 'active') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges, activeSession])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const response = await api.getTestSessions(projectId)
      setSessions(response.sessions)

      // Auto-select active session or most recent
      const active = response.sessions.find((s) => s.status === 'active')
      if (active) {
        setActiveSessionId(active.id)
      } else if (response.sessions.length > 0) {
        setActiveSessionId(response.sessions[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadSession = async (sessionId: string) => {
    try {
      const response = await api.getTestSession(sessionId)
      setActiveSession(response.session as TestSessionWithMessages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    }
  }

  const handleCreateSession = async () => {
    try {
      const response = await api.createTestSession(projectId)
      const newSession: TestSessionSummary = {
        id: response.session.id,
        name: response.session.name,
        status: response.session.status,
        messageCount: 0,
        commentCount: 0,
        createdAt: response.session.createdAt,
        endedAt: response.session.endedAt,
      }
      setSessions([newSession, ...sessions])
      setActiveSessionId(response.session.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
    }
  }

  const handleEndSession = async (applyFeedback: boolean) => {
    if (!activeSessionId) return

    try {
      await api.updateTestSession(activeSessionId, { status: 'ended' })

      // Refresh sessions list
      await loadSessions()

      if (applyFeedback) {
        // Navigate to recommendations (Spec 3)
        onNavigateAway?.('recommendations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end session')
    }
  }

  const handleNavigationConfirm = async (keepLive: boolean, applyFeedback: boolean) => {
    setShowNavigationModal(false)

    if (!keepLive) {
      await handleEndSession(applyFeedback)
    }
  }

  const handleNewMessage = (message: TestMessage) => {
    // Use functional update to avoid stale closure when user + assistant messages arrive quickly
    setActiveSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: [...prev.messages, message],
      }
    })
    setHasUnsavedChanges(true)
  }

  const handleNewComment = (messageId: string, comment: TestComment) => {
    setActiveSession((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.id === messageId
            ? { ...m, comments: [...m.comments, comment] }
            : m
        ),
      }
    })
  }

  const handleDeleteSession = async (id: string) => {
    await api.deleteTestSession(id)
    await loadSessions()
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setActiveSession(null)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    await api.deleteTestComment(commentId)
    if (activeSession) {
      await loadSession(activeSession.id)
    }
  }

  const hasComments = activeSession?.messages.some((m) => m.comments.length > 0) || false

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading Testing Dojo...</div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header with Session Manager */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Testing Dojo</h2>
          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
            TEST MODE
          </span>
        </div>

        <SessionManager
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateSession={handleCreateSession}
          onDeleteSession={handleDeleteSession}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-center justify-between">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            ✕
          </button>
        </div>
      )}

      {/* Main Content */}
      {activeSession ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel (left) */}
          <div className="flex-1 flex flex-col">
            <DojoChat
              projectId={projectId}
              sessionId={activeSession.id}
              messages={activeSession.messages}
              onNewMessage={handleNewMessage}
              onAddComment={handleNewComment}
            />
          </div>

          {/* Comments Sidebar (right) */}
          <div className="w-80 border-l bg-gray-50 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <CommentSidebar
                messages={activeSession.messages}
                onScrollToMessage={(messageId) => {
                  document.getElementById(`message-${messageId}`)?.scrollIntoView({
                    behavior: 'smooth',
                  })
                }}
                onDeleteComment={handleDeleteComment}
              />
            </div>
            {/* Get Recommendations Button */}
            <div className="p-4 border-t bg-white">
              <button
                onClick={() => setShowRecommendations(true)}
                disabled={!hasComments}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Get Recommendations
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No active test session</p>
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Start New Session
            </button>
          </div>
        </div>
      )}

      {/* End Session Button */}
      {activeSession?.status === 'active' && (
        <div className="px-4 py-3 border-t bg-white flex justify-end">
          <button
            onClick={() => setShowNavigationModal(true)}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            End Session
          </button>
        </div>
      )}

      {/* Navigation Modal */}
      <NavigationModal
        isOpen={showNavigationModal}
        onClose={() => setShowNavigationModal(false)}
        onConfirm={handleNavigationConfirm}
        hasComments={activeSession?.messages.some((m) => m.comments.length > 0) || false}
      />

      {/* Recommendation Panel */}
      {showRecommendations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <RecommendationPanel
            projectId={projectId}
            onApplyAll={(_profile, _versionNumber) => {
              // Profile has been updated directly - close panel and navigate to profile view
              setShowRecommendations(false)
              onNavigateAway?.('profile')
            }}
            onClose={() => setShowRecommendations(false)}
          />
        </div>
      )}
    </div>
  )
}
