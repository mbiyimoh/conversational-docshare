import { useState, useEffect } from 'react'
import { api, AgentProfile as AgentProfileType, ProfileProgressEvent, VersionHistoryResponse } from '../lib/api'
import { ProfileSectionContent } from './ProfileSectionContent'
import { SourceMaterialModal } from './SourceMaterialModal'
import { Card, Button, Textarea } from './ui'

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
  onContinueToTesting?: () => void
  onEditInterview?: () => void
  onStartOver?: () => void
  onNavigateToTest?: () => void
}

export function AgentProfile({
  projectId,
  interviewData,
  onContinueToTesting,
  onEditInterview,
  onStartOver,
  onNavigateToTest,
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

  // Source material and refinement state
  const [showSourceMaterial, setShowSourceMaterial] = useState(false)
  const [showRefinement, setShowRefinement] = useState(false)
  const [refinementContext, setRefinementContext] = useState('')
  const [refining, setRefining] = useState(false)

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

  const handleRefineProfile = async () => {
    if (!refinementContext.trim()) return

    try {
      setRefining(true)
      setError('')

      const configResponse = await api.getAgentConfig(projectId)
      const config = configResponse.agentConfig as { rawBrainDump?: string }

      const response = await api.synthesizeAgentProfile(
        projectId,
        config.rawBrainDump || '',
        refinementContext
      )

      await api.saveAgentProfileV2(projectId, {
        profile: response.profile,
        rawInput: config.rawBrainDump || '',
        lightAreas: response.lightAreas,
        synthesisMode: response.synthesisMode
      })

      await loadProfile()
      await loadVersionHistory()
      setShowRefinement(false)
      setRefinementContext('')
      showNotification('Profile updated successfully')
    } catch (err) {
      // Show error but preserve user input
      setError(err instanceof Error ? err.message : 'Failed to refine profile. Please try again.')
    } finally {
      setRefining(false)
    }
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
          <div className="flex items-center gap-2 text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading profile...
          </div>
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
          <div className="animate-spin h-8 w-8 border-4 border-accent border-t-transparent rounded-full mb-4" />
          <div className="text-muted font-medium mb-6">{generationStep}</div>

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
                      className="h-5 w-5 text-success"
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
                    <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-border" />
                  )}
                  <span
                    className={
                      isCompleted
                        ? 'text-success font-medium'
                        : isCurrent
                          ? 'text-accent font-medium'
                          : isPending
                            ? 'text-dim'
                            : 'text-dim'
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
        <div className="fixed top-4 right-4 bg-success text-background px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground">AI Agent Profile</h1>
            <p className="mt-2 text-muted">
              Review how your AI agent will communicate with recipients. Edit any
              section to fine-tune the behavior.
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Source Material Button */}
            <button
              onClick={() => setShowSourceMaterial(true)}
              className="p-2 text-dim hover:text-muted transition-colors"
              title="View source material"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {/* Version History Dropdown */}
            {versionHistory && versionHistory.versions.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                  disabled={rollingBack}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-card-bg disabled:opacity-50 text-foreground transition-colors"
                >
                {rollingBack ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full" />
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
                  <div className="absolute right-0 mt-1 w-56 bg-card-bg border border-border rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <div className="px-3 py-2 text-xs font-medium text-dim uppercase tracking-wide border-b border-border font-mono">
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
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                            version.version === versionHistory.currentVersion
                              ? 'text-accent font-medium bg-accent/10'
                              : 'text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              v{version.version}
                              {version.version === versionHistory.currentVersion && ' (current)'}
                            </span>
                            <span className="text-xs text-dim">
                              {version.source === 'recommendation' ? 'from feedback' : version.source}
                            </span>
                          </div>
                          <div className="text-xs text-dim mt-0.5">
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
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">{error}</div>
      )}

      {/* Profile Sections */}
      {profile && (
        <div className="space-y-6">
          {sectionOrder.map((sectionKey) => {
            const section = profile.sections[sectionKey]
            const isEditing = editingSection === sectionKey

            return (
              <Card key={sectionKey} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-foreground">
                      {section.title}
                    </h3>
                    {/* Source attribution */}
                    <p className="text-xs text-dim mt-1">
                      Based on: {getSourceLabel(sectionKey)}
                    </p>
                    {section.isEdited && (
                      <span className="text-xs text-dim">
                        • Manually edited
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleEditSection(sectionKey, section.content)
                      }
                    >
                      Edit
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <div>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button variant="ghost" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveSection}
                        disabled={saving}
                        isLoading={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ProfileSectionContent content={section.content} />
                )}

                {/* Expandable original response comparison */}
                {interviewData && !isEditing && (
                  <details className="mt-4 pt-4 border-t border-border">
                    <summary className="text-xs text-accent cursor-pointer hover:text-accent/80 select-none transition-colors">
                      Show original response
                    </summary>
                    <div className="mt-2 p-3 bg-background-elevated rounded-lg text-sm italic">
                      <ProfileSectionContent
                        content={getOriginalResponses(sectionKey, interviewData)}
                        className="text-muted"
                      />
                    </div>
                  </details>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => generateProfile()}
          disabled={generating}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Regenerate profile from interview
        </button>
      </div>

      {/* Tip */}
      <Card className="mt-6 border-accent/30" glow>
        <p className="font-display text-foreground">Tip:</p>
        <p className="mt-1 text-sm text-muted">
          This profile shapes how your AI agent communicates. Test it in the
          Testing Dojo, then return here to make adjustments based on what you
          observe.
        </p>
      </Card>

      {/* Action Buttons */}
      <div className="mt-8 space-y-4">
        {/* Refinement Section */}
        {showRefinement ? (
          <Card className="p-4">
            <h3 className="font-display text-foreground mb-2">Refine Your Profile</h3>
            <p className="text-sm text-muted mb-3">
              Add context to update your agent's behavior. This will regenerate the profile.
            </p>
            <Textarea
              value={refinementContext}
              onChange={(e) => setRefinementContext(e.target.value)}
              placeholder="e.g., Be more formal with executives. Emphasize sustainability initiatives..."
              rows={3}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowRefinement(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleRefineProfile}
                disabled={!refinementContext.trim() || refining}
                isLoading={refining}
              >
                Regenerate Profile
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={() => setShowRefinement(true)}>
                Refine Profile
              </Button>
              {onEditInterview && (
                <Button variant="ghost" onClick={onEditInterview}>
                  Edit Interview
                </Button>
              )}
              {onStartOver && (
                <button
                  onClick={onStartOver}
                  className="text-sm text-dim hover:text-muted transition-colors"
                >
                  Start Over
                </button>
              )}
            </div>
            <Button onClick={onNavigateToTest || onContinueToTesting}>
              Continue to Testing
            </Button>
          </div>
        )}
      </div>

      {/* Source Material Modal */}
      <SourceMaterialModal
        projectId={projectId}
        isOpen={showSourceMaterial}
        onClose={() => setShowSourceMaterial(false)}
      />
    </div>
  )
}
