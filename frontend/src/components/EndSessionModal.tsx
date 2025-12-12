import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { LeaveMessageModal } from './LeaveMessageModal'
import {
  Card,
  Button,
  Input,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalContent,
  ModalFooter
} from './ui'

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
    <Modal isOpen={true} onClose={onClose} size="md" showCloseButton={false}>
      {mode === 'confirm' && (
        <>
          <ModalHeader>
            <ModalTitle>End Your Session?</ModalTitle>
          </ModalHeader>

          <ModalContent>
            <Card className="mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Project:</span>
                  <span className="font-medium text-foreground">{projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Messages:</span>
                  <span className="font-medium text-accent">{messageCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Duration:</span>
                  <span className="font-medium text-foreground">{duration} minutes</span>
                </div>
              </div>
            </Card>

            <Card className="mb-6 border-accent/30" glow>
              <h4 className="font-display text-foreground mb-2">Save this conversation</h4>
              <p className="text-sm text-muted mb-3">
                Create a free account to save this conversation and access it anytime from your dashboard.
              </p>
              <ul className="text-sm text-muted space-y-1">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-accent rounded-full"></span>
                  Access your conversation history
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-accent rounded-full"></span>
                  Continue conversations later
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 bg-accent rounded-full"></span>
                  Explore other shared documents
                </li>
              </ul>
            </Card>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => setMode('register')}
                className="w-full"
              >
                Save & Create Account
              </Button>

              <Button
                variant="secondary"
                onClick={handleJustEnd}
                disabled={ending}
                isLoading={ending}
                className="w-full"
              >
                {ending ? 'Ending...' : 'Just End'}
              </Button>
            </div>

            <button
              onClick={onClose}
              className="mt-4 w-full text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </ModalContent>
        </>
      )}

      {mode === 'register' && (
        <>
          <ModalHeader>
            <ModalTitle>Create Your Account</ModalTitle>
            <p className="text-sm text-muted mt-1">
              Save this conversation and access it anytime
            </p>
          </ModalHeader>

          <ModalContent className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {error}
              </div>
            )}

            <Input
              id="name"
              label="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />

            <Input
              id="email"
              type="email"
              label="Email *"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />

            <Input
              id="password"
              type="password"
              label="Password *"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
            />
          </ModalContent>

          <ModalFooter className="flex-col">
            <Button
              onClick={handleSaveAndRegister}
              disabled={saving}
              isLoading={saving}
              className="w-full"
            >
              {saving ? 'Creating Account...' : 'Create Account & Save'}
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setMode('confirm')
                setError('')
              }}
              disabled={saving}
              className="w-full"
            >
              Back
            </Button>
          </ModalFooter>
        </>
      )}

      {mode === 'success' && (
        <>
          <ModalContent className="text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-success"
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
            <h3 className="font-display text-xl text-foreground mb-2">Account Created!</h3>
            <p className="text-sm text-muted">
              Your conversation has been saved to your account. You can access it anytime from your dashboard.
            </p>
          </ModalContent>

          <ModalFooter>
            <Button onClick={handleGoToDashboard} className="w-full">
              Go to Dashboard
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
