import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Button } from './ui'
import { useIsMobile } from '../hooks/useIsMobile'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

// Ceiling height from top of viewport (px) - leaves room to see chat thread peek
const MOBILE_CEILING_HEIGHT = 100

export function ChatInput({ onSend, disabled, placeholder = 'Type your message...' }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile(768)

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea with ceiling constraint on mobile
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'

    if (isMobile) {
      // Calculate max height based on viewport minus ceiling
      // Account for: status bar, peek of chat, and any keyboard insets
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const containerRect = containerRef.current?.getBoundingClientRect()
      const containerPadding = containerRect ? containerRect.height - textarea.offsetHeight : 60

      // Max height = viewport - ceiling - container padding (for button, hint text, etc)
      const maxHeight = viewportHeight - MOBILE_CEILING_HEIGHT - containerPadding

      // Set height to scrollHeight but capped at maxHeight
      const newHeight = Math.min(textarea.scrollHeight, Math.max(maxHeight, 48))
      textarea.style.height = `${newHeight}px`
    } else {
      // Desktop: simpler auto-resize with reasonable max
      const maxDesktopHeight = 200
      const newHeight = Math.min(textarea.scrollHeight, maxDesktopHeight)
      textarea.style.height = `${newHeight}px`
    }
  }, [isMobile])

  // Adjust height when message changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [message, adjustTextareaHeight])

  // Re-adjust on viewport resize (especially for mobile keyboard)
  useEffect(() => {
    if (!isMobile) return

    const handleResize = () => adjustTextareaHeight()

    // Use visualViewport API for better mobile keyboard handling
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      return () => window.visualViewport?.removeEventListener('resize', handleResize)
    } else {
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isMobile, adjustTextareaHeight])

  return (
    <div ref={containerRef} className="border-t border-border bg-background-elevated p-4">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-2 font-body text-foreground placeholder:text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-background-elevated disabled:text-muted transition-[border-color,box-shadow] min-h-[44px] overflow-y-auto"
          style={{
            // Smooth height transition for better UX
            transition: 'height 150ms ease-out, border-color 150ms, box-shadow 150ms',
          }}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="flex-shrink-0"
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
