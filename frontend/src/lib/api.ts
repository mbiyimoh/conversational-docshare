import { fetchEventSource } from '@microsoft/fetch-event-source'

// Use empty string to leverage Vite's proxy in development, or VITE_API_URL for production
const API_URL = import.meta.env.VITE_API_URL || ''

// Profile types
export interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
}

export interface AgentProfile {
  sections: {
    identityRole: ProfileSection
    communicationStyle: ProfileSection
    contentPriorities: ProfileSection
    engagementApproach: ProfileSection
    keyFramings: ProfileSection
  }
  generatedAt: string
  source: 'interview' | 'manual' | 'feedback'
}

// Progress event types for SSE streaming
export type ProfileProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'section_start'; sectionId: string; sectionName: string }
  | { type: 'section_complete'; sectionId: string; content: string }
  | { type: 'complete'; profile: AgentProfile }
  | { type: 'error'; message: string }

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.token = localStorage.getItem('auth_token')
  }

  setToken(token: string | null) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  getToken(): string | null {
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'An error occurred')
    }

    return response.json()
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ user: unknown; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(email: string, password: string, name?: string) {
    return this.request<{ user: unknown; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
  }

  async getMe() {
    return this.request<{ user: unknown }>('/api/auth/me')
  }

  // Project endpoints
  async getProjects() {
    return this.request<{ projects: unknown[] }>('/api/projects')
  }

  async getProject(projectId: string) {
    return this.request<{ project: unknown }>(`/api/projects/${projectId}`)
  }

  async createProject(name: string, description?: string) {
    return this.request<{ project: unknown }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async updateProject(projectId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    return this.request<{ project: unknown }>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteProject(projectId: string) {
    return this.request<void>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    })
  }

  // Document endpoints
  async uploadDocument(projectId: string, file: File) {
    const formData = new FormData()
    formData.append('document', file)

    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseUrl}/api/projects/${projectId}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Upload failed')
    }

    return response.json()
  }

  async getDocuments(projectId: string) {
    return this.request<{ documents: unknown[] }>(`/api/projects/${projectId}/documents`)
  }

  async deleteDocument(documentId: string) {
    return this.request<void>(`/api/documents/${documentId}`, {
      method: 'DELETE',
    })
  }

  // Chat endpoints
  async createConversation(projectId: string, viewerEmail?: string, viewerName?: string) {
    return this.request<{ conversation: { id: string } }>(`/api/projects/${projectId}/conversations`, {
      method: 'POST',
      body: JSON.stringify({ viewerEmail, viewerName }),
    })
  }

  async sendMessage(conversationId: string, message: string) {
    return this.request<{ message: string }>(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  }

  async getConversationHistory(conversationId: string) {
    return this.request<{ conversation: unknown }>(`/api/conversations/${conversationId}`)
  }

  // Agent config endpoints
  async saveAgentConfig(projectId: string, interviewData: Record<string, unknown>, status?: string, completionLevel?: number) {
    return this.request<{ agentConfig: unknown }>(`/api/projects/${projectId}/agent`, {
      method: 'POST',
      body: JSON.stringify({ interviewData, status, completionLevel }),
    })
  }

  async getAgentConfig(projectId: string) {
    return this.request<{ agentConfig: unknown }>(`/api/projects/${projectId}/agent`)
  }

  // Profile endpoints
  async generateAgentProfileStream(
    projectId: string,
    onProgress: (event: ProfileProgressEvent) => void
  ): Promise<AgentProfile> {
    return new Promise((resolve, reject) => {
      let finalProfile: AgentProfile | null = null
      let hasError = false

      fetchEventSource(
        `${this.baseUrl}/api/projects/${projectId}/agent/profile/generate-stream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ force: true }),
          onmessage: (event) => {
            if (!event.data) return

            try {
              const data = JSON.parse(event.data) as ProfileProgressEvent
              onProgress(data)

              if (data.type === 'complete') {
                finalProfile = data.profile
              } else if (data.type === 'error') {
                hasError = true
                reject(new Error(data.message))
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e)
            }
          },
          onclose: () => {
            if (!hasError && finalProfile) {
              resolve(finalProfile)
            } else if (!hasError) {
              reject(new Error('Connection closed without completion'))
            }
          },
          onerror: (err) => {
            hasError = true
            reject(err instanceof Error ? err : new Error('SSE connection failed'))
          },
        }
      )
    })
  }

  async getAgentProfile(projectId: string) {
    return this.request<{
      profile: AgentProfile
      generatedAt: string
      source: string
      interviewData?: Record<string, string>
    }>(`/api/projects/${projectId}/agent/profile`)
  }

  async updateAgentProfileSection(projectId: string, sectionId: string, content: string) {
    return this.request<{ section: ProfileSection; message: string }>(
      `/api/projects/${projectId}/agent/profile`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sectionId, content }),
      }
    )
  }

  // Analytics endpoints
  async getProjectAnalytics(projectId: string) {
    return this.request<{ analytics: unknown }>(`/api/projects/${projectId}/analytics`)
  }

  async getConversationAnalytics(conversationId: string) {
    return this.request<{ conversation: unknown }>(`/api/conversations/${conversationId}/analytics`)
  }

  // Share link endpoints
  async createShareLink(projectId: string, data: { accessType: string; password?: string; allowedEmails?: string[]; expiresAt?: string }) {
    return this.request<{ shareLink: unknown }>(`/api/projects/${projectId}/share-links`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getShareLinks(projectId: string) {
    return this.request<{ shareLinks: unknown[] }>(`/api/projects/${projectId}/share-links`)
  }

  async getShareLinkBySlug(slug: string) {
    return this.request<{ shareLink: unknown; project: unknown }>(`/api/share/${slug}`)
  }

  async verifyShareLinkAccess(slug: string, credentials: { password?: string; email?: string }) {
    return this.request<{ accessGranted: boolean }>(`/api/share/${slug}/verify`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async deleteShareLink(shareLinkId: string) {
    return this.request<void>(`/api/share-links/${shareLinkId}`, {
      method: 'DELETE',
    })
  }
}

export const api = new ApiClient(API_URL)
