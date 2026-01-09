import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import { DocumentCapsule } from './DocumentCapsule'
import { DocumentContentViewer } from './DocumentContentViewer'

interface MobileDocumentOverlayProps {
  isOpen: boolean
  onClose: () => void
  mode: 'capsule' | 'document'
  // Document capsule props
  documents: Array<{
    id: string
    filename: string
    title: string
    summary?: string
    outline?: Array<{ id: string; title: string; level: number; position: number }>
  }>
  projectName: string
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
  // Document viewer props
  selectedDocumentId: string | null
  selectedDocumentTitle?: string
  shareSlug: string
  highlightSectionId: string | null
  highlightKey: number
  isCollaborator: boolean
  onCommentSubmit?: (data: {
    chunkId: string
    startOffset: number
    endOffset: number
    text: string
    content: string
  }) => Promise<void>
  onBackToCapsule: () => void
}

export function MobileDocumentOverlay({
  isOpen,
  onClose,
  mode,
  documents,
  projectName,
  onDocumentClick,
  onSectionClick,
  selectedDocumentId,
  selectedDocumentTitle,
  shareSlug,
  highlightSectionId,
  highlightKey,
  isCollaborator,
  onCommentSubmit,
  onBackToCapsule,
}: MobileDocumentOverlayProps) {
  // Escape key handler
  const handleEscape = useCallback(
    (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Lock body scroll
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  // Handle back button in document mode
  const handleBack = () => {
    if (mode === 'document') {
      onBackToCapsule()
    } else {
      onClose()
    }
  }

  const headerTitle =
    mode === 'document' && selectedDocumentTitle
      ? selectedDocumentTitle
      : 'Documents'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={headerTitle}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-border bg-background-elevated shrink-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {mode === 'document' ? 'Back' : 'Back to Chat'}
                </span>
              </button>

              {mode === 'document' && selectedDocumentTitle && (
                <span className="text-sm text-muted truncate max-w-[40%] text-center">
                  {selectedDocumentTitle}
                </span>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-card-bg transition-colors"
                aria-label="Close document viewer"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {mode === 'capsule' ? (
                <DocumentCapsule
                  documents={documents}
                  projectName={projectName}
                  onDocumentClick={onDocumentClick}
                  onSectionClick={onSectionClick}
                />
              ) : selectedDocumentId ? (
                <DocumentContentViewer
                  documentId={selectedDocumentId}
                  shareSlug={shareSlug}
                  highlightSectionId={highlightSectionId}
                  highlightKey={highlightKey}
                  isCollaborator={isCollaborator}
                  onCommentSubmit={isCollaborator ? onCommentSubmit : undefined}
                />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
