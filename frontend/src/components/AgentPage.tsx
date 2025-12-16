import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { ProfileCreationChoice } from './ProfileCreationChoice'
import { AgentProfileBrainDumpModal } from './AgentProfileBrainDumpModal'
import { AgentInterviewModal } from './AgentInterviewModal'
import { AgentProfile } from './AgentProfile'

type TabId = 'documents' | 'agent' | 'test' | 'share' | 'analytics'

interface AgentPageProps {
  projectId: string
  onNavigateToTab: (tab: TabId) => void
}

export function AgentPage({ projectId, onNavigateToTab }: AgentPageProps) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreationChoice, setShowCreationChoice] = useState(false)
  const [showBrainDumpModal, setShowBrainDumpModal] = useState(false)
  const [showInterviewModal, setShowInterviewModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    checkProfileExists()
  }, [projectId])

  const checkProfileExists = async () => {
    try {
      setLoading(true)
      const response = await api.getAgentConfig(projectId)
      const config = response.agentConfig as { status?: string } | null
      setHasProfile(config?.status === 'complete')
      setShowCreationChoice(config?.status !== 'complete')
    } catch {
      // Assume no profile exists - let user create one
      // This handles 404s and network errors gracefully
      setHasProfile(false)
      setShowCreationChoice(true)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileCreated = () => {
    setNotification('Profile created successfully')
    setShowBrainDumpModal(false)
    setShowInterviewModal(false)
    setShowCreationChoice(false)
    setHasProfile(true)
    setTimeout(() => setNotification(null), 3000)
  }

  const handleStartOver = () => {
    setShowCreationChoice(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading...
        </div>
      </div>
    )
  }

  // Determine what to show - use clear boolean logic
  const shouldShowProfile = hasProfile === true && !showCreationChoice

  // Modals can appear over either state
  const modals = (
    <>
      {/* Brain Dump Modal */}
      {showBrainDumpModal && (
        <AgentProfileBrainDumpModal
          projectId={projectId}
          onClose={() => setShowBrainDumpModal(false)}
          onSaved={handleProfileCreated}
          onSwitchToInterview={() => {
            setShowBrainDumpModal(false)
            setShowInterviewModal(true)
          }}
        />
      )}

      {/* Interview Modal */}
      {showInterviewModal && (
        <AgentInterviewModal
          projectId={projectId}
          onClose={() => setShowInterviewModal(false)}
          onComplete={handleProfileCreated}
        />
      )}
    </>
  )

  // Show profile view when profile exists and user hasn't started over
  if (shouldShowProfile) {
    return (
      <>
        {notification && (
          <div className="fixed top-4 right-4 bg-success text-background px-4 py-2 rounded-lg shadow-lg z-50">
            {notification}
          </div>
        )}
        <AgentProfile
          projectId={projectId}
          onNavigateToTest={() => onNavigateToTab('test')}
          onStartOver={handleStartOver}
        />
        {modals}
      </>
    )
  }

  // Default: show profile creation choice (for new projects or starting over)
  return (
    <>
      {notification && (
        <div className="fixed top-4 right-4 bg-success text-background px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}
      <ProfileCreationChoice
        onSelectBrainDump={() => setShowBrainDumpModal(true)}
        onSelectInterview={() => setShowInterviewModal(true)}
      />
      {modals}
    </>
  )
}
