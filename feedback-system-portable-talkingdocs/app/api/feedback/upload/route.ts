import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'  // CUSTOMIZE: Update import path
import { ApiErrorHandler } from '@/lib/api-errors'  // CUSTOMIZE: Update import path
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL, generateFileKey } from '@/lib/storage/r2-client'  // CUSTOMIZE: Update import path

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/**
 * POST /api/feedback/upload
 * Upload attachment file for feedback
 *
 * Requires authentication. Uploads file to Cloudflare R2 storage.
 *
 * Request: multipart/form-data with 'file' field
 *
 * Returns 200 with:
 * - url: string (R2 storage URL)
 * - filename: string
 * - sizeBytes: number
 * - mimeType: string
 */
export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 3. Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Only images (PNG, JPEG, GIF, WebP) are supported.' },
        { status: 400 }
      )
    }

    // 4. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // 5. Upload to Cloudflare R2
    const fileKey = `feedback/${user.id}/${generateFileKey(file.name)}`

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      ContentLength: file.size,
    }))

    const fileUrl = `${R2_PUBLIC_URL}/${fileKey}`

    return NextResponse.json({
      url: fileUrl,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type
    })

  } catch (error) {
    return ApiErrorHandler.handle(error)
  }
}
