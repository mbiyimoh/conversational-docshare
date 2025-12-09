import { useState, useEffect } from 'react'
import { api } from '../lib/api'

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
        <h2 className="text-xl font-bold text-gray-900 mb-4">Saved Profiles</h2>
        <div className="rounded-lg bg-white p-8 shadow text-center text-gray-500">
          Loading profiles...
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="mb-8" data-testid="saved-profiles-section">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Saved Profiles</h2>
        <div className="rounded-lg bg-red-50 p-8 shadow text-center text-red-600">
          {error}
          <button onClick={loadProfiles} className="ml-2 underline">
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-8" data-testid="saved-profiles-section">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Saved Profiles</h2>
        <button
          onClick={() => {
            if (activeTab === 'audience') {
              setEditingAudienceProfile(null)
              setShowAudienceModal(true)
            } else {
              setEditingCollaboratorProfile(null)
              setShowCollaboratorModal(true)
            }
          }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          + New {activeTab === 'audience' ? 'Audience' : 'Collaborator'} Profile
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('audience')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'audience'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Audience Profiles ({audienceProfiles.length})
        </button>
        <button
          onClick={() => setActiveTab('collaborator')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'collaborator'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Collaborator Profiles ({collaboratorProfiles.length})
        </button>
      </div>

      {/* Audience Profiles Tab */}
      {activeTab === 'audience' && (
        <>
          {audienceProfiles.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <div className="text-6xl">👥</div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">No audience profiles yet</h3>
              <p className="mt-2 text-gray-600">
                Save reusable audience settings (board members, investors, etc.) to quickly configure share links.
              </p>
              <button
                onClick={() => {
                  setEditingAudienceProfile(null)
                  setShowAudienceModal(true)
                }}
                className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              >
                Create Audience Profile
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {audienceProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-gray-900 truncate">{profile.name}</div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingAudienceProfile(profile)
                          setShowAudienceModal(true)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAudienceProfile(profile.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {profile.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{profile.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="px-2 py-0.5 rounded bg-gray-100">{profile.accessType}</span>
                    <span>Used {profile.timesUsed}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Collaborator Profiles Tab */}
      {activeTab === 'collaborator' && (
        <>
          {collaboratorProfiles.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <div className="text-6xl">🤝</div>
              <h3 className="mt-4 text-xl font-semibold text-gray-900">No collaborator profiles yet</h3>
              <p className="mt-2 text-gray-600">
                Save named contacts with preferences to quickly configure share links for collaborators.
              </p>
              <button
                onClick={() => {
                  setEditingCollaboratorProfile(null)
                  setShowCollaboratorModal(true)
                }}
                className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              >
                Create Collaborator Profile
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collaboratorProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-white rounded-lg p-4 shadow border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-medium text-gray-900 truncate">{profile.name}</div>
                      {profile.email && (
                        <div className="text-sm text-gray-500 truncate">{profile.email}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingCollaboratorProfile(profile)
                          setShowCollaboratorModal(true)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteCollaboratorProfile(profile.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {profile.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{profile.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {profile.feedbackStyle && (
                      <span className="px-2 py-0.5 rounded bg-gray-100">{profile.feedbackStyle}</span>
                    )}
                    {profile.expertiseAreas.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {profile.expertiseAreas.length} expertise areas
                      </span>
                    )}
                    <span>Used {profile.timesUsed}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Audience Profile Modal */}
      {showAudienceModal && (
        <AudienceProfileModal
          profile={editingAudienceProfile}
          onClose={() => {
            setShowAudienceModal(false)
            setEditingAudienceProfile(null)
          }}
          onSaved={handleAudienceProfileSaved}
        />
      )}

      {/* Collaborator Profile Modal */}
      {showCollaboratorModal && (
        <CollaboratorProfileModal
          profile={editingCollaboratorProfile}
          onClose={() => {
            setShowCollaboratorModal(false)
            setEditingCollaboratorProfile(null)
          }}
          onSaved={handleCollaboratorProfileSaved}
        />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Edit Audience Profile' : 'Create Audience Profile'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label htmlFor="ap-name" className="block text-sm font-medium text-gray-700">
              Profile Name *
            </label>
            <input
              id="ap-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Board Members, Series A Investors"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="ap-desc" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="ap-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this audience type"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="ap-audience" className="block text-sm font-medium text-gray-700">
              Audience Description
            </label>
            <textarea
              id="ap-audience"
              value={audienceDescription}
              onChange={(e) => setAudienceDescription(e.target.value)}
              rows={2}
              placeholder="Who is this audience? What do they care about?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="ap-comms" className="block text-sm font-medium text-gray-700">
              Communication Style
            </label>
            <textarea
              id="ap-comms"
              value={communicationStyle}
              onChange={(e) => setCommunicationStyle(e.target.value)}
              rows={2}
              placeholder="How should the AI communicate with this audience?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="ap-topics" className="block text-sm font-medium text-gray-700">
              Topics to Emphasize
            </label>
            <textarea
              id="ap-topics"
              value={topicsEmphasis}
              onChange={(e) => setTopicsEmphasis(e.target.value)}
              rows={2}
              placeholder="What topics should be highlighted for this audience?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="ap-access" className="block text-sm font-medium text-gray-700">
              Default Access Type
            </label>
            <select
              id="ap-access"
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="open">Open (no verification)</option>
              <option value="email">Email required</option>
              <option value="password">Password protected</option>
              <option value="domain">Domain whitelist</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Edit Collaborator Profile' : 'Create Collaborator Profile'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label htmlFor="cp-name" className="block text-sm font-medium text-gray-700">
              Name *
            </label>
            <input
              id="cp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., John Smith"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cp-email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="cp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cp-desc" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="cp-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this collaborator"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cp-comms" className="block text-sm font-medium text-gray-700">
              Communication Notes
            </label>
            <textarea
              id="cp-comms"
              value={communicationNotes}
              onChange={(e) => setCommunicationNotes(e.target.value)}
              rows={2}
              placeholder="How should the AI communicate with this person?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="cp-expertise" className="block text-sm font-medium text-gray-700">
              Expertise Areas
            </label>
            <input
              id="cp-expertise"
              type="text"
              value={expertiseAreas}
              onChange={(e) => setExpertiseAreas(e.target.value)}
              placeholder="Finance, Legal, Marketing (comma-separated)"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">Comma-separated list of expertise areas</p>
          </div>

          <div>
            <label htmlFor="cp-feedback" className="block text-sm font-medium text-gray-700">
              Preferred Feedback Style
            </label>
            <select
              id="cp-feedback"
              value={feedbackStyle}
              onChange={(e) => setFeedbackStyle(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">-- Select style --</option>
              <option value="direct">Direct</option>
              <option value="gentle">Gentle</option>
              <option value="detailed">Detailed</option>
              <option value="high-level">High-level</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
