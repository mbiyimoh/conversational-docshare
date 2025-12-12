import { useState } from 'react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter,
  Button,
  Textarea
} from './ui'

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
    <Modal isOpen={isOpen} onClose={onSkip} size="md" showCloseButton={false}>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-full">
            <svg
              className="w-5 h-5 text-accent"
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
          <ModalTitle>Before you go...</ModalTitle>
        </div>
      </ModalHeader>

      <ModalContent className="space-y-4">
        <p className="text-muted">
          Is there anything specific you'd like me to share with{' '}
          <span className="font-medium text-foreground">{senderName}</span>{' '}
          now that you've explored this document capsule?
        </p>

        <Textarea
          placeholder="Share your thoughts, questions, or feedback..."
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, maxCharacters))}
          rows={5}
        />

        <div className="flex justify-between items-center text-sm text-muted">
          <span>
            Examples: Feedback, questions for follow-up, clarifications...
          </span>
          <span className={characterCount > maxCharacters * 0.9 ? 'text-warning' : ''}>
            {characterCount}/{maxCharacters}
          </span>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send & Continue'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
