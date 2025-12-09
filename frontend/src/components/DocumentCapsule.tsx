import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface DocumentOutlineSection {
  id: string
  title: string
  level: number
  position: number
}

interface DocumentInfo {
  id: string
  filename: string
  title: string
  summary?: string
  outline?: DocumentOutlineSection[]
}

interface DocumentCapsuleProps {
  documents: DocumentInfo[]
  projectName: string
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
}

export function DocumentCapsule({
  documents,
  projectName,
  onDocumentClick,
  onSectionClick,
}: DocumentCapsuleProps) {
  // Track which documents are expanded
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  const toggleExpanded = (docId: string) => {
    setExpandedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(docId)) {
        next.delete(docId)
      } else {
        next.add(docId)
      }
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-white min-h-0">
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Document Capsule
        </h2>
        <p className="text-sm text-gray-500 mt-1">{projectName}</p>
      </div>

      {/* Document List */}
      <div
        className="flex-1 overflow-y-auto p-4 min-h-0"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="space-y-2">
          {documents.map((doc) => {
            const isExpanded = expandedDocs.has(doc.id)
            return (
              <div key={doc.id} className="border rounded-lg overflow-hidden">
                {/* Document Header (clickable to expand) */}
                <button
                  onClick={() => toggleExpanded(doc.id)}
                  className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 text-left transition-colors"
                >
                  <FileText className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">
                      {doc.title || doc.filename}
                    </div>
                    {doc.summary && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    {/* View Full Document Button */}
                    <button
                      onClick={() => onDocumentClick(doc.id)}
                      className="w-full text-left px-3 py-2 mt-3 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm font-medium transition-colors"
                    >
                      View Full Document →
                    </button>

                    {/* Outline Sections */}
                    {doc.outline && doc.outline.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-1">
                          Sections
                        </div>
                        <div className="space-y-1">
                          {doc.outline.map((section) => (
                            <button
                              key={section.id}
                              onClick={() => onSectionClick(doc.id, section.id)}
                              className="w-full text-left px-3 py-1.5 rounded hover:bg-white text-sm flex items-center gap-2 transition-colors text-gray-700"
                              style={{ paddingLeft: `${(section.level - 1) * 12 + 12}px` }}
                            >
                              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{section.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(!doc.outline || doc.outline.length === 0) && (
                      <p className="mt-3 text-sm text-gray-500 italic px-1">
                        No sections available
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {documents.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No documents in this capsule
          </div>
        )}
      </div>
    </div>
  )
}
