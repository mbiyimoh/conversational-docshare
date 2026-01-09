// ============================================================================
// Feedback System - Zod Validation Schemas
// ============================================================================
//
// INSTRUCTIONS:
// Add these schemas to your existing lib/validation.ts file
// Or import from this file if you prefer to keep them separate
//
// IMPORTANT: The FeedbackAreaSchema values MUST match:
// 1. Your Prisma schema enum
// 2. The areaOptions in FeedbackForm.tsx
// 3. The area filter options in FeedbackList.tsx
// 4. The areaLabels in FeedbackCard.tsx
// ============================================================================

import { z } from 'zod'

/**
 * Feedback Area Enum Schema
 * Represents which part of the application the feedback relates to.
 *
 * CUSTOMIZE these values to match your application's areas.
 * Must match the FeedbackArea enum in your Prisma schema.
 *
 * Example customization:
 * export const FeedbackAreaSchema = z.enum([
 *   'DASHBOARD',
 *   'REPORTS',
 *   'SETTINGS',
 *   'BILLING',
 *   'API',
 *   'OTHER'
 * ])
 */
export const FeedbackAreaSchema = z.enum([
  'NODE_TREE_UI',    // CUSTOMIZE: Replace with your app's areas
  'MAIN_AI_CHAT',
  'COMPASS',
  'SCOPE_TOOL',
  'OTHER'
], {
  message: "Invalid feedback area"
})

/**
 * Feedback Type Enum Schema
 * Categorizes the nature of the feedback.
 */
export const FeedbackTypeSchema = z.enum([
  'BUG',
  'ENHANCEMENT',
  'IDEA',
  'QUESTION'
], {
  message: "Feedback type must be BUG, ENHANCEMENT, IDEA, or QUESTION"
})

/**
 * Feedback Status Enum Schema
 * Tracks the lifecycle state of feedback (admin-managed).
 */
export const FeedbackStatusSchema = z.enum([
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED'
], {
  message: "Invalid feedback status"
})

/**
 * Feedback Attachment Metadata Schema
 * Validates file attachment metadata returned from upload endpoint.
 */
export const FeedbackAttachmentMetadataSchema = z.object({
  url: z.string().url('Invalid attachment URL'),
  filename: z.string().min(1, 'Filename required'),
  mimeType: z.string().min(1, 'MIME type required'),
  sizeBytes: z.number().int().positive('File size must be positive')
})

/**
 * Create Feedback Schema
 * Validates new feedback submissions.
 *
 * Validation rules:
 * - Title: 5-200 characters (trimmed)
 * - Description: 10-5000 characters (trimmed)
 * - Area and Type: Must match enum values
 * - Attachments: Optional array of file metadata (max 10MB per file)
 *
 * @example
 * ```typescript
 * const feedbackInput = CreateFeedbackSchema.parse({
 *   title: "Dashboard charts don't load on Safari",
 *   description: "When viewing the dashboard on Safari 17, the charts section shows a loading spinner forever...",
 *   area: "NODE_TREE_UI",  // Use your actual area value
 *   type: "BUG",
 *   attachments: [{
 *     url: "https://storage.example.com/screenshot.png",
 *     filename: "screenshot.png",
 *     mimeType: "image/png",
 *     sizeBytes: 1024000
 *   }]
 * })
 * ```
 */
export const CreateFeedbackSchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title must be 200 characters or less')
    .transform(s => s.trim()),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be 5000 characters or less')
    .transform(s => s.trim()),
  area: FeedbackAreaSchema,
  type: FeedbackTypeSchema,
  attachments: z.array(FeedbackAttachmentMetadataSchema)
    .optional()
    .default([])
    .refine(
      (arr) => arr.every(a => a.sizeBytes <= 10 * 1024 * 1024), // 10MB max per file
      { message: 'Attachment size must be 10MB or less' }
    )
})

/**
 * Update Feedback Schema
 * Allows admin users to update feedback status.
 * Currently only status changes are allowed.
 *
 * @example
 * ```typescript
 * const updates = UpdateFeedbackSchema.parse({
 *   status: "IN_REVIEW"
 * })
 * ```
 */
export const UpdateFeedbackSchema = z.object({
  status: FeedbackStatusSchema.optional()
})

/**
 * Vote Action Schema
 * Validates upvote/remove actions on feedback.
 */
export const VoteActionSchema = z.object({
  action: z.enum(['upvote', 'remove'], {
    message: "Action must be either 'upvote' or 'remove'"
  })
})

// Export TypeScript types inferred from schemas
export type FeedbackArea = z.infer<typeof FeedbackAreaSchema>
export type FeedbackType = z.infer<typeof FeedbackTypeSchema>
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>
export type FeedbackAttachmentMetadata = z.infer<typeof FeedbackAttachmentMetadataSchema>
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>
export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>
export type VoteActionInput = z.infer<typeof VoteActionSchema>
