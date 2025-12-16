import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { DocumentUpload } from '../components/DocumentUpload'
import { AgentPage } from '../components/AgentPage'
import { AnalyticsDashboard } from '../components/AnalyticsDashboard'
import { ShareLinkManager } from '../components/ShareLinkManager'
import { TestingDojo } from '../components/TestingDojo'
import { api } from '../lib/api'
import { Button, Card, AccentText } from '../components/ui'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

const tabs = [
  { id: 'documents', label: 'Documents' },
  { id: 'agent', label: 'AI Agent' },
  { id: 'test', label: 'Test' },
  { id: 'share', label: 'Share' },
  { id: 'analytics', label: 'Analytics' },
] as const

type TabId = typeof tabs[number]['id']

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // URL-based tab state
  const activeTab = (searchParams.get('tab') || 'documents') as TabId

  const setActiveTab = (tab: TabId) => {
    setSearchParams({ tab })
  }

  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  const loadProject = async () => {
    try {
      setError('')
      const data = await api.getProject(projectId!)
      setProject(data.project as Project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-2 text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading project...
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="text-center max-w-md">
          <h2 className="font-display text-2xl text-foreground">Project Not Found</h2>
          <p className="mt-2 text-muted">{error || 'This project does not exist or you do not have access to it.'}</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background-elevated border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-muted hover:text-foreground transition-colors flex items-center gap-1"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="font-display text-3xl text-foreground mt-2">
                <AccentText>{project.name}</AccentText>
              </h1>
              {project.description && (
                <p className="mt-2 text-muted">{project.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-background-elevated border-b border-border">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`px-3 py-4 border-b-2 font-body font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div role="tabpanel" hidden={activeTab !== 'documents'}>
          {activeTab === 'documents' && <DocumentUpload projectId={projectId!} />}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'agent'}>
          {activeTab === 'agent' && (
            <AgentPage
              projectId={projectId!}
              onNavigateToTab={setActiveTab}
            />
          )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'test'}>
          {activeTab === 'test' && (
            <TestingDojo
              projectId={projectId!}
              onNavigateAway={(dest) => {
                if (dest === 'recommendations' || dest === 'interview' || dest === 'profile') {
                  // Navigate to agent/interview tab (profile view is also on agent tab)
                  setActiveTab('agent')
                }
              }}
            />
          )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'share'}>
          {activeTab === 'share' && <ShareLinkManager projectId={projectId!} />}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'analytics'}>
          {activeTab === 'analytics' && <AnalyticsDashboard projectId={projectId!} />}
        </div>
      </div>
    </div>
  )
}
