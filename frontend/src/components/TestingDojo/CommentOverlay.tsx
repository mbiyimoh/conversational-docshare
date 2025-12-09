import { useState } from 'react'

const COMMENT_TEMPLATES = [
  { id: 'identity', label: 'Identity/Role', icon: '👤', placeholder: 'The agent should present itself as...' },
  { id: 'communication', label: 'Communication', icon: '💬', placeholder: 'The tone should be more/less...' },
  { id: 'content', label: 'Content', icon: '📋', placeholder: 'Should emphasize/de-emphasize...' },
  { id: 'engagement', label: 'Engagement', icon: '🎯', placeholder: 'Should ask about/probe deeper into...' },
  { id: 'framing', label: 'Framing', icon: '🖼️', placeholder: 'Should frame this as...' },
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
      className="absolute left-0 right-0 -bottom-48 z-10 bg-white border rounded-lg shadow-lg p-4"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quick Templates */}
      <div className="flex flex-wrap gap-2 mb-3">
        {COMMENT_TEMPLATES.map((template) => (
          <button
            type="button"
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
              selectedTemplate === template.id
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {template.icon} {template.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add your feedback..."
        rows={3}
        className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Add Comment
        </button>
      </div>
    </div>
  )
}
