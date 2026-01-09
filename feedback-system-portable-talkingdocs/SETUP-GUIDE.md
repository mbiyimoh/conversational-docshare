# Feedback System Setup Guide

Complete step-by-step instructions for integrating the feedback system into your Next.js project.

## Prerequisites

Before starting, ensure your project has:

- [x] Next.js 14+ with App Router
- [x] Prisma ORM with PostgreSQL database
- [x] shadcn/ui configured
- [x] Authentication system (Supabase, NextAuth, etc.)
- [x] Toast notification library (sonner recommended)

---

## Step 1: Install Dependencies

### NPM Packages

```bash
npm install @aws-sdk/client-s3 date-fns lucide-react sonner zod
```

### shadcn/ui Components

If not already installed:

```bash
npx shadcn@latest add button card badge avatar dialog input textarea select
```

---

## Step 2: Set Up Cloudflare R2

### Create R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Go to **R2 Object Storage** → **Create bucket**
3. Name it (e.g., `my-app-files`)
4. Note your **Account ID** (shown in the URL or sidebar)

### Generate API Token

1. Go to **R2** → **Manage R2 API Tokens** → **Create API token**
2. Select permissions:
   - **Object Read & Write** for your bucket
3. Copy the **Access Key ID** and **Secret Access Key**

### Enable Public Access (for file URLs)

1. Go to your bucket → **Settings**
2. Under **R2.dev subdomain**, click **Allow Access**
3. Note the public URL: `https://pub-{accountId}.r2.dev`

### Add Environment Variables

```bash
# .env.local
R2_ACCOUNT_ID=your_32_char_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=my-app-files
# Optional - auto-generated if not set
R2_PUBLIC_URL=https://pub-{accountId}.r2.dev
```

> **CRITICAL**: No quotes around values! Quotes cause signature errors.

---

## Step 3: Update Database Schema

### Add to `prisma/schema.prisma`

Copy the contents from `schema/prisma-additions.prisma`:

```prisma
// ============================================================================
// User Feedback System Models
// ============================================================================

enum FeedbackArea {
  // Customize these for your app
  DASHBOARD
  REPORTS
  SETTINGS
  BILLING
  OTHER
}

enum FeedbackType {
  BUG
  ENHANCEMENT
  IDEA
  QUESTION
}

enum FeedbackStatus {
  OPEN
  IN_REVIEW
  PLANNED
  IN_PROGRESS
  COMPLETED
  CLOSED
}

model Feedback {
  id          String         @id @default(cuid())
  userId      String

  // Content
  title       String         @db.VarChar(200)
  description String         @db.Text

  // Categorization
  area        FeedbackArea
  type        FeedbackType
  status      FeedbackStatus @default(OPEN)

  // Metrics
  upvoteCount Int            @default(0)

  // Timestamps
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  // Relations
  user        User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  votes       FeedbackVote[]
  attachments FeedbackAttachment[]

  @@index([userId])
  @@index([status])
  @@index([area])
  @@index([type])
  @@index([createdAt])
  @@index([upvoteCount])
}

model FeedbackVote {
  id         String   @id @default(cuid())
  feedbackId String
  userId     String
  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, userId])  // One vote per user per feedback
  @@index([feedbackId])
  @@index([userId])
}

model FeedbackAttachment {
  id         String   @id @default(cuid())
  feedbackId String

  url        String   @db.Text
  filename   String   @db.VarChar(255)
  mimeType   String   @db.VarChar(100)
  sizeBytes  Int

  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@index([feedbackId])
}
```

### Add Relations to User Model

In your existing `User` model, add:

```prisma
model User {
  // ... existing fields ...

  // Add these relations
  feedbackSubmissions Feedback[]
  feedbackVotes       FeedbackVote[]
}
```

### Run Migration

```bash
npx prisma migrate dev --name add_feedback_system
npx prisma generate
```

---

## Step 4: Copy Files to Project

### Create Directory Structure

```bash
mkdir -p components/feedback
mkdir -p app/feedback
mkdir -p app/api/feedback/[id]/vote
mkdir -p app/api/feedback/upload
mkdir -p lib/storage
```

### Copy Component Files

Copy from `components/feedback/`:
- `FeedbackButton.tsx`
- `FeedbackDialog.tsx`
- `FeedbackForm.tsx`
- `FeedbackList.tsx`
- `FeedbackCard.tsx`
- `UpvoteButton.tsx`
- `FileUploadInput.tsx`

### Copy API Routes

Copy from `app/api/feedback/`:
- `route.ts` → `app/api/feedback/route.ts`
- `[id]/route.ts` → `app/api/feedback/[id]/route.ts`
- `[id]/vote/route.ts` → `app/api/feedback/[id]/vote/route.ts`
- `upload/route.ts` → `app/api/feedback/upload/route.ts`

### Copy Page

Copy from `app/feedback/`:
- `page.tsx` → `app/feedback/page.tsx`

### Copy Library Files

Copy from `lib/`:
- `storage/r2-client.ts` → `lib/storage/r2-client.ts`
- `api-errors.ts` → `lib/api-errors.ts` (if you don't have one)
- `validation-additions.ts` → Add schemas to your existing `lib/validation.ts`

---

## Step 5: Update Imports

### Fix Auth Imports

In all API routes, update the auth import to match your project:

```typescript
// Change this:
import { getCurrentUser, requireAdmin } from '@/lib/auth'

// To your auth location:
import { getCurrentUser, requireAdmin } from '@/lib/your-auth-file'
```

### Your Auth Functions Should Return

```typescript
// getCurrentUser() should return:
interface User {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
  role?: string  // Optional, for admin check
}

// requireAdmin() should throw if not admin
```

### Fix Prisma Import

If your Prisma client is in a different location:

```typescript
// Change this:
import prisma from '@/lib/db'

// To your location:
import { prisma } from '@/lib/your-prisma-file'
```

### Fix Auth Context Import

In `UpvoteButton.tsx`:

```typescript
// Change this:
import { useAuth } from '@/contexts/AuthContext'

// To your auth hook location:
import { useAuth } from '@/hooks/useAuth'
// or
import { useSession } from 'next-auth/react'
```

---

## Step 6: Add Global Feedback Button

### Update Your Layout

In `app/layout.tsx`:

```tsx
import { FeedbackButton } from '@/components/feedback/FeedbackButton'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <YourAuthProvider>
          {children}
          <Toaster />
          <FeedbackButton />  {/* Add this */}
        </YourAuthProvider>
      </body>
    </html>
  )
}
```

---

## Step 7: Customize for Your App

### Update Feedback Areas

1. Edit the Prisma enum in `schema.prisma`
2. Update the Zod schema in `lib/validation.ts`
3. Update labels in `FeedbackForm.tsx`:

```typescript
const areaOptions: Array<{ value: FeedbackArea; label: string }> = [
  { value: 'DASHBOARD', label: 'Dashboard' },
  { value: 'REPORTS', label: 'Reports & Analytics' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'BILLING', label: 'Billing & Plans' },
  { value: 'OTHER', label: 'Other' }
]
```

4. Update `FeedbackList.tsx` select options
5. Update `FeedbackCard.tsx` area labels

### Update Dialog Description

In `FeedbackDialog.tsx`:

```tsx
<DialogDescription>
  Help us improve [Your App Name] by sharing your feedback, bug reports, or feature ideas.
</DialogDescription>
```

---

## Step 8: Test the Integration

### Start Development Server

```bash
npm run dev
```

### Test Checklist

1. **Feedback Button**: Should appear in bottom-left of all pages
2. **Click Button**: Should navigate to `/feedback`
3. **Feedback Page**: Should show empty list with "Be the first..." message
4. **Add Feedback**: Click "Add New Feedback", fill form, submit
5. **Form Validation**: Title < 5 chars should show error
6. **File Upload**: Drag image, should upload and show preview
7. **View Feedback**: New item should appear in list
8. **Upvote**: Click thumbs up, count should increase
9. **Toggle Vote**: Click again, vote should be removed
10. **Filters**: Test area and type dropdowns
11. **Sorting**: Test popular/recent/oldest

### Common Issues

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check auth function returns user correctly |
| R2 SignatureDoesNotMatch | Remove quotes from env vars, check for hidden chars |
| FeedbackButton not showing | Check it's imported in layout.tsx |
| Upvote not persisting | Check auth context is working |
| Type errors | Run `npx prisma generate` |

---

## Step 9: Optional Enhancements

### Add Admin Dashboard

Create an admin page to manage feedback status:

```tsx
// app/admin/feedback/page.tsx
'use client'

export default function AdminFeedbackPage() {
  // Fetch all feedback including CLOSED status
  // Add status update dropdowns
  // Implement bulk actions
}
```

### Add Email Notifications

When feedback is submitted:

```typescript
// In POST /api/feedback route, after creation:
await sendEmail({
  to: 'admin@example.com',
  subject: `New Feedback: ${validated.title}`,
  body: `A new ${validated.type} was submitted in ${validated.area}...`
})
```

### Add Search

In `FeedbackList.tsx`:

```typescript
const [searchQuery, setSearchQuery] = useState('')

// Add to fetch params
if (searchQuery) {
  params.append('search', searchQuery)
}
```

Update API route to support search:

```typescript
if (searchParam) {
  where.OR = [
    { title: { contains: searchParam, mode: 'insensitive' } },
    { description: { contains: searchParam, mode: 'insensitive' } }
  ]
}
```

---

## Troubleshooting

### Database Errors

```bash
# Reset and re-migrate
npx prisma migrate reset
npx prisma migrate dev
```

### Type Errors

```bash
# Regenerate Prisma client
npx prisma generate

# Check TypeScript
npx tsc --noEmit
```

### R2 Upload Failing

1. Check environment variables are set correctly
2. Verify bucket exists and has public access
3. Check API token has write permissions
4. Look for CORS issues if uploading from browser

### Auth Context Not Available

Ensure your auth provider wraps the entire app:

```tsx
// app/layout.tsx
<AuthProvider>
  {children}
  <FeedbackButton />
</AuthProvider>
```

---

## Production Checklist

- [ ] Environment variables set in production
- [ ] R2 bucket has public access enabled
- [ ] Database migrations applied
- [ ] Admin user role configured
- [ ] Error tracking set up (Sentry, etc.)
- [ ] Rate limiting on API routes (recommended)

---

## Support

If you encounter issues:

1. Check the browser console for errors
2. Check the server logs for API errors
3. Verify database schema matches Prisma schema
4. Ensure all imports are correct for your project structure
