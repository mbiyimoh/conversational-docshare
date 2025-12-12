import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useCallback } from 'react'
import { api } from '../lib/api'

interface DocumentEditorProps {
  documentId: string
  initialContent: Record<string, unknown> | null
  onSave: () => void
  onClose: () => void
}

export function DocumentEditor({
  documentId,
  initialContent,
  onSave,
  onClose,
}: DocumentEditorProps) {
  const [saving, setSaving] = useState(false)
  const [changeNote, setChangeNote] = useState('')
  const [error, setError] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[400px] p-4 text-foreground',
      },
    },
  })

  const handleSave = useCallback(async () => {
    if (!editor) return

    setSaving(true)
    setError('')
    try {
      const content = editor.getJSON()
      await api.saveDocumentVersion(documentId, content, changeNote || undefined)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [editor, documentId, changeNote, onSave])

  if (!editor) return null

  return (
    <div className="fixed inset-4 bg-card-bg z-50 flex flex-col rounded-xl shadow-2xl border border-border">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card-bg">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded font-bold transition-colors ${
            editor.isActive('bold') ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Bold"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded italic transition-colors ${
            editor.isActive('italic') ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Italic"
        >
          I
        </button>
        <div className="h-6 w-px bg-border mx-2" />
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded text-sm font-medium transition-colors ${
            editor.isActive('heading', { level: 3 }) ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Heading 3"
        >
          H3
        </button>
        <div className="h-6 w-px bg-border mx-2" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bulletList') ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('orderedList') ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Numbered List"
        >
          1.
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('blockquote') ? 'bg-white/10 text-foreground' : 'text-muted hover:bg-white/10 hover:text-foreground'
          }`}
          title="Quote"
        >
          &quot;
        </button>

        <div className="flex-1" />

        {error && <span className="text-destructive text-sm mr-2">{error}</span>}

        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Change note (optional)"
          className="px-3 py-1 border border-border rounded text-sm w-64 bg-background-elevated text-foreground placeholder:text-dim"
        />
        <button
          onClick={onClose}
          className="px-4 py-2 text-muted hover:bg-white/5 hover:text-foreground rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-gold text-background rounded hover:bg-gold-hover disabled:opacity-50 transition-colors font-medium"
        >
          {saving ? 'Saving...' : 'Save Version'}
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto bg-background-elevated">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
