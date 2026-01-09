import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { Button, SectionLabel } from '../components/ui'
import { FeedbackList, FeedbackModal } from '../components/feedback'
import type {
  FeedbackItem,
  ListFeedbackParams,
  CreateFeedbackInput,
  UserRole,
} from '../types/feedback'

export function FeedbackPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // User state
  const [userRole, setUserRole] = useState<UserRole>('USER')

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Parse filters from URL
  const currentFilters: ListFeedbackParams = {
    sort: (searchParams.get('sort') as ListFeedbackParams['sort']) || 'popular',
    area: searchParams.get('area') as ListFeedbackParams['area'],
    type: searchParams.get('type') as ListFeedbackParams['type'],
    status: searchParams.get('status') as ListFeedbackParams['status'],
  }

  // Fetch user info to get role
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.getUser()
        // Check if user has role field (SYSTEM_ADMIN or USER)
        const role = (response.user as { role?: UserRole }).role || 'USER'
        setUserRole(role)
      } catch {
        // User not logged in or error - default to USER
        setUserRole('USER')
      }
    }
    fetchUser()
  }, [])

  // Fetch feedback list
  const fetchFeedback = useCallback(async (params: ListFeedbackParams, append = false) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await api.listFeedback(params)

      if (append) {
        setFeedback((prev) => [...prev, ...response.feedback])
      } else {
        setFeedback(response.feedback)
      }
      setNextCursor(response.nextCursor)
    } catch (err) {
      console.error('Failed to load feedback:', err)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  // Load initial feedback when search params change
  useEffect(() => {
    fetchFeedback(currentFilters)
  }, [searchParams, fetchFeedback])

  // Handle filter changes
  const handleFilterChange = (params: ListFeedbackParams) => {
    const newParams = new URLSearchParams()
    if (params.sort && params.sort !== 'popular') {
      newParams.set('sort', params.sort)
    }
    if (params.area) newParams.set('area', params.area)
    if (params.type) newParams.set('type', params.type)
    if (params.status) newParams.set('status', params.status)

    setSearchParams(newParams)
  }

  // Handle load more
  const handleLoadMore = () => {
    if (nextCursor && !isLoadingMore) {
      fetchFeedback({ ...currentFilters, cursor: nextCursor }, true)
    }
  }

  // Handle feedback update (vote, status change)
  const handleFeedbackUpdate = (updatedFeedback: FeedbackItem) => {
    setFeedback((prev) =>
      prev.map((f) => (f.id === updatedFeedback.id ? updatedFeedback : f))
    )
  }

  // Handle new feedback submission
  const handleSubmit = async (data: CreateFeedbackInput): Promise<FeedbackItem> => {
    setIsSubmitting(true)
    try {
      const response = await api.createFeedback(data)
      // Add new feedback to top of list
      setFeedback((prev) => [response.feedback, ...prev])
      return response.feedback
    } finally {
      setIsSubmitting(false)
    }
  }

  const isAdmin = userRole === 'SYSTEM_ADMIN'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card-bg/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-muted hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-xl text-foreground">Feedback Portal</h1>
              <p className="text-sm text-muted">Share ideas, report bugs, vote on features</p>
            </div>
          </div>

          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={16} className="mr-1.5" />
            New Feedback
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <SectionLabel>All Feedback</SectionLabel>

        <div className="mt-4">
          <FeedbackList
            feedback={feedback}
            isLoading={isLoading || isLoadingMore}
            hasMore={!!nextCursor}
            isAdmin={isAdmin}
            onLoadMore={handleLoadMore}
            onFilterChange={handleFilterChange}
            onFeedbackUpdate={handleFeedbackUpdate}
            currentFilters={currentFilters}
          />
        </div>
      </main>

      {/* Submit modal */}
      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
