# User Feedback System - Implementation Tasks

**Spec:** `specs/feat-user-feedback-system.md`
**Created:** 2026-01-09
**Status:** Ready for Implementation

---

## Task Overview

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| Phase 1: Database & Auth | 4 tasks | None |
| Phase 2: Backend API | 5 tasks | Phase 1 |
| Phase 3: Frontend Types & API | 3 tasks | Phase 2 |
| Phase 4: Frontend Components | 7 tasks | Phase 3 |
| Phase 5: Integration | 4 tasks | Phase 4 |
| Phase 6: Polish | 3 tasks | Phase 5 |

**Total: 26 tasks**

---

## Phase 1: Database & Auth Foundation

### Task 1.1: Add Prisma Schema Enums and Models

**File:** `backend/prisma/schema.prisma`

**Changes:**
1. Add `UserRole` enum (USER, SYSTEM_ADMIN)
2. Add `FeedbackType` enum (BUG, ENHANCEMENT, IDEA, QUESTION)
3. Add `FeedbackStatus` enum (OPEN, IN_REVIEW, PLANNED, IN_PROGRESS, COMPLETED, CLOSED)
4. Add `role` field to User model with `@default(USER)`
5. Add `feedbackSubmissions` and `feedbackVotes` relations to User model
6. Add `Feedback` model with all fields and indexes
7. Add `FeedbackVote` model with unique constraint

**Acceptance Criteria:**
- [ ] Schema compiles without errors
- [ ] All indexes defined for query patterns
- [ ] Cascade delete configured correctly

---

### Task 1.2: Run Database Migration

**Commands:**
```bash
cd backend && npm run db:push
```

**Acceptance Criteria:**
- [ ] Migration completes successfully
- [ ] New tables visible in database
- [ ] Existing data unaffected

---

### Task 1.3: Update Auth Controller to Return Role

**File:** `backend/src/controllers/auth.controller.ts`

**Changes:**
1. In `login` function, include `role` in user response
2. In `register` function, include `role` in user response
3. In `me` endpoint (if exists), include `role` in response

**Code Pattern:**
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    name: true,
    role: true,  // ADD THIS
    createdAt: true,
  },
})
```

**Acceptance Criteria:**
- [ ] Login response includes `role` field
- [ ] Register response includes `role` field
- [ ] Default role is "USER"

---

### Task 1.4: Set Admin Role via SQL

**Command:**
```sql
UPDATE "users" SET role = 'SYSTEM_ADMIN' WHERE email = 'mbiyimoh@gmail.com';
```

**Acceptance Criteria:**
- [ ] Target user has SYSTEM_ADMIN role
- [ ] Verified via `SELECT role FROM users WHERE email = 'mbiyimoh@gmail.com'`

---

## Phase 2: Backend API

### Task 2.1: Create Feedback Controller

**File:** `backend/src/controllers/feedback.controller.ts`

**Functions to implement:**

1. `listFeedback(req, res)` - GET /api/feedback
   - Parse query params: sort, area, type, status, limit, cursor
   - Build Prisma query with filters
   - Include user relation (id, name, email)
   - Check if current user has voted on each item
   - Return with nextCursor for pagination

2. `createFeedback(req, res)` - POST /api/feedback
   - Validate with Zod schema
   - Create feedback with Prisma transaction
   - Auto-create self-vote in same transaction
   - Return created feedback with upvoteCount: 1

3. `getFeedback(req, res)` - GET /api/feedback/:id
   - Find by ID with user relation
   - Check hasUserUpvoted
   - Return 404 if not found

4. `toggleVote(req, res)` - POST /api/feedback/:id/vote
   - Parse action (upvote/remove)
   - Use transaction to:
     - Create/delete FeedbackVote
     - Increment/decrement upvoteCount
   - Return updated count and hasUserUpvoted

5. `updateStatus(req, res)` - PATCH /api/feedback/:id/status
   - Check user.role === 'SYSTEM_ADMIN' (fetch from DB)
   - Return 403 if not admin
   - Validate status with Zod
   - Update and return feedback

**Acceptance Criteria:**
- [ ] All 5 endpoints implemented
- [ ] Zod validation on all inputs
- [ ] Proper error responses (code, message, retryable)
- [ ] Transactions used where needed

---

### Task 2.2: Create Feedback Routes

**File:** `backend/src/routes/feedback.routes.ts`

**Routes:**
```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import * as feedbackController from '../controllers/feedback.controller'

const router = Router()

router.get('/', authenticate, feedbackController.listFeedback)
router.post('/', authenticate, feedbackController.createFeedback)
router.get('/:id', authenticate, feedbackController.getFeedback)
router.post('/:id/vote', authenticate, feedbackController.toggleVote)
router.patch('/:id/status', authenticate, feedbackController.updateStatus)

export default router
```

**Acceptance Criteria:**
- [ ] All routes use authenticate middleware
- [ ] Routes match spec endpoints

---

### Task 2.3: Register Routes in Index

**File:** `backend/src/index.ts`

**Changes:**
```typescript
import feedbackRoutes from './routes/feedback.routes'
// ...
app.use('/api/feedback', feedbackRoutes)
```

**Acceptance Criteria:**
- [ ] Routes accessible at /api/feedback/*
- [ ] Server starts without errors

---

### Task 2.4: Create Validation Schemas

**File:** `backend/src/validators/feedback.validator.ts` (new file)

**Schemas:**
```typescript
import { z } from 'zod'

export const FEEDBACK_AREAS = [
  'DOCUMENT_UPLOAD',
  'AI_CHAT',
  'SHARE_LINKS',
  'ANALYTICS',
  'AGENT_CONFIG',
  'GENERAL'
] as const

export const FEEDBACK_TYPES = ['BUG', 'ENHANCEMENT', 'IDEA', 'QUESTION'] as const
export const FEEDBACK_STATUSES = ['OPEN', 'IN_REVIEW', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as const

export const createFeedbackSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  areas: z.array(z.enum(FEEDBACK_AREAS)).min(1),
  type: z.enum(FEEDBACK_TYPES)
})

export const updateStatusSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES)
})

export const voteSchema = z.object({
  action: z.enum(['upvote', 'remove'])
})
```

**Acceptance Criteria:**
- [ ] All schemas export correctly
- [ ] Used in controller validation

---

### Task 2.5: Test Backend Endpoints

**Manual Testing:**
1. Create feedback via POST /api/feedback
2. List feedback via GET /api/feedback
3. Vote via POST /api/feedback/:id/vote
4. Update status via PATCH /api/feedback/:id/status (as admin)
5. Verify 403 for non-admin status update

**Acceptance Criteria:**
- [ ] All endpoints return expected responses
- [ ] Error cases handled properly
- [ ] Vote count updates correctly

---

## Phase 3: Frontend Types & API Client

### Task 3.1: Create Frontend Types

**File:** `frontend/src/types/feedback.ts` (new file)

```typescript
export type FeedbackArea =
  | 'DOCUMENT_UPLOAD'
  | 'AI_CHAT'
  | 'SHARE_LINKS'
  | 'ANALYTICS'
  | 'AGENT_CONFIG'
  | 'GENERAL'

export type FeedbackType = 'BUG' | 'ENHANCEMENT' | 'IDEA' | 'QUESTION'

export type FeedbackStatus =
  | 'OPEN'
  | 'IN_REVIEW'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'

export interface FeedbackUser {
  id: string
  name: string | null
  email: string
}

export interface Feedback {
  id: string
  title: string
  description: string
  areas: FeedbackArea[]
  type: FeedbackType
  status: FeedbackStatus
  upvoteCount: number
  hasUserUpvoted: boolean
  createdAt: string
  user: FeedbackUser
}

export interface FeedbackListResponse {
  feedback: Feedback[]
  nextCursor: string | null
}

export interface CreateFeedbackInput {
  title: string
  description: string
  areas: FeedbackArea[]
  type: FeedbackType
}

export interface VoteResponse {
  upvoteCount: number
  hasUserUpvoted: boolean
}

// Constants for UI
export const FEEDBACK_AREA_LABELS: Record<FeedbackArea, string> = {
  DOCUMENT_UPLOAD: 'Document Upload',
  AI_CHAT: 'AI Chat',
  SHARE_LINKS: 'Share Links',
  ANALYTICS: 'Analytics',
  AGENT_CONFIG: 'Agent Config',
  GENERAL: 'General'
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  BUG: 'Bug',
  ENHANCEMENT: 'Enhancement',
  IDEA: 'Idea',
  QUESTION: 'Question'
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In Review',
  PLANNED: 'Planned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed'
}

export const FEEDBACK_STATUS_COLORS: Record<FeedbackStatus, string> = {
  OPEN: '#888888',
  IN_REVIEW: '#60a5fa',
  PLANNED: '#d4a54a',
  IN_PROGRESS: '#f59e0b',
  COMPLETED: '#4ade80',
  CLOSED: '#555555'
}
```

**Acceptance Criteria:**
- [ ] All types match backend contracts
- [ ] Labels and colors defined for UI

---

### Task 3.2: Add Feedback API Methods

**File:** `frontend/src/lib/api.ts`

**Add to ApiClient class:**
```typescript
// Feedback methods
async listFeedback(params?: {
  sort?: 'popular' | 'recent' | 'oldest'
  area?: FeedbackArea
  type?: FeedbackType
  status?: FeedbackStatus
  limit?: number
  cursor?: string
}): Promise<FeedbackListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.sort) searchParams.set('sort', params.sort)
  if (params?.area) searchParams.set('area', params.area)
  if (params?.type) searchParams.set('type', params.type)
  if (params?.status) searchParams.set('status', params.status)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.cursor) searchParams.set('cursor', params.cursor)

  const query = searchParams.toString()
  return this.request<FeedbackListResponse>(`/api/feedback${query ? `?${query}` : ''}`)
}

async createFeedback(input: CreateFeedbackInput): Promise<Feedback> {
  return this.request<Feedback>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

async getFeedback(id: string): Promise<Feedback> {
  return this.request<Feedback>(`/api/feedback/${id}`)
}

async toggleFeedbackVote(id: string, action: 'upvote' | 'remove'): Promise<VoteResponse> {
  return this.request<VoteResponse>(`/api/feedback/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify({ action })
  })
}

async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
  return this.request<Feedback>(`/api/feedback/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}
```

**Acceptance Criteria:**
- [ ] All 5 methods added
- [ ] Types imported from feedback.ts
- [ ] Query params properly encoded

---

### Task 3.3: Add isAdmin Helper

**File:** `frontend/src/lib/api.ts`

**Add user role tracking:**
```typescript
// In ApiClient class
private userRole: 'USER' | 'SYSTEM_ADMIN' | null = null

// Update me() method to store role
async me(): Promise<User & { role: 'USER' | 'SYSTEM_ADMIN' }> {
  const user = await this.request<User & { role: 'USER' | 'SYSTEM_ADMIN' }>('/api/auth/me')
  this.userRole = user.role
  return user
}

isAdmin(): boolean {
  return this.userRole === 'SYSTEM_ADMIN'
}

getUserRole(): 'USER' | 'SYSTEM_ADMIN' | null {
  return this.userRole
}
```

**Acceptance Criteria:**
- [ ] Role stored on login/me
- [ ] isAdmin() helper works correctly

---

## Phase 4: Frontend Components

### Task 4.1: Create FeedbackPage

**File:** `frontend/src/pages/FeedbackPage.tsx` (new file)

**Structure:**
- Page header with SectionLabel "01 — FEEDBACK PORTAL"
- Headline "Shape the Product" with AccentText
- "Add Feedback" button (triggers modal)
- Filter/sort controls
- FeedbackList component
- FeedbackModal for submission

**Acceptance Criteria:**
- [ ] Page renders with 33 Strategies design
- [ ] Loads feedback on mount
- [ ] Filters update URL params
- [ ] Modal opens/closes correctly

---

### Task 4.2: Create FeedbackList Component

**File:** `frontend/src/components/feedback/FeedbackList.tsx` (new file)

**Props:**
```typescript
interface FeedbackListProps {
  feedback: Feedback[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onVote: (id: string, action: 'upvote' | 'remove') => void
  onStatusChange?: (id: string, status: FeedbackStatus) => void
  isAdmin: boolean
}
```

**Features:**
- Maps feedback to FeedbackCard
- "Load More" button at bottom
- Loading skeleton state
- Empty state message

**Acceptance Criteria:**
- [ ] Renders list of FeedbackCards
- [ ] Load More button works
- [ ] Loading and empty states handled

---

### Task 4.3: Create FeedbackCard Component

**File:** `frontend/src/components/feedback/FeedbackCard.tsx` (new file)

**Layout:**
- Left: UpvoteButton
- Right: Title, description (2-line clamp), badges (type, status, areas)
- Footer: User avatar/name, timestamp

**Props:**
```typescript
interface FeedbackCardProps {
  feedback: Feedback
  onVote: (action: 'upvote' | 'remove') => void
  onStatusChange?: (status: FeedbackStatus) => void
  isAdmin: boolean
}
```

**Acceptance Criteria:**
- [ ] Glass card styling (33 Strategies)
- [ ] Description truncated at 2 lines
- [ ] Area badges displayed (multiple)
- [ ] Type badge color-coded
- [ ] Status badge interactive for admin

---

### Task 4.4: Create UpvoteButton Component

**File:** `frontend/src/components/feedback/UpvoteButton.tsx` (new file)

**Props:**
```typescript
interface UpvoteButtonProps {
  count: number
  hasUpvoted: boolean
  onVote: (action: 'upvote' | 'remove') => void
  disabled?: boolean
}
```

**Features:**
- Thumbs up icon (Lucide)
- Count display
- Filled vs outline based on hasUpvoted
- Gold color when upvoted
- Optimistic UI handled by parent

**Acceptance Criteria:**
- [ ] Visual feedback on click
- [ ] Gold highlight when voted
- [ ] Accessible (aria-label)

---

### Task 4.5: Create FeedbackModal Component

**File:** `frontend/src/components/feedback/FeedbackModal.tsx` (new file)

**Uses existing Modal component from ui/modal.tsx**

**Props:**
```typescript
interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: CreateFeedbackInput) => Promise<void>
}
```

**Acceptance Criteria:**
- [ ] Uses Modal, ModalHeader, ModalContent, ModalFooter
- [ ] Contains FeedbackForm
- [ ] Closes on successful submit

---

### Task 4.6: Create FeedbackForm Component

**File:** `frontend/src/components/feedback/FeedbackForm.tsx` (new file)

**Multi-step form:**
1. Step 1: Areas (checkbox grid, multi-select)
2. Step 2: Type (icon button group, single select)
3. Step 3: Title + Description

**State:**
```typescript
const [step, setStep] = useState(1)
const [areas, setAreas] = useState<FeedbackArea[]>([])
const [type, setType] = useState<FeedbackType | null>(null)
const [title, setTitle] = useState('')
const [description, setDescription] = useState('')
```

**Acceptance Criteria:**
- [ ] Back/Next navigation
- [ ] Validation per step (areas required, type required, title/desc min lengths)
- [ ] Submit button on step 3
- [ ] Clear form on close

---

### Task 4.7: Create FeedbackStatusDropdown Component

**File:** `frontend/src/components/feedback/FeedbackStatusDropdown.tsx` (new file)

**Props:**
```typescript
interface FeedbackStatusDropdownProps {
  currentStatus: FeedbackStatus
  onChange: (status: FeedbackStatus) => void
}
```

**Features:**
- Badge that becomes dropdown on click
- Status color coding
- All 6 status options

**Acceptance Criteria:**
- [ ] Only rendered for admins (parent handles this)
- [ ] Dropdown closes on selection
- [ ] Visual matches status colors from spec

---

## Phase 5: Integration

### Task 5.1: Add Route to App.tsx

**File:** `frontend/src/App.tsx`

**Changes:**
```typescript
import { FeedbackPage } from './pages/FeedbackPage'
// ...
<Route path="/feedback" element={<FeedbackPage />} />
```

**Acceptance Criteria:**
- [ ] /feedback route accessible
- [ ] Protected (requires auth)

---

### Task 5.2: Create FeedbackButton Component

**File:** `frontend/src/components/feedback/FeedbackButton.tsx` (new file)

**Props:**
```typescript
interface FeedbackButtonProps {
  context: 'creator' | 'viewer'
  className?: string
}
```

**Behavior:**
- Creator desktop: fixed bottom-6 left-6 z-50
- Viewer desktop: fixed bottom-6 right-6 z-50
- Navigates to /feedback on click
- Uses MessageSquarePlus icon

**Acceptance Criteria:**
- [ ] Position varies by context
- [ ] Gold accent styling
- [ ] Hover effect (scale/glow)

---

### Task 5.3: Add FeedbackButton to Creator Layouts

**Files:**
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/ProjectPage.tsx`

**Changes:**
Add `<FeedbackButton context="creator" />` to each page.

**Acceptance Criteria:**
- [ ] Button visible on Dashboard
- [ ] Button visible on Project page
- [ ] Positioned bottom-left

---

### Task 5.4: Add FeedbackButton to SharePage

**File:** `frontend/src/pages/SharePage.tsx`

**Desktop:** Add FeedbackButton to document panel (bottom-right)

**Mobile:**
1. Add feedback icon to header bar (next to document icon)
2. Truncate capsule name: `max-w-[40vw] truncate`

**Acceptance Criteria:**
- [ ] Desktop: button in document panel area
- [ ] Mobile: icon in header
- [ ] Capsule name truncated on mobile

---

## Phase 6: Polish

### Task 6.1: Handle Empty States

**Files:** FeedbackPage.tsx, FeedbackList.tsx

**Empty states:**
- No feedback yet: "Be the first to share feedback!"
- No results for filter: "No feedback matches your filters"

**Acceptance Criteria:**
- [ ] Empty state message displayed
- [ ] Encourages submission

---

### Task 6.2: Add Loading States

**Files:** FeedbackPage.tsx, FeedbackList.tsx

**Loading states:**
- Initial load: Skeleton cards
- Load more: Button shows spinner
- Vote: Disable button while pending

**Acceptance Criteria:**
- [ ] Skeleton cards during initial load
- [ ] Visual feedback during actions

---

### Task 6.3: Update CLAUDE.md Documentation

**File:** `CLAUDE.md`

**Add section:**
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
- Self-vote auto-created on feedback submission

**Making yourself admin:**
\`\`\`sql
UPDATE "users" SET role = 'SYSTEM_ADMIN' WHERE email = 'mbiyimoh@gmail.com';
\`\`\`
```

**Acceptance Criteria:**
- [ ] Documentation accurate
- [ ] Key patterns documented

---

## Execution Order

```
Phase 1 (DB)     Phase 2 (API)    Phase 3 (Types)   Phase 4 (Components)   Phase 5 (Integration)   Phase 6 (Polish)
    │                │                  │                   │                      │                      │
    ▼                ▼                  ▼                   ▼                      ▼                      ▼
   1.1 ──────────► 2.1 ──────────► 3.1 ──────────► 4.1 ──────────────► 5.1 ──────────────► 6.1
   1.2             2.2              3.2              4.2                 5.2                 6.2
   1.3             2.3              3.3              4.3                 5.3                 6.3
   1.4             2.4                               4.4                 5.4
                   2.5                               4.5
                                                    4.6
                                                    4.7
```

**Parallelization opportunities:**
- Tasks 4.1-4.7 can be developed in parallel after Phase 3
- Tasks 5.3-5.4 can be done in parallel after 5.1-5.2
- Phase 6 tasks are independent of each other
