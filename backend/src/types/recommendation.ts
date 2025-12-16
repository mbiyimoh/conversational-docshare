/**
 * Types for Profile-Direct Additive Recommendations Feature
 *
 * This module defines TypeScript types for the intelligent profile recommendations system,
 * which analyzes testing feedback and generates profile section recommendations with
 * additive operations (ADD/REMOVE/MODIFY) instead of wholesale replacements.
 */

import type { AgentProfile, AgentProfileV2 } from '../services/profileSynthesizer'

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
 * Valid profile section keys that can be targeted by recommendations (V1 or V2)
 */
export type ProfileSectionKey = ProfileSectionKeyV1 | ProfileSectionKeyV2

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

/**
 * Operation types for profile recommendations
 */
export type RecommendationType = 'add' | 'remove' | 'modify'

/**
 * Represents a single recommendation for improving a profile section
 */
export interface ProfileRecommendation {
  /** Unique identifier for the recommendation */
  id: string
  /** Groups recommendations from the same analysis run */
  setId: string
  /** The type of operation to perform */
  type: RecommendationType
  /** The profile section this recommendation applies to */
  targetSection: ProfileSectionKey
  /** Content to append (for ADD operation) */
  addedContent?: string
  /** Content to remove (for REMOVE operation) */
  removedContent?: string
  /** Original phrase to replace (for MODIFY operation) */
  modifiedFrom?: string
  /** Replacement phrase (for MODIFY operation) */
  modifiedTo?: string
  /** 2-3 bullet points summarizing the change */
  summaryBullets: string[]
  /** Section content before the change */
  previewBefore: string
  /** Section content after the change (showing the effect) */
  previewAfter: string
  /** Explanation of why this change is recommended */
  rationale: string
  /** IDs of test comments that informed this recommendation */
  relatedCommentIds: string[]
  /** Current status of the recommendation */
  status: 'pending' | 'applied' | 'dismissed'
  /** Timestamp when applied (if applicable) */
  appliedAt?: string
}

/**
 * Analysis summary from the recommendation generation
 */
export interface AnalysisSummary {
  /** 2-3 sentence overview of the analysis */
  overview: string
  /** Main themes identified from feedback */
  feedbackThemes: string[]
  /** How well current profile aligns with feedback */
  configAlignment: 'good' | 'needs_update' | 'partial'
  /** Reason if no recommendations were generated */
  noChangeReason?: string
}

/**
 * A set of recommendations generated from a single analysis run
 */
export interface RecommendationSet {
  /** Unique identifier for this recommendation set */
  setId: string
  /** All recommendations in this set */
  recommendations: ProfileRecommendation[]
  /** Summary of the analysis */
  analysisSummary: AnalysisSummary
  /** Total number of comments analyzed */
  totalComments: number
  /** Number of test sessions the comments came from */
  sessionsAnalyzed: number
  /** When this set was generated */
  generatedAt: string
}

/**
 * Represents a saved version of the profile for rollback functionality
 * Supports both V1 (interview) and V2 (braindump) profiles
 */
export interface ProfileVersion {
  /** Unique identifier for this version */
  id: string
  /** The project this version belongs to */
  projectId: string
  /** Sequential version number (1, 2, 3, ...) */
  version: number
  /** Complete profile snapshot at this point (V1 or V2) */
  profile: AgentProfile | AgentProfileV2
  /** What created this version */
  source: 'interview' | 'manual' | 'recommendation'
  /** Which recommendation set created this version (if applicable) */
  recommendationSetId?: string
  /** When this version was created */
  createdAt: string
}

/**
 * Response for the generate recommendations API endpoint
 */
export interface GenerateRecommendationsResponse {
  /** Unique identifier for this recommendation set */
  setId: string
  /** All generated recommendations */
  recommendations: ProfileRecommendation[]
  /** Summary of the analysis */
  analysisSummary: AnalysisSummary
  /** Total comments analyzed */
  totalComments: number
  /** Number of sessions analyzed */
  sessionsAnalyzed: number
  /** When recommendations were generated */
  generatedAt: string
}

/**
 * Request body for applying all recommendations
 */
export interface ApplyAllRequest {
  /** The set ID to apply */
  setId: string
}

/**
 * Response for the apply all recommendations API endpoint
 */
export interface ApplyAllResponse {
  /** Whether the operation succeeded */
  success: true
  /** Number of recommendations that were applied */
  appliedCount: number
  /** The updated profile after applying */
  profile: AgentProfile
  /** Version information */
  version: {
    /** New version number */
    number: number
    /** When this version was created */
    createdAt: string
  }
  /** Rollback is available */
  rollbackAvailable: true
}

/**
 * Request body for rolling back to a previous profile version
 */
export interface RollbackRequest {
  /** Version number to rollback to */
  toVersion: number
}

/**
 * Response for the rollback API endpoint
 */
export interface RollbackResponse {
  /** Whether the rollback succeeded */
  success: true
  /** The restored profile (V1 or V2) */
  profile: AgentProfile | AgentProfileV2
  /** The version number that was restored */
  restoredVersion: number
}

/**
 * Response for the version history API endpoint
 */
export interface VersionHistoryResponse {
  /** List of versions (newest first, limited to 10) */
  versions: {
    /** Version number */
    version: number
    /** What created this version */
    source: string
    /** When created */
    createdAt: string
    /** Associated recommendation set (if applicable) */
    recommendationSetId?: string
  }[]
  /** Current active version number */
  currentVersion: number
}

/**
 * LLM response format for parsed recommendations
 */
export interface ParsedLLMRecommendation {
  type: RecommendationType
  targetSection: ProfileSectionKey
  addedContent?: string
  removedContent?: string
  modifiedFrom?: string
  modifiedTo?: string
  summaryBullets: string[]
  rationale: string
  relatedCommentIds: string[]
}

/**
 * Full LLM response structure
 */
export interface ParsedLLMResponse {
  analysisSummary: AnalysisSummary
  recommendations: ParsedLLMRecommendation[]
}

// ============================================================================
// CONVERSATION RECOMMENDATION TYPES (for document updates from viewer chats)
// ============================================================================

export type ConversationRecommendationType = 'document_update' | 'consideration' | 'follow_up'
export type ConversationRecommendationStatus = 'pending' | 'approved' | 'rejected' | 'applied'
export type ImpactLevel = 'low' | 'medium' | 'high'

export interface ConversationRecommendationInput {
  type: ConversationRecommendationType
  targetDocumentId: string | null
  targetSectionId: string | null
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: ImpactLevel
}

export interface ConversationRecommendationOutput {
  id: string
  conversationId: string
  type: ConversationRecommendationType
  targetDocumentId: string | null
  targetDocument?: { id: string; filename: string }
  targetSectionId: string | null
  title: string
  description: string
  proposedContent: string | null
  changeHighlight: string | null
  evidenceQuotes: string[]
  reasoning: string
  confidence: number
  impactLevel: ImpactLevel
  status: ConversationRecommendationStatus
  reviewedAt: string | null
  appliedAt: string | null
  appliedToVersion: number | null
  createdAt: string
}

export interface RecipientMessageOutput {
  id: string
  content: string
  viewerEmail: string | null
  viewerName: string | null
  createdAt: string
}

export interface GeneratedConversationRecommendations {
  recommendations: ConversationRecommendationInput[]
  noRecommendationsReason?: string | null
}
