# Portable Feedback System

A complete, production-ready user feedback system with upvoting, attachments, filtering, and sorting.

## Features

- **Sticky Feedback Button**: Fixed position button visible on all pages
- **Feedback Portal Page**: Full-page view with sorting and filtering
- **Submission Form**: Multi-step form with area/type categorization
- **Upvoting System**: One vote per user with optimistic UI
- **File Attachments**: Image uploads to Cloudflare R2 (S3-compatible)
- **Admin Status Management**: Track feedback through lifecycle
- **Pagination Support**: Cursor-based pagination for large datasets

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│  FeedbackButton (global)  →  /feedback page                     │
│                               ↓                                  │
│                         FeedbackDialog                           │
│                               ↓                                  │
│  FeedbackList ← → FeedbackCard ← → UpvoteButton                 │
│                               ↓                                  │
│                         FeedbackForm → FileUploadInput          │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                          API Routes                              │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/feedback           - Create feedback                  │
│  GET  /api/feedback           - List feedback (with filters)    │
│  GET  /api/feedback/[id]      - Get single feedback             │
│  PATCH /api/feedback/[id]     - Update status (admin)           │
│  POST /api/feedback/[id]/vote - Upvote/remove vote             │
│  POST /api/feedback/upload    - Upload attachment              │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Database                                 │
├─────────────────────────────────────────────────────────────────┤
│  Feedback → FeedbackVote (1:N)                                  │
│           → FeedbackAttachment (1:N)                            │
│           → User (N:1)                                          │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare R2                               │
├─────────────────────────────────────────────────────────────────┤
│  feedback/{userId}/{timestamp}-{random}-{filename}              │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

1. **Copy files** to your project (see File Structure below)
2. **Add Prisma schema** (see `schema/prisma-additions.prisma`)
3. **Configure environment variables**
4. **Run database migration**
5. **Add FeedbackButton to layout**

See `SETUP-GUIDE.md` for detailed instructions.

## File Structure

```
feedback-system/
├── README.md                      # This file
├── SETUP-GUIDE.md                 # Detailed setup instructions
├── schema/
│   └── prisma-additions.prisma    # Copy to your schema.prisma
├── lib/
│   ├── validation-additions.ts    # Zod schemas for feedback
│   ├── api-errors.ts              # Error handler (full file)
│   └── storage/
│       └── r2-client.ts           # Cloudflare R2 client
├── components/
│   └── feedback/
│       ├── FeedbackButton.tsx     # Sticky feedback button
│       ├── FeedbackDialog.tsx     # Submission modal
│       ├── FeedbackForm.tsx       # Multi-step form
│       ├── FeedbackList.tsx       # List with filters
│       ├── FeedbackCard.tsx       # Individual feedback item
│       ├── UpvoteButton.tsx       # Voting component
│       └── FileUploadInput.tsx    # File upload with preview
├── app/
│   ├── feedback/
│   │   └── page.tsx               # Feedback portal page
│   └── api/
│       └── feedback/
│           ├── route.ts           # POST/GET feedback
│           ├── [id]/
│           │   ├── route.ts       # GET/PATCH single feedback
│           │   └── vote/
│           │       └── route.ts   # POST vote
│           └── upload/
│               └── route.ts       # POST upload
└── layout-snippet.tsx             # Example layout integration
```

## Dependencies

### NPM Packages

```bash
npm install @aws-sdk/client-s3 date-fns lucide-react sonner zod
```

### shadcn/ui Components

```bash
npx shadcn@latest add button card badge avatar dialog input textarea select
```

### Existing Project Requirements

Your project must have:
- Next.js 14+ (App Router)
- Prisma with PostgreSQL
- shadcn/ui configured
- Authentication system with `getCurrentUser()` function
- AuthContext with `useAuth()` hook

## Environment Variables

```bash
# Cloudflare R2 (required for file uploads)
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-{accountId}.r2.dev  # Optional, auto-generated
```

## Customization Points

### 1. Feedback Areas

Edit `FeedbackAreaSchema` in `lib/validation-additions.ts`:

```typescript
export const FeedbackAreaSchema = z.enum([
  'DASHBOARD',      // Your custom areas
  'REPORTS',
  'SETTINGS',
  'BILLING',
  'OTHER'
])
```

Update labels in `FeedbackForm.tsx` and `FeedbackList.tsx`.

### 2. Feedback Types

Default types: BUG, ENHANCEMENT, IDEA, QUESTION

Edit `FeedbackTypeSchema` if needed.

### 3. Styling

Components use Tailwind CSS + shadcn/ui. Customize:
- Button colors in `FeedbackCard.tsx` (`typeColors`, `statusColors`)
- Card styling in `FeedbackCard.tsx`
- Form layout in `FeedbackForm.tsx`

### 4. File Storage

Default: Cloudflare R2

To use different storage (S3, Vercel Blob, etc.):
1. Update `lib/storage/r2-client.ts`
2. Modify upload route `app/api/feedback/upload/route.ts`

### 5. Authentication

Update these imports in API routes:
```typescript
import { getCurrentUser, requireAdmin } from '@/lib/auth'
```

Make sure your auth functions return:
```typescript
interface User {
  id: string
  email: string
  name?: string
  role?: string  // For admin check
}
```

## License

MIT - Use freely in any project.
