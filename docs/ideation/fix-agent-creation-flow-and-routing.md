# Fix AI Agent Creation Flow and Tab Routing

**Slug:** fix-agent-creation-flow-and-routing
**Author:** Claude Code
**Date:** 2025-12-15
**Branch:** preflight/fix-agent-creation-flow-and-routing
**Related:** `specs/feat-braindump-agent-profile-synthesis-frontend.md`, `docs/ideation/stories-onboarding-flow.md`

---

## 1) Intent & Assumptions

- **Task brief:** Fix the AI agent creation flow so that after submitting a brain dump, users are redirected to the profile page with success feedback (not back to the choice screen). Remove the Interview Responses tab from main navigation and replace with a small callout to view source material. Fix the blank profile page bug. Convert the 5-tab navigation from state-based to dedicated URL routes.

- **Assumptions:**
  - The existing brain dump synthesis backend works correctly
  - Users should only see the creation choice screen when no profile exists
  - Once a profile exists, the agent tab should always show the profile directly
  - Source material (brain dump text or interview responses) should be viewable but not prominent
  - URL-based routing is preferred over state-based tabs for better UX

- **Out of scope:**
  - Redesigning the actual profile display/editing UI
  - Changes to the Testing Dojo or Share Link Manager components
  - Mobile-specific optimizations
  - Adding new profile fields or synthesis improvements

---

## 2) Pre-reading Log

- `frontend/src/pages/ProjectPage.tsx`: Main container with 5-tab navigation using `useState`. Handles agent tab logic with `profileCreationMode` state machine. **Bug identified:** After brain dump save, `onSaved()` sets mode back to 'choice' instead of showing profile.

- `frontend/src/App.tsx`: Single route `/projects/:projectId` for entire project page. No nested routes for tabs.

- `frontend/src/components/AgentProfile.tsx`: Displays 5-section profile with version history. Receives `interviewData` prop for source attribution. Has "Edit Interview" and "Continue to Testing" buttons.

- `frontend/src/components/AgentProfileBrainDumpModal.tsx`: 3-step wizard (input → processing → preview). After save, calls `onSaved()` callback. No success feedback shown.

- `frontend/src/components/AgentInterview.tsx`: Has sub-tabs for 'responses' and 'profile'. The `AgentProfile` component is embedded inside it. **Architectural issue:** Profile view is nested inside interview component.

- `frontend/src/components/ProfileCreationChoice.tsx`: Simple two-option selector. Should only show when no profile exists.

- `specs/feat-braindump-agent-profile-synthesis-frontend.md`: Documents the brain dump modal flow. Notes that `onSaved` should "Refresh profile display or navigate" but current implementation doesn't.

---

## 3) Codebase Map

- **Primary components/modules:**
  - `frontend/src/pages/ProjectPage.tsx` - Main project page with tab navigation
  - `frontend/src/components/AgentProfile.tsx` - Profile display/editing
  - `frontend/src/components/AgentInterview.tsx` - Interview flow + profile sub-tab
  - `frontend/src/components/AgentProfileBrainDumpModal.tsx` - Brain dump wizard
  - `frontend/src/components/ProfileCreationChoice.tsx` - Creation method selector
  - `frontend/src/App.tsx` - Route definitions

- **Shared dependencies:**
  - `frontend/src/lib/api.ts` - API client with `getAgentConfig`, `getAgentProfile`, `saveAgentProfileV2`
  - `frontend/src/components/ui/` - Button, Card, Textarea, Badge components
  - `react-router-dom` - useParams, useNavigate, Routes, Route

- **Data flow:**
  - Brain dump: User input → `api.synthesizeAgentProfile()` → Preview → `api.saveAgentProfileV2()` → Profile saved
  - Interview: Questions → `api.saveAgentConfig()` → Interview data → `api.generateAgentProfileStream()` → Profile
  - Profile load: `api.getAgentConfig()` checks status → `api.getAgentProfile()` loads sections

- **Feature flags/config:** None for routing. Tab order defined in `ProjectPage.tsx:20-26`.

- **Potential blast radius:**
  - `ProjectPage.tsx` - Major restructure for URL routing
  - `App.tsx` - New nested routes
  - `AgentInterview.tsx` - Remove profile sub-tab, simplify to interview-only
  - `AgentProfile.tsx` - Standalone component with source material callout
  - Navigation/back buttons throughout the app that link to specific tabs

---

## 4) Root Cause Analysis

### Bug 1: Blank Profile Page

- **Repro steps:**
  1. Create a project and upload documents
  2. Create an AI agent using brain dump flow
  3. Navigate away from project
  4. Return to project and click "AI Agent" tab

- **Observed:** Blank page or loading spinner that never resolves
- **Expected:** Profile should display immediately

- **Evidence:**
  - `ProjectPage.tsx:54`: When `config?.status === 'complete'`, sets `profileCreationMode = 'interview'`
  - `AgentInterview.tsx:77-79`: If status is 'complete', sets `view = 'review'`
  - `AgentInterview.tsx:57`: Default `reviewTab = 'responses'` (not 'profile')
  - The profile is only visible when `reviewTab === 'profile'`

- **Root-cause hypotheses:**
  1. **HIGH confidence:** Profile view is buried under two levels of state (`view === 'review'` AND `reviewTab === 'profile'`). Users see responses tab by default, not the profile.
  2. **MEDIUM confidence:** Brain dump profiles use V2 schema but `AgentProfile.tsx` may be calling V1 endpoints
  3. **LOW confidence:** Race condition between config check and profile load

- **Decision:** Primary cause is architectural - profile is nested inside interview component with wrong default state. Secondary cause may be API mismatch.

### Bug 2: No Redirect After Brain Dump

- **Repro steps:**
  1. Go to AI Agent tab
  2. Select "Describe in Your Own Words"
  3. Enter brain dump, generate, save

- **Observed:** User is returned to choice screen with no feedback
- **Expected:** User should be taken to profile view with success toast

- **Evidence:**
  - `AgentProfileBrainDumpModal.tsx:105`: After save, calls `onSaved()`
  - `ProjectPage.tsx:182-184`: `onSaved` handler sets `profileCreationMode('choice')`

- **Root cause:** The `onSaved` callback navigates to wrong destination.

### Bug 3: Interview Tab Always Visible

- **Root cause:** `AgentInterview.tsx` contains both interview questionnaire AND profile review with sub-tabs. This architectural decision means the interview responses tab persists even after profile creation.

---

## 5) Research Findings

### Potential Solutions for URL-Based Tab Routing

**1. Nested Routes with Outlet**

```typescript
// App.tsx
<Route path="/projects/:projectId" element={<ProjectLayout />}>
  <Route index element={<Navigate to="documents" replace />} />
  <Route path="documents" element={<DocumentUpload />} />
  <Route path="agent" element={<AgentPage />} />
  <Route path="test" element={<TestingDojo />} />
  <Route path="share" element={<ShareLinkManager />} />
  <Route path="analytics" element={<AnalyticsDashboard />} />
</Route>
```

**Pros:**
- Clean, semantic URLs (`/projects/123/agent`)
- Browser history works correctly
- Deep linking support
- Better for SEO (if relevant)
- Each tab can have its own data loading

**Cons:**
- Requires restructuring route definitions
- `ProjectLayout` component needed for shared header/tabs
- More migration work

**2. Search Parameters**

```typescript
// /projects/123?tab=agent
const [searchParams, setSearchParams] = useSearchParams()
const activeTab = searchParams.get('tab') || 'documents'
```

**Pros:**
- Minimal migration effort
- Single route, state in URL
- Easy to add more parameters later

**Cons:**
- Less semantic URLs
- Harder to add route guards per tab
- No per-tab data loading optimization

**Recommendation:** **Nested Routes** - Better UX, cleaner architecture, and future-proof for per-tab features like route guards or lazy loading.

### Profile Page Architecture

**Option A: AgentProfile as Standalone Page**

- Extract `AgentProfile.tsx` from `AgentInterview.tsx`
- Route directly to `<AgentProfile />` when profile exists
- Add collapsible "View Source Material" section at top

**Option B: Wrapper Component with State Detection**

- Create `AgentPage.tsx` that checks profile existence
- Shows `ProfileCreationChoice` if no profile
- Shows `AgentProfile` (standalone) if profile exists
- Interview flow handled as separate modal or sub-route

**Recommendation:** **Option B** - Keeps creation flow discoverable while making profile the primary view.

---

## 6) Clarifications (Resolved)

1. **Success feedback style:** **Toast + redirect** - Show brief toast notification and immediately redirect to profile view

2. **Source material callout design:** **Icon button + modal** - Small icon in profile header that opens source material (brain dump or interview responses) in a modal

3. **URL structure preference:** **Query params** - `/projects/123?tab=agent` for simpler migration

4. **Profile update flow:** Users should have two options:
   - **Primary (recommended):** Edit existing profile with a prompt - submit additional context to refine the current profile
   - **Secondary:** Full re-interview/brain dump - start fresh with the creation flow

5. **Backward compatibility:** Default to documents tab for existing URLs without tab parameter

---

## 7) Proposed Implementation Approach

### Phase 1: Fix Critical Bugs (Quick Wins)

1. **Fix brain dump redirect** - Change `onSaved()` handler in `ProjectPage.tsx` to navigate to profile view with success toast
2. **Add success toast** - Show "Profile created successfully" notification
3. **Fix blank profile** - Make AgentProfile the primary view when profile exists (not nested in AgentInterview)

### Phase 2: Restructure Agent Tab Architecture

1. **Create AgentPage component** - Smart wrapper that:
   - Checks if profile exists via `api.getAgentConfig()`
   - Shows `ProfileCreationChoice` if no profile
   - Shows `AgentProfile` (standalone) if profile exists
   - Handles the "refine with prompt" flow as primary update method

2. **Add Source Material Modal** - New `SourceMaterialModal.tsx`:
   - Icon button in AgentProfile header opens modal
   - Displays raw brain dump text OR interview Q&A responses
   - Read-only view with nice formatting

3. **Add Profile Refinement Feature** - On AgentProfile page:
   - "Refine Profile" button (recommended) - Opens textarea for additional context
   - "Start Over" link (secondary) - Returns to ProfileCreationChoice
   - Uses existing `api.synthesizeAgentProfile()` with additionalContext param

4. **Simplify AgentInterview** - Remove profile sub-tab, interview-only component

### Phase 3: URL-Based Tab Navigation (Query Params)

1. **Update ProjectPage** - Use `useSearchParams` for tab state:
   ```typescript
   const [searchParams, setSearchParams] = useSearchParams()
   const activeTab = searchParams.get('tab') || 'documents'
   ```

2. **Update tab navigation** - Replace `setActiveTab(tab)` with:
   ```typescript
   setSearchParams({ tab })
   ```

3. **Update cross-component navigation** - Fix all `onComplete` callbacks to use URL navigation

4. **Handle initial load** - Default to 'documents' tab if no param

### Phase 4: Polish & Edge Cases

1. **Loading states** - Proper skeleton loading for profile
2. **Error handling** - Graceful fallback if profile load fails
3. **Toast notifications** - Consistent success/error feedback
4. **URL sync** - Ensure browser back/forward work correctly

### Estimated Impact

- **Files modified:** 8-10 core files
- **New files:** 2-3 (AgentPage, SourceMaterialModal)
- **Breaking changes:** None - query params preserve existing URL structure
- **Risk level:** Low-Medium (mostly UI restructuring, no DB changes)
