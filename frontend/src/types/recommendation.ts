/**
 * Profile-Direct Recommendation Types
 * Matches backend types for profile section targeting
 * Supports both V1 (interview) and V2 (braindump) profiles
 */

/**
 * V1 profile section keys (interview-based profiles)
 */
export type ProfileSectionKeyV1 =
  | 'identityRole'
  | 'communicationStyle'
  | 'contentPriorities'
  | 'engagementApproach'
  | 'keyFramings'

/**
 * V2 profile field keys (braindump-based profiles)
 */
export type ProfileSectionKeyV2 =
  | 'agentIdentity'
  | 'domainExpertise'
  | 'targetAudience'
  | 'toneAndVoice'
  | 'languagePatterns'
  | 'adaptationRules'
  | 'keyTopics'
  | 'avoidanceAreas'
  | 'examplePreferences'
  | 'proactiveGuidance'
  | 'framingStrategies'
  | 'successCriteria'

/**
 * Valid profile section keys (V1 or V2)
 */
export type ProfileSectionKey = ProfileSectionKeyV1 | ProfileSectionKeyV2

export type RecommendationType = 'add' | 'remove' | 'modify'

/**
 * V1 section display names (interview-based profiles)
 */
export const V1_SECTION_DISPLAY_NAMES: Record<ProfileSectionKeyV1, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
}

/**
 * V2 field display names (braindump-based profiles)
 */
export const V2_FIELD_DISPLAY_NAMES: Record<ProfileSectionKeyV2, string> = {
  agentIdentity: 'Agent Identity',
  domainExpertise: 'Domain Expertise',
  targetAudience: 'Target Audience',
  toneAndVoice: 'Tone & Voice',
  languagePatterns: 'Language Patterns',
  adaptationRules: 'Adaptation Rules',
  keyTopics: 'Key Topics',
  avoidanceAreas: 'Avoidance Areas',
  examplePreferences: 'Example Preferences',
  proactiveGuidance: 'Proactive Guidance',
  framingStrategies: 'Framing Strategies',
  successCriteria: 'Success Criteria',
}

/**
 * Combined display names for backward compatibility
 */
export const SECTION_DISPLAY_NAMES: Record<ProfileSectionKey, string> = {
  ...V1_SECTION_DISPLAY_NAMES,
  ...V2_FIELD_DISPLAY_NAMES,
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
