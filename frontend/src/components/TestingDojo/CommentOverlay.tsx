import { useState } from 'react'

// Icon components using geometric SVG shapes (no emojis per design system)
const IdentityIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="5" r="3" />
    <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" strokeLinecap="round" />
  </svg>
)

const CommunicationIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 5c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2H9l-3 3v-3H4c-1.1 0-2-.9-2-2V5z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const ContentIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="2" width="10" height="12" rx="1" />
    <path d="M6 5h4M6 8h4M6 11h2" strokeLinecap="round" />
  </svg>
)

const EngagementIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" />
    <circle cx="8" cy="8" r="2" fill="currentColor" />
  </svg>
)

const FramingIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="12" height="12" rx="1" />
    <path d="M6 2v12M10 2v12M2 6h12M2 10h12" strokeLinecap="round" />
  </svg>
)

const COMMENT_TEMPLATES = [
  { id: 'identity', label: 'Identity/Role', Icon: IdentityIcon, placeholder: 'The agent should present itself as...' },
  { id: 'communication', label: 'Communication', Icon: CommunicationIcon, placeholder: 'The tone should be more/less...' },
  { id: 'content', label: 'Content', Icon: ContentIcon, placeholder: 'Should emphasize/de-emphasize...' },
  { id: 'engagement', label: 'Engagement', Icon: EngagementIcon, placeholder: 'Should ask about/probe deeper into...' },
  { id: 'framing', label: 'Framing', Icon: FramingIcon, placeholder: 'Should frame this as...' },
]

interface CommentOverlayProps {
  onSubmit: (content: string, templateId?: string) => void
  onCancel: () => void
}

export function CommentOverlay({ onSubmit, onCancel }: CommentOverlayProps) {
  const [content, setContent] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  const handleTemplateClick = (template: typeof COMMENT_TEMPLATES[0]) => {
    setSelectedTemplate(template.id)
    if (!content) {
      setContent(template.placeholder)
    }
  }

  const handleSubmit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (content.trim()) {
      onSubmit(content.trim(), selectedTemplate || undefined)
    }
  }

  return (
    <div
      className="absolute left-0 right-0 -bottom-48 z-10 bg-background-elevated border border-border rounded-lg shadow-lg p-4 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2 mb-3">
        {COMMENT_TEMPLATES.map((template) => {
          const { Icon } = template
          return (
            <button
              type="button"
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className={`px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1.5 ${
                selectedTemplate === template.id
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-white/5 border-border hover:bg-white/10 text-muted hover:text-foreground'
              }`}
            >
              <Icon /> {template.label}
            </button>
          )
        })}
      </div>

      {/* Input */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add your feedback..."
        rows={3}
        className="w-full bg-white/5 border border-border text-foreground placeholder:text-dim rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        autoFocus
      />

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm text-muted hover:bg-white/5 hover:text-foreground rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-3 py-1 text-sm bg-accent text-background rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          Add Comment
        </button>
      </div>
    </div>
  )
}
