import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { LeaveMessageModal } from './LeaveMessageModal'

type ModalMode = 'message' | 'confirm' | 'register' | 'success'

interface EndSessionModalProps {
  conversationId: string
  messageCount: number
  startedAt: Date
  projectName: string
  senderName?: string
  onClose: () => void
  onEnded: () => void
}

export function EndSessionModal({
  conversationId,
  messageCount,
  startedAt,
  projectName,
  senderName = 'the sender',
  onClose,
  onEnded,
}: EndSessionModalProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ModalMode>('message')
  const [ending, setEnding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [recipientMessage, setRecipientMessage] = useState<string | null>(null)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  // Calculate session duration
  const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000 / 60) // minutes

  // Reset mode when modal opens
  useEffect(() => {
    setMode('message')
    setRecipientMessage(null)
    setError('')
  }, [conversationId])

  const handleMessageSubmit = (message: string) => {
    setRecipientMessage(message)
    setMode('confirm')
  }

  const handleMessageSkip = () => {
    setRecipientMessage(null)
    setMode('confirm')
  }

  const handleJustEnd = async () => {
    try {
      setEnding(true)
      setError('')
      await api.endConversationWithMessage(conversationId, recipientMessage || undefined)
      onEnded()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end conversation')
    } finally {
      setEnding(false)
    }
  }

  const handleSaveAndRegister = async () => {
    // Validate required fields
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!password.trim()) {
      setError('Password is required')
      return
    }

    try {
      setSaving(true)
      setError('')

      // 1. End the conversation with recipient message
      await api.endConversationWithMessage(conversationId, recipientMessage || undefined)

      // 2. Register the user
      const registerResponse = await api.register(email, password, name || undefined)

      // 3. Set the auth token
      api.setToken(registerResponse.token)

      // 4. Save the conversation to their account
      await api.saveConversation(conversationId)

      // 5. Show success mode (don't call onEnded - let user see success screen)
      setMode('success')
    } catch (err) {
      console.error('[EndSession] Error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save conversation')
    } finally {
      setSaving(false)
    }
  }

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  // Show LeaveMessageModal as first step
  if (mode === 'message') {
    return (
      <LeaveMessageModal
        isOpen={true}
        senderName={senderName}
        onSubmit={handleMessageSubmit}
        onSkip={handleMessageSkip}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {mode === 'confirm' && (
          <>
            <h3 className="text-lg font-semibold mb-4">End Your Session?</h3>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Project:</span>
                <span className="font-medium">{projectName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Messages:</span>
                <span className="font-medium">{messageCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{duration} minutes</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">Save this conversation</h4>
              <p className="text-sm text-blue-700 mb-3">
                Create a free account to save this conversation and access it anytime from your dashboard.
              </p>
              <ul className="text-sm text-blue-600 space-y-1">
                <li>Access your conversation history</li>
                <li>Continue conversations later</li>
                <li>Explore other shared documents</li>
              </ul>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setMode('register')}
                className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save & Create Account
              </button>

              <button
                onClick={handleJustEnd}
                disabled={ending}
                className="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ending ? 'Ending...' : 'Just End'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {mode === 'register' && (
          <>
            <h3 className="text-lg font-semibold mb-2">Create Your Account</h3>
            <p className="text-sm text-gray-600 mb-6">
              Save this conversation and access it anytime
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name (optional)
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Create a password"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSaveAndRegister}
                disabled={saving}
                className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating Account...' : 'Create Account & Save'}
              </button>

              <button
                onClick={() => {
                  setMode('confirm')
                  setError('')
                }}
                disabled={saving}
                className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
            </div>
          </>
        )}

        {mode === 'success' && (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Account Created!</h3>
              <p className="text-sm text-gray-600">
                Your conversation has been saved to your account. You can access it anytime from your dashboard.
              </p>
            </div>

            <button
              onClick={handleGoToDashboard}
              className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
