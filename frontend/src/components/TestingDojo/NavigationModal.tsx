import { Button } from '../ui'

interface NavigationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (keepLive: boolean, applyFeedback: boolean) => void
  hasComments: boolean
}

export function NavigationModal({
  isOpen,
  onClose,
  onConfirm,
  hasComments,
}: NavigationModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[rgba(255,255,255,0.03)] backdrop-blur-sm border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">End Testing Session?</h3>

        <p className="text-muted mb-6">
          {hasComments
            ? "You have comments in this session. Would you like to keep the session active or end it and apply your feedback to the AI profile?"
            : "Would you like to keep this session active for later, or end it now?"}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onConfirm(true, false)}
            className="w-full px-4 py-3 text-left border border-border rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="font-medium text-foreground">Keep Session Live</div>
            <div className="text-sm text-muted">
              Return to the same spot next time you open Testing Dojo
            </div>
          </button>

          <button
            onClick={() => onConfirm(false, false)}
            className="w-full px-4 py-3 text-left border border-border rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="font-medium text-foreground">End Session</div>
            <div className="text-sm text-muted">
              Save conversation history but mark session as complete
            </div>
          </button>

          {hasComments && (
            <button
              onClick={() => onConfirm(false, true)}
              className="w-full px-4 py-3 text-left border border-accent/30 bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors"
            >
              <div className="font-medium text-accent">End & Apply Feedback</div>
              <div className="text-sm text-accent/80">
                Generate recommendations from your comments
              </div>
            </button>
          )}
        </div>

        <Button
          onClick={onClose}
          variant="ghost"
          className="mt-4 w-full"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
