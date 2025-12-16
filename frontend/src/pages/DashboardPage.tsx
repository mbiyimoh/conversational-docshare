import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { SavedThreadsSection, type SavedThread } from '../components/SavedThreadsSection'
import { SavedProfilesSection } from '../components/SavedProfilesSection'
import { StoriesOnboarding, useOnboardingState } from '../components/onboarding'
import {
  Card,
  Button,
  Input,
  Textarea,
  Badge,
  SectionLabel,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter,
  AccentText
} from '../components/ui'

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

// Empty state icon using Lucide
function EmptyFolderIcon() {
  return <FolderOpen className="mx-auto text-accent w-20 h-20" strokeWidth={1.5} />
}

export function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { isComplete: isOnboardingComplete, markComplete: markOnboardingComplete, reset: resetOnboarding } = useOnboardingState()
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="text-center max-w-md">
          <div className="text-destructive mb-4">Failed to load dashboard</div>
          <div className="text-muted text-sm mb-4">{error}</div>
          <Button onClick={loadDashboard}>
            Retry
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Onboarding overlay - shown when not complete */}
      {!isOnboardingComplete && (
        <StoriesOnboarding onComplete={markOnboardingComplete} />
      )}

      {/* Header */}
      <div className="border-b border-border bg-background-elevated">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl text-foreground">
              <AccentText>Dashboard</AccentText>
            </h1>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={resetOnboarding}>
                Take Tour
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                New Project
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* My Projects Section - first */}
        <section>
          <SectionLabel number={1} title="MY PROJECTS" />

          {!dashboardData || dashboardData.projects.length === 0 ? (
            <Card className="p-12 text-center">
              <EmptyFolderIcon />
              <h2 className="mt-6 font-display text-xl text-foreground">No projects yet</h2>
              <p className="mt-2 text-muted">
                Create your first project to start sharing documents with AI-powered conversations
              </p>
              <Button onClick={() => setShowCreateModal(true)} className="mt-6">
                Create Project
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {dashboardData.projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-all hover:border-accent/50 hover:shadow-[0_0_20px_hsl(var(--color-accent-glow))]"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <h3 className="font-display text-lg text-foreground">{project.name}</h3>
                  {project.description && (
                    <p className="mt-2 text-sm text-muted line-clamp-2">{project.description}</p>
                  )}

                  <div className="mt-4 flex gap-4 text-sm text-muted">
                    <div>
                      <span className="font-medium text-accent">{project.documentCount}</span> documents
                    </div>
                    <div>
                      <span className="font-medium text-accent">{project.conversationCount}</span> conversations
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-dim">
                      Created {formatDate(project.createdAt)}
                    </div>
                    {project.agentConfigured ? (
                      <Badge variant="success">Configured</Badge>
                    ) : (
                      <Badge variant="warning">Setup needed</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Saved Profiles Section - audience & collaborator profiles */}
        <SavedProfilesSection />

        {/* Saved Threads Section - third */}
        <SavedThreadsSection threads={dashboardData?.savedConversations ?? []} />
      </div>

      {/* Create project modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          loadDashboard()
        }}
      />
    </div>
  )
}

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
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
      setName('')
      setDescription('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalHeader>
        <ModalTitle>Create New Project</ModalTitle>
      </ModalHeader>

      <form onSubmit={handleCreate}>
        <ModalContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Input
            id="name"
            label="Project Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="My Project"
          />

          <Textarea
            id="description"
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
          />
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating || !name.trim()} isLoading={creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
