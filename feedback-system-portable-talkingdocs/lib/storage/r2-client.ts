// ============================================================================
// Cloudflare R2 Storage Client Configuration
// ============================================================================
//
// R2 is S3-compatible object storage, so we use the AWS SDK.
//
// Required environment variables:
// - R2_ACCOUNT_ID: Your Cloudflare account ID
// - R2_ACCESS_KEY_ID: R2 API token access key
// - R2_SECRET_ACCESS_KEY: R2 API token secret key
// - R2_BUCKET_NAME: Name of the R2 bucket to use
// - R2_PUBLIC_URL: (Optional) Public URL for accessing files
//
// IMPORTANT: Do not wrap env var values in quotes in your .env file!
// ============================================================================

import { S3Client } from '@aws-sdk/client-s3'

// Enable debug logging in development only
const DEBUG_R2 = process.env.NODE_ENV === 'development'

// Validate required environment variables
if (!process.env.R2_ACCOUNT_ID) {
  throw new Error('R2_ACCOUNT_ID environment variable is required')
}
if (!process.env.R2_ACCESS_KEY_ID) {
  throw new Error('R2_ACCESS_KEY_ID environment variable is required')
}
if (!process.env.R2_SECRET_ACCESS_KEY) {
  throw new Error('R2_SECRET_ACCESS_KEY environment variable is required')
}
if (!process.env.R2_BUCKET_NAME) {
  throw new Error('R2_BUCKET_NAME environment variable is required')
}

// Debug logging for R2 configuration (only in development)
if (DEBUG_R2) {
  console.warn('[R2 Client] Initializing with configuration:', {
    accountIdPresent: !!process.env.R2_ACCOUNT_ID,
    accountIdLength: process.env.R2_ACCOUNT_ID?.length || 0,
    accessKeyPresent: !!process.env.R2_ACCESS_KEY_ID,
    secretKeyPresent: !!process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  })
}

// Check for invisible/problematic characters in env vars
const checkForHiddenChars = (str: string | undefined, name: string) => {
  if (!str) return
  const hasNonPrintable = /[^\x20-\x7E]/.test(str)
  const hasLeadingSpace = str !== str.trimStart()
  const hasTrailingSpace = str !== str.trimEnd()
  const hasLineBreak = /[\r\n]/.test(str)

  if (hasNonPrintable || hasLeadingSpace || hasTrailingSpace || hasLineBreak) {
    console.error(`[R2 Client] WARNING: ${name} contains problematic characters:`, {
      hasNonPrintable,
      hasLeadingSpace,
      hasTrailingSpace,
      hasLineBreak,
    })
  }
}

checkForHiddenChars(process.env.R2_ACCOUNT_ID, 'R2_ACCOUNT_ID')
checkForHiddenChars(process.env.R2_ACCESS_KEY_ID, 'R2_ACCESS_KEY_ID')
checkForHiddenChars(process.env.R2_SECRET_ACCESS_KEY, 'R2_SECRET_ACCESS_KEY')

/**
 * S3 Client configured for Cloudflare R2
 *
 * Note: R2 doesn't use regions like AWS, but the SDK requires the 'region' parameter.
 * Using 'auto' is the standard approach for R2.
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // R2 requires path-style addressing
})

/**
 * Bucket name for storing files
 */
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME

/**
 * Public URL base for constructing file URLs
 *
 * Defaults to Cloudflare's standard R2 public URL format.
 * Override with R2_PUBLIC_URL for custom domains.
 */
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`

// Log the resolved public URL (only in development)
if (DEBUG_R2) {
  console.warn('[R2 Client] Public URL:', R2_PUBLIC_URL)
}

/**
 * Generate a unique file key with random suffix
 * Format: {timestamp}-{random}-{filename}
 * Prevents filename collisions
 */
export function generateFileKey(filename: string): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).slice(2, 10)
  return `${timestamp}-${randomSuffix}-${filename}`
}

/**
 * Extract file key from stored R2 URL
 * Handles both default R2 URLs and custom domain URLs
 */
export function extractFileKey(fileUrl: string): string {
  const url = new URL(fileUrl)
  // Remove leading slash from pathname
  return url.pathname.slice(1)
}
