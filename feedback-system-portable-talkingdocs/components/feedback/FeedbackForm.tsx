'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileUploadInput } from './FileUploadInput'
import { Bug, Sparkles, Lightbulb, HelpCircle } from 'lucide-react'
import type { CreateFeedbackInput, FeedbackArea, FeedbackType, FeedbackAttachmentMetadata } from '@/lib/validation'

interface FeedbackFormProps {
  onSubmit: (data: CreateFeedbackInput) => Promise<void>
  isSubmitting: boolean
}

/**
 * Feedback submission form
 *
 * Multi-step form for creating new feedback with:
 * - Area selection (which part of the app)
 * - Type selection (bug, enhancement, idea, question)
 * - Title and description with character limits
 * - Optional file attachments
 *
 * CUSTOMIZE: Update areaOptions to match your app's FeedbackArea enum.
 * The values must match your Prisma schema and Zod validation.
 */
export function FeedbackForm({ onSubmit, isSubmitting }: FeedbackFormProps) {
  const [formData, setFormData] = useState<{
    title: string
    description: string
    area: FeedbackArea
    type: FeedbackType
    attachments: FeedbackAttachmentMetadata[]
  }>({
    title: '',
    description: '',
    area: 'NODE_TREE_UI',  // CUSTOMIZE: Set your default area
    type: 'BUG',
    attachments: []
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // CUSTOMIZE: Update these values to match your app's FeedbackArea enum
  // These must match your Prisma schema and Zod validation exactly
  const areaOptions: Array<{ value: FeedbackArea; label: string }> = [
    { value: 'NODE_TREE_UI', label: 'Main Node Tree UI' },
    { value: 'MAIN_AI_CHAT', label: 'Main AI Chat' },
    { value: 'COMPASS', label: 'Compass / Compass AI' },
    { value: 'SCOPE_TOOL', label: 'Project Scope Tool' },
    { value: 'OTHER', label: 'Other' }
  ]

  const typeOptions: Array<{
    value: FeedbackType
    label: string
    icon: typeof Bug
    color: string
  }> = [
    { value: 'BUG', label: 'Bug', icon: Bug, color: 'text-red-600' },
    { value: 'ENHANCEMENT', label: 'Enhancement', icon: Sparkles, color: 'text-blue-600' },
    { value: 'IDEA', label: 'Idea', icon: Lightbulb, color: 'text-yellow-600' },
    { value: 'QUESTION', label: 'Question', icon: HelpCircle, color: 'text-purple-600' }
  ]

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters'
    }
    if (formData.title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less'
    }
    if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters'
    }
    if (formData.description.trim().length > 5000) {
      newErrors.description = 'Description must be 5000 characters or less'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Area Selection */}
      <div>
        <Label>Which part of the app does this relate to?</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {areaOptions.map(option => (
            <Button
              key={option.value}
              type="button"
              variant={formData.area === option.value ? 'default' : 'outline'}
              onClick={() => setFormData({ ...formData, area: option.value })}
              className="justify-start"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Type Selection */}
      <div>
        <Label>What type of feedback is this?</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {typeOptions.map(option => {
            const Icon = option.icon
            return (
              <Button
                key={option.value}
                type="button"
                variant={formData.type === option.value ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, type: option.value })}
                className="justify-start"
              >
                <Icon className={`mr-2 h-4 w-4 ${formData.type === option.value ? '' : option.color}`} />
                {option.label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => {
            setFormData({ ...formData, title: e.target.value })
            if (errors.title) setErrors({ ...errors, title: '' })
          }}
          placeholder="Brief summary of your feedback"
          required
          maxLength={200}
          className={errors.title ? 'border-red-500' : ''}
        />
        {errors.title && (
          <p className="text-xs text-red-600 mt-1">{errors.title}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formData.title.length}/200 characters
        </p>
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => {
            setFormData({ ...formData, description: e.target.value })
            if (errors.description) setErrors({ ...errors, description: '' })
          }}
          placeholder="Provide details about your feedback. For bugs, include steps to reproduce."
          required
          rows={6}
          maxLength={5000}
          className={errors.description ? 'border-red-500' : ''}
        />
        {errors.description && (
          <p className="text-xs text-red-600 mt-1">{errors.description}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formData.description.length}/5000 characters
        </p>
      </div>

      {/* File Upload */}
      <div>
        <Label>Screenshots or Attachments (optional)</Label>
        <FileUploadInput
          onUpload={(metadata: FeedbackAttachmentMetadata) => setFormData({
            ...formData,
            attachments: [...formData.attachments, metadata]
          })}
          onRemove={(url: string) => setFormData({
            ...formData,
            attachments: formData.attachments.filter(a => a.url !== url)
          })}
          attachments={formData.attachments}
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </form>
  )
}
