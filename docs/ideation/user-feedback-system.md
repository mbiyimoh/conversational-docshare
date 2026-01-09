# User Feedback System for Conversational DocShare

**Slug:** user-feedback-system
**Author:** Claude Code
**Date:** 2026-01-09
**Branch:** preflight/user-feedback-system
**Related:** Reference implementation in `/feedback-system-portable-talkingdocs/`

---

## 1) Intent & Assumptions

- **Task brief:** Implement a user feedback system with a persistent/sticky feedback button that leads to a dedicated feedback page. Users can submit feedback (bugs, feature ideas, questions) and upvote existing feedback to prevent duplicates and surface popular requests.

- **Assumptions:**
  - Feedback system is for authenticated users (creators logged into the dashboard), not share link viewers
  - All users can submit and vote; admin functionality may be added later
  - File attachments will use existing upload infrastructure or can be deferred
  - This is a product-wide feedback system, not project-specific
  - Dark mode design system applies (33 Strategies)
  - Express/Prisma backend pattern continues (not Next.js API routes)

- **Out of scope:**
  - Admin panel for managing feedback status (can be added later)
  - Email notifications for status changes
  - Anonymous feedback submission
  - Share-link viewer feedback (separate concern)
  - Real-time updates via WebSocket (simple refetch on action is sufficient)

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `feedback-system-portable-talkingdocs/README.md` | Reference architecture: sticky button → page → dialog → form/list/card/upvote components. REST API pattern. |
| `feedback-system-portable-talkingdocs/SETUP-GUIDE.md` | Detailed setup: Prisma schema, R2 for attachments, shadcn/ui components, auth integration points. |
| `feedback-system-portable-talkingdocs/schema/prisma-additions.prisma` | Schema: Feedback (title, desc, area, type, status, upvoteCount), FeedbackVote (unique per user), FeedbackAttachment. |
| `feedback-system-portable-talkingdocs/components/feedback/*.tsx` | 7 components: Button, Dialog, Form, List, Card, UpvoteButton, FileUploadInput. Optimistic UI for votes. |
| `CLAUDE.md` | Design system (33 Strategies), auth pattern, existing modal patterns, DB approach (db:push not migrations). |
| `frontend/src/components/ui/modal.tsx` | Existing Modal component with Framer Motion, escape key, backdrop click. Use this instead of Dialog. |
| `frontend/src/lib/api.ts` | API client pattern: fetch with auth headers, structured error handling. Add feedback methods here. |
| `backend/prisma/schema.prisma` | User model exists, need to add feedback relations. Many existing models for reference. |
| `frontend/src/pages/DashboardPage.tsx` | Main authenticated landing page. Good place for feedback button visibility. |

---

## 3) Codebase Map

- **Primary components/modules:**
  - `frontend/src/components/ui/modal.tsx` - Base modal for feedback dialog
  - `frontend/src/components/ui/Button.tsx` - Styled button component
  - `frontend/src/components/ui/Card.tsx` - Glass card for feedback items
  - `frontend/src/components/ui/Badge.tsx` - Status/type badges
  - `frontend/src/lib/api.ts` - API client (add feedback methods)
  - `frontend/src/pages/` - Add FeedbackPage.tsx
  - `backend/src/controllers/` - Add feedback.controller.ts
  - `backend/src/routes/` - Add feedback.routes.ts
  - `backend/prisma/schema.prisma` - Add feedback models

- **Shared dependencies:**
  - Theme: CSS variables in `globals.css` (gold accent, glass cards, dark mode)
  - Hooks: `useIsMobile` for responsive behavior
  - Auth: `api.setToken()` / `api.me()` for current user
  - Icons: Lucide React for consistent iconography
  - Animation: Framer Motion for modal/transitions

- **Data flow:**
  - User clicks sticky button → Navigate to `/feedback` page
  - Page loads feedback list via `GET /api/feedback`
  - User clicks "Add Feedback" → Modal opens with multi-step form
  - Submit → `POST /api/feedback` → Refetch list
  - Upvote → `POST /api/feedback/:id/vote` → Optimistic UI update

- **Feature flags/config:**
  - None required initially
  - Could add `FEEDBACK_ENABLED` env var for toggling

- **Potential blast radius:**
  - Database schema (new tables, User relations)
  - Frontend routing (new /feedback route)
  - API routes registration in backend/src/index.ts
  - Layout changes (sticky button placement)

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research

### Potential Solutions

#### **1. Direct Port of Reference Implementation**
Port the Next.js feedback system directly, adapting for Express backend.

**Pros:**
- Proven, working implementation
- Minimal design decisions needed
- All components already built

**Cons:**
- Next.js patterns (API routes, app router) need conversion to Express
- shadcn/ui Dialog vs our Modal component (styling mismatch)
- May not perfectly match 33 Strategies design system

#### **2. Custom Implementation Following Reference Architecture**
Build from scratch using reference as blueprint but native to this codebase.

**Pros:**
- Perfect integration with existing patterns (Modal, API client, auth)
- Consistent with 33 Strategies design system
- No conversion friction

**Cons:**
- More development time
- Risk of missing features from reference

#### **3. Minimal Viable Feedback (Simplified)**
Reduce scope: single-page form, no attachments, basic list.

**Pros:**
- Fastest to ship
- Lower complexity

**Cons:**
- Missing upvoting (key feature for preventing duplicates)
- No categorization (harder to manage at scale)
- Would need to be rebuilt for full feature set

### Research-Backed Best Practices

Based on industry research (Canny, UserVoice, GitHub Issues, ProductBoard):

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Button Position** | Bottom-left, fixed | Avoids conflicts with help widgets (usually bottom-right). Reference uses bottom-left. |
| **Button Visibility** | Show on authenticated pages only | Keeps viewer experience clean, targets actual product users. |
| **Form Type** | Multi-step (area → type → content) | Progressive disclosure reduces cognitive load per step. Reference pattern works well. |
| **Voting Model** | Binary (upvote/unvote) | Simple, clear, prevents gaming. More complex allocation systems add friction. |
| **Duplicate Prevention** | Manual (users see list before submitting) | Automatic similarity detection is complex. Manual browsing + voting is sufficient. |
| **Pagination** | Initial load + "Load More" | Better than infinite scroll for feedback (users want to scan, not endless scroll). |
| **Attachments** | Optional, defer if needed | Nice-to-have but adds R2/S3 complexity. Can use existing upload infrastructure. |

### Recommendation

**Solution 2: Custom Implementation Following Reference Architecture**

Build a native implementation that:
1. Uses existing `Modal` component (not shadcn Dialog)
2. Follows 33 Strategies design system exactly
3. Uses Express controllers/routes (not Next.js API routes)
4. Adapts reference component structure for this codebase
5. Includes upvoting from day one (core feature for reducing duplicates)

This approach balances proven patterns with seamless integration.

---

## 6) Clarification

Before proceeding, please clarify:

1. **Feedback Areas:** What product areas should users categorize feedback into?
   - Suggestion: `DOCUMENT_UPLOAD`, `AI_CHAT`, `SHARE_LINKS`, `ANALYTICS`, `AGENT_CONFIG`, `GENERAL`
   - Or prefer simpler: `DASHBOARD`, `DOCUMENTS`, `SHARING`, `OTHER`?
   >> go with your suggestion. the more tags the better (but tags shouldnt be mutually exclusive — one piece of feedback can touch many areas of the app)

2. **Feedback Visibility:** Should feedback be visible to all users, or just the submitter + admins?
   - Public: Encourages voting, reduces duplicates
   - Private: More like support tickets
   >> public. the public upvote system is the most crucial element of the system

3. **File Attachments:** Include attachments in v1 or defer?
   - Include: Requires R2/S3 setup
   - Defer: Simpler initial implementation, add later
   >> defer

4. **Admin Panel:** Do you want basic status management in v1?
   - Include: Can mark feedback as PLANNED, IN_PROGRESS, COMPLETED
   - Defer: All feedback stays OPEN, manage manually in DB
   >> yes, include. see below from a different project — lets follow this same general pattern: "5. **Admin Status Management:**
      - **Option A:** Inline on cards (click status badge to change)
      - **Option B:** Separate admin view (like reference - admin route only)
      - **Option C:** Both options
      - **Decision needed:** Since you're the admin, how do you want to manage status?
      >> option A sounds like the interaction / UX that I want, but I certainly don't want anybody but me to be able
   to update those statuses. so ya, maybe a /feedback-admin route that is simple password-protected? I have a user
   account for this product and I don't want to deal with the headache of those lines getting muddy, unless there's
   just a simple way to add a "type" to users or something like that, where we can just assign the "type" for my user
    to "system-admin" which then would give me (or anybody whose user record has that type) access to that route. but
    I'm no expert in this stuff so let me know your thoughts after considering this response ... Addressing Your Admin Access Question
    
      Adding a role field to the User model is the cleanest and most scalable approach. Here's why:
    
      Why role-based access is better than password protection:
    
      1. No separate login - You're already authenticated, the system just checks your role
      2. Database-backed - Easy to change who's admin without code changes
      3. Audit trail - All actions tied to your authenticated user
      4. Simple implementation - Just add role: UserRole to User model and check it in API routes
    
      Implementation:
      enum UserRole {
        USER          // Default - can submit feedback, vote
        SYSTEM_ADMIN  // Can change status, see all feedback metadata
      }
    
      model User {
        // ... existing fields
        role  UserRole  @default(USER)
      }
    
      Then in the API:
      // Anyone can view /feedback
      // Only SYSTEM_ADMIN can see/use status dropdown on cards
      if (user.role !== 'SYSTEM_ADMIN') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    
      To make yourself admin: After migration, one SQL update:
      UPDATE "User" SET role = 'SYSTEM_ADMIN' WHERE email = 'your@email.com';
    
      This gives you the inline UX you want (click status badge to change) but only renders the dropdown/edit
      capability when the logged-in user has SYSTEM_ADMIN role."

5. **Button Placement:** Confirm bottom-left fixed position, or prefer different location?
>> for desktop: bottom left for the main user views (your dashboard, creting capsule, sending out links, analytics, etc.); bottom right for the receiver view (at the bootom of the document panel — on the left it would conflict with the chat panel)
for mobile: see @IMG_3012.jpg — lets think of an icon that represents "feedback" and but it where I drew the red circle, next to the icon that pulls up the document viewer. lets also have the name of the capsule truncate at like 40% of the screen width so that the name isn't crowding into / butting up againast those two icons. I don't expect many people will be using the "creator and sender" experience in mobile, so just put it wherever you think makes sense for that case — could be top bar like I described for the viewer, could be in the side-nav if we have one for that specific mobile view (I've never used it myself)

---

## 7) Finalized Decisions

Based on clarification responses:

| Decision | Choice | Notes |
|----------|--------|-------|
| **Feedback Areas** | Multi-select: `DOCUMENT_UPLOAD`, `AI_CHAT`, `SHARE_LINKS`, `ANALYTICS`, `AGENT_CONFIG`, `GENERAL` | Areas are NOT mutually exclusive - feedback can touch multiple areas |
| **Visibility** | Public | Core feature - upvoting to surface popular requests and reduce duplicates |
| **File Attachments** | Defer to v2 | Keep v1 simple |
| **Admin Status** | Include with role-based access | Inline status dropdown on cards, only visible to `SYSTEM_ADMIN` users |
| **Button Placement** | Context-aware | Desktop creator: bottom-left. Desktop viewer: bottom-right (document panel). Mobile viewer: header bar icon next to document icon. Mobile creator: top bar or side-nav |
| **User Roles** | Add `UserRole` enum | `USER` (default) and `SYSTEM_ADMIN` for status management |

---

## 8) Technical Implementation Plan

### Database Schema

```prisma
// User role for access control
enum UserRole {
  USER           // Default - can submit feedback, vote
  SYSTEM_ADMIN   // Can change status, see admin controls
}

// Feedback areas (multi-select via junction table)
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

model Feedback {
  id          String         @id @default(cuid())
  userId      String

  title       String         @db.VarChar(200)
  description String         @db.Text

  // Areas stored as JSON array since Prisma doesn't support enum arrays well
  areas       Json           @default("[]")  // Array of FeedbackArea values
  type        FeedbackType
  status      FeedbackStatus @default(OPEN)

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
}

model FeedbackVote {
  id         String   @id @default(cuid())
  feedbackId String
  userId     String
  createdAt  DateTime @default(now())

  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)
  user       User     @relation("UserFeedbackVotes", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, userId])
  @@index([feedbackId])
  @@index([userId])
}
```

Add to User model:
```prisma
model User {
  // ... existing fields ...

  role                UserRole       @default(USER)
  feedbackSubmissions Feedback[]     @relation("UserFeedback")
  feedbackVotes       FeedbackVote[] @relation("UserFeedbackVotes")
}
```

**Post-migration:** Set yourself as admin:
```sql
UPDATE "User" SET role = 'SYSTEM_ADMIN' WHERE email = 'mbiyimoh@gmail.com';
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/feedback` | Required | List feedback (sort, filter by area/type/status) |
| POST | `/api/feedback` | Required | Create feedback (with multi-select areas) |
| GET | `/api/feedback/:id` | Required | Get single feedback |
| PATCH | `/api/feedback/:id/status` | SYSTEM_ADMIN | Update status only |
| POST | `/api/feedback/:id/vote` | Required | Toggle upvote |
| GET | `/api/auth/me` | Required | Returns user with `role` field for admin check |

### Frontend Components

```
frontend/src/
├── pages/
│   └── FeedbackPage.tsx              # Main feedback portal
├── components/
│   └── feedback/
│       ├── FeedbackButton.tsx        # Context-aware sticky button
│       ├── FeedbackModal.tsx         # Submission modal wrapper
│       ├── FeedbackForm.tsx          # Multi-step form (areas multi-select)
│       ├── FeedbackList.tsx          # List with sort/filter controls
│       ├── FeedbackCard.tsx          # Individual item with admin status dropdown
│       ├── UpvoteButton.tsx          # Voting component (optimistic UI)
│       └── FeedbackStatusDropdown.tsx # Admin-only inline status editor
├── lib/
│   └── api.ts                        # Add feedback methods
└── types/
    └── feedback.ts                   # Type definitions
```

### Design Specifications

Following 33 Strategies:

**Feedback Button (Context-Aware Placement)**

| Context | Desktop | Mobile |
|---------|---------|--------|
| Creator views (Dashboard, Project, Analytics) | Bottom-left fixed (`bottom-6 left-6 z-50`) | Top bar or side-nav |
| Viewer/Share page | Bottom-right of document panel | Header bar icon (next to document icon) |

- Style: Gold accent button with `MessageSquarePlus` icon (Lucide)
- Mobile icon suggestion: `MessageSquarePlus` or `Megaphone` (compact, recognizable)
- Hover: Subtle scale/glow effect

**Mobile Header Adjustments**
- Capsule name: Truncate at 40% screen width (`max-w-[40vw] truncate`)
- Icons: Feedback icon + Document icon with adequate spacing

**Feedback Page**
- Header: `01 — FEEDBACK PORTAL` section label (gold mono)
- Headline: "Shape the Product" with gold accent on "Product"
- Cards: Glass style with `rgba(255,255,255,0.03)` + blur

**Feedback Card**
- Left: Upvote button with count
- Right: Title, description (2-line clamp), badges
- Badges: Type (color-coded), Status (clickable dropdown for admins), Area tags (multiple)
- Footer: Avatar, name, time
- Admin view: Status badge becomes dropdown on hover/click

**Status Badge Colors**
| Status | Color |
|--------|-------|
| OPEN | Gray (`#888`) |
| IN_REVIEW | Blue (`#60a5fa`) |
| PLANNED | Gold (`#d4a54a`) |
| IN_PROGRESS | Orange (`#f59e0b`) |
| COMPLETED | Green (`#4ade80`) |
| CLOSED | Dim gray (`#555`) |

**Modal Form**
- Step 1: Area selection (checkbox grid - multi-select)
- Step 2: Type selection (icon buttons - single select)
- Step 3: Title + Description

### Routing

Add to `frontend/src/App.tsx`:
```tsx
<Route path="/feedback" element={<FeedbackPage />} />
```

Add to `backend/src/index.ts`:
```ts
import feedbackRoutes from './routes/feedback.routes'
app.use('/api/feedback', feedbackRoutes)
```

---

## 9) Implementation Checklist

### Phase 1: Database & Auth
- [ ] Add `UserRole` enum to Prisma schema
- [ ] Add `role` field to User model (default: USER)
- [ ] Add `Feedback` model with JSON `areas` field
- [ ] Add `FeedbackVote` model with unique constraint
- [ ] Run `npm run db:push` in backend
- [ ] Update auth controller to return `role` in user response
- [ ] Run SQL to set yourself as SYSTEM_ADMIN

### Phase 2: Backend API
- [ ] Create `feedback.controller.ts` with CRUD operations
- [ ] Create `feedback.routes.ts` with auth middleware
- [ ] Implement GET /api/feedback (list with filters, sort, pagination)
- [ ] Implement POST /api/feedback (create with areas array validation)
- [ ] Implement POST /api/feedback/:id/vote (toggle with optimistic support)
- [ ] Implement PATCH /api/feedback/:id/status (admin-only status update)
- [ ] Register routes in index.ts

### Phase 3: Frontend Types & API
- [ ] Create `types/feedback.ts` with TypeScript interfaces
- [ ] Add feedback methods to `api.ts`
- [ ] Add `isAdmin` helper based on user role

### Phase 4: Frontend Components
- [ ] FeedbackButton.tsx (context-aware placement)
- [ ] FeedbackPage.tsx (header, list, dialog trigger)
- [ ] FeedbackList.tsx (sort/filter controls, loading state)
- [ ] FeedbackCard.tsx (display with admin status dropdown)
- [ ] UpvoteButton.tsx (optimistic UI)
- [ ] FeedbackModal.tsx (wrapper for form)
- [ ] FeedbackForm.tsx (multi-step with multi-select areas)
- [ ] FeedbackStatusDropdown.tsx (admin-only)

### Phase 5: Integration & Placement
- [ ] Add route to App.tsx
- [ ] Add FeedbackButton to creator layouts (Dashboard, Project pages)
- [ ] Add FeedbackButton to SharePage (document panel, bottom-right)
- [ ] Mobile: Add feedback icon to SharePage header
- [ ] Mobile: Truncate capsule name to 40% width
- [ ] Style per 33 Strategies design system

### Phase 6: Testing
- [ ] Test submit flow: browse → create → appears in list
- [ ] Test vote flow: upvote → count updates → toggle removes
- [ ] Test admin flow: status dropdown → update → persists
- [ ] Test non-admin: status dropdown not visible
- [ ] Test mobile layouts

---

## 10) Next Steps

The ideation is complete with all decisions finalized. Ready to generate the implementation spec with `/spec:create` or begin implementation directly.

Key implementation notes:
1. Areas are multi-select (stored as JSON array)
2. Role-based admin access (no separate admin route needed)
3. Context-aware button placement (different positions for creator vs viewer)
4. Mobile header needs capsule name truncation + feedback icon
