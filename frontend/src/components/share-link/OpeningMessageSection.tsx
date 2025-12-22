import { useState, useCallback } from 'react'
import { api } from '../../lib/api'
import { Button, Input } from '../ui'
import { Sparkles, RefreshCw, History, Wand2, Pencil } from 'lucide-react'
import { cn } from '../../lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface OpeningMessageVersion {
  version: number
  content: string
  source: 'generated' | 'manual' | 'refined'
  createdAt: string
}

interface OpeningMessageSectionProps {
  projectId: string
  value: string
  versions: OpeningMessageVersion[]
  onMessageChange: (message: string) => void
  onVersionsChange: (versions: OpeningMessageVersion[]) => void
  disabled?: boolean
}

/**
 * Helper to add a version to history, keeping last 10
 */
function addVersion(
  existingVersions: OpeningMessageVersion[],
  content: string,
  source: 'generated' | 'manual' | 'refined'
): OpeningMessageVersion[] {
  const newVersion: OpeningMessageVersion = {
    version: existingVersions.length + 1,
    content,
    source,
    createdAt: new Date().toISOString(),
  }
  return [...existingVersions, newVersion].slice(-10)
}

/**
 * Opening message editor component with AI generation and refinement
 * Shows preview by default, with edit mode toggle
 */
export function OpeningMessageSection({
  projectId,
  value,
  versions,
  onMessageChange,
  onVersionsChange,
  disabled = false,
}: OpeningMessageSectionProps) {
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState(false)
  const [refinePrompt, setRefinePrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Find current version number
  const currentVersion = versions.find((v) => v.content === value)?.version

  const handleGenerate = useCallback(async () => {
    if (!projectId) return

    setGenerating(true)
    setError(null)

    try {
      const result = await api.generateOpeningMessagePreview(projectId)
      onMessageChange(result.message)
      // Add to client-side version history
      const updatedVersions = addVersion(versions, result.message, 'generated')
      onVersionsChange(updatedVersions)
      setIsEditing(false) // Show preview after generation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate message')
    } finally {
      setGenerating(false)
    }
  }, [projectId, versions, onMessageChange, onVersionsChange])

  const handleRefine = useCallback(async () => {
    if (!projectId || !refinePrompt.trim() || !value) return

    setRefining(true)
    setError(null)

    try {
      const result = await api.refineOpeningMessagePreview(projectId, value, refinePrompt.trim())
      onMessageChange(result.message)
      // Add to client-side version history
      const updatedVersions = addVersion(versions, result.message, 'refined')
      onVersionsChange(updatedVersions)
      setRefinePrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refine message')
    } finally {
      setRefining(false)
    }
  }, [projectId, refinePrompt, value, versions, onMessageChange, onVersionsChange])

  const handleManualEdit = useCallback(
    (newMessage: string) => {
      onMessageChange(newMessage)
    },
    [onMessageChange]
  )

  const handleRestoreVersion = useCallback(
    (version: number) => {
      const versionToRestore = versions.find((v) => v.version === version)
      if (versionToRestore) {
        onMessageChange(versionToRestore.content)
        setIsEditing(false) // Show preview after restore
      }
    },
    [versions, onMessageChange]
  )

  const characterCount = value.length
  const isOverLimit = characterCount > 1000

  // No message yet - show generate prompt
  if (!value) {
    return (
      <div className="space-y-4">
        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Empty state with generate button */}
        <div className="bg-background-elevated rounded-lg p-6 border border-border text-center">
          <p className="text-muted mb-4">
            Generate a personalized opening message for recipients, or type your own.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              onClick={handleGenerate}
              disabled={disabled || generating || !projectId}
              isLoading={generating}
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Generate with AI
            </Button>
            <Button variant="secondary" onClick={() => setIsEditing(true)} disabled={disabled}>
              <Pencil className="w-4 h-4 mr-1" />
              Write Custom
            </Button>
          </div>
        </div>

        {/* Show textarea if user chose to write custom */}
        {isEditing && (
          <div className="space-y-2">
            <textarea
              value={value}
              onChange={(e) => handleManualEdit(e.target.value)}
              disabled={disabled}
              autoFocus
              className={cn(
                'w-full min-h-[150px] bg-card-bg border border-border rounded-lg p-3 text-foreground placeholder:text-muted resize-y',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent'
              )}
              placeholder="Write your opening message here..."
            />
          </div>
        )}

        {/* Help Text */}
        <p className="text-xs text-muted">
          <span className="text-dim">Tip:</span> Leave empty to auto-generate when recipient
          arrives.
        </p>
      </div>
    )
  }

  // Has message - show preview or edit mode
  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Preview Mode (default) */}
      {!isEditing ? (
        <div className="space-y-3">
          {/* Chat bubble preview - matches viewer experience (gold/accent bg) */}
          <div className="bg-background rounded-lg p-4 border border-border/50">
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg px-4 py-3 bg-accent">
                <div
                  className="prose prose-base max-w-none break-words text-background [&_strong]:text-background [&_a]:text-background [&_a]:underline"
                  style={{ fontFamily: 'Merriweather, Georgia, serif' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {/* Character count and version */}
          <div className="flex items-center justify-between text-xs">
            <span className={cn('text-muted', isOverLimit && 'text-destructive')}>
              {characterCount}/1000 characters
            </span>
            {currentVersion && <span className="text-dim">Version {currentVersion}</span>}
          </div>
        </div>
      ) : (
        /* Edit Mode */
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => handleManualEdit(e.target.value)}
            disabled={disabled || generating || refining}
            autoFocus
            className={cn(
              'w-full min-h-[150px] bg-card-bg border border-border rounded-lg p-3 text-foreground placeholder:text-muted resize-y',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isOverLimit && 'border-destructive focus:ring-destructive'
            )}
            placeholder="Write your opening message here..."
          />
          <div className="flex items-center justify-between text-xs">
            <span className={cn('text-muted', isOverLimit && 'text-destructive')}>
              {characterCount}/1000 characters
            </span>
            {currentVersion && <span className="text-dim">Version {currentVersion}</span>}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {!isEditing ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsEditing(true)}
            disabled={disabled}
          >
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>
            Done Editing
          </Button>
        )}

        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={disabled || generating || refining || !projectId}
          isLoading={generating}
        >
          <Sparkles className="w-4 h-4 mr-1" />
          Regenerate
        </Button>

        {versions.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowHistory(!showHistory)}
            disabled={disabled}
          >
            <History className="w-4 h-4 mr-1" />
            History ({versions.length})
          </Button>
        )}
      </div>

      {/* Version History */}
      {showHistory && versions.length > 0 && (
        <div className="bg-background-elevated rounded-lg p-3 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-dim font-mono uppercase">Version History</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => (
              <button
                key={v.version}
                onClick={() => handleRestoreVersion(v.version)}
                disabled={disabled || v.version === currentVersion}
                className={cn(
                  'px-3 py-1.5 text-xs rounded font-mono transition-colors',
                  v.version === currentVersion
                    ? 'bg-accent text-background cursor-default'
                    : 'bg-card-bg text-muted hover:bg-border hover:text-foreground disabled:opacity-50'
                )}
                title={`${v.source} - ${new Date(v.createdAt).toLocaleString()}`}
              >
                v{v.version}
                <span className="ml-1 opacity-60">
                  {v.source === 'generated' && 'AI'}
                  {v.source === 'refined' && 'R'}
                  {v.source === 'manual' && 'M'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Refine with AI */}
      <div className="bg-background-elevated rounded-lg p-3 border border-border space-y-2">
        <label className="text-xs text-dim font-mono uppercase flex items-center gap-1">
          <Wand2 className="w-3 h-3" />
          Refine with AI
        </label>
        <div className="flex gap-2">
          <Input
            value={refinePrompt}
            onChange={(e) => setRefinePrompt(e.target.value)}
            placeholder="e.g., Make it more formal, Add a call to action..."
            disabled={disabled || refining || !projectId}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && refinePrompt.trim()) {
                e.preventDefault()
                handleRefine()
              }
            }}
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleRefine}
            disabled={disabled || refining || !refinePrompt.trim() || !projectId}
            isLoading={refining}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Apply
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <p className="text-xs text-muted">
        <span className="text-dim">Tip:</span> This is how the message will appear to recipients
        when they first open the chat.
      </p>
    </div>
  )
}
