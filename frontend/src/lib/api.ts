import { fetchEventSource } from '@microsoft/fetch-event-source'
import type {
  RecommendationResponse,
  ApplyAllResponse,
  RollbackResponse,
  VersionHistoryResponse,
} from '../types/recommendation'

// Re-export types for external use
export type { VersionHistoryResponse } from '../types/recommendation'

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

// V2 Profile types (for braindump synthesis)
export interface AgentProfileFieldV2 {
  id: string
  title: string
  content: string
  confidence: 'EXPLICIT' | 'INFERRED' | 'ASSUMED'
  isEdited: boolean
  editedAt?: string
}

export interface AgentProfileV2 {
  fields: {
    agentIdentity: AgentProfileFieldV2
    domainExpertise: AgentProfileFieldV2
    targetAudience: AgentProfileFieldV2
    toneAndVoice: AgentProfileFieldV2
    languagePatterns: AgentProfileFieldV2
    adaptationRules: AgentProfileFieldV2
    keyTopics: AgentProfileFieldV2
    avoidanceAreas: AgentProfileFieldV2
    examplePreferences: AgentProfileFieldV2
    proactiveGuidance: AgentProfileFieldV2
    framingStrategies: AgentProfileFieldV2
    successCriteria: AgentProfileFieldV2
  }
  generatedAt: string
  source: 'braindump' | 'interview' | 'manual'
  version: 2
}

export interface BrainDumpSynthesisResponse {
  success: boolean
  profile: AgentProfileV2
  lightAreas: string[]
  overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  rawInput: string
  synthesisMode: 'voice' | 'text'
}

// Synthesized profile types
export interface SynthesizedAudienceProfile {
  name: string
  description: string | null
  audienceDescription: string | null
  communicationStyle: string | null
  topicsEmphasis: string | null
  accessType: 'open' | 'email' | 'password' | 'domain'
}

export interface SynthesizedCollaboratorProfile {
  name: string
  email: string | null
  description: string | null
  communicationNotes: string | null
  expertiseAreas: string[]
  feedbackStyle: 'direct' | 'gentle' | 'detailed' | 'high-level' | null
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

    // Handle 204 No Content responses (e.g., DELETE operations)
    if (response.status === 204) {
      return undefined as T
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
    // Always sync token from localStorage before upload to handle HMR/module reload edge cases
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken && !this.token) {
      this.token = storedToken
    }

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
      const errorText = await response.text()
      let error
      try {
        error = JSON.parse(errorText)
      } catch {
        throw new Error(`Upload failed: ${errorText}`)
      }
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

  async retryDocument(documentId: string) {
    return this.request<{ message: string }>(`/api/documents/${documentId}/retry`, {
      method: 'POST',
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
  async createShareLink(projectId: string, data: {
    accessType: string
    password?: string
    allowedEmails?: string[]
    expiresAt?: string
    recipientRole?: 'viewer' | 'collaborator'
  }) {
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
    return this.request<{
      accessGranted: boolean
      recipientRole?: 'viewer' | 'collaborator'
    }>(`/api/share/${slug}/verify`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async deleteShareLink(shareLinkId: string) {
    return this.request<void>(`/api/share-links/${shareLinkId}`, {
      method: 'DELETE',
    })
  }

  // Share link document endpoints (public, for viewers)
  async getShareLinkDocuments(slug: string) {
    return this.request<{
      documents: Array<{
        id: string
        filename: string
        title: string
        mimeType: string
        outline: Array<{ id: string; title: string; level: number; position: number }>
        status: string
      }>
    }>(`/api/share/${slug}/documents`)
  }

  async getShareLinkDocument(slug: string, documentId: string) {
    return this.request<{
      document: {
        id: string
        filename: string
        title: string
        mimeType: string
        outline: Array<{ id: string; title: string; level: number; position: number }>
        status: string
      }
    }>(`/api/share/${slug}/documents/${documentId}`)
  }

  async getShareLinkDocumentChunks(slug: string, documentId: string) {
    return this.request<{
      chunks: Array<{
        id: string
        content: string
        sectionId: string | null
        sectionTitle: string | null
        chunkIndex: number
      }>
    }>(`/api/share/${slug}/documents/${documentId}/chunks`)
  }

  // ============================================================================
  // Test Session endpoints (Testing Dojo)
  // ============================================================================

  async getTestSessions(projectId: string) {
    return this.request<{
      sessions: Array<{
        id: string
        name: string | null
        status: 'active' | 'ended'
        messageCount: number
        commentCount: number
        createdAt: string
        endedAt: string | null
      }>
    }>(`/api/projects/${projectId}/test-sessions`)
  }

  async createTestSession(projectId: string, name?: string) {
    return this.request<{
      session: {
        id: string
        projectId: string
        name: string | null
        status: 'active' | 'ended'
        createdAt: string
        updatedAt: string
        endedAt: string | null
      }
    }>(`/api/projects/${projectId}/test-sessions`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  }

  async getTestSession(sessionId: string) {
    return this.request<{
      session: {
        id: string
        projectId: string
        name: string | null
        status: 'active' | 'ended'
        createdAt: string
        updatedAt: string
        endedAt: string | null
        messages: Array<{
          id: string
          sessionId: string
          role: 'user' | 'assistant'
          content: string
          createdAt: string
          comments: Array<{
            id: string
            messageId: string
            content: string
            templateId: string | null
            createdAt: string
          }>
        }>
      }
    }>(`/api/test-sessions/${sessionId}`)
  }

  async updateTestSession(sessionId: string, data: { name?: string; status?: 'active' | 'ended' }) {
    return this.request<{
      session: {
        id: string
        name: string | null
        status: string
        endedAt: string | null
      }
    }>(`/api/test-sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteTestSession(sessionId: string) {
    return this.request<{ success: boolean }>(`/api/test-sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  async addTestComment(messageId: string, content: string, templateId?: string) {
    return this.request<{
      comment: {
        id: string
        messageId: string
        content: string
        templateId: string | null
        createdAt: string
      }
    }>(`/api/test-messages/${messageId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, templateId }),
    })
  }

  async deleteTestComment(commentId: string) {
    return this.request<{ success: boolean }>(`/api/test-comments/${commentId}`, {
      method: 'DELETE',
    })
  }

  // Recommendation endpoints
  async getRecommendations(projectId: string) {
    return this.request<RecommendationResponse>(
      `/api/projects/${projectId}/recommendations`,
      { method: 'POST' }
    )
  }

  async applyAllRecommendations(projectId: string, setId: string) {
    return this.request<ApplyAllResponse>(
      `/api/projects/${projectId}/recommendations/apply-all`,
      {
        method: 'POST',
        body: JSON.stringify({ setId }),
      }
    )
  }

  async dismissRecommendation(projectId: string, recommendationId: string) {
    return this.request<{ success: boolean }>(
      `/api/projects/${projectId}/recommendations/${recommendationId}/dismiss`,
      { method: 'POST' }
    )
  }

  async rollbackProfile(projectId: string, toVersion: number) {
    return this.request<RollbackResponse>(
      `/api/projects/${projectId}/profile/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ toVersion }),
      }
    )
  }

  async getVersionHistory(projectId: string) {
    return this.request<VersionHistoryResponse>(
      `/api/projects/${projectId}/profile/versions`,
      { method: 'GET' }
    )
  }

  // ============================================================================
  // User endpoints (Conversation saving & Dashboard)
  // ============================================================================

  async saveConversation(conversationId: string) {
    return this.request<{ savedConversation: unknown }>(
      `/api/conversations/${conversationId}/save`,
      { method: 'POST' }
    )
  }

  async getSavedConversations() {
    return this.request<{
      conversations: Array<{
        id: string
        projectId: string
        messageCount: number
        startedAt: string
        endedAt: string | null
        project: {
          id: string
          name: string
        }
      }>
      total: number
    }>('/api/users/me/saved-conversations')
  }

  async getDashboardData() {
    return this.request<{
      projects: unknown[]
      savedConversations: Array<{
        id: string
        projectId: string
        messageCount: number
        startedAt: string
        endedAt: string | null
        project: {
          id: string
          name: string
        }
      }>
      stats: {
        projectCount: number
        savedConversationCount: number
      }
    }>('/api/users/me/dashboard')
  }

  // ============================================================================
  // Conversation Detail & Management (Analytics)
  // ============================================================================

  async getConversationDetail(conversationId: string) {
    return this.request<{
      conversation: {
        id: string
        projectId: string
        shareLinkSlug: string | null
        viewerEmail: string | null
        viewerName: string | null
        messageCount: number
        durationSeconds: number | null
        summary: string | null
        sentiment: string | null
        topics: string[]
        startedAt: string
        endedAt: string | null
        messages: Array<{
          id: string
          role: string
          content: string
          createdAt: string
        }>
        project: {
          id: string
          name: string
        }
      }
    }>(`/api/conversations/${conversationId}`)
  }

  async endConversation(conversationId: string) {
    return this.request<{
      conversation: unknown
      summary: string | null
    }>(`/api/conversations/${conversationId}/end`, {
      method: 'POST',
    })
  }

  async exportConversationsCSV(projectId: string): Promise<Blob> {
    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(
      `${this.baseUrl}/api/projects/${projectId}/analytics/export`,
      {
        method: 'GET',
        headers,
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || 'Export failed')
    }

    return response.blob()
  }

  /**
   * Get documents for a project (used by SavedThreadPage for document panel)
   */
  async getProjectDocuments(projectId: string) {
    return this.request<{
      documents: Array<{
        id: string
        filename: string
        title: string
        mimeType: string
        outline: Array<{ id: string; title: string; level: number; position: number }>
        status: string
      }>
    }>(`/api/projects/${projectId}/documents`)
  }

  // ============================================================================
  // Conversation Recommendations (Post-conversation document improvements)
  // ============================================================================

  async getConversationRecommendations(conversationId: string) {
    return this.request<{
      recommendations: Array<{
        id: string
        type: 'document_update' | 'consideration' | 'follow_up'
        title: string
        description: string
        proposedContent: string | null
        changeHighlight: string | null
        evidenceQuotes: string[]
        reasoning: string
        confidence: number
        impactLevel: 'low' | 'medium' | 'high'
        status: 'pending' | 'approved' | 'rejected' | 'applied'
        targetDocument?: { id: string; filename: string }
        targetSectionId: string | null
        reviewedAt: string | null
        appliedAt: string | null
        appliedToVersion: number | null
        createdAt: string
      }>
    }>(`/api/conversations/${conversationId}/recommendations`)
  }

  async applyRecommendation(recommendationId: string) {
    return this.request<{
      success: boolean
      recommendation: {
        id: string
        status: string
        appliedAt: string | null
        appliedToVersion: number | null
      }
      documentVersion?: {
        version: number
      }
    }>(`/api/recommendations/${recommendationId}/apply`, {
      method: 'POST',
    })
  }

  async dismissConversationRecommendation(recommendationId: string) {
    return this.request<{
      success: boolean
      recommendation: {
        id: string
        status: string
        reviewedAt: string | null
      }
    }>(`/api/recommendations/${recommendationId}/dismiss`, {
      method: 'POST',
    })
  }

  async endConversationWithMessage(conversationId: string, recipientMessage?: string) {
    return this.request<{
      conversation: unknown
      summary: string | null
      recommendationCount: number
    }>(`/api/conversations/${conversationId}/end`, {
      method: 'POST',
      body: JSON.stringify({ recipientMessage }),
    })
  }

  // ============================================================================
  // Document Comment endpoints (Collaborator feature)
  // ============================================================================

  async createDocumentComment(
    documentId: string,
    data: {
      conversationId?: string
      chunkId: string
      startOffset: number
      endOffset: number
      highlightedText: string
      content: string
      viewerEmail?: string
      viewerName?: string
    }
  ) {
    return this.request<{
      comment: {
        id: string
        documentId: string
        highlightedText: string
        content: string
        status: string
        createdAt: string
      }
    }>(`/api/documents/${documentId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getDocumentComments(
    documentId: string,
    params?: { conversationId?: string; status?: string }
  ) {
    const query = params
      ? new URLSearchParams(
          Object.entries(params).filter(([_, v]) => v !== undefined) as Array<[string, string]>
        ).toString()
      : ''
    return this.request<{
      comments: Array<{
        id: string
        chunkId: string
        startOffset: number
        endOffset: number
        highlightedText: string
        content: string
        viewerEmail: string | null
        viewerName: string | null
        status: string
        createdAt: string
      }>
    }>(`/api/documents/${documentId}/comments${query ? `?${query}` : ''}`)
  }

  async updateCommentStatus(
    commentId: string,
    status: 'pending' | 'addressed' | 'dismissed'
  ) {
    return this.request<{
      comment: {
        id: string
        status: string
      }
    }>(`/api/comments/${commentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // ============================================================================
  // Audience Synthesis endpoints
  // ============================================================================

  async getAudienceSynthesis(projectId: string) {
    return this.request<{
      synthesis: {
        id: string
        version: number
        overview: string
        commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
        knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
        documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
        sentimentTrend: string
        insights: string[]
        conversationCount: number
        totalMessages: number
        dateRangeFrom: string
        dateRangeTo: string
        createdAt: string
      } | null
    }>(`/api/projects/${projectId}/audience-synthesis`)
  }

  async getAudienceSynthesisVersions(projectId: string) {
    return this.request<{
      versions: Array<{
        id: string
        version: number
        conversationCount: number
        createdAt: string
      }>
    }>(`/api/projects/${projectId}/audience-synthesis/versions`)
  }

  async getAudienceSynthesisVersion(projectId: string, version: number) {
    return this.request<{
      synthesis: {
        id: string
        version: number
        overview: string
        commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
        knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
        documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
        sentimentTrend: string
        insights: string[]
        conversationCount: number
        totalMessages: number
        dateRangeFrom: string
        dateRangeTo: string
        createdAt: string
      }
    }>(`/api/projects/${projectId}/audience-synthesis/versions/${version}`)
  }

  async regenerateAudienceSynthesis(projectId: string) {
    return this.request<{
      synthesis: {
        id: string
        version: number
        overview: string
        commonQuestions: Array<{ pattern: string; frequency: number; documents: string[] }>
        knowledgeGaps: Array<{ topic: string; severity: string; suggestion: string }>
        documentSuggestions: Array<{ documentId: string; section: string; suggestion: string }>
        sentimentTrend: string
        insights: string[]
        conversationCount: number
        totalMessages: number
        dateRangeFrom: string
        dateRangeTo: string
        createdAt: string
      } | null
      regenerated: boolean
    }>(`/api/projects/${projectId}/audience-synthesis/regenerate`, {
      method: 'POST',
    })
  }

  // ============================================================================
  // Saved Audience Profile endpoints
  // ============================================================================

  async getAudienceProfiles() {
    return this.request<{
      profiles: Array<{
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
      }>
    }>('/api/audience-profiles')
  }

  async createAudienceProfile(data: {
    name: string
    description?: string
    audienceDescription?: string
    communicationStyle?: string
    topicsEmphasis?: string
    accessType?: string
  }) {
    return this.request<{
      profile: {
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
    }>('/api/audience-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAudienceProfile(
    profileId: string,
    data: {
      name?: string
      description?: string
      audienceDescription?: string
      communicationStyle?: string
      topicsEmphasis?: string
      accessType?: string
    }
  ) {
    return this.request<{
      profile: {
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
    }>(`/api/audience-profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteAudienceProfile(profileId: string) {
    return this.request<void>(`/api/audience-profiles/${profileId}`, {
      method: 'DELETE',
    })
  }

  async incrementAudienceProfileUsage(profileId: string) {
    return this.request<{
      profile: {
        id: string
        timesUsed: number
      }
    }>(`/api/audience-profiles/${profileId}/use`, {
      method: 'POST',
    })
  }

  // ============================================================================
  // Saved Collaborator Profile endpoints
  // ============================================================================

  async getCollaboratorProfiles() {
    return this.request<{
      profiles: Array<{
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
      }>
    }>('/api/collaborator-profiles')
  }

  async createCollaboratorProfile(data: {
    name: string
    email?: string
    description?: string
    communicationNotes?: string
    expertiseAreas?: string[]
    feedbackStyle?: string
  }) {
    return this.request<{
      profile: {
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
    }>('/api/collaborator-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCollaboratorProfile(
    profileId: string,
    data: {
      name?: string
      email?: string
      description?: string
      communicationNotes?: string
      expertiseAreas?: string[]
      feedbackStyle?: string
    }
  ) {
    return this.request<{
      profile: {
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
    }>(`/api/collaborator-profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteCollaboratorProfile(profileId: string) {
    return this.request<void>(`/api/collaborator-profiles/${profileId}`, {
      method: 'DELETE',
    })
  }

  async incrementCollaboratorProfileUsage(profileId: string) {
    return this.request<{
      profile: {
        id: string
        timesUsed: number
      }
    }>(`/api/collaborator-profiles/${profileId}/use`, {
      method: 'POST',
    })
  }

  // ============================================================================
  // Profile Synthesis endpoints (AI-assisted profile creation)
  // ============================================================================

  async synthesizeAudienceProfile(rawInput: string, additionalContext?: string) {
    return this.request<{ profile: SynthesizedAudienceProfile }>(
      '/api/audience-profiles/synthesize',
      {
        method: 'POST',
        body: JSON.stringify({ rawInput, additionalContext }),
      }
    )
  }

  async synthesizeCollaboratorProfile(rawInput: string, additionalContext?: string) {
    return this.request<{ profile: SynthesizedCollaboratorProfile }>(
      '/api/collaborator-profiles/synthesize',
      {
        method: 'POST',
        body: JSON.stringify({ rawInput, additionalContext }),
      }
    )
  }

  // ============================================================================
  // Agent Profile Braindump Synthesis (V2)
  // ============================================================================

  async synthesizeAgentProfile(
    projectId: string,
    rawInput: string,
    additionalContext?: string
  ) {
    return this.request<BrainDumpSynthesisResponse>(
      `/api/projects/${projectId}/profile/synthesize`,
      {
        method: 'POST',
        body: JSON.stringify({ rawInput, additionalContext }),
      }
    )
  }

  async saveAgentProfileV2(
    projectId: string,
    data: {
      profile: AgentProfileV2
      rawInput: string
      lightAreas: string[]
      synthesisMode: 'voice' | 'text'
    }
  ) {
    return this.request<{ success: boolean; profile: AgentProfileV2 }>(
      `/api/projects/${projectId}/profile/save`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    )
  }

  // ============================================================================
  // Document Versioning & Editing
  // ============================================================================

  async getDocumentForEdit(documentId: string) {
    return this.request<{
      document: {
        id: string
        filename: string
        isEditable: boolean
        currentVersion: number
      }
      content: Record<string, unknown> | null
    }>(`/api/documents/${documentId}/edit`)
  }

  async saveDocumentVersion(
    documentId: string,
    content: Record<string, unknown>,
    changeNote?: string
  ) {
    return this.request<{
      version: {
        id: string
        version: number
        createdAt: string
      }
    }>(`/api/documents/${documentId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content, changeNote }),
    })
  }

  async getDocumentVersions(documentId: string) {
    return this.request<{
      versions: Array<{
        id: string
        version: number
        editedByName: string | null
        changeNote: string | null
        source: string | null
        createdAt: string
      }>
      currentVersion: number
    }>(`/api/documents/${documentId}/versions`)
  }

  async getDocumentVersion(documentId: string, versionNum: number) {
    return this.request<{
      version: {
        id: string
        version: number
        content: Record<string, unknown>
        editedByName: string | null
        changeNote: string | null
        source: string | null
        createdAt: string
      }
    }>(`/api/documents/${documentId}/versions/${versionNum}`)
  }

  async rollbackDocumentVersion(documentId: string, versionNum: number) {
    return this.request<{
      newVersion: number
      content: Record<string, unknown>
    }>(`/api/documents/${documentId}/rollback/${versionNum}`, {
      method: 'POST',
    })
  }

  // ============================================================================
  // AI Recommendation Application
  // ============================================================================

  async generateRecommendationDraft(recommendationId: string) {
    return this.request<{
      draft: {
        originalText: string
        proposedText: string
        changeNote: string
        targetChunkId: string
      }
    }>(`/api/recommendations/${recommendationId}/draft`, {
      method: 'POST',
    })
  }

  async applyRecommendationDraft(
    recommendationId: string,
    proposedText: string,
    changeNote: string
  ) {
    return this.request<{
      version: {
        id: string
        version: number
        createdAt: string
      }
      recommendation: {
        id: string
        status: string
      }
    }>(`/api/recommendations/${recommendationId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ proposedText, changeNote }),
    })
  }
}

export const api = new ApiClient(API_URL)
