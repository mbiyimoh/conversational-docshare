# Highlight-to-Comment UX & Collaborator Onboarding

**Slug:** highlight-to-comment-ux-and-collaborator-onboarding
**Author:** Claude Code
**Date:** 2025-12-22
**Branch:** preflight/highlight-comment-onboarding
**Related:** CollaboratorCommentPanel.tsx, ViewerPreferencesOnboarding.tsx, DocumentContentViewer.tsx

---

## 1) Intent & Assumptions

**Task brief:** Implement intuitive highlight-to-comment functionality where selecting text in a document immediately shows a comment bubble, plus add a final onboarding slide explaining the collaborator commenting feature with visual illustration (similar to Medium/Google Docs experience).

**Assumptions:**
- User is already in collaborator mode (`recipientRole === 'collaborator'`)
- The existing text selection infrastructure works (TreeWalker offset calculation, chunk detection)
- The backend comment API is functional and tested
- Mobile and desktop both need to support commenting
- Users are familiar with highlight-to-comment patterns from Medium, Google Docs, Notion

**Out of scope:**
- Real-time collaborative editing (Google Docs style)
- Comment threading/replies
- @mentions in comments
- Comment resolution workflows beyond status changes
- Inline comment markers visible in document text

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `DocumentContentViewer.tsx` | Has working text selection with TreeWalker offset calculation. Current popup only shows "Add Comment" button after selection - no inline comment input. |
| `CollaboratorCommentPanel.tsx` | Separate positioned panel for comment input. Uses absolute positioning with x/y from props. |
| `ViewerPreferencesOnboarding.tsx` | 3-step modal (depth, font, theme). Uses Framer Motion animations, ProgressBars component, handles keyboard navigation and focus trap. |
| `viewerPrefsConfig.ts` | Defines preference types, DEPTH_OPTIONS, FONT_OPTIONS, THEME_OPTIONS with structured config. Easy to extend with new step. |
| `SharePage.tsx` | Orchestrates comment flow: `handleAddComment` → `pendingComment` state → renders `CollaboratorCommentPanel`. |
| `CLAUDE.md` | Text offset uses TreeWalker pattern. Scroll containment critical. Design system: glass cards, gold accent #d4a54a, no emojis. |

---

## 3) Codebase Map

**Primary components/modules:**
- `DocumentContentViewer.tsx:76-169` - Text selection handler and popup
- `CollaboratorCommentPanel.tsx` - Comment form (currently separate positioned panel)
- `ViewerPreferencesOnboarding.tsx` - Multi-step onboarding modal
- `SharePage.tsx:251-338` - Comment orchestration handlers

**Shared dependencies:**
- `useViewerPreferencesContext` - Preferences hook (need to add collaborator-aware flag)
- `viewerPrefsConfig.ts` - Configuration constants
- Framer Motion - All animations
- Lucide icons - MessageSquarePlus, etc.
- `cn()` utility for className merging

**Data flow:**
1. User selects text → `handleTextSelection()` fires on `mouseup`
2. Selection validated → `textSelection` state set with position
3. Popup renders at selection position
4. Click "Add Comment" → `onAddComment()` callback → `handleAddComment()` in SharePage
5. `pendingComment` state set → `CollaboratorCommentPanel` renders
6. Submit → `handleSubmitComment()` → `api.createDocumentComment()`

**Feature flags/config:**
- `isCollaborator` prop passed to `DocumentContentViewer`
- `shareLink.recipientRole === 'collaborator'` determines collaborator status
- `preferences.onboardingComplete` controls onboarding visibility

**Potential blast radius:**
- DocumentContentViewer rendering (both paper and dark mode)
- ViewerPreferencesOnboarding step flow
- SharePage comment state management
- Mobile overlay (MobileDocumentOverlay) if commenting needs adaptation

---

## 4) Root Cause Analysis

**Problem 1: Comment UX is unclear**

- **Repro steps:**
  1. Access share link as collaborator
  2. Open document viewer
  3. Try to leave a comment
  4. ???

- **Observed:** User has no idea how to leave comments. The current flow requires:
  1. Select text (not obvious this is possible)
  2. See small "Add Comment" button appear (easy to miss)
  3. Click button to open separate panel
  4. Type comment in panel

- **Expected:** Like Medium/Google Docs - highlight text, immediate visual feedback, inline comment input appears.

- **Root-cause hypotheses:**
  1. **No visual affordance** - Nothing tells users text is selectable for comments (HIGH confidence)
  2. **Two-step process** - Button → Panel is extra friction vs inline input (HIGH confidence)
  3. **Popup positioning** - Small button can appear off-screen or obscured (MEDIUM confidence)
  4. **No onboarding** - Users aren't told this feature exists (HIGH confidence)

- **Decision:** Address all four issues - visual affordance via cursor change, inline comment input replacing two-step, better popup positioning, and onboarding slide.

**Problem 2: Missing onboarding context**

- **Repro steps:**
  1. Access share link as collaborator (first time)
  2. Complete onboarding (depth, font, theme)
  3. Start using app
  4. Never learn about commenting

- **Observed:** Onboarding covers reading preferences only, not collaboration capabilities.

- **Expected:** Final slide explains "You can comment on documents by highlighting text" with visual illustration.

- **Root cause:** Onboarding was designed for "viewer" role, not "collaborator" role.

---

## 5) Research Findings

### UX Patterns from Industry Leaders

**Medium Pattern:**
- Select text → Tooltip appears above selection
- Single button with comment icon
- Click → Inline popover expands with textarea
- Highlight remains visible during input
- Animation: subtle slide-up (200ms)

**Google Docs Pattern:**
- Select text → Comment icon appears in margin
- Click → Side panel opens (persistent)
- Selection highlighted in yellow
- Supports reply threading

**Notion Pattern:**
- Select text → Floating toolbar appears
- Multiple actions (comment, link, highlight)
- Click comment → Inline input below selection
- Minimal, clean design

**Recommended Pattern for This App:**
Given the existing infrastructure and design system, the **Medium-style inline popover** is most appropriate:

1. Familiar to users
2. Doesn't require major architectural changes
3. Works well in both paper and dark mode
4. Maintains focus on selected text
5. Fits glass card aesthetic

### Potential Solutions

**Solution A: Enhanced Popup (Recommended)**
- Keep current selection detection
- Replace button-only popup with expandable inline comment input
- Add visual affordances (cursor change, subtle highlight on hover)
- Smooth animation on expand

**Pros:**
- Minimal refactoring
- Single-step comment flow
- Familiar UX pattern
- Works with existing positioning logic

**Cons:**
- Popup may still need positioning improvements for edge cases

**Solution B: Margin Comments (Google Docs style)**
- Add comment icon in right margin
- Open side panel on click
- Highlight selected text in document

**Pros:**
- Persistent comment visibility
- Better for long documents

**Cons:**
- Major UI restructure
- Conflicts with current mobile overlay design
- Less intuitive selection → comment flow

**Solution C: Floating Toolbar (Notion style)**
- Multi-action toolbar on selection
- Comment is one of several options
- More flexible for future features

**Pros:**
- Extensible for future features (highlight, share, etc.)
- Modern feel

**Cons:**
- Over-engineered for current needs
- More complex implementation
- Users may be confused by options

### Recommendation

**Go with Solution A (Enhanced Popup)** with these specific improvements:

1. **Visual Affordance:**
   - Add `cursor: text` + subtle gold underline on hover for collaborators
   - Tooltip hint on first document view: "Highlight text to comment"

2. **Inline Comment Input:**
   - Expand popup to include textarea directly (no second panel)
   - Keep preview of selected text above input
   - Submit/Cancel buttons inline
   - Auto-focus textarea on popup appear

3. **Positioning Improvements:**
   - Ensure popup stays within viewport bounds
   - Add arrow/caret pointing to selection
   - Handle mobile viewport correctly

4. **Animation:**
   - Framer Motion spring animation (150ms)
   - Scale from 0.95 → 1.0 with fade

### Onboarding Slide Design

**Slide Content:**
- Title: "Leave feedback directly on the documents"
- Subtitle: "Highlight any text to share your thoughts"
- Visual: Animated illustration showing:
  1. Cursor selecting text (highlighted in gold)
  2. Comment popup appearing
  3. User typing comment
- Small note: "Your feedback helps improve these documents"

**Visual Style:**
- Match existing onboarding aesthetic
- Use gold accent for highlighted text in illustration
- Glass card containing the illustration
- Framer Motion sequence animation

---

## 6) Clarifications Needed

1. **Onboarding scope:** Should the collaborator slide ONLY show for collaborators, or should all viewers see it with different messaging?
   - Option A: Only show slide 4 if `recipientRole === 'collaborator'`
   - Option B: Show to all with "Collaborators can comment..." messaging
   - **Recommendation:** Option A - keeps onboarding focused and relevant
   >> yes, go with your recommendation

2. **Mobile commenting:** On mobile, the document viewer is in an overlay. Should:
   - Option A: Comment popup appear in overlay (same as desktop)
   - Option B: Open bottom sheet for comment input
   - **Recommendation:** Option A with adjusted positioning
   >> yes, go with your recommendation

3. **Existing comments visibility:** Should we show indicators for existing comments on text?
   - Option A: No indicators (keep document clean)
   - Option B: Subtle highlight on commented text
   - **Recommendation:** Start with Option A, add B later if requested
   >> yes, go with your recommendation

4. **Animation illustration:** For the onboarding slide, should the illustration be:
   - Option A: Static image showing the comment flow
   - Option B: Animated sequence (Framer Motion)
   - Option C: Interactive mini-demo (user can try highlighting)
   - **Recommendation:** Option B - animated but not interactive (simpler implementation, still engaging)
   >> yes, go with your recommendation
---

## 7) Implementation Plan (High-Level)

### Part 1: Enhanced Comment Popup

1. **Modify `DocumentContentViewer.tsx`:**
   - Add `isExpanded` state to popup
   - When "Add Comment" clicked, expand popup to show textarea
   - Move textarea logic from CollaboratorCommentPanel into popup
   - Add viewport boundary detection
   - Add caret/arrow pointing to selection

2. **Visual affordances:**
   - Add CSS for collaborator cursor change
   - Add subtle hover effect on document text (optional gold underline)

3. **Animation:**
   - Wrap popup in Framer Motion
   - Add scale/opacity animation
   - Add expand animation for textarea reveal

### Part 2: Collaborator Onboarding Slide

1. **Create `CollaboratorFeatureSlide.tsx`:**
   - New component for the illustration
   - SVG-based or div-based animated mockup
   - Shows selection → popup → typing sequence

2. **Modify `ViewerPreferencesOnboarding.tsx`:**
   - Add conditional step when `isCollaborator`
   - Pass `isCollaborator` prop from SharePage
   - Update STEPS array conditionally
   - Add step content for 'collaboration' step

3. **Modify `viewerPrefsConfig.ts`:**
   - Add 'collaboration' to step types (conditional)

### Part 3: Integration

1. **SharePage.tsx:**
   - Pass `isCollaborator` to onboarding
   - Update state management if needed

2. **Testing:**
   - Test both collaborator and non-collaborator flows
   - Test on mobile viewport
   - Test edge cases (selection near viewport edge)

---

## 8) Files to Modify

| File | Changes |
|------|---------|
| `DocumentContentViewer.tsx` | Enhanced popup with inline comment form, animations, positioning |
| `ViewerPreferencesOnboarding.tsx` | Add conditional collaboration step |
| `viewerPrefsConfig.ts` | Add collaboration step config |
| `SharePage.tsx` | Pass isCollaborator to onboarding |
| `frontend/src/components/viewer-prefs/CollaboratorFeatureSlide.tsx` | NEW - Animated illustration component |

---

## 9) Success Criteria

1. **Comment UX:**
   - Highlighting text immediately shows a popup
   - Popup expands to show comment input (no second panel)
   - Comment can be submitted in 2 actions: highlight → type+submit
   - Visual cursor indicates text is commentable

2. **Onboarding:**
   - Collaborators see 4-step onboarding (depth, font, theme, collaboration)
   - Non-collaborators see 3-step onboarding (unchanged)
   - Collaboration slide has animated illustration
   - Illustration clearly shows highlight → comment flow

3. **Polish:**
   - Smooth Framer Motion animations throughout
   - Popup stays within viewport bounds
   - Works correctly on mobile
   - Matches 33 Strategies design system
