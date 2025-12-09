/**
 * Types for Profile-Direct Additive Recommendations Feature
 *
 * This module defines TypeScript types for the intelligent profile recommendations system,
 * which analyzes testing feedback and generates profile section recommendations with
 * additive operations (ADD/REMOVE/MODIFY) instead of wholesale replacements.
 */

import type { AgentProfile } from '../services/profileSynthesizer'

/**
 * Valid profile section keys that can be targeted by recommendations
 */
export type ProfileSectionKey =
  | 'identityRole'
  | 'communicationStyle'
  | 'contentPriorities'
  | 'engagementApproach'
  | 'keyFramings'

/**
 * Human-readable names for profile sections
 */
export const SECTION_DISPLAY_NAMES: Record<ProfileSectionKey, string> = {
  identityRole: 'Identity & Role',
  communicationStyle: 'Communication Style',
  contentPriorities: 'Content Priorities',
  engagementApproach: 'Engagement Approach',
  keyFramings: 'Key Framings',
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
 */
export interface ProfileVersion {
  /** Unique identifier for this version */
  id: string
  /** The project this version belongs to */
  projectId: string
  /** Sequential version number (1, 2, 3, ...) */
  version: number
  /** Complete profile snapshot at this point */
  profile: AgentProfile
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
  /** The restored profile */
  profile: AgentProfile
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
