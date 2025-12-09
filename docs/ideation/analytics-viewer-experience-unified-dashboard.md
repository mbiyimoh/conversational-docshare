# Analytics Enhancement + Viewer Experience + Unified Dashboard

**Slug:** analytics-viewer-experience-unified-dashboard
**Author:** Claude Code
**Date:** 2025-12-04
**Branch:** feat/analytics-viewer-unified-dashboard
**Related:**
- `.simple-task-master/tasks/14-task-114-basic-analytics.md`
- `.simple-task-master/tasks/16-task-21-enhanced-analytics-dashboard.md`
- `specs/03-api-reference.md`

---

## 1) Intent & Assumptions

### Task Brief
Enhance the Analytics tab to complete Phase 1/2 features (conversation detail views, AI-generated summaries, sentiment analysis, CSV/PDF export), implement a viewer end-of-interaction experience that prompts account creation to save conversations, and create a unified dashboard that gracefully handles three user journeys: creator-only, viewer-only, and hybrid users.

### Assumptions
- The existing User model supports both creator and viewer roles without schema changes (confirmed: `savedConversations` relation exists)
- Viewers who create accounts use the same authentication flow as creators
- Saved conversations belong to the viewer (via `savedByUserId`), not duplicated
- AI summary generation triggers only for conversations with 5+ messages (cost management)
- Duration tracking requires explicit "end conversation" action or browser close detection
- The dashboard should encourage viewer→creator conversion without being pushy

### Out of Scope
- Phase 4 advanced analytics (heat maps, cohort analysis, A/B testing)
- Real-time dashboard updates via WebSocket/SSE
- Mobile-specific UI optimizations
- Email notifications for conversation summaries
- Conversation sharing between users
- Social login (OAuth) - existing email/password flow is sufficient

---

## 2) Pre-reading Log

### Documentation
- `CLAUDE.md:368-395` - Analytics patterns documented, mentions `AnalyticsEvent` model and tracking patterns
- `CLAUDE.md:849-853` - Phase 2 includes "Creator analytics dashboard" and "Conversation summaries"
- `.simple-task-master/tasks/14-*` - Phase 1 scope: views, conversations, duration, questions/session
- `.simple-task-master/tasks/16-*` - Phase 2 scope: AI summaries, topic extraction, sentiment, export
- `specs/03-api-reference.md` - API patterns for analytics endpoints

### Code
- `frontend/src/components/AnalyticsDashboard.tsx` - 268 lines, basic implementation complete with overview cards, bar chart, conversations table
- `frontend/src/pages/DashboardPage.tsx` - 231 lines, creator-only view with project grid, needs unified experience
- `frontend/src/pages/SharePage.tsx` - Viewer experience, no end-session handling currently
- `backend/src/controllers/analytics.controller.ts` - 179 lines, `getProjectAnalytics` and `getConversationAnalytics` implemented
- `backend/prisma/schema.prisma:311-347` - Conversation model has AI fields (summary, sentiment, topics) but unpopulated

### Patterns Found
- `TestingDojo` has end-session pattern with `beforeunload` listener and modal confirmation
- `savedConversations` relation exists but no API endpoints to save/retrieve viewer's saved threads
- Dashboard assumes user has projects - no handling for viewer-only users

---

## 3) Codebase Map

### Primary Components/Modules

| Component | Path | Role |
|-----------|------|------|
| AnalyticsDashboard | `frontend/src/components/AnalyticsDashboard.tsx` | Analytics tab UI |
| DashboardPage | `frontend/src/pages/DashboardPage.tsx` | Main dashboard (projects only) |
| SharePage | `frontend/src/pages/SharePage.tsx` | Viewer chat experience |
| ChatInterface | `frontend/src/components/ChatInterface.tsx` | Chat UI for viewers |
| analytics.controller | `backend/src/controllers/analytics.controller.ts` | Analytics API |
| chatService | `backend/src/services/chatService.ts` | Conversation management |

### Shared Dependencies
- `api.ts` - Frontend API client (needs new endpoints)
- `prisma` - Database access
- Authentication middleware - Needed for viewer→registered user flow

### Data Flow

```
Viewer Journey:
SharePage → ChatInterface → [End Session] → EndSessionModal → [Save?] → Registration → DashboardPage

Analytics Flow:
Conversation.endedAt → summarizeConversation() → Update Conversation.summary/sentiment/topics
                    ↓
ProjectPage/Analytics → getProjectAnalytics → AnalyticsDashboard → ConversationDetail
```

### Potential Blast Radius
- `DashboardPage` - Major changes for unified experience
- `SharePage` - Add end-session UI
- `api.ts` - New endpoints for saving conversations
- `auth.controller` - May need to handle viewer registration differently
- `chatService` - Add conversation end/summary logic

---

## 4) Root Cause Analysis

**N/A** - This is a feature implementation, not a bug fix.

---

## 5) Research Findings

### End-of-Session Experience

**Best Practices (from research):**
1. **User-initiated control** - Don't auto-end sessions; provide clear "End Conversation" button
2. **Graceful close detection** - Use `beforeunload` as backup but prefer explicit user action
3. **Value-first prompt** - Show summary of what was discussed before asking for account
4. **Timing** - Prompt immediately after value delivery (Slack achieves 30% vs 2-5% industry)

**Recommended Pattern:**
```
[User clicks "End Conversation" or closes tab]
         ↓
[EndSessionModal appears]
  - "Thanks for chatting about {project name}"
  - Quick summary: "You discussed X topics over Y messages"
  - "Create a free account to save this conversation and continue later"
  - [Save & Create Account] [Just End] buttons
```

### Unified Dashboard Patterns

**Research Insights:**
- Role-based dashboards with tab navigation work best for multi-role users
- Progressive disclosure: show relevant content based on user state
- Airtable/Notion pattern: "Workspaces" (projects) + "Recent" (activity) sections

**Recommended Structure:**
```
┌─────────────────────────────────────────────────────┐
│  Dashboard Header                          [Logout] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Saved Threads] (if hasThreads)                    │
│  ┌───────────────────────────────────────────────┐ │
│  │ Thread from "Project A"  •  5 msgs  •  Dec 3  │ │
│  │ Thread from "Project B"  •  12 msgs •  Nov 28 │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [My Projects] (always shown)                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Project cards OR empty state with CTA         │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Create Your Own] CTA (if no projects)             │
│  "Share your documents with AI-powered             │
│   conversations. Create your first project →"      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### AI Conversation Summarization

**Trigger Conditions:**
- Explicit end: User clicks "End Conversation"
- Implicit end: `beforeunload` event (less reliable)
- Threshold: Only summarize if `messageCount >= 5`

**Summary Content:**
- 2-3 sentence overview of discussion
- 3-5 extracted topics as tags
- Sentiment: positive/neutral/negative
- Optional: action items if detected

**LLM Prompt Pattern:**
```
Analyze this conversation and provide:
1. A 2-3 sentence summary
2. 3-5 key topics as single words or short phrases
3. Overall sentiment (positive/neutral/negative)
4. Any action items mentioned (if any)

Conversation:
{messages}
```

---

## 6) Clarification Questions

### For User Decision:

1. **End Session Button Location:**
   - Option A: In chat header (always visible)
   - Option B: At bottom of chat after last message
   - Option C: Both (header + contextual at end)
   - **Recommendation:** Option A - consistent, discoverable
   >> option A

2. **Viewer Registration Flow:**
   - Option A: Full registration form in modal (email + password)
   - Option B: Email-only "magic link" flow
   - Option C: Both options presented
   - **Recommendation:** Option A - consistent with existing auth, simpler to implement
   >> option A

3. **Saved Threads - Continue vs View-Only:**
   - Option A: Viewers can continue conversations later (append new messages)
   - Option B: Saved threads are read-only archives
   - **Recommendation:** Option A - more value, encourages return visits
   >> option A

4. **Analytics Export Format:**
   - Option A: CSV only (simpler)
   - Option B: CSV + PDF (more polished)
   - **Recommendation:** Option A for MVP, Option B for polish phase
   >> csv only is fine. exporting these analytics will be very rare

5. **Conversation Detail View:**
   - Option A: Full-page dedicated route (`/analytics/conversations/:id`)
   - Option B: Slide-over panel within analytics tab
   - **Recommendation:** Option B - keeps context, faster navigation
   >> option B

---

## 7) Implementation Phases

### Phase A: Analytics Completion (Backend + Frontend)

**Backend:**
1. Add `GET /api/conversations/:id` endpoint for full transcript + metadata
2. Add `POST /api/conversations/:id/end` endpoint to mark conversation ended + trigger summary
3. Add `generateConversationSummary()` service function using LLM
4. Update `getProjectAnalytics` to include document/section citation counts

**Frontend:**
1. Add conversation detail slide-over panel in AnalyticsDashboard
2. Add CSV export button with conversation data download
3. Add document citation statistics section
4. Wire up click handler on conversation table rows

### Phase B: End-of-Session Experience

**Backend:**
1. Add `POST /api/conversations/:id/save` endpoint (requires auth)
2. Add `GET /api/users/me/saved-conversations` endpoint
3. Handle viewer registration with conversation linking

**Frontend:**
1. Create `EndSessionModal` component with:
   - Conversation summary preview
   - "Save & Create Account" flow
   - "Just End" option
2. Add "End Conversation" button to SharePage header
3. Add `beforeunload` handler as backup
4. Create inline registration form in modal

### Phase C: Unified Dashboard

**Backend:**
1. Add `savedConversationCount` to user response
2. Create `GET /api/users/me/dashboard` endpoint returning unified data

**Frontend:**
1. Refactor DashboardPage to show:
   - Saved Threads section (if any)
   - My Projects section (always)
   - Creator CTA (if no projects)
2. Create `SavedThreadsList` component
3. Create `SavedThreadDetail` page for viewing/continuing conversations
4. Add empty state messaging for each section

---

## 8) Database Changes

**No schema changes required** - existing fields support all features:
- `Conversation.savedByUserId` - links saved conversations to users
- `Conversation.summary/sentiment/topics` - AI-generated fields ready
- `Conversation.endedAt` - tracks when conversation ended

**New indexes recommended:**
```prisma
@@index([savedByUserId]) // For fetching user's saved conversations
```

---

## 9) API Endpoints (New)

### Conversation Management
```
POST   /api/conversations/:id/end
       → Marks endedAt, triggers summary generation
       → Returns: { conversation, summary }

POST   /api/conversations/:id/save
       → Links conversation to authenticated user
       → Requires: Auth token
       → Returns: { savedConversation }
```

### User Dashboard
```
GET    /api/users/me/saved-conversations
       → Returns user's saved conversation threads
       → Returns: { conversations: [...], total }

GET    /api/users/me/dashboard
       → Returns unified dashboard data
       → Returns: { projects: [...], savedConversations: [...], stats }
```

### Analytics Enhancement
```
GET    /api/projects/:id/analytics/citations
       → Returns document/section citation statistics
       → Returns: { topDocuments: [...], topSections: [...] }

GET    /api/conversations/:id
       → Returns full conversation with messages
       → Returns: { conversation: {...}, messages: [...] }
```

---

## 10) Component Tree (New/Modified)

```
DashboardPage (modified)
├── SavedThreadsSection (new)
│   ├── SavedThreadCard (new)
│   └── EmptyState
├── ProjectsSection (extracted)
│   ├── ProjectCard (existing)
│   └── EmptyState + CreatorCTA
└── CreateProjectModal (existing)

SharePage (modified)
├── ChatHeader (modified - add End button)
├── ChatInterface (existing)
├── DocumentPanel (existing)
└── EndSessionModal (new)
    ├── ConversationSummary
    ├── RegisterForm (inline)
    └── ActionButtons

AnalyticsDashboard (modified)
├── OverviewCards (existing)
├── ConversationChart (existing)
├── ConversationsTable (modified - clickable)
├── CitationStats (new)
└── ConversationDetailPanel (new slide-over)
    ├── MessageList
    ├── MetadataPanel
    └── ExportButton

SavedThreadPage (new)
├── ConversationHeader
├── MessageList
├── ContinueChat (if allowed)
└── BackToDashboard
```

---

## 11) Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Viewer → Account conversion | >15% | Users who create account after prompt |
| Saved conversation rate | >30% | % of ended conversations that get saved |
| Return visitor rate | >20% | Saved thread viewers who return within 7 days |
| Summary generation time | <5s | Time from end-session to summary displayed |
| Analytics page load | <2s | Time to load full analytics dashboard |

---

## 12) Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM cost for summaries | Medium | 5+ message threshold, simple prompt |
| beforeunload unreliable | Low | Prefer explicit end button, use as backup only |
| Viewer spam accounts | Medium | Rate limit registration, require email verification |
| Dashboard complexity | Medium | Progressive disclosure, clear visual hierarchy |
| Conversation continuation conflicts | Low | Use optimistic locking, handle concurrent edits |
