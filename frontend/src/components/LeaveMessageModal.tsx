import { useState } from 'react'

interface LeaveMessageModalProps {
  isOpen: boolean
  senderName: string
  onSubmit: (message: string) => void
  onSkip: () => void
}

export function LeaveMessageModal({
  isOpen,
  senderName,
  onSubmit,
  onSkip,
}: LeaveMessageModalProps) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      onSkip()
      return
    }
    setIsSubmitting(true)
    try {
      onSubmit(message.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  const characterCount = message.length
  const maxCharacters = 2000

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-full">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Before you go...</h3>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-gray-600">
            Is there anything specific you'd like me to share with{' '}
            <span className="font-medium text-gray-900">{senderName}</span>{' '}
            now that you've explored this document capsule?
          </p>

          <textarea
            placeholder="Share your thoughts, questions, or feedback..."
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxCharacters))}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />

          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>
              Examples: Feedback, questions for follow-up, clarifications...
            </span>
            <span className={characterCount > maxCharacters * 0.9 ? 'text-orange-500' : ''}>
              {characterCount}/{maxCharacters}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
