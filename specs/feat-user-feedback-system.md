# User Feedback System

## Status
Approved

## Authors
- Claude Code (2026-01-09)

## Overview
A product-wide user feedback system that enables authenticated users to submit feedback (bugs, ideas, questions), browse and upvote existing feedback to surface popular requests and reduce duplicates, and provides role-based admin status management for tracking feedback lifecycle.

## Background/Problem Statement

### Core Problem
Product teams need a structured channel to collect, prioritize, and manage user feedback. Without a dedicated system:
- Feedback arrives through scattered channels (email, chat, verbal)
- Duplicate requests are submitted because users can't see existing feedback
- Popular requests are hard to identify without voting
- Feedback status (planned, in progress, completed) isn't visible to users

### Solution Approach
A built-in feedback portal with:
1. **Public visibility** - All users see all feedback, encouraging upvoting instead of duplicate submissions
2. **Upvoting** - Binary vote system surfaces popular requests
3. **Multi-select areas** - Feedback can touch multiple product areas (not mutually exclusive)
4. **Role-based admin** - SYSTEM_ADMIN users can update status inline on cards
5. **Context-aware button placement** - Different positions for creator vs viewer experiences

## Goals
- Enable authenticated users to submit categorized feedback
- Surface popular requests through public upvoting
- Reduce duplicate submissions by showing existing feedback
- Provide admin status management without a separate admin panel
- Integrate seamlessly with 33 Strategies design system
- Support both desktop and mobile with context-aware button placement

## Non-Goals
- File attachments (deferred to v2)
- Email notifications for status changes
- Anonymous feedback submission
- Real-time WebSocket updates (refetch on action is sufficient)
- Search functionality (can be added later)
- Share-link viewer feedback (separate concern - this is for authenticated creators)

## Technical Dependencies

### Backend
- **Prisma ORM** - PostgreSQL database (existing)
- **Express.js** - API framework (existing)
- **Zod** - Validation (existing)

### Frontend
- **React 18** with TypeScript (existing)
- **Framer Motion** - Animations for modal (existing)
- **Lucide React** - Icons (existing)
- **Tailwind CSS** - Styling (existing)

### No New Dependencies Required
This feature uses entirely existing infrastructure.

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
├─────────────────────────────────────────────────────────────────┤
│  FeedbackButton (context-aware)  →  /feedback page              │
│                                       ↓                         │
│                                 FeedbackModal                    │
│                                       ↓                         │
│  FeedbackList ← → FeedbackCard ← → UpvoteButton                │
│                         ↓                                       │
│              FeedbackStatusDropdown (admin-only)                │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                          API Routes                              │
├─────────────────────────────────────────────────────────────────┤
│  GET  /api/feedback           - List feedback (with filters)    │
│  POST /api/feedback           - Create feedback                 │
│  GET  /api/feedback/:id       - Get single feedback             │
│  PATCH /api/feedback/:id/status - Update status (admin only)    │
│  POST /api/feedback/:id/vote  - Toggle upvote                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Database                                 │
├─────────────────────────────────────────────────────────────────┤
│  User (+ role field)                                            │
│    ↓                                                            │
│  Feedback → FeedbackVote (1:N, unique per user)                │
│    areas: Json (multi-select array)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

#### New Enums

```prisma
// User role for access control
enum UserRole {
  USER           // Default - can submit feedback, vote
  SYSTEM_ADMIN   // Can change status, see admin controls
}

// Feedback areas (stored as JSON array for multi-select)
enum FeedbackArea {
  DOCUMENT_UPLOAD
  AI_CHAT
  SHARE_LINKS
  ANALYTICS
  AGENT_CONFIG
  GENERAL
}

// Categorizes the nature of feedback
enum FeedbackType {
  BUG
  ENHANCEMENT
  IDEA
  QUESTION
}

// Tracks lifecycle state (admin-managed)
enum FeedbackStatus {
  OPEN
  IN_REVIEW
  PLANNED
  IN_PROGRESS
  COMPLETED
  CLOSED
}
```

#### New Models

```prisma
model Feedback {
  id          String         @id @default(cuid())
  userId      String

  title       String         @db.VarChar(200)
  description String         @db.Text

  // Areas stored as JSON array since Prisma doesn't support enum arrays
  // Validated at API layer to contain only valid FeedbackArea values
  areas       Json           @default("[]")
  type        FeedbackType
  status      FeedbackStatus @default(OPEN)

  // Denormalized for efficient sorting
  upvoteCount Int            @default(0)

  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  user        User           @relation("UserFeedback", fields: [userId], references: [id], onDelete: Cascade)
  votes       FeedbackVote[]

  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
  @@index([upvoteCount])
  @@map("feedback")
}

model FeedbackVote {
  id         String   @id @default(cuid())
  feedbackId String
  userId     String
  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  user       User     @relation("UserFeedbackVotes", fields: [userId], references: [id], onDelete: Cascade)

  // One vote per user per feedback
  @@unique([feedbackId, userId])
  @@index([feedbackId])
  @@index([userId])
  @@map("feedback_votes")
}
```

#### User Model Additions

```prisma
model User {
  // ... existing fields ...

  role                UserRole       @default(USER)
  feedbackSubmissions Feedback[]     @relation("UserFeedback")
  feedbackVotes       FeedbackVote[] @relation("UserFeedbackVotes")
}
```

### API Design

#### GET /api/feedback

List all feedback with optional filters and sorting.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `sort` | `popular` \| `recent` \| `oldest` | Sort order (default: `popular`) |
| `area` | `FeedbackArea` | Filter by area (optional) |
| `type` | `FeedbackType` | Filter by type (optional) |
| `status` | `FeedbackStatus` | Filter by status (optional) |
| `limit` | number | Max results (default: 50) |
| `cursor` | string | Cursor for pagination |

**Response:**
```typescript
interface FeedbackListResponse {
  feedback: Array<{
    id: string
    title: string
    description: string
    areas: FeedbackArea[]
    type: FeedbackType
    status: FeedbackStatus
    upvoteCount: number
    hasUserUpvoted: boolean
    createdAt: string
    user: {
      id: string
      name: string | null
      email: string
    }
  }>
  nextCursor: string | null
}
```

#### POST /api/feedback

Create new feedback.

**Request Body:**
```typescript
interface CreateFeedbackInput {
  title: string        // 5-200 chars
  description: string  // 10-5000 chars
  areas: FeedbackArea[] // 1+ required
  type: FeedbackType
}
```

**Response:** Created feedback object (with auto-created self-vote, starts at upvoteCount: 1)

**Behavior Notes:**
- Auto-creates a FeedbackVote for the creator (self-upvote)
- Feedback starts with `upvoteCount: 1` and `hasUserUpvoted: true`
- Uses Prisma transaction to ensure atomicity

#### POST /api/feedback/:id/vote

Toggle upvote on feedback.

**Request Body:**
```typescript
interface VoteInput {
  action: 'upvote' | 'remove'
}
```

**Response:**
```typescript
interface VoteResponse {
  upvoteCount: number
  hasUserUpvoted: boolean
}
```

#### PATCH /api/feedback/:id/status

Update feedback status (SYSTEM_ADMIN only).

**Request Body:**
```typescript
interface UpdateStatusInput {
  status: FeedbackStatus
}
```

**Response:** Updated feedback object

### Frontend Components

#### File Structure

```
frontend/src/
├── pages/
│   └── FeedbackPage.tsx              # Main feedback portal
├── components/
│   └── feedback/
│       ├── FeedbackButton.tsx        # Context-aware sticky button
│       ├── FeedbackModal.tsx         # Submission modal wrapper
│       ├── FeedbackForm.tsx          # Multi-step form
│       ├── FeedbackList.tsx          # List with sort/filter controls
│       ├── FeedbackCard.tsx          # Individual feedback item
│       ├── UpvoteButton.tsx          # Voting component
│       └── FeedbackStatusDropdown.tsx # Admin-only status editor
├── types/
│   └── feedback.ts                   # TypeScript interfaces
```

#### FeedbackButton Component

Context-aware sticky button with different placement:

| Context | Desktop Position | Mobile Position |
|---------|------------------|-----------------|
| Creator views (Dashboard, Project, Analytics) | Bottom-left fixed | Top bar or side-nav |
| Viewer/Share page | Bottom-right (document panel) | Header bar (next to document icon) |

```tsx
interface FeedbackButtonProps {
  context: 'creator' | 'viewer'
  className?: string
}

// Creator desktop: fixed bottom-6 left-6 z-50
// Viewer desktop: fixed bottom-6 right-6 z-50 (within document panel)
// Mobile: icon only in header bar
```

#### FeedbackForm Component

Multi-step form with progressive disclosure:

1. **Step 1: Areas** - Checkbox grid (multi-select, 1+ required)
2. **Step 2: Type** - Icon button group (single select)
3. **Step 3: Content** - Title (5-200 chars) + Description (10-5000 chars)

#### UpvoteButton Component

Optimistic UI pattern for instant feedback:

```tsx
const handleVote = async () => {
  // Capture previous state for rollback
  const previousUpvotes = upvotes
  const previousHasUpvoted = hasUpvoted

  // Optimistic update
  const newHasUpvoted = !hasUpvoted
  setHasUpvoted(newHasUpvoted)
  setUpvotes(newHasUpvoted ? upvotes + 1 : upvotes - 1)

  try {
    const response = await api.toggleFeedbackVote(feedbackId, newHasUpvoted ? 'upvote' : 'remove')
    // Sync with server (handles race conditions)
    setUpvotes(response.upvoteCount)
    setHasUpvoted(response.hasUserUpvoted)
  } catch {
    // Rollback on error
    setUpvotes(previousUpvotes)
    setHasUpvoted(previousHasUpvoted)
    toast.error('Failed to update vote')
  }
}
```

#### FeedbackStatusDropdown Component

Admin-only inline status editor:

- Only rendered when `user.role === 'SYSTEM_ADMIN'`
- Badge becomes clickable dropdown on hover/click
- Status colors follow design system:

| Status | Color |
|--------|-------|
| OPEN | Gray (`#888`) |
| IN_REVIEW | Blue (`#60a5fa`) |
| PLANNED | Gold (`#d4a54a`) |
| IN_PROGRESS | Orange (`#f59e0b`) |
| COMPLETED | Green (`#4ade80`) |
| CLOSED | Dim gray (`#555`) |

### Routing Changes

#### Frontend (App.tsx)

```tsx
<Route path="/feedback" element={<FeedbackPage />} />
```

#### Backend (index.ts)

```typescript
import feedbackRoutes from './routes/feedback.routes'
app.use('/api/feedback', feedbackRoutes)
```

### Mobile Considerations

#### SharePage Header Changes

- Capsule name truncated at 40% width: `max-w-[40vw] truncate`
- Feedback icon added next to document viewer icon
- Icon: `MessageSquarePlus` from Lucide (compact, recognizable)

```tsx
// Mobile header layout
<div className="flex items-center justify-between px-4 py-2">
  <span className="max-w-[40vw] truncate font-medium">{capsuleName}</span>
  <div className="flex items-center gap-2">
    <button onClick={openFeedback}><MessageSquarePlus size={20} /></button>
    <button onClick={openDocuments}><FileText size={20} /></button>
  </div>
</div>
```

## User Experience

### User Flow: Submit Feedback

1. User clicks feedback button (location varies by context)
2. Navigates to `/feedback` page
3. Browses existing feedback to check for duplicates
4. Can upvote existing feedback OR click "Add New Feedback"
5. Modal opens with multi-step form:
   - Select areas (checkbox, multi-select)
   - Select type (bug/enhancement/idea/question)
   - Enter title and description
6. Submit → feedback appears in list with 1 upvote (own)

### User Flow: Upvote

1. User sees feedback in list
2. Clicks thumbs up button
3. Count increments immediately (optimistic)
4. Server confirms → syncs actual count
5. Click again → removes vote

### Admin Flow: Update Status

1. Admin (SYSTEM_ADMIN role) sees status badge as interactive
2. Clicks/hovers on badge → dropdown appears
3. Selects new status
4. Badge updates immediately
5. Toast confirms change

## Testing Strategy

### Unit Tests

```typescript
// feedback.controller.test.ts

/**
 * Tests feedback creation with multi-select areas validation.
 * Validates that areas array contains only valid enum values.
 */
describe('POST /api/feedback', () => {
  it('creates feedback with valid areas array', async () => {
    const input = {
      title: 'Test feedback title',
      description: 'Description with at least 10 characters',
      areas: ['AI_CHAT', 'SHARE_LINKS'],
      type: 'BUG'
    }
    // ... assertion that feedback is created with areas as JSON array
  })

  it('rejects empty areas array', async () => {
    const input = { ...validInput, areas: [] }
    // ... assertion that 400 error is returned
  })

  it('rejects invalid area values', async () => {
    const input = { ...validInput, areas: ['INVALID_AREA'] }
    // ... assertion that 400 error with specific message is returned
  })
})

/**
 * Tests upvote toggle logic including duplicate prevention.
 */
describe('POST /api/feedback/:id/vote', () => {
  it('adds vote and increments count', async () => {
    // ... test that new vote is created and count incremented
  })

  it('removes vote on second call', async () => {
    // ... test toggle behavior
  })

  it('prevents duplicate votes via unique constraint', async () => {
    // ... test that concurrent requests don't create duplicates
  })
})

/**
 * Tests role-based access for status updates.
 */
describe('PATCH /api/feedback/:id/status', () => {
  it('allows SYSTEM_ADMIN to update status', async () => {
    // ... test with admin user succeeds
  })

  it('rejects non-admin status update with 403', async () => {
    // ... test with regular user returns forbidden
  })
})
```

### Integration Tests

```typescript
// feedback.integration.test.ts

/**
 * Tests complete feedback lifecycle from creation to status update.
 */
describe('Feedback Lifecycle', () => {
  it('creates, votes, and updates status through full flow', async () => {
    // 1. Create feedback as regular user
    // 2. Verify appears in list
    // 3. Vote as different user
    // 4. Verify vote count increased
    // 5. Update status as admin
    // 6. Verify status persisted
  })
})
```

### E2E Tests (if needed)

```typescript
// feedback.e2e.test.ts

/**
 * Tests complete user journey through feedback system UI.
 */
describe('Feedback Portal E2E', () => {
  it('submits feedback through multi-step form', async () => {
    // Navigate to /feedback
    // Click "Add New Feedback"
    // Complete each form step
    // Verify feedback appears in list
  })

  it('votes and sees count update optimistically', async () => {
    // Find feedback card
    // Click upvote
    // Verify count changes immediately
    // Wait for server sync
    // Verify count persisted
  })
})
```

## Performance Considerations

### Database Indexes

All query patterns are covered by indexes:
- `upvoteCount` for popular sort
- `createdAt` for recent/oldest sort
- `status`, `type` for filtering
- `userId` for "my feedback" queries

### Denormalized Vote Count

`upvoteCount` is denormalized on Feedback model to avoid COUNT queries:
- Incremented/decremented on vote toggle
- Enables efficient sorting by popularity

### Pagination

Cursor-based pagination prevents offset issues with large datasets:
- Default limit: 50
- Returns `nextCursor` for subsequent requests

## Security Considerations

### Authentication

All feedback endpoints require authentication via JWT token in Authorization header.

### Authorization

- **Create/Vote**: Any authenticated user
- **Update Status**: SYSTEM_ADMIN role only (checked server-side)
- Frontend hides status dropdown for non-admins, but authorization is enforced at API layer

### Input Validation

- Title: 5-200 characters
- Description: 10-5000 characters
- Areas: Non-empty array of valid FeedbackArea values
- Type: Valid FeedbackType value
- Status: Valid FeedbackStatus value (admin only)

**Zod Validation Schemas:**

```typescript
// Valid feedback areas for validation
const FEEDBACK_AREAS = [
  'DOCUMENT_UPLOAD',
  'AI_CHAT',
  'SHARE_LINKS',
  'ANALYTICS',
  'AGENT_CONFIG',
  'GENERAL'
] as const

const FEEDBACK_TYPES = ['BUG', 'ENHANCEMENT', 'IDEA', 'QUESTION'] as const
const FEEDBACK_STATUSES = ['OPEN', 'IN_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as const

const createFeedbackSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title must be 200 characters or less'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000, 'Description must be 5000 characters or less'),
  areas: z.array(z.enum(FEEDBACK_AREAS)).min(1, 'Select at least one area'),
  type: z.enum(FEEDBACK_TYPES)
})

const updateStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES)
})

const voteSchema = z.object({
  action: z.enum(['upvote', 'remove'])
})
```

### Error Response Format

All API errors follow the existing codebase pattern:

```typescript
interface ErrorResponse {
  error: {
    code: string      // e.g., 'VALIDATION_ERROR', 'NOT_FOUND', 'FORBIDDEN'
    message: string   // Human-readable message
    retryable: boolean
  }
}

// Error codes used:
// - VALIDATION_ERROR (400): Invalid input
// - UNAUTHORIZED (401): Missing or invalid token
// - FORBIDDEN (403): Not SYSTEM_ADMIN for status update
// - NOT_FOUND (404): Feedback item not found
// - INTERNAL_ERROR (500): Server error
```

### Rate Limiting

Vote endpoint uses existing rate limiting middleware to prevent spam:
- Applied via `app.use('/api/feedback', feedbackRoutes)` inheriting global rate limits

### SQL Injection Prevention

Prisma ORM handles parameterized queries automatically.

## Documentation

### CLAUDE.md Updates

Add feedback system section:

```markdown
## User Feedback System

**Files:**
- Frontend: `frontend/src/components/feedback/*.tsx`
- Backend: `backend/src/controllers/feedback.controller.ts`
- Types: `frontend/src/types/feedback.ts`

**Key patterns:**
- Areas stored as JSON array (multi-select)
- Upvotes use optimistic UI with rollback
- Status dropdown only visible to SYSTEM_ADMIN users

**Making yourself admin:**
\`\`\`sql
UPDATE "users" SET role = 'SYSTEM_ADMIN' WHERE email = 'your@email.com';
\`\`\`
```

## Implementation Phases

### Phase 1: Database & Auth Foundation
- Add UserRole enum and role field to User model
- Add FeedbackArea, FeedbackType, FeedbackStatus enums
- Add Feedback and FeedbackVote models
- Run `npm run db:push`
- Update auth controller to return role in user response
- Set admin role via SQL

### Phase 2: Backend API
- Create feedback.controller.ts with all endpoints
- Create feedback.routes.ts with auth middleware
- Implement validation with Zod schemas
- Register routes in index.ts
- Write unit tests

### Phase 3: Frontend Types & API Client
- Create types/feedback.ts with TypeScript interfaces
- Add feedback methods to api.ts
- Add isAdmin helper based on user role

### Phase 4: Frontend Components
- FeedbackPage.tsx (route: /feedback)
- FeedbackList.tsx (sort, filter, loading states)
- FeedbackCard.tsx (display with upvote)
- UpvoteButton.tsx (optimistic UI)
- FeedbackModal.tsx (wrapper)
- FeedbackForm.tsx (multi-step with areas multi-select)
- FeedbackStatusDropdown.tsx (admin only)

### Phase 5: Integration & Button Placement
- Add route to App.tsx
- FeedbackButton.tsx with context-aware placement
- Add to creator layouts (Dashboard, Project pages)
- Add to SharePage (document panel for desktop, header for mobile)
- Mobile header adjustments (truncate capsule name)

### Phase 6: Testing & Polish
- Full flow testing
- Mobile layout testing
- Edge cases (empty states, error handling)
- Design system compliance review

## Resolved Questions

1. **Load More vs Infinite Scroll**: Use "Load More" button - better UX for scanning feedback lists
2. **Notification Badge**: Deferred to v2 - not core functionality
3. **Search**: Deferred to v2 - confirmed in Non-Goals
4. **Sort Persistence**: Use URL params (`?sort=popular&type=BUG`) for shareability

## References

- Ideation Document: `docs/ideation/user-feedback-system.md`
- Reference Implementation: `feedback-system-portable-talkingdocs/`
- Design System: `.claude/skills/33-strategies-frontend-design.md`
- Existing Modal Pattern: `frontend/src/components/ui/modal.tsx`
- API Client Pattern: `frontend/src/lib/api.ts`
