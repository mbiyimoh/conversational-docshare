/**
 * Learner configuration types for Personal Explorer mode
 * These define how the AI adapts to help users learn from documents
 */

export interface LearnerConfig {
  // Background & Goals (from short interview)
  backgroundLevel: 'beginner' | 'familiar' | 'expert'
  primaryGoal?: string

  // Explanation Style
  analogyDomains?: string[] // ["sports", "cooking", "everyday life"]
  preferSocratic: boolean // Ask guiding questions vs direct answers

  // Communication Preferences
  tone: 'casual' | 'professional' | 'academic'
  verbosity: 'concise' | 'balanced' | 'detailed'
}

export type LearnerPreset = 'eli5' | 'balanced' | 'deep_dive' | 'custom'

export type ProjectPurpose = 'share' | 'explore'
