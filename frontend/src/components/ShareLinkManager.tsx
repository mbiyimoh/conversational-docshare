import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import type { AudienceProfile, CollaboratorProfile } from './SavedProfilesSection'
import { Card, Button, Badge, Input } from './ui'
import { Link, Copy, Trash2, Users, UserCheck, ChevronDown, ChevronUp } from 'lucide-react'

interface ShareLink {
  id: string
  slug: string
  name: string | null
  accessType: string
  currentViews: number
  createdAt: string
  expiresAt?: string
  isActive: boolean
}

interface ShareLinkManagerProps {
  projectId: string
  projectName?: string
}

/**
 * Validate custom slug format.
 * Must start/end with alphanumeric, hyphens only between words, 3-50 chars.
 */
function validateSlug(slug: string): string | null {
  if (!slug) return null // Empty is valid (will use random)
  if (slug.length < 3) return 'Slug must be at least 3 characters'
  if (slug.length > 50) return 'Slug must be 50 characters or less'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return 'Use lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)'
  }
  return null
}

export function ShareLinkManager({ projectId, projectName = 'Project' }: ShareLinkManagerProps) {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [accessType, setAccessType] = useState('password')
  const [password, setPassword] = useState('')
  const [recipientRole, setRecipientRole] = useState<'viewer' | 'collaborator'>('viewer')
  const [error, setError] = useState('')
  const [notification, setNotification] = useState<string | null>(null)

  // Link name and custom slug state
  const [linkName, setLinkName] = useState('')
  const [customSlug, setCustomSlug] = useState('')
  const [showCustomSlug, setShowCustomSlug] = useState(false)
  const [slugError, setSlugError] = useState('')

  // Profile import state
  const [audienceProfiles, setAudienceProfiles] = useState<AudienceProfile[]>([])
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [profileType, setProfileType] = useState<'audience' | 'collaborator'>('audience')

  // Get selected profile for default name generation
  const selectedProfile = useMemo(() => {
    if (!selectedProfileId) return null
    if (profileType === 'audience') {
      return audienceProfiles.find((p) => p.id === selectedProfileId)
    }
    return collaboratorProfiles.find((p) => p.id === selectedProfileId)
  }, [selectedProfileId, profileType, audienceProfiles, collaboratorProfiles])

  // Generate default name preview based on project name and selected profile
  const defaultName = useMemo(() => {
    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const profileDisplayName = selectedProfile?.name
    if (profileDisplayName) {
      return `${projectName} - ${profileDisplayName} - ${date}`
    }
    return `${projectName} - ${date}`
  }, [projectName, selectedProfile])

  useEffect(() => {
    loadShareLinks()
    loadProfiles()
  }, [projectId])

  const loadProfiles = async () => {
    try {
      const [audienceRes, collaboratorRes] = await Promise.all([
        api.getAudienceProfiles(),
        api.getCollaboratorProfiles(),
      ])
      setAudienceProfiles(audienceRes.profiles)
      setCollaboratorProfiles(collaboratorRes.profiles)
    } catch (err) {
      console.error('Failed to load profiles:', err)
    }
  }

  const handleProfileImport = (profileId: string, type: 'audience' | 'collaborator') => {
    if (!profileId) {
      setSelectedProfileId('')
      return
    }

    setSelectedProfileId(profileId)
    setProfileType(type)

    if (type === 'audience') {
      const profile = audienceProfiles.find((p) => p.id === profileId)
      if (profile) {
        // Map profile accessType to share link accessType
        const accessMap: Record<string, string> = {
          open: 'public',
          email: 'email',
          password: 'password',
          domain: 'email', // fallback to email for domain
        }
        setAccessType(accessMap[profile.accessType] || 'password')
        setRecipientRole('viewer')
      }
    } else {
      const profile = collaboratorProfiles.find((p) => p.id === profileId)
      if (profile) {
        // Collaborators use email access if they have an email
        setAccessType(profile.email ? 'email' : 'password')
        setRecipientRole('collaborator')
      }
    }
  }

  const loadShareLinks = async () => {
    try {
      setError('')
      const data = await api.getShareLinks(projectId)
      setShareLinks(data.shareLinks as ShareLink[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load share links')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (accessType === 'password' && !password) {
      setError('Password is required')
      return
    }

    // Validate custom slug if provided
    if (customSlug) {
      const slugValidationError = validateSlug(customSlug)
      if (slugValidationError) {
        setSlugError(slugValidationError)
        return
      }
    }

    setCreating(true)
    setError('')

    try {
      const requestPayload = {
        accessType,
        password: accessType === 'password' ? password : undefined,
        recipientRole,
        name: linkName || undefined,
        customSlug: customSlug || undefined,
        profileName: selectedProfile?.name,
      }

      const data = await api.createShareLink(projectId, requestPayload)

      setShareLinks([data.shareLink as ShareLink, ...shareLinks])

      // Increment usage count if a profile was used
      if (selectedProfileId) {
        try {
          if (profileType === 'audience') {
            await api.incrementAudienceProfileUsage(selectedProfileId)
          } else {
            await api.incrementCollaboratorProfileUsage(selectedProfileId)
          }
        } catch (err) {
          console.error('Failed to increment profile usage:', err)
        }
      }

      // Reset form
      setPassword('')
      setAccessType('password')
      setRecipientRole('viewer')
      setSelectedProfileId('')
      setLinkName('')
      setCustomSlug('')
      setShowCustomSlug(false)
      setSlugError('')
      showNotification('Share link created successfully')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create share link'
      // Handle slug-taken error specifically
      if (errorMessage.toLowerCase().includes('already taken')) {
        setSlugError('This URL is already taken. Try a different one.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (linkId: string) => {
    if (!confirm('Are you sure you want to delete this share link?')) {
      return
    }

    try {
      await api.deleteShareLink(linkId)
      setShareLinks(shareLinks.filter(link => link.id !== linkId))
      showNotification('Share link deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete share link')
    }
  }

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/share/${slug}`
    navigator.clipboard.writeText(url)
    showNotification('Link copied to clipboard')
  }

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading share links...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-success text-background px-4 py-2 rounded-lg shadow-lg z-50">
          {notification}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Create New Link */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl text-foreground">Create Share Link</h2>
        </div>

        <div className="space-y-4">
          {/* Profile Import Section */}
          {(audienceProfiles.length > 0 || collaboratorProfiles.length > 0) && (
            <div className="bg-background-elevated rounded-lg p-4 border border-border">
              <label className="block text-sm font-medium text-foreground mb-2">Import from Saved Profile</label>
              <div className="grid grid-cols-2 gap-3">
                {audienceProfiles.length > 0 && (
                  <div>
                    <label className="block text-xs text-dim mb-1 font-mono uppercase tracking-wide">Audience Profile</label>
                    <select
                      value={profileType === 'audience' ? selectedProfileId : ''}
                      onChange={(e) => handleProfileImport(e.target.value, 'audience')}
                      className="w-full bg-card-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    >
                      <option value="">-- Select --</option>
                      {audienceProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {collaboratorProfiles.length > 0 && (
                  <div>
                    <label className="block text-xs text-dim mb-1 font-mono uppercase tracking-wide">Collaborator Profile</label>
                    <select
                      value={profileType === 'collaborator' ? selectedProfileId : ''}
                      onChange={(e) => handleProfileImport(e.target.value, 'collaborator')}
                      className="w-full bg-card-bg border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                    >
                      <option value="">-- Select --</option>
                      {collaboratorProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.email && `(${p.email})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {selectedProfileId && (
                <p className="mt-2 text-xs text-accent">
                  Settings imported from profile. You can customize below.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Access Type</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full bg-card-bg border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="password">Password Protected</option>
              <option value="email">Email Required</option>
              <option value="public">Public (No Protection)</option>
            </select>
            <p className="mt-1 text-sm text-muted">
              {accessType === 'password' && 'Viewers must enter a password to access'}
              {accessType === 'email' && 'Viewers must provide their email address'}
              {accessType === 'public' && 'Anyone with the link can access'}
            </p>
          </div>

          {accessType === 'password' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Password</label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a password"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Recipient Role</label>
            <div className="space-y-2">
              <label className="flex items-start cursor-pointer p-3 rounded-lg border border-border hover:border-accent/50 transition-colors">
                <input
                  type="radio"
                  name="recipientRole"
                  value="viewer"
                  checked={recipientRole === 'viewer'}
                  onChange={() => setRecipientRole('viewer')}
                  className="mt-1 mr-3 accent-accent"
                />
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <div>
                    <span className="font-medium text-foreground">Viewer</span>
                    <span className="text-muted text-sm ml-2">Can chat and view documents</span>
                  </div>
                </div>
              </label>
              <label className="flex items-start cursor-pointer p-3 rounded-lg border border-border hover:border-accent/50 transition-colors">
                <input
                  type="radio"
                  name="recipientRole"
                  value="collaborator"
                  checked={recipientRole === 'collaborator'}
                  onChange={() => setRecipientRole('collaborator')}
                  className="mt-1 mr-3 accent-accent"
                />
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-accent" />
                  <div>
                    <span className="font-medium text-foreground">Collaborator</span>
                    <span className="text-muted text-sm ml-2">Can also leave comments on documents</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Link Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Link Name</label>
            <Input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder={defaultName}
              maxLength={100}
            />
            <p className="mt-1 text-sm text-muted">
              {linkName ? `Using: ${linkName}` : `Default: ${defaultName}`}
            </p>
          </div>

          {/* Custom URL (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustomSlug(!showCustomSlug)}
              className="text-sm text-accent hover:underline flex items-center gap-1"
            >
              {showCustomSlug ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide custom URL
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Customize URL
                </>
              )}
            </button>

            {showCustomSlug && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted whitespace-nowrap">{window.location.origin}/share/</span>
                  <Input
                    type="text"
                    value={customSlug}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                      setCustomSlug(val)
                      setSlugError(validateSlug(val) || '')
                    }}
                    placeholder="custom-url"
                    maxLength={50}
                    className="flex-1"
                  />
                </div>
                {slugError && <p className="text-sm text-destructive">{slugError}</p>}
                {customSlug && !slugError && (
                  <p className="text-sm text-success">
                    URL: {window.location.origin}/share/{customSlug}
                  </p>
                )}
                {!customSlug && (
                  <p className="text-sm text-muted">Leave empty for a random URL</p>
                )}
              </div>
            )}
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || (accessType === 'password' && !password) || !!slugError}
            isLoading={creating}
            className="w-full"
          >
            {creating ? 'Creating...' : 'Create Share Link'}
          </Button>
        </div>
      </Card>

      {/* Existing Links */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-xl text-foreground">Existing Links</h2>
        </div>

        {shareLinks.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted">
            No share links yet. Create one above to start sharing!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {shareLinks.map(link => (
              <div key={link.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Name as primary identifier */}
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {link.name || link.slug}
                      </p>
                      {!link.isActive && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                      <Badge variant="secondary" className="capitalize">{link.accessType}</Badge>
                    </div>
                    {/* URL below name */}
                    <code className="text-sm text-muted font-mono mt-1 block">
                      {window.location.origin}/share/{link.slug}
                    </code>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted">
                      <span>{link.currentViews} views</span>
                      <span className="text-dim">•</span>
                      <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(link.slug)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(link.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
