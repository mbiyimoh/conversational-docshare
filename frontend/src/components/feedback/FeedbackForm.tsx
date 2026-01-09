import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bug, Sparkles, Lightbulb, HelpCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'
import type { FeedbackArea, FeedbackType, CreateFeedbackInput } from '../../types/feedback'
import {
  FEEDBACK_AREAS,
  FEEDBACK_TYPES,
  FEEDBACK_AREA_DISPLAY_NAMES,
  FEEDBACK_TYPE_DISPLAY_NAMES,
} from '../../types/feedback'

interface FeedbackFormProps {
  onSubmit: (data: CreateFeedbackInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

const TYPE_ICONS: Record<FeedbackType, React.ReactNode> = {
  BUG: <Bug size={20} />,
  ENHANCEMENT: <Sparkles size={20} />,
  IDEA: <Lightbulb size={20} />,
  QUESTION: <HelpCircle size={20} />,
}

const TYPE_COLORS: Record<FeedbackType, string> = {
  BUG: '#ef4444',
  ENHANCEMENT: '#8b5cf6',
  IDEA: '#f59e0b',
  QUESTION: '#3b82f6',
}

export function FeedbackForm({ onSubmit, onCancel, isSubmitting }: FeedbackFormProps) {
  const [step, setStep] = useState(1)
  const [selectedAreas, setSelectedAreas] = useState<FeedbackArea[]>([])
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const toggleArea = (area: FeedbackArea) => {
    setSelectedAreas((prev) =>
      prev.includes(area)
        ? prev.filter((a) => a !== area)
        : [...prev, area]
    )
  }

  const canProceedStep1 = selectedAreas.length > 0
  const canProceedStep2 = selectedType !== null
  const canSubmit = title.length >= 5 && description.length >= 10

  const handleSubmit = async () => {
    if (!selectedType || !canSubmit) return

    await onSubmit({
      title,
      description,
      areas: selectedAreas,
      type: selectedType,
    })
  }

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              s <= step ? 'bg-accent' : 'bg-border'
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Select Areas */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="font-display text-lg text-foreground mb-1">
                What area does this relate to?
              </h3>
              <p className="text-sm text-muted">
                Select one or more areas (you can select multiple)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() => toggleArea(area)}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    'text-sm font-medium',
                    selectedAreas.includes(area)
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-transparent border-border text-muted hover:text-foreground hover:border-border/60'
                  )}
                >
                  {FEEDBACK_AREA_DISPLAY_NAMES[area]}
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Select Type */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="font-display text-lg text-foreground mb-1">
                What type of feedback is this?
              </h3>
              <p className="text-sm text-muted">
                Help us categorize your feedback
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {FEEDBACK_TYPES.map((type) => {
                const color = TYPE_COLORS[type]
                const isSelected = selectedType === type

                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      'p-4 rounded-lg border text-left transition-all',
                      'flex flex-col items-center gap-2',
                      isSelected
                        ? 'border-2'
                        : 'border-border hover:border-border/60'
                    )}
                    style={{
                      borderColor: isSelected ? color : undefined,
                      backgroundColor: isSelected ? `${color}10` : undefined,
                    }}
                  >
                    <span style={{ color: isSelected ? color : '#888' }}>
                      {TYPE_ICONS[type]}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isSelected ? color : undefined }}
                    >
                      {FEEDBACK_TYPE_DISPLAY_NAMES[type]}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft size={16} className="mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Title & Description */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <h3 className="font-display text-lg text-foreground mb-1">
                Describe your feedback
              </h3>
              <p className="text-sm text-muted">
                Be specific to help us understand and address it
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief summary of your feedback"
                  maxLength={200}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg',
                    'bg-transparent border border-border',
                    'text-foreground placeholder:text-muted/50',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
                  )}
                />
                <p className="text-xs text-muted mt-1">
                  {title.length}/200 (min 5 characters)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details, steps to reproduce (for bugs), or context for your suggestion"
                  maxLength={5000}
                  rows={5}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg resize-none',
                    'bg-transparent border border-border',
                    'text-foreground placeholder:text-muted/50',
                    'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
                  )}
                />
                <p className="text-xs text-muted mt-1">
                  {description.length}/5000 (min 10 characters)
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ChevronLeft size={16} className="mr-1" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  isLoading={isSubmitting}
                >
                  Submit Feedback
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
