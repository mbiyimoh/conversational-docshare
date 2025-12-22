import { useState, useEffect } from 'react'
import { Users, Handshake } from 'lucide-react'
import { api } from '../lib/api'
import { AudienceProfileAIModal } from './AudienceProfileAIModal'
import { CollaboratorProfileAIModal } from './CollaboratorProfileAIModal'
import {
  Card,
  Button,
  Badge,
  SectionLabel,
  Input,
  Textarea,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter
} from './ui'

// Empty state icons using Lucide
function EmptyAudienceIcon() {
  return <Users className="mx-auto text-accent w-20 h-20" strokeWidth={1.5} />
}

function EmptyCollaboratorIcon() {
  return <Handshake className="mx-auto text-accent w-20 h-20" strokeWidth={1.5} />
}

// Types matching API responses
export interface AudienceProfile {
  id: string
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: string
  timesUsed: number
  createdAt: string
  updatedAt: string
}

export interface CollaboratorProfile {
  id: string
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: string | null
  timesUsed: number
  createdAt: string
  updatedAt: string
}

type ProfileTab = 'audience' | 'collaborator'

export function SavedProfilesSection() {
  const [activeTab, setActiveTab] = useState<ProfileTab>('audience')
  const [audienceProfiles, setAudienceProfiles] = useState<AudienceProfile[]>([])
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal state
  const [showAudienceModal, setShowAudienceModal] = useState(false)
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [editingAudienceProfile, setEditingAudienceProfile] = useState<AudienceProfile | null>(null)
  const [editingCollaboratorProfile, setEditingCollaboratorProfile] = useState<CollaboratorProfile | null>(null)
  const [audienceModalMode, setAudienceModalMode] = useState<'ai' | 'manual'>('ai')
  const [collaboratorModalMode, setCollaboratorModalMode] = useState<'ai' | 'manual'>('ai')

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      setLoading(true)
      setError(null)
      const [audienceRes, collaboratorRes] = await Promise.all([
        api.getAudienceProfiles(),
        api.getCollaboratorProfiles(),
      ])
      setAudienceProfiles(audienceRes.profiles)
      setCollaboratorProfiles(collaboratorRes.profiles)
    } catch (err) {
      console.error('Failed to load profiles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAudienceProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this audience profile?')) return
    try {
      await api.deleteAudienceProfile(id)
      setAudienceProfiles((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Failed to delete profile:', err)
    }
  }

  const handleDeleteCollaboratorProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this collaborator profile?')) return
    try {
      await api.deleteCollaboratorProfile(id)
      setCollaboratorProfiles((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      console.error('Failed to delete profile:', err)
    }
  }

  const handleAudienceProfileSaved = (profile: AudienceProfile) => {
    if (editingAudienceProfile) {
      setAudienceProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)))
    } else {
      setAudienceProfiles((prev) => [profile, ...prev])
    }
    setShowAudienceModal(false)
    setEditingAudienceProfile(null)
  }

  const handleCollaboratorProfileSaved = (profile: CollaboratorProfile) => {
    if (editingCollaboratorProfile) {
      setCollaboratorProfiles((prev) => prev.map((p) => (p.id === profile.id ? profile : p)))
    } else {
      setCollaboratorProfiles((prev) => [profile, ...prev])
    }
    setShowCollaboratorModal(false)
    setEditingCollaboratorProfile(null)
  }

  if (loading) {
    return (
      <section className="mb-8" data-testid="saved-profiles-section">
        <SectionLabel number={2} title="SAVED RECIPIENT PROFILES" />
        <Card className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading profiles...
          </div>
        </Card>
      </section>
    )
  }

  if (error) {
    return (
      <section className="mb-8" data-testid="saved-profiles-section">
        <SectionLabel number={2} title="SAVED RECIPIENT PROFILES" />
        <Card className="p-8 text-center">
          <span className="text-destructive">{error}</span>
          <button onClick={loadProfiles} className="ml-2 text-accent underline hover:no-underline">
            Retry
          </button>
        </Card>
      </section>
    )
  }

  return (
    <section className="mb-8" data-testid="saved-profiles-section">
      <div className="flex items-center justify-between mb-4">
        <SectionLabel number={2} title="SAVED RECIPIENT PROFILES" className="mb-0" />
        <Button
          size="sm"
          onClick={() => {
            if (activeTab === 'audience') {
              setEditingAudienceProfile(null)
              setShowAudienceModal(true)
            } else {
              setEditingCollaboratorProfile(null)
              setShowCollaboratorModal(true)
            }
          }}
        >
          + New {activeTab === 'audience' ? 'Audience' : 'Collaborator'} Profile
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('audience')}
          className={`px-4 py-2 rounded-lg text-sm font-medium font-body transition-colors ${
            activeTab === 'audience'
              ? 'bg-accent/10 text-accent border border-accent/20'
              : 'bg-card-bg text-muted border border-border hover:border-accent/30'
          }`}
        >
          Audience Profiles ({audienceProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab('collaborator')}
          className={`px-4 py-2 rounded-lg text-sm font-medium font-body transition-colors ${
            activeTab === 'collaborator'
              ? 'bg-accent/10 text-accent border border-accent/20'
              : 'bg-card-bg text-muted border border-border hover:border-accent/30'
          }`}
        >
          Collaborator Profiles ({collaboratorProfiles.length})
        </button>
      </div>

      {/* Audience Profiles Tab */}
      {activeTab === 'audience' && (
        <>
          {audienceProfiles.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyAudienceIcon />
              <h3 className="mt-6 font-display text-xl text-foreground">No audience profiles yet</h3>
              <p className="mt-2 text-muted">
                Save reusable audience settings (board members, investors, etc.) to quickly configure share links.
              </p>
              <Button
                onClick={() => {
                  setEditingAudienceProfile(null)
                  setShowAudienceModal(true)
                }}
                className="mt-6"
              >
                Create Audience Profile
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {audienceProfiles.map((profile) => (
                <Card
                  key={profile.id}
                  className="transition-all hover:border-accent/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-display text-foreground truncate">{profile.name}</div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingAudienceProfile(profile)
                          setShowAudienceModal(true)
                        }}
                        className="p-1 text-muted hover:text-accent transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAudienceProfile(profile.id)}
                        className="p-1 text-muted hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {profile.description && (
                    <p className="text-sm text-muted mb-2 line-clamp-2">{profile.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted">
                    <Badge variant="secondary">{profile.accessType}</Badge>
                    <span>Used <span className="text-accent">{profile.timesUsed}</span>x</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Collaborator Profiles Tab */}
      {activeTab === 'collaborator' && (
        <>
          {collaboratorProfiles.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyCollaboratorIcon />
              <h3 className="mt-6 font-display text-xl text-foreground">No collaborator profiles yet</h3>
              <p className="mt-2 text-muted">
                Save named contacts with preferences to quickly configure share links for collaborators.
              </p>
              <Button
                onClick={() => {
                  setEditingCollaboratorProfile(null)
                  setShowCollaboratorModal(true)
                }}
                className="mt-6"
              >
                Create Collaborator Profile
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collaboratorProfiles.map((profile) => (
                <Card
                  key={profile.id}
                  className="transition-all hover:border-accent/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-display text-foreground truncate">{profile.name}</div>
                      {profile.email && (
                        <div className="text-sm text-muted truncate">{profile.email}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingCollaboratorProfile(profile)
                          setShowCollaboratorModal(true)
                        }}
                        className="p-1 text-muted hover:text-accent transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCollaboratorProfile(profile.id)}
                        className="p-1 text-muted hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {profile.description && (
                    <p className="text-sm text-muted mb-2 line-clamp-2">{profile.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {profile.feedbackStyle && (
                      <Badge variant="secondary">{profile.feedbackStyle}</Badge>
                    )}
                    {profile.expertiseAreas.length > 0 && (
                      <Badge variant="info">
                        {profile.expertiseAreas.length} expertise areas
                      </Badge>
                    )}
                    <span>Used <span className="text-accent">{profile.timesUsed}</span>x</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Audience Profile Modal */}
      {showAudienceModal && (
        audienceModalMode === 'ai' ? (
          <AudienceProfileAIModal
            profile={editingAudienceProfile}
            onClose={() => {
              setShowAudienceModal(false)
              setEditingAudienceProfile(null)
              setAudienceModalMode('ai')
            }}
            onSaved={handleAudienceProfileSaved}
            onSwitchToManual={() => setAudienceModalMode('manual')}
          />
        ) : (
          <AudienceProfileModal
            profile={editingAudienceProfile}
            onClose={() => {
              setShowAudienceModal(false)
              setEditingAudienceProfile(null)
              setAudienceModalMode('ai')
            }}
            onSaved={handleAudienceProfileSaved}
          />
        )
      )}

      {/* Collaborator Profile Modal */}
      {showCollaboratorModal && (
        collaboratorModalMode === 'ai' ? (
          <CollaboratorProfileAIModal
            profile={editingCollaboratorProfile}
            onClose={() => {
              setShowCollaboratorModal(false)
              setEditingCollaboratorProfile(null)
              setCollaboratorModalMode('ai')
            }}
            onSaved={handleCollaboratorProfileSaved}
            onSwitchToManual={() => setCollaboratorModalMode('manual')}
          />
        ) : (
          <CollaboratorProfileModal
            profile={editingCollaboratorProfile}
            onClose={() => {
              setShowCollaboratorModal(false)
              setEditingCollaboratorProfile(null)
              setCollaboratorModalMode('ai')
            }}
            onSaved={handleCollaboratorProfileSaved}
          />
        )
      )}
    </section>
  )
}

// ============================================================================
// Audience Profile Modal
// ============================================================================

interface AudienceProfileModalProps {
  profile: AudienceProfile | null
  onClose: () => void
  onSaved: (profile: AudienceProfile) => void
}

function AudienceProfileModal({ profile, onClose, onSaved }: AudienceProfileModalProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [audienceDescription, setAudienceDescription] = useState(profile?.audienceDescription ?? '')
  const [communicationStyle, setCommunicationStyle] = useState(profile?.communicationStyle ?? '')
  const [topicsEmphasis, setTopicsEmphasis] = useState(profile?.topicsEmphasis ?? '')
  const [accessType, setAccessType] = useState(profile?.accessType ?? 'password')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!profile

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        audienceDescription: audienceDescription.trim() || undefined,
        communicationStyle: communicationStyle.trim() || undefined,
        topicsEmphasis: topicsEmphasis.trim() || undefined,
        accessType,
      }

      let result
      if (isEditing) {
        result = await api.updateAudienceProfile(profile.id, data)
      } else {
        result = await api.createAudienceProfile(data)
      }
      onSaved(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>{isEditing ? 'Edit Audience Profile' : 'Create Audience Profile'}</ModalTitle>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            id="ap-name"
            label="Profile Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Board Members, Series A Investors"
          />

          <Input
            id="ap-desc"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this audience type"
          />

          <Textarea
            id="ap-audience"
            label="Audience Description"
            value={audienceDescription}
            onChange={(e) => setAudienceDescription(e.target.value)}
            rows={2}
            placeholder="Who is this audience? What do they care about?"
          />

          <Textarea
            id="ap-comms"
            label="Communication Style"
            value={communicationStyle}
            onChange={(e) => setCommunicationStyle(e.target.value)}
            rows={2}
            placeholder="How should the AI communicate with this audience?"
          />

          <Textarea
            id="ap-topics"
            label="Topics to Emphasize"
            value={topicsEmphasis}
            onChange={(e) => setTopicsEmphasis(e.target.value)}
            rows={2}
            placeholder="What topics should be highlighted for this audience?"
          />

          <div>
            <label htmlFor="ap-access" className="block text-sm font-medium font-body text-muted mb-1.5">
              Default Access Type
            </label>
            <select
              id="ap-access"
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-elevated px-3 py-2 font-body text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="open">Open (no verification)</option>
              <option value="email">Email required</option>
              <option value="password">Password protected</option>
              <option value="domain">Domain whitelist</option>
            </select>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()} isLoading={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

// ============================================================================
// Collaborator Profile Modal
// ============================================================================

interface CollaboratorProfileModalProps {
  profile: CollaboratorProfile | null
  onClose: () => void
  onSaved: (profile: CollaboratorProfile) => void
}

function CollaboratorProfileModal({ profile, onClose, onSaved }: CollaboratorProfileModalProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [communicationNotes, setCommunicationNotes] = useState(profile?.communicationNotes ?? '')
  const [expertiseAreas, setExpertiseAreas] = useState(profile?.expertiseAreas?.join(', ') ?? '')
  const [feedbackStyle, setFeedbackStyle] = useState(profile?.feedbackStyle ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEditing = !!profile

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setSaving(true)
    setError('')

    try {
      const data = {
        name: name.trim(),
        email: email.trim() || undefined,
        description: description.trim() || undefined,
        communicationNotes: communicationNotes.trim() || undefined,
        expertiseAreas: expertiseAreas
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        feedbackStyle: feedbackStyle || undefined,
      }

      let result
      if (isEditing) {
        result = await api.updateCollaboratorProfile(profile.id, data)
      } else {
        result = await api.createCollaboratorProfile(data)
      }
      onSaved(result.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>{isEditing ? 'Edit Collaborator Profile' : 'Create Collaborator Profile'}</ModalTitle>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalContent className="space-y-4 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            id="cp-name"
            label="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., John Smith"
          />

          <Input
            id="cp-email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
          />

          <Input
            id="cp-desc"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this collaborator"
          />

          <Textarea
            id="cp-comms"
            label="Communication Notes"
            value={communicationNotes}
            onChange={(e) => setCommunicationNotes(e.target.value)}
            rows={2}
            placeholder="How should the AI communicate with this person?"
          />

          <div>
            <Input
              id="cp-expertise"
              label="Expertise Areas"
              value={expertiseAreas}
              onChange={(e) => setExpertiseAreas(e.target.value)}
              placeholder="Finance, Legal, Marketing (comma-separated)"
            />
            <p className="mt-1 text-xs text-dim">Comma-separated list of expertise areas</p>
          </div>

          <div>
            <label htmlFor="cp-feedback" className="block text-sm font-medium font-body text-muted mb-1.5">
              Preferred Feedback Style
            </label>
            <select
              id="cp-feedback"
              value={feedbackStyle}
              onChange={(e) => setFeedbackStyle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background-elevated px-3 py-2 font-body text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="">-- Select style --</option>
              <option value="direct">Direct</option>
              <option value="gentle">Gentle</option>
              <option value="detailed">Detailed</option>
              <option value="high-level">High-level</option>
            </select>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !name.trim()} isLoading={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
