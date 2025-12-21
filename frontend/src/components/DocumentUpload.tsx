import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { api } from '../lib/api'
import { formatFileSize } from '../lib/utils'
import { DocumentEditor } from './DocumentEditor'
import { DocumentVersionHistory } from './DocumentVersionHistory'
import { Card, Button, Badge } from './ui'
import { FileText, Upload, Trash2, Clock, Pencil, RotateCcw } from 'lucide-react'

interface Document {
  id: string
  originalName: string
  filename: string
  mimeType: string
  fileSize: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  processingError?: string
  uploadedAt: string
  processedAt?: string
  isEditable?: boolean
  currentVersion?: number
}

/**
 * Parse auto-retry info from processingError field.
 * Backend stores retry count as "[auto-retry N] Previous error: ..."
 */
function parseAutoRetryInfo(processingError?: string): { retryCount: number; originalError: string } | null {
  if (!processingError) return null
  const match = processingError.match(/^\[auto-retry (\d+)\] Previous error: (.*)$/)
  if (match) {
    return {
      retryCount: parseInt(match[1], 10),
      originalError: match[2],
    }
  }
  return null
}

/**
 * Check if a failed document is eligible for auto-retry (uploaded within last hour).
 * The backend auto-retries failed docs up to 2 times within 1 hour of upload.
 */
function isEligibleForAutoRetry(doc: Document): boolean {
  if (doc.status !== 'failed') return false
  const uploadedAt = new Date(doc.uploadedAt).getTime()
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const autoRetryInfo = parseAutoRetryInfo(doc.processingError)
  const retryCount = autoRetryInfo?.retryCount ?? 0
  // Backend allows up to 2 auto-retries, within 1 hour of upload
  return uploadedAt > oneHourAgo && retryCount < 2
}

interface DocumentUploadProps {
  projectId: string
  onUploadComplete?: () => void
}

// Geometric file type icons
function PDFIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h4" />
      <circle cx="16" cy="16" r="2" fill="currentColor" className="text-destructive" />
    </svg>
  )
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h8M8 18h4" />
    </svg>
  )
}

function SheetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M4 8h16M4 14h16M10 8v14" />
    </svg>
  )
}

function MarkdownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M7 15V9l2.5 3L12 9v6M15 12h2m0 0v3m0-3l2-3" />
    </svg>
  )
}

interface UploadProgress {
  filename: string
  status: 'pending' | 'uploading' | 'success' | 'failed'
  error?: string
}

export function DocumentUpload({ projectId, onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([])
  const [editingDocument, setEditingDocument] = useState<{
    id: string
    content: Record<string, unknown> | null
  } | null>(null)
  const [viewingHistory, setViewingHistory] = useState<{
    id: string
    currentVersion: number
  } | null>(null)

  // Load documents from API
  const loadDocuments = useCallback(async () => {
    try {
      const data = await api.getDocuments(projectId)
      setDocuments(data.documents as Document[])
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch existing documents on mount
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Auto-refresh while documents are processing OR have pending auto-retries
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'pending' || d.status === 'processing')
    const hasPendingAutoRetry = documents.some(d => isEligibleForAutoRetry(d))

    if (!hasProcessing && !hasPendingAutoRetry) return

    const interval = setInterval(loadDocuments, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [documents, loadDocuments])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError('')
    setUploading(true)

    // Initialize upload queue with all files as pending
    const initialQueue: UploadProgress[] = acceptedFiles.map(file => ({
      filename: file.name,
      status: 'pending',
    }))
    setUploadQueue(initialQueue)

    // Process files sequentially to avoid overwhelming the server
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i]

      // Update status to uploading
      setUploadQueue(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'uploading' } : item
      ))

      try {
        // Auto-retry is handled inside uploadDocument with exponential backoff
        const result = await api.uploadDocument(projectId, file)
        // Add the newly uploaded document to the list
        setDocuments(prev => [result.document as Document, ...prev])

        // Update status to success
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'success' } : item
        ))
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed'
        // Update status to failed
        setUploadQueue(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'failed', error: errorMsg } : item
        ))
        // Don't stop the queue - continue with other files
      }
    }

    // Clear the queue after a short delay to show final status
    setTimeout(() => setUploadQueue([]), 3000)

    if (onUploadComplete) {
      onUploadComplete()
    }

    setUploading(false)
  }, [projectId, onUploadComplete])

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.deleteDocument(documentId)
      setDocuments(prev => prev.filter(d => d.id !== documentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleRetry = async (documentId: string) => {
    try {
      // First, refresh the document list to get latest status
      // This prevents acting on stale state (e.g., doc already succeeded via auto-retry)
      const freshData = await api.getDocuments(projectId)
      const freshDoc = (freshData.documents as Document[]).find(d => d.id === documentId)

      if (!freshDoc) {
        setError('Document not found')
        return
      }

      if (freshDoc.status === 'completed') {
        // Doc already succeeded - just refresh UI
        setDocuments(freshData.documents as Document[])
        return
      }

      if (freshDoc.status !== 'failed') {
        // Doc is processing or pending - just refresh UI
        setDocuments(freshData.documents as Document[])
        return
      }

      // Doc is still failed, proceed with retry
      await api.retryDocument(documentId)
      // Update the document status to pending locally
      setDocuments(prev => prev.map(d =>
        d.id === documentId ? { ...d, status: 'pending' as const, processingError: undefined } : d
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
      // Refresh to show latest state even on error
      loadDocuments()
    }
  }

  const handleEditDocument = async (documentId: string) => {
    try {
      const response = await api.getDocumentForEdit(documentId)
      setEditingDocument({ id: documentId, content: response.content })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document for editing')
    }
  }

  const handleViewHistory = (documentId: string, currentVersion: number) => {
    setViewingHistory({ id: documentId, currentVersion })
  }

  const handleRollback = async (version: number) => {
    if (!viewingHistory) return
    try {
      await api.rollbackDocumentVersion(viewingHistory.id, version)
      setViewingHistory(null)
      loadDocuments() // Refresh document list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback')
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/markdown': ['.md'],
    },
    maxSize: 52428800, // 50MB
    disabled: uploading,
  })

  const getStatusBadge = (doc: Document) => {
    const { status } = doc

    switch (status) {
      case 'pending':
        return (
          <Badge variant="warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse mr-1" />
            Queued
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="secondary">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent mr-1" />
            Processing
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="success">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready
          </Badge>
        )
      case 'failed': {
        // Check if auto-retry is pending
        const willAutoRetry = isEligibleForAutoRetry(doc)
        const autoRetryInfo = parseAutoRetryInfo(doc.processingError)

        if (willAutoRetry) {
          return (
            <Badge variant="warning">
              <RotateCcw className="w-3 h-3 mr-1 animate-spin" style={{ animationDuration: '3s' }} />
              Retrying{autoRetryInfo ? ` (${autoRetryInfo.retryCount + 1}/2)` : '...'}
            </Badge>
          )
        }

        return (
          <Badge variant="destructive">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed{autoRetryInfo ? ` (after ${autoRetryInfo.retryCount} retries)` : ''}
          </Badge>
        )
      }
    }
  }

  const getFileIcon = (mimeType: string) => {
    const className = "w-6 h-6 text-accent"
    if (mimeType === 'application/pdf') return <PDFIcon className={className} />
    if (mimeType.includes('wordprocessingml')) return <DocIcon className={className} />
    if (mimeType.includes('spreadsheetml')) return <SheetIcon className={className} />
    if (mimeType.includes('markdown') || mimeType === 'text/markdown') return <MarkdownIcon className={className} />
    return <FileText className={className} />
  }

  const completedCount = documents.filter(d => d.status === 'completed').length
  const processingCount = documents.filter(d => d.status === 'pending' || d.status === 'processing').length

  return (
    <div className="w-full space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragActive
            ? 'border-accent bg-accent/10'
            : 'border-border bg-card-bg hover:border-accent/50'
        } ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="space-y-2">
          <div className="flex justify-center">
            <Upload className="w-10 h-10 text-accent" />
          </div>
          {isDragActive ? (
            <p className="text-lg font-display text-accent">Drop files here...</p>
          ) : (
            <>
              <p className="text-lg font-display text-foreground">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-muted">
                Supports PDF, DOCX, XLSX, and Markdown files (max 50MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Upload Queue Progress */}
      {uploadQueue.length > 0 && (
        <Card className="bg-accent/10 border-accent/30">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span>Uploading {uploadQueue.filter(f => f.status === 'success').length}/{uploadQueue.length} files...</span>
            </div>
            <div className="space-y-1">
              {uploadQueue.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {item.status === 'pending' && (
                    <span className="h-2 w-2 rounded-full bg-muted" />
                  )}
                  {item.status === 'uploading' && (
                    <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  )}
                  {item.status === 'success' && (
                    <svg className="w-3 h-3 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {item.status === 'failed' && (
                    <svg className="w-3 h-3 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={item.status === 'failed' ? 'text-destructive' : 'text-foreground'}>
                    {item.filename}
                  </span>
                  {item.error && (
                    <span className="text-destructive text-xs">({item.error})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Status Summary */}
      {documents.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">
                <strong className="text-foreground">{documents.length}</strong> document{documents.length !== 1 ? 's' : ''} uploaded
              </span>
              {completedCount > 0 && (
                <span className="text-sm text-success">
                  <strong>{completedCount}</strong> ready for chat
                </span>
              )}
              {processingCount > 0 && (
                <span className="text-sm text-accent">
                  <strong>{processingCount}</strong> processing...
                </span>
              )}
            </div>
            {completedCount > 0 && (
              <p className="text-sm text-muted flex items-center gap-1">
                <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Documents are saved automatically
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="ml-2 text-muted">Loading documents...</span>
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-display text-foreground">Project Documents</h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card-bg">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="flex-shrink-0">{getFileIcon(doc.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{doc.originalName}</p>
                    <p className="text-sm text-muted">
                      {formatFileSize(doc.fileSize)}
                      {doc.processedAt && (
                        <> · Processed {new Date(doc.processedAt).toLocaleDateString()}</>
                      )}
                    </p>
                    {doc.status === 'failed' && doc.processingError && (
                      <p className="text-sm text-destructive mt-1">
                        {parseAutoRetryInfo(doc.processingError)?.originalError || doc.processingError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {getStatusBadge(doc)}
                  {doc.status === 'failed' && !isEligibleForAutoRetry(doc) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(doc.id)}
                      title="Retry processing"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Retry
                    </Button>
                  )}
                  {doc.isEditable && doc.status === 'completed' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditDocument(doc.id)}
                        title="Edit document"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewHistory(doc.id, doc.currentVersion || 1)}
                        title="View version history"
                      >
                        <Clock className="w-4 h-4 mr-1" />
                        History
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-dim hover:text-destructive transition-colors p-1"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <p className="text-muted">No documents uploaded yet</p>
          <p className="text-sm text-dim mt-1">
            Upload documents above to get started
          </p>
        </div>
      )}

      {/* Next Steps Guide */}
      {documents.length > 0 && completedCount > 0 && (
        <Card className="border-accent/30" glow>
          <h4 className="font-display text-foreground mb-2">Next Steps</h4>
          <ol className="text-sm text-muted space-y-1 list-decimal list-inside">
            <li>Configure your AI agent in the <strong className="text-foreground">AI Agent</strong> tab</li>
            <li>Create a share link in the <strong className="text-foreground">Share</strong> tab</li>
            <li>Send the link to your audience to start conversations!</li>
          </ol>
        </Card>
      )}

      {/* Document Editor Modal */}
      {editingDocument && (
        <DocumentEditor
          documentId={editingDocument.id}
          initialContent={editingDocument.content}
          onSave={() => {
            setEditingDocument(null)
            loadDocuments()
          }}
          onClose={() => setEditingDocument(null)}
        />
      )}

      {/* Version History Modal */}
      {viewingHistory && (
        <DocumentVersionHistory
          documentId={viewingHistory.id}
          currentVersion={viewingHistory.currentVersion}
          onRollback={handleRollback}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </div>
  )
}
