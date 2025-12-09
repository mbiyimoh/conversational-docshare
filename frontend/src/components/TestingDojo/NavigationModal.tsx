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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold mb-4">End Testing Session?</h3>

        <p className="text-gray-600 mb-6">
          {hasComments
            ? "You have comments in this session. Would you like to keep the session active or end it and apply your feedback to the AI profile?"
            : "Would you like to keep this session active for later, or end it now?"}
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onConfirm(true, false)}
            className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50"
          >
            <div className="font-medium">Keep Session Live</div>
            <div className="text-sm text-gray-500">
              Return to the same spot next time you open Testing Dojo
            </div>
          </button>

          <button
            onClick={() => onConfirm(false, false)}
            className="w-full px-4 py-3 text-left border rounded-lg hover:bg-gray-50"
          >
            <div className="font-medium">End Session</div>
            <div className="text-sm text-gray-500">
              Save conversation history but mark session as complete
            </div>
          </button>

          {hasComments && (
            <button
              onClick={() => onConfirm(false, true)}
              className="w-full px-4 py-3 text-left border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100"
            >
              <div className="font-medium text-blue-700">End & Apply Feedback</div>
              <div className="text-sm text-blue-600">
                Generate recommendations from your comments
              </div>
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
