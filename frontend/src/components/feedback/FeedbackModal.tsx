import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
} from '../ui/modal'
import { FeedbackForm } from './FeedbackForm'
import type { CreateFeedbackInput, FeedbackItem } from '../../types/feedback'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateFeedbackInput) => Promise<FeedbackItem>
  isSubmitting?: boolean
}

export function FeedbackModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: FeedbackModalProps) {
  const handleSubmit = async (data: CreateFeedbackInput) => {
    await onSubmit(data)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader>
        <ModalTitle>Submit Feedback</ModalTitle>
        <ModalDescription>
          Help us improve by sharing your thoughts, ideas, or reporting issues
        </ModalDescription>
      </ModalHeader>
      <ModalContent>
        <FeedbackForm
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
        />
      </ModalContent>
    </Modal>
  )
}
