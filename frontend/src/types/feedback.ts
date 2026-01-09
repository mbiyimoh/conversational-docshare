/**
 * User Feedback System Types
 */

// Feedback areas (matches backend enum)
export type FeedbackArea =
  | 'DOCUMENT_UPLOAD'
  | 'AI_CHAT'
  | 'SHARE_LINKS'
  | 'ANALYTICS'
  | 'AGENT_CONFIG'
  | 'GENERAL'

// Feedback types (matches backend enum)
export type FeedbackType = 'BUG' | 'ENHANCEMENT' | 'IDEA' | 'QUESTION'

// Feedback status (matches backend enum)
export type FeedbackStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'

// User role for access control
export type UserRole = 'USER' | 'SYSTEM_ADMIN'

// Array constants for iteration
export const FEEDBACK_AREAS: FeedbackArea[] = [
  'DOCUMENT_UPLOAD',
  'AI_CHAT',
  'SHARE_LINKS',
  'ANALYTICS',
  'AGENT_CONFIG',
  'GENERAL',
]

export const FEEDBACK_TYPES: FeedbackType[] = ['BUG', 'ENHANCEMENT', 'IDEA', 'QUESTION']

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
]

// Feedback item returned from API
export interface FeedbackItem {
  id: string
  title: string
  description: string
  areas: FeedbackArea[]
  type: FeedbackType
  status: FeedbackStatus
  upvoteCount: number
  hasUserUpvoted: boolean
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
}

// Create feedback input
export interface CreateFeedbackInput {
  title: string
  description: string
  areas: FeedbackArea[]
  type: FeedbackType
}

// List feedback query params
export interface ListFeedbackParams {
  sort?: 'popular' | 'recent' | 'oldest'
  area?: FeedbackArea
  type?: FeedbackType
  status?: FeedbackStatus
  limit?: number
  cursor?: string
}

// List feedback response
export interface ListFeedbackResponse {
  feedback: FeedbackItem[]
  nextCursor: string | null
}

// Vote response
export interface VoteResponse {
  upvoteCount: number
  hasUserUpvoted: boolean
}

// Display names for areas
export const FEEDBACK_AREA_DISPLAY_NAMES: Record<FeedbackArea, string> = {
  DOCUMENT_UPLOAD: 'Document Upload',
  AI_CHAT: 'AI Chat',
  SHARE_LINKS: 'Share Links',
  ANALYTICS: 'Analytics',
  AGENT_CONFIG: 'Agent Config',
  GENERAL: 'General',
}

// Display names for types
export const FEEDBACK_TYPE_DISPLAY_NAMES: Record<FeedbackType, string> = {
  BUG: 'Bug',
  ENHANCEMENT: 'Enhancement',
  IDEA: 'Idea',
  QUESTION: 'Question',
}

// Display names for statuses
export const FEEDBACK_STATUS_DISPLAY_NAMES: Record<FeedbackStatus, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In Review',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
}

// Status colors for display
export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  OPEN: '#888888',
  IN_REVIEW: '#60a5fa',
  PLANNED: '#d4a54a',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#4ade80',
  CLOSED: '#555555',
}

// Type icons (Lucide icon names)
export const FEEDBACK_TYPE_ICONS: Record<FeedbackType, string> = {
  BUG: 'Bug',
  ENHANCEMENT: 'Sparkles',
  IDEA: 'Lightbulb',
  QUESTION: 'HelpCircle',
}
