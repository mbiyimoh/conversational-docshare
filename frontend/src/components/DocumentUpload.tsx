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

export function DocumentUpload({ projectId, onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
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

  // Auto-refresh while documents are processing
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'pending' || d.status === 'processing')
    if (!hasProcessing) return

    const interval = setInterval(loadDocuments, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [documents, loadDocuments])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError('')
    setUploading(true)

    try {
      for (const file of acceptedFiles) {
        const result = await api.uploadDocument(projectId, file)
        // Add the newly uploaded document to the list
        setDocuments(prev => [result.document as Document, ...prev])
      }

      if (onUploadComplete) {
        onUploadComplete()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
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
      await api.retryDocument(documentId)
      // Update the document status to pending locally
      setDocuments(prev => prev.map(d =>
        d.id === documentId ? { ...d, status: 'pending' as const, processingError: undefined } : d
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed')
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

  const getStatusBadge = (status: Document['status']) => {
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
      case 'failed':
        return (
          <Badge variant="destructive">
            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </Badge>
        )
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

      {/* Uploading indicator */}
      {uploading && (
        <Card className="bg-accent/10 border-accent/30">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-foreground">Uploading...</span>
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
                      <p className="text-sm text-destructive mt-1">{doc.processingError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {getStatusBadge(doc.status)}
                  {doc.status === 'failed' && (
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
