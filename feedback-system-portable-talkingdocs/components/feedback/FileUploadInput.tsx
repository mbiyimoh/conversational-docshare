/**
 * File Upload Input Component
 *
 * Handles file uploads with preview, drag-drop support, and file limit enforcement.
 * Uploads to R2/S3 storage via API endpoint.
 */

'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { FeedbackAttachmentMetadata } from '@/lib/validation'

interface FileUploadInputProps {
  onUpload: (metadata: FeedbackAttachmentMetadata) => void
  onRemove: (url: string) => void
  attachments: FeedbackAttachmentMetadata[]
  maxFiles?: number
}

export function FileUploadInput({
  onUpload,
  onRemove,
  attachments,
  maxFiles = 3
}: FileUploadInputProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    if (attachments.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    const file = files[0]

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are supported')
      return
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB.')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/feedback/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await res.json()
      // Pass full metadata from upload response
      onUpload({
        url: data.url,
        filename: data.filename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes
      })
      toast.success('File uploaded successfully')

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="space-y-3">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
          id="file-upload"
          disabled={isUploading || attachments.length >= maxFiles}
        />
        <label
          htmlFor="file-upload"
          className={`cursor-pointer ${
            isUploading || attachments.length >= maxFiles ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            {isUploading ? (
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-sm">
              <span className="font-medium text-primary">Click to upload</span>
              {' or drag and drop'}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, GIF, or WEBP (max 5MB)
            </p>
            <p className="text-xs text-muted-foreground">
              {attachments.length}/{maxFiles} files uploaded
            </p>
          </div>
        </label>
      </div>

      {/* Preview List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 border rounded-lg bg-muted/50"
            >
              <img
                src={attachment.url}
                alt={`Attachment ${index + 1}`}
                className="h-12 w-12 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {attachment.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(attachment.url)}
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
