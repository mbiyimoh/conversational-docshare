import { useState, useEffect } from 'react'

interface DocumentOutlineSection {
  id: string
  title: string
  level: number
  position: number
}

interface DocumentViewerProps {
  documentId: string
  highlightSectionId?: string
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export function DocumentViewer({ documentId, highlightSectionId }: DocumentViewerProps) {
  const [document, setDocument] = useState<{
    title: string
    outline: DocumentOutlineSection[]
    mimeType: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSection, setSelectedSection] = useState<string | null>(highlightSectionId || null)

  useEffect(() => {
    loadDocument()
  }, [documentId])

  useEffect(() => {
    if (highlightSectionId) {
      setSelectedSection(highlightSectionId)
      // Scroll to section if it exists
      const element = window.document.getElementById(`section-${highlightSectionId}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [highlightSectionId])

  const loadDocument = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Failed to load document')
      }

      const data = await response.json()
      setDocument(data.document)
    } catch (error) {
      console.error('Failed to load document:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`${API_URL}/api/documents/${documentId}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        throw new Error('Failed to download document')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document?.title || 'document'
      window.document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      window.document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download document:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500">Loading document...</div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-500">Failed to load document</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-xl font-bold">{document.title}</h2>
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleDownload}
            className="rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700"
          >
            Download
          </button>
        </div>
      </div>

      {/* Document Outline */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-4 font-semibold text-gray-700">Document Outline</h3>
        <div className="space-y-2">
          {document.outline.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className={`cursor-pointer rounded p-2 transition-colors ${
                selectedSection === section.id
                  ? 'bg-blue-100 border-l-4 border-blue-600'
                  : 'hover:bg-gray-50'
              }`}
              style={{ paddingLeft: `${section.level * 12}px` }}
              onClick={() => setSelectedSection(section.id)}
            >
              <div className="font-medium text-gray-900">{section.title}</div>
            </div>
          ))}
        </div>

        {document.outline.length === 0 && (
          <div className="text-gray-500">No outline available for this document</div>
        )}
      </div>

      {/* Document viewer note */}
      <div className="border-t bg-gray-50 p-4 text-sm text-gray-600">
        <p>
          Note: Full document preview requires PDF.js integration. Currently showing document outline.
          Use the Download button to view the complete document.
        </p>
      </div>
    </div>
  )
}
