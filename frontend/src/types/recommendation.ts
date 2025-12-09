/**
 * Profile-Direct Recommendation Types
 * Matches backend types for profile section targeting
 */

export type ProfileSectionKey =
  | 'identityRole'
  | 'communicationStyle'
  | 'contentPriorities'
  | 'engagementApproach'
  | 'keyFramings'

export type RecommendationType = 'add' | 'remove' | 'modify'

export const SECTION_DISPLAY_NAMES: Record<ProfileSectionKey, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
}

export interface ProfileRecommendation {
  id: string
  setId: string
  type: RecommendationType
  targetSection: ProfileSectionKey
  addedContent?: string
  removedContent?: string
  modifiedFrom?: string
  modifiedTo?: string
  summaryBullets: string[]
  previewBefore: string
  previewAfter: string
  rationale: string
  relatedCommentIds: string[]
  status: 'pending' | 'applied' | 'dismissed'
  appliedAt?: string
}

export interface AnalysisSummary {
  overview: string
  feedbackThemes: string[]
  configAlignment: 'good' | 'needs_update' | 'partial'
  noChangeReason?: string
}

export interface RecommendationResponse {
  setId: string
  recommendations: ProfileRecommendation[]
  analysisSummary: AnalysisSummary
  totalComments: number
  sessionsAnalyzed: number
  generatedAt: string
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

export interface ProfileSection {
  id: string
  title: string
  content: string
  isEdited: boolean
  editedAt?: string
  editSource?: 'manual' | 'recommendation'
}

export interface ApplyAllResponse {
  success: true
  appliedCount: number
  profile: AgentProfile
  version: {
    number: number
    createdAt: string
  }
  rollbackAvailable: true
}

export interface RollbackResponse {
  success: true
  profile: AgentProfile
  restoredVersion: number
}

export interface VersionHistoryResponse {
  versions: {
    version: number
    source: string
    createdAt: string
    recommendationSetId?: string
  }[]
  currentVersion: number
}
