import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { api } from '../lib/api'
import { formatFileSize } from '../lib/utils'
import { DocumentEditor } from './DocumentEditor'
import { DocumentVersionHistory } from './DocumentVersionHistory'

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
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            Queued
          </span>
        )
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            Processing
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            <span>✓</span>
            Ready
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            <span>✗</span>
            Failed
          </span>
        )
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return '📕'
    if (mimeType.includes('wordprocessingml')) return '📘'
    if (mimeType.includes('spreadsheetml')) return '📗'
    if (mimeType.includes('markdown') || mimeType === 'text/markdown') return '📝'
    return '📄'
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
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        } ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="space-y-2">
          <div className="text-4xl">📄</div>
          {isDragActive ? (
            <p className="text-lg font-medium text-blue-600">Drop files here...</p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-700">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, DOCX, XLSX, and Markdown files (max 50MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-blue-900">Uploading...</span>
          </div>
        </div>
      )}

      {/* Status Summary */}
      {documents.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                <strong>{documents.length}</strong> document{documents.length !== 1 ? 's' : ''} uploaded
              </span>
              {completedCount > 0 && (
                <span className="text-sm text-green-600">
                  <strong>{completedCount}</strong> ready for chat
                </span>
              )}
              {processingCount > 0 && (
                <span className="text-sm text-blue-600">
                  <strong>{processingCount}</strong> processing...
                </span>
              )}
            </div>
            {completedCount > 0 && (
              <p className="text-sm text-gray-500">
                ✓ Documents are saved automatically
              </p>
            )}
          </div>
        </div>
      )}

      {/* Documents List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="ml-2 text-gray-500">Loading documents...</span>
        </div>
      ) : documents.length > 0 ? (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-700">Project Documents</h3>
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-2xl flex-shrink-0">{getFileIcon(doc.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{doc.originalName}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(doc.fileSize)}
                      {doc.processedAt && (
                        <> · Processed {new Date(doc.processedAt).toLocaleDateString()}</>
                      )}
                    </p>
                    {doc.status === 'failed' && doc.processingError && (
                      <p className="text-sm text-red-600 mt-1">{doc.processingError}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {getStatusBadge(doc.status)}
                  {doc.isEditable && doc.status === 'completed' && (
                    <>
                      <button
                        onClick={() => handleEditDocument(doc.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        title="Edit document"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleViewHistory(doc.id, doc.currentVersion || 1)}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                        title="View version history"
                      >
                        History
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    title="Delete document"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-gray-500">No documents uploaded yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Upload documents above to get started
          </p>
        </div>
      )}

      {/* Next Steps Guide */}
      {documents.length > 0 && completedCount > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <h4 className="font-medium text-blue-900 mb-2">✨ Next Steps</h4>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Configure your AI agent in the <strong>AI Agent</strong> tab</li>
            <li>Create a share link in the <strong>Share</strong> tab</li>
            <li>Send the link to your audience to start conversations!</li>
          </ol>
        </div>
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
