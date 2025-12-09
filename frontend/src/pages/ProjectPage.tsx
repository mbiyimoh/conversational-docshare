import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { DocumentUpload } from '../components/DocumentUpload'
import { AgentInterview } from '../components/AgentInterview'
import { AnalyticsDashboard } from '../components/AnalyticsDashboard'
import { ShareLinkManager } from '../components/ShareLinkManager'
import { TestingDojo } from '../components/TestingDojo'
import { api } from '../lib/api'

interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading project...</div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Project Not Found</h2>
          <p className="mt-2 text-gray-600">{error || 'This project does not exist or you do not have access to it.'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← Back
                </button>
              </div>
              <h1 className="text-3xl font-bold mt-2">{project.name}</h1>
              {project.description && (
                <p className="mt-2 text-gray-600">{project.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8" role="tablist">
            <button
              onClick={() => setActiveTab('documents')}
              role="tab"
              aria-selected={activeTab === 'documents'}
              className={`px-3 py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'documents'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              role="tab"
              aria-selected={activeTab === 'agent'}
              className={`px-3 py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'agent'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              AI Agent
            </button>
            <button
              onClick={() => setActiveTab('test')}
              role="tab"
              aria-selected={activeTab === 'test'}
              className={`px-3 py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'test'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Test
            </button>
            <button
              onClick={() => setActiveTab('share')}
              role="tab"
              aria-selected={activeTab === 'share'}
              className={`px-3 py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'share'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Share
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              role="tab"
              aria-selected={activeTab === 'analytics'}
              className={`px-3 py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
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
            <AgentInterview
              projectId={projectId!}
              onComplete={(action) => {
                if (action === 'navigate-to-share') {
                  setActiveTab('share')
                }
              }}
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
