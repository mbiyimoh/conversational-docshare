import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface ShareLink {
  id: string
  slug: string
  accessType: string
  currentViews: number
  createdAt: string
  expiresAt?: string
  isActive: boolean
}

interface ShareLinkManagerProps {
  projectId: string
}

export function ShareLinkManager({ projectId }: ShareLinkManagerProps) {
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [accessType, setAccessType] = useState('password')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadShareLinks()
  }, [projectId])

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

    setCreating(true)
    setError('')

    try {
      const data = await api.createShareLink(projectId, {
        accessType,
        password: accessType === 'password' ? password : undefined,
      })
      setShareLinks([...shareLinks, data.shareLink as ShareLink])
      setPassword('')
      setAccessType('password')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link')
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete share link')
    }
  }

  const copyToClipboard = (slug: string) => {
    const url = `${window.location.origin}/share/${slug}`
    navigator.clipboard.writeText(url)
    alert('Link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-500">Loading share links...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Create New Link */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Create Share Link</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Access Type</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="password">Password Protected</option>
              <option value="email">Email Required</option>
              <option value="public">Public (No Protection)</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {accessType === 'password' && 'Viewers must enter a password to access'}
              {accessType === 'email' && 'Viewers must provide their email address'}
              {accessType === 'public' && 'Anyone with the link can access'}
            </p>
          </div>

          {accessType === 'password' && (
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a password"
              />
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || (accessType === 'password' && !password)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Share Link'}
          </button>
        </div>
      </div>

      {/* Existing Links */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-bold">Existing Links</h2>
        </div>

        {shareLinks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            No share links yet. Create one above to start sharing!
          </div>
        ) : (
          <div className="divide-y">
            {shareLinks.map(link => (
              <div key={link.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {window.location.origin}/share/{link.slug}
                      </code>
                      {!link.isActive && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                      <span className="capitalize">{link.accessType}</span>
                      <span>•</span>
                      <span>{link.currentViews} views</span>
                      <span>•</span>
                      <span>Created {new Date(link.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => copyToClipboard(link.slug)}
                      className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      Copy
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
