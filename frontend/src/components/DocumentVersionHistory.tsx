import { useState, useEffect, useCallback } from 'react'
import { diffWords } from 'diff'
import { api } from '../lib/api'
import { tipTapToPlainText } from '../lib/tiptapUtils'
import { Badge } from './ui/badge'

interface Version {
  id: string
  version: number
  changeNote: string | null
  source: string | null
  createdAt: string
  editedByName?: string | null
}

interface DocumentVersionHistoryProps {
  documentId: string
  currentVersion: number
  onRollback: (version: number) => void
  onClose: () => void
}

export function DocumentVersionHistory({
  documentId,
  currentVersion,
  onRollback,
  onClose,
}: DocumentVersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [diffContent, setDiffContent] = useState<{
    original: string
    current: string
  } | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.getDocumentVersions(documentId)
      setVersions(response.versions)
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  const handleViewDiff = async (version: number) => {
    setSelectedVersion(version)
    setLoadingDiff(true)
    try {
      const [selected, current] = await Promise.all([
        api.getDocumentVersion(documentId, version),
        api.getDocumentVersion(documentId, currentVersion),
      ])
      setDiffContent({
        original: tipTapToPlainText(selected.version.content),
        current: tipTapToPlainText(current.version.content),
      })
    } catch (err) {
      console.error('Failed to load diff:', err)
    } finally {
      setLoadingDiff(false)
    }
  }

  const renderDiff = () => {
    if (!diffContent) return null
    const diff = diffWords(diffContent.original, diffContent.current)
    return (
      <div className="font-mono text-sm whitespace-pre-wrap p-4 bg-background-elevated rounded">
        {diff.map((part, i) => (
          <span
            key={i}
            className={
              part.added
                ? 'bg-success/10 text-success'
                : part.removed
                  ? 'bg-destructive/10 text-destructive line-through'
                  : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="fixed inset-4 bg-card-bg z-50 flex flex-col rounded-xl shadow-2xl">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Version History</h2>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground text-xl"
        >
          ×
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Version List */}
        <div className="w-80 border-r border-border overflow-y-auto">
          {loading ? (
            <div className="p-4 text-muted">Loading...</div>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className={`p-4 border-b border-border cursor-pointer hover:bg-white/5 transition-colors ${
                  selectedVersion === v.version ? 'bg-accent/10' : ''
                }`}
                onClick={() => handleViewDiff(v.version)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Version {v.version}
                    {v.version === currentVersion && (
                      <Badge variant="success" className="ml-2">
                        Current
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {v.changeNote && (
                  <p className="text-sm text-muted mt-1">{v.changeNote}</p>
                )}
                <p className="text-xs text-dim mt-1">
                  {v.source === 'recommendation'
                    ? 'AI Recommendation'
                    : v.source === 'import'
                      ? 'Initial Import'
                      : 'Manual Edit'}
                  {v.editedByName && ` by ${v.editedByName}`}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Diff View */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingDiff ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-accent border-t-transparent rounded-full" />
              <span className="ml-2 text-muted">Loading diff...</span>
            </div>
          ) : selectedVersion !== null ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">
                  Comparing Version {selectedVersion} → {currentVersion}
                </h3>
                {selectedVersion !== currentVersion && (
                  <button
                    onClick={() => onRollback(selectedVersion)}
                    className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90"
                  >
                    Rollback to Version {selectedVersion}
                  </button>
                )}
              </div>
              {renderDiff()}
            </>
          ) : (
            <div className="text-muted text-center py-12">
              Select a version to view changes
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
