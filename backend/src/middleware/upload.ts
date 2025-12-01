import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { ValidationError } from '../utils/errors'

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/markdown',
  'text/plain', // .md files might be detected as text/plain
]

// Maximum file size (50MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10)

// Upload directory
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    // Generate unique filename: timestamp_randomhash.ext
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
    const ext = path.extname(file.originalname)
    cb(null, `${uniqueSuffix}${ext}`)
  },
})

/**
 * File filter for validation
 */
function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    // Check if it's a markdown file by extension
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.md' || ext === '.markdown') {
      cb(null, true)
      return
    }

    cb(
      new ValidationError(
        'Invalid file type. Allowed types: PDF, DOCX, XLSX, MD',
        {
          allowedTypes: ['pdf', 'docx', 'xlsx', 'md'],
          receivedType: file.mimetype,
        }
      )
    )
    return
  }

  cb(null, true)
}

/**
 * Multer instance for single file upload
 */
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
}).single('document')

/**
 * Multer instance for multiple file uploads
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Maximum 10 files at once
  },
}).array('documents', 10)

/**
 * Multer error handler middleware
 */
export function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          retryable: false,
        },
      })
      return
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Maximum 10 files allowed per upload',
          retryable: false,
        },
      })
      return
    }

    res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message,
        retryable: false,
      },
    })
    return
  }

  next(err)
}
