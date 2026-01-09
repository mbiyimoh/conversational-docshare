'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackList } from '@/components/feedback/FeedbackList'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import { Plus } from 'lucide-react'

/**
 * Feedback portal page
 *
 * Lists all feedback with sorting/filtering and allows submission of new feedback.
 * Route: /feedback
 */
export default function FeedbackPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSuccess = () => {
    // Trigger list refresh by incrementing counter
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Feedback Portal</h1>
          <p className="text-muted-foreground mt-1">
            Share your feedback, report bugs, or suggest new features
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Add New Feedback
        </Button>
      </div>

      {/* Feedback List */}
      <FeedbackList refreshTrigger={refreshTrigger} />

      {/* Submission Dialog */}
      <FeedbackDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
