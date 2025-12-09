import { useState, useEffect } from 'react'
import { api, AgentProfile as AgentProfileType, ProfileProgressEvent, VersionHistoryResponse } from '../lib/api'
import { ProfileSectionContent } from './ProfileSectionContent'

// Section-to-question mapping for source attribution
const sectionSourceMap: Record<string, string[]> = {
  identityRole: ['audience', 'purpose'],
  communicationStyle: ['tone'],
  contentPriorities: ['emphasis'],
  engagementApproach: ['questions'],
  keyFramings: ['audience', 'tone', 'emphasis'],
}

const questionLabels: Record<string, string> = {
  audience: 'Primary Audience',
  purpose: 'Main Purpose',
  tone: 'Communication Style',
  emphasis: 'Areas to Emphasize',
  questions: 'Proactive Questions',
}

function getSourceLabel(sectionKey: string): string {
  const sources = sectionSourceMap[sectionKey] || []
  return sources.map((s) => questionLabels[s]).join(' + ')
}

function getOriginalResponses(
  sectionKey: string,
  data: Record<string, string>
): string {
  const sources = sectionSourceMap[sectionKey] || []
  return (
    sources
      .map((s) => data[s])
      .filter(Boolean)
      .join('\n\n---\n\n') || 'No response provided'
  )
}

interface AgentProfileProps {
  projectId: string
  interviewData?: Record<string, string>
  onContinueToTesting: () => void
  onEditInterview: () => void
}

export function AgentProfile({
  projectId,
  interviewData,
  onContinueToTesting,
  onEditInterview,
}: AgentProfileProps) {
  const [profile, setProfile] = useState<AgentProfileType | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  // Progress tracking state for streaming generation
  const [generationStep, setGenerationStep] = useState<string>('')
  const [currentSection, setCurrentSection] = useState<string | null>(null)
  const [completedSections, setCompletedSections] = useState<string[]>([])

  // Version history state
  const [versionHistory, setVersionHistory] = useState<VersionHistoryResponse | null>(null)
  const [showVersionDropdown, setShowVersionDropdown] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)

  useEffect(() => {
    loadProfile()
    loadVersionHistory()
  }, [projectId])

  const loadVersionHistory = async () => {
    try {
      const history = await api.getVersionHistory(projectId)
      setVersionHistory(history)
    } catch (err) {
      // Version history is optional - don't show error if it fails
      console.warn('Failed to load version history:', err)
    }
  }

  const handleRollback = async (targetVersion: number) => {
    try {
      setRollingBack(true)
      setShowVersionDropdown(false)
      const response = await api.rollbackProfile(projectId, targetVersion)
      const restoredProfile = response.profile
      setProfile(restoredProfile)
      await loadVersionHistory()
      showNotification(`Rolled back to version ${targetVersion}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback')
    } finally {
      setRollingBack(false)
    }
  }

  const loadProfile = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.getAgentProfile(projectId)
      setProfile(response.profile)
    } catch (err) {
      // Profile doesn't exist yet, generate it
      if (err instanceof Error && err.message.includes('not found')) {
        await generateProfile()
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      }
    } finally {
      setLoading(false)
    }
  }

  const generateProfile = async () => {
    try {
      setGenerating(true)
      setError('')
      setGenerationStep('Starting...')
      setCurrentSection(null)
      setCompletedSections([])

      const handleProgress = (event: ProfileProgressEvent) => {
        switch (event.type) {
          case 'status':
            setGenerationStep(event.message)
            break
          case 'section_start':
            setCurrentSection(event.sectionId)
            setGenerationStep(`Generating ${event.sectionName}...`)
            break
          case 'section_complete':
            setCompletedSections((prev) => [...prev, event.sectionId])
            break
        }
      }

      const generatedProfile = await api.generateAgentProfileStream(projectId, handleProgress)
      setProfile(generatedProfile)
      showNotification('Profile generated successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate profile')
    } finally {
      setGenerating(false)
      setGenerationStep('')
      setCurrentSection(null)
      setCompletedSections([])
    }
  }

  const handleEditSection = (sectionId: string, content: string) => {
    setEditingSection(sectionId)
    setEditContent(content)
  }

  const handleSaveSection = async () => {
    if (!editingSection) return

    try {
      setSaving(true)
      await api.updateAgentProfileSection(projectId, editingSection, editContent)

      // Update local state
      if (profile) {
        const updatedProfile = { ...profile }
        const section =
          updatedProfile.sections[
            editingSection as keyof typeof updatedProfile.sections
          ]
        section.content = editContent
        section.isEdited = true
        section.editedAt = new Date().toISOString()
        setProfile(updatedProfile)
      }

      setEditingSection(null)
      showNotification('Section saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setEditContent('')
  }

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  const sectionOrder: (keyof AgentProfileType['sections'])[] = [
    'identityRole',
    'communicationStyle',
    'contentPriorities',
    'engagementApproach',
    'keyFramings',
  ]

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Loading profile...</div>
        </div>
      </div>
    )
  }

  // Section display info for progress UI
  const sectionDisplayInfo = [
    { id: 'identityRole', name: 'Identity & Role' },
    { id: 'communicationStyle', name: 'Communication Style' },
    { id: 'contentPriorities', name: 'Content Priorities' },
    { id: 'engagementApproach', name: 'Engagement Approach' },
    { id: 'keyFramings', name: 'Key Framings' },
  ]

  if (generating) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <div className="text-gray-600 font-medium mb-6">{generationStep}</div>

          {/* Section progress list */}
          <div className="space-y-3 w-full max-w-xs">
            {sectionDisplayInfo.map((section) => {
              const isCompleted = completedSections.includes(section.id)
              const isCurrent = currentSection === section.id
              const isPending = !isCompleted && !isCurrent

              return (
                <div key={section.id} className="flex items-center gap-3">
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : isCurrent ? (
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                  )}
                  <span
                    className={
                      isCompleted
                        ? 'text-green-600 font-medium'
                        : isCurrent
                          ? 'text-blue-600 font-medium'
                          : isPending
                            ? 'text-gray-400'
                            : 'text-gray-400'
                    }
                  >
                    {section.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agent Profile</h1>
            <p className="mt-2 text-gray-600">
              Review how your AI agent will communicate with recipients. Edit any
              section to fine-tune the behavior.
            </p>
          </div>

          {/* Version History Dropdown */}
          {versionHistory && versionHistory.versions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                disabled={rollingBack}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {rollingBack ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                    Rolling back...
                  </>
                ) : (
                  <>
                    <span>v{versionHistory.currentVersion}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {showVersionDropdown && (
                <>
                  {/* Click outside to close */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowVersionDropdown(false)}
                  />
                  <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b">
                        Version History
                      </div>
                      {versionHistory.versions.map((version) => (
                        <button
                          key={version.version}
                          onClick={() => {
                            if (version.version !== versionHistory.currentVersion) {
                              handleRollback(version.version)
                            } else {
                              setShowVersionDropdown(false)
                            }
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                            version.version === versionHistory.currentVersion
                              ? 'text-blue-600 font-medium bg-blue-50'
                              : 'text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              v{version.version}
                              {version.version === versionHistory.currentVersion && ' (current)'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {version.source === 'recommendation' ? 'from feedback' : version.source}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(version.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      )}

      {/* Profile Sections */}
      {profile && (
        <div className="space-y-6">
          {sectionOrder.map((sectionKey) => {
            const section = profile.sections[sectionKey]
            const isEditing = editingSection === sectionKey

            return (
              <div
                key={sectionKey}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {section.title}
                    </h3>
                    {/* Source attribution */}
                    <p className="text-xs text-gray-400 mt-1">
                      Based on: {getSourceLabel(sectionKey)}
                    </p>
                    {section.isEdited && (
                      <span className="text-xs text-gray-400">
                        • Manually edited
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() =>
                        handleEditSection(sectionKey, section.content)
                      }
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveSection}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <ProfileSectionContent content={section.content} />
                )}

                {/* Expandable original response comparison */}
                {interviewData && !isEditing && (
                  <details className="mt-4 pt-4 border-t border-gray-100">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 select-none">
                      Show original response
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm italic">
                      <ProfileSectionContent
                        content={getOriginalResponses(sectionKey, interviewData)}
                        className="text-gray-600"
                      />
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => generateProfile()}
          disabled={generating}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Regenerate profile from interview
        </button>
      </div>

      {/* Tip */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Tip:</p>
        <p className="mt-1">
          This profile shapes how your AI agent communicates. Test it in the
          Testing Dojo, then return here to make adjustments based on what you
          observe.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onEditInterview}
          className="rounded-lg px-6 py-2 text-gray-600 hover:bg-gray-100"
        >
          Edit Interview
        </button>

        <button
          onClick={onContinueToTesting}
          className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
        >
          Continue to Testing
        </button>
      </div>
    </div>
  )
}
