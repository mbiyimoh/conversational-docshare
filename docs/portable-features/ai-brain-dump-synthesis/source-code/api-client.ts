/**
 * AI Brain Dump Synthesis - Frontend API Client
 *
 * API client methods for profile synthesis endpoints.
 * Add these methods to your existing API client class.
 *
 * Dependencies:
 * - fetch API or your HTTP client of choice
 * - Authentication token handling
 */

// ============================================================================
// Type Definitions - Match these to your backend interfaces
// ============================================================================

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

// ============================================================================
// API Client Methods - Add these to your ApiClient class
// ============================================================================

/**
 * Example API Client class structure.
 * Adapt this to your existing API client pattern.
 */
class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    // Load token from storage if using persistent auth
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

  /**
   * Generic request method with auth header injection
   */
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
      throw new Error(error.error?.message || error.error || 'An error occurred')
    }

    return response.json()
  }

  // ==========================================================================
  // Synthesis Methods - The core of this feature
  // ==========================================================================

  /**
   * Synthesize an audience profile from natural language input.
   *
   * @param rawInput - Natural language description of the audience
   * @param additionalContext - Optional refinements for regeneration
   * @returns Synthesized profile ready for preview
   *
   * @example
   * const { profile } = await api.synthesizeAudienceProfile(
   *   "Board members focused on ROI and risk management"
   * )
   */
  async synthesizeAudienceProfile(
    rawInput: string,
    additionalContext?: string
  ) {
    return this.request<{ profile: SynthesizedAudienceProfile }>(
      '/api/audience-profiles/synthesize',
      {
        method: 'POST',
        body: JSON.stringify({ rawInput, additionalContext }),
      }
    )
  }

  /**
   * Synthesize a collaborator profile from natural language input.
   *
   * @param rawInput - Natural language description of the collaborator
   * @param additionalContext - Optional refinements for regeneration
   * @returns Synthesized profile ready for preview
   *
   * @example
   * const { profile } = await api.synthesizeCollaboratorProfile(
   *   "Sarah is our CFO, sarah@company.com, expert in finance"
   * )
   */
  async synthesizeCollaboratorProfile(
    rawInput: string,
    additionalContext?: string
  ) {
    return this.request<{ profile: SynthesizedCollaboratorProfile }>(
      '/api/collaborator-profiles/synthesize',
      {
        method: 'POST',
        body: JSON.stringify({ rawInput, additionalContext }),
      }
    )
  }

  // ==========================================================================
  // CRUD Methods - For saving synthesized profiles
  // These are your existing create/update endpoints
  // ==========================================================================

  /**
   * Create a new audience profile (after synthesis preview is approved)
   */
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
        createdAt: string
        updatedAt: string
      }
    }>('/api/audience-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing audience profile
   */
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
        createdAt: string
        updatedAt: string
      }
    }>(`/api/audience-profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  /**
   * Create a new collaborator profile
   */
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
        createdAt: string
        updatedAt: string
      }
    }>('/api/collaborator-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  /**
   * Update an existing collaborator profile
   */
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
        createdAt: string
        updatedAt: string
      }
    }>(`/api/collaborator-profiles/${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }
}

// Export singleton instance
// Adapt the base URL for your environment
const API_URL = import.meta.env?.VITE_API_URL || ''
export const api = new ApiClient(API_URL)
