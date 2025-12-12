import { useState, KeyboardEvent } from 'react'
import { Button } from './ui'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = 'Type your message...' }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-background-elevated p-4">
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={3}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-2 font-body text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-background-elevated disabled:text-muted transition-colors"
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
        >
          Send
        </Button>
      </div>
      <div className="mt-2 text-xs text-dim">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
}
