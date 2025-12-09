import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { SavedThreadsSection, type SavedThread } from '../components/SavedThreadsSection'
import { SavedProfilesSection } from '../components/SavedProfilesSection'

interface Project {
  id: string
  name: string
  description: string | null
  documentCount: number
  conversationCount: number
  agentConfigured: boolean
  createdAt: string
}

interface DashboardData {
  projects: Project[]
  savedConversations: SavedThread[]
  stats: {
    projectCount: number
    savedConversationCount: number
  }
}

export function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      setError(null)
      const data = await api.getDashboardData()
      setDashboardData({
        projects: data.projects as Project[],
        savedConversations: data.savedConversations,
        stats: data.stats,
      })
    } catch (err) {
      console.error('Failed to load dashboard:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    api.setToken(null)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">Failed to load dashboard</div>
          <div className="text-gray-600 text-sm mb-4">{error}</div>
          <button
            onClick={loadDashboard}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                New Project
              </button>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="container mx-auto px-4 py-8">
        {/* Saved Threads Section - always shown */}
        <SavedThreadsSection threads={dashboardData?.savedConversations ?? []} />

        {/* Saved Profiles Section - audience & collaborator profiles */}
        <SavedProfilesSection />

        {/* My Projects Section - always shown */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">My Projects</h2>

          {!dashboardData || dashboardData.projects.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <div className="text-6xl">📁</div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">No projects yet</h2>
              <p className="mt-2 text-gray-600">
                Create your first project to start sharing documents with AI-powered conversations
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {dashboardData.projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="cursor-pointer rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-lg"
                >
                  <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                  {project.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{project.description}</p>
                  )}

                  <div className="mt-4 flex gap-4 text-sm text-gray-500">
                    <div>
                      <span className="font-medium">{project.documentCount}</span> documents
                    </div>
                    <div>
                      <span className="font-medium">{project.conversationCount}</span> conversations
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      Created {formatDate(project.createdAt)}
                    </div>
                    {project.agentConfigured ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">
                        Configured
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
                        Setup needed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Create project modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            loadDashboard()
          }}
        />
      )}
    </div>
  )
}

interface CreateProjectModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      await api.createProject(name, description)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold">Create New Project</h2>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          {error && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Project Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
