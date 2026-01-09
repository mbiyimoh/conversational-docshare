'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FeedbackForm } from './FeedbackForm'
import { toast } from 'sonner'
import type { CreateFeedbackInput } from '@/lib/validation'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Feedback submission dialog
 *
 * Modal wrapper for FeedbackForm with submission handling.
 * Handles API call, loading state, and success/error toasts.
 */
export function FeedbackDialog({ open, onOpenChange, onSuccess }: FeedbackDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: CreateFeedbackInput) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to submit feedback')
      }

      toast.success('Feedback submitted successfully!')
      onOpenChange(false)
      onSuccess?.()

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            {/* CUSTOMIZE: Update this description for your app */}
            Help us improve by sharing your feedback, bug reports, or feature ideas.
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </DialogContent>
    </Dialog>
  )
}
