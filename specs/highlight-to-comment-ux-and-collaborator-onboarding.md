# Spec: Highlight-to-Comment UX & Collaborator Onboarding

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-22
**Ideation:** `docs/ideation/highlight-to-comment-ux-and-collaborator-onboarding.md`

---

## 1. Overview

### Problem Statement
Collaborators accessing shared documents have no clear way to leave comments. The current implementation requires discovering that text can be selected, then clicking a small "Add Comment" button, then typing in a separate panel. Additionally, the onboarding flow doesn't explain the commenting feature exists.

### Solution Summary
1. **Enhanced inline comment popup** - When text is highlighted, an expandable popup appears with the comment input directly inline (Medium-style pattern)
2. **Collaborator onboarding slide** - A 4th onboarding step (only for collaborators) with an animated illustration showing how to highlight and comment

### Success Criteria
- [ ] Highlighting text shows a popup with comment input (no separate panel)
- [ ] Comments can be submitted in 2 actions: highlight → type+submit
- [ ] Collaborators see 4-step onboarding with collaboration slide
- [ ] Non-collaborators see unchanged 3-step onboarding
- [ ] Animation illustration clearly shows the highlight → comment flow
- [ ] Works correctly on mobile overlay
- [ ] Matches 33 Strategies design system

---

## 2. Technical Design

### 2.1 Enhanced Comment Popup

**Current State:**
```
DocumentContentViewer.tsx:
- handleTextSelection() detects selection, calculates offsets
- Sets textSelection state with {chunkId, startOffset, endOffset, text, position}
- Renders small popup with "Add Comment" button
- onClick calls onAddComment() → SharePage sets pendingComment → CollaboratorCommentPanel renders separately
```

**New State:**
```
DocumentContentViewer.tsx:
- Same selection detection
- Popup now has two modes: collapsed (button) and expanded (inline form)
- isCommentExpanded state tracks mode
- Clicking button expands popup to show textarea inline
- Submit calls onAddComment with comment content directly
- No separate CollaboratorCommentPanel needed for inline flow
```

**Component Structure:**

```typescript
// New internal component in DocumentContentViewer.tsx
interface InlineCommentPopupProps {
  selection: TextSelection
  onSubmit: (content: string) => Promise<void>
  onCancel: () => void
  containerRect: DOMRect | null
}

function InlineCommentPopup({ selection, onSubmit, onCancel, containerRect }: InlineCommentPopupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const popupRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Keyboard accessibility: Escape to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  // Auto-focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isExpanded])

  // Calculate position with viewport boundary detection
  const position = useMemo(() => {
    let x = selection.position.x
    let y = selection.position.y

    // Ensure popup stays within container bounds
    if (containerRect && popupRef.current) {
      const popupWidth = isExpanded ? 320 : 140
      const minX = popupWidth / 2 + 8
      const maxX = containerRect.width - popupWidth / 2 - 8
      x = Math.max(minX, Math.min(maxX, x))
    }

    return { x, y }
  }, [selection.position, containerRect, isExpanded])

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit(content.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      ref={popupRef}
      role="dialog"
      aria-label={isExpanded ? "Add comment form" : "Comment on selected text"}
      aria-modal="false"
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 5 }}
      transition={{ type: 'spring', damping: 25, stiffness: 400 }}
      className="comment-popover absolute z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      {/* Caret pointing to selection */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0
        border-l-[8px] border-l-transparent
        border-r-[8px] border-r-transparent
        border-t-[8px] border-t-card-bg" />

      <div className="bg-card-bg backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            // Collapsed: Just the button
            <motion.button
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent hover:bg-background-elevated transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Comment
            </motion.button>
          ) : (
            // Expanded: Inline form
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-80 p-4"
            >
              {/* Selected text preview */}
              <div className="mb-3 pb-2 border-b border-border">
                <div className="text-[10px] font-mono text-accent uppercase tracking-wider mb-1">
                  Commenting on:
                </div>
                <div className="text-sm text-muted italic line-clamp-2">
                  "{selection.text}"
                </div>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your comment..."
                aria-label="Comment text"
                className="w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-lg
                  text-foreground placeholder:text-muted resize-none
                  focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              />

              {error && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !content.trim()}
                  className="px-4 py-1.5 text-sm font-medium bg-accent text-background rounded-md
                    hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
```

**Props Changes to DocumentContentViewer:**

```typescript
interface DocumentContentViewerProps {
  documentId: string
  shareSlug: string
  highlightSectionId?: string | null
  highlightKey?: number
  isCollaborator?: boolean
  // CHANGED: Now receives full submit handler instead of just selection callback
  onCommentSubmit?: (data: {
    chunkId: string
    startOffset: number
    endOffset: number
    text: string
    content: string
  }) => Promise<void>
}
```

**SharePage Changes:**

```typescript
// In SharePage.tsx, replace handleAddComment pattern:

// OLD:
const handleAddComment = (selection: {...}) => setPendingComment(selection)
// ...render CollaboratorCommentPanel when pendingComment exists

// NEW:
const handleCommentSubmit = async (data: {
  chunkId: string
  startOffset: number
  endOffset: number
  text: string
  content: string
}) => {
  if (!selectedDocumentId || !conversationId) return

  await api.createDocumentComment(selectedDocumentId, {
    conversationId,
    chunkId: data.chunkId,
    startOffset: data.startOffset,
    endOffset: data.endOffset,
    highlightedText: data.text,
    content: data.content,
    viewerEmail: viewerEmail || undefined,
    viewerName: viewerName || undefined,
  })

  await loadComments()
}

// Pass to DocumentContentViewer:
<DocumentContentViewer
  ...
  isCollaborator={isCollaborator}
  onCommentSubmit={handleCommentSubmit}
/>
```

### 2.2 Collaborator Onboarding Slide

**New Component: `CollaboratorFeatureSlide.tsx`**

Located at: `frontend/src/components/viewer-prefs/CollaboratorFeatureSlide.tsx`

```typescript
import { motion, useReducedMotion } from 'framer-motion'
import { MessageSquarePlus } from 'lucide-react'

export function CollaboratorFeatureSlide() {
  const prefersReducedMotion = useReducedMotion()

  // Animation sequence timing (in seconds)
  const timing = {
    selectionStart: 0.5,
    selectionEnd: 1.5,
    popupAppear: 2.0,
    typingStart: 2.5,
    typingEnd: 4.0,
    loopReset: 5.0,
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Illustration container - glass card */}
      <div className="relative bg-card-bg/50 backdrop-blur-sm border border-border rounded-xl p-6 overflow-hidden">
        {/* Mock document content */}
        <div className="space-y-3 mb-4">
          <div className="h-3 bg-muted/20 rounded w-3/4" />
          <div className="h-3 bg-muted/20 rounded w-full" />

          {/* Highlighted text line */}
          <div className="relative h-3 flex items-center">
            <div className="bg-muted/20 rounded w-1/4" style={{ height: '100%' }} />
            <motion.div
              className="mx-1 bg-accent/30 rounded px-1"
              initial={{ scaleX: 0, originX: 0 }}
              animate={prefersReducedMotion ? { scaleX: 1 } : {
                scaleX: [0, 1, 1, 1, 0],
                transition: {
                  duration: timing.loopReset,
                  times: [
                    timing.selectionStart / timing.loopReset,
                    timing.selectionEnd / timing.loopReset,
                    timing.popupAppear / timing.loopReset,
                    (timing.loopReset - 0.5) / timing.loopReset,
                    1
                  ],
                  repeat: Infinity,
                  ease: 'easeInOut'
                }
              }}
              style={{ height: '100%', width: '35%' }}
            >
              <span className="text-[8px] text-accent font-medium whitespace-nowrap">
                important insight
              </span>
            </motion.div>
            <div className="bg-muted/20 rounded flex-1" style={{ height: '100%' }} />
          </div>

          <div className="h-3 bg-muted/20 rounded w-5/6" />
          <div className="h-3 bg-muted/20 rounded w-2/3" />
        </div>

        {/* Animated popup */}
        <motion.div
          className="absolute left-1/2 top-[45%]"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : {
            opacity: [0, 0, 1, 1, 0],
            scale: [0.9, 0.9, 1, 1, 0.9],
            y: [10, 10, 0, 0, 10],
            transition: {
              duration: timing.loopReset,
              times: [
                0,
                (timing.popupAppear - 0.1) / timing.loopReset,
                timing.popupAppear / timing.loopReset,
                (timing.loopReset - 0.3) / timing.loopReset,
                1
              ],
              repeat: Infinity,
            }
          }}
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="bg-card-bg border border-border rounded-lg shadow-lg p-3 w-48">
            {/* Mini comment form mockup */}
            <div className="flex items-center gap-2 text-accent text-xs font-medium mb-2">
              <MessageSquarePlus className="w-3 h-3" />
              Comment
            </div>

            {/* Typing animation */}
            <motion.div
              className="h-8 bg-background/50 rounded border border-border/50 px-2 py-1"
              initial={{ opacity: 0.5 }}
              animate={prefersReducedMotion ? { opacity: 1 } : {
                opacity: [0.5, 0.5, 0.5, 1, 1, 0.5],
                transition: {
                  duration: timing.loopReset,
                  times: [
                    0,
                    timing.typingStart / timing.loopReset,
                    (timing.typingStart + 0.1) / timing.loopReset,
                    timing.typingEnd / timing.loopReset,
                    (timing.loopReset - 0.3) / timing.loopReset,
                    1
                  ],
                  repeat: Infinity,
                }
              }}
            >
              <motion.span
                className="text-[10px] text-foreground/80"
                initial={{ opacity: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : {
                  opacity: [0, 0, 0, 1, 1, 0],
                  transition: {
                    duration: timing.loopReset,
                    times: [
                      0,
                      timing.typingStart / timing.loopReset,
                      (timing.typingStart + 0.3) / timing.loopReset,
                      timing.typingEnd / timing.loopReset,
                      (timing.loopReset - 0.3) / timing.loopReset,
                      1
                    ],
                    repeat: Infinity,
                  }
                }}
              >
                Great point here...
              </motion.span>
            </motion.div>
          </div>

          {/* Caret */}
          <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[6px] border-t-card-bg" />
        </motion.div>

        {/* Cursor animation */}
        <motion.div
          className="absolute w-4 h-4 pointer-events-none"
          initial={{ left: '20%', top: '30%' }}
          animate={prefersReducedMotion ? {} : {
            left: ['20%', '30%', '55%', '50%', '50%', '20%'],
            top: ['30%', '42%', '42%', '55%', '60%', '30%'],
            transition: {
              duration: timing.loopReset,
              times: [
                0,
                timing.selectionStart / timing.loopReset,
                timing.selectionEnd / timing.loopReset,
                timing.popupAppear / timing.loopReset,
                timing.typingStart / timing.loopReset,
                1
              ],
              repeat: Infinity,
              ease: 'easeInOut'
            }
          }}
        >
          {/* Custom cursor SVG */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M1 1L1 12L4.5 8.5L7 14L9 13L6.5 7.5L11 7.5L1 1Z"
              fill="#d4a54a"
              stroke="#0a0a0f"
              strokeWidth="1"
            />
          </svg>
        </motion.div>
      </div>

      {/* Instruction text */}
      <p className="text-center text-sm text-muted mt-4">
        Select any text to share your feedback
      </p>
    </div>
  )
}
```

**Onboarding Integration:**

Modify `ViewerPreferencesOnboarding.tsx`:

```typescript
// Add to imports
import { CollaboratorFeatureSlide } from './CollaboratorFeatureSlide'

// Update props interface
interface ViewerPreferencesOnboardingProps {
  onComplete: () => void
  isCollaborator?: boolean  // NEW
}

// Update STEPS logic
const STEPS_BASE = ['depth', 'font', 'theme'] as const
const STEPS_COLLABORATOR = ['depth', 'font', 'theme', 'collaboration'] as const

// Inside component:
const STEPS = isCollaborator ? STEPS_COLLABORATOR : STEPS_BASE

// Update STEP_TITLES
const STEP_TITLES: Record<string, string> = {
  depth: 'How much detail do you prefer?',
  font: 'Choose your reading style',
  theme: 'Pick a color scheme',
  collaboration: 'Leave feedback on documents',  // NEW
}

// In the step-specific selector section, add:
{currentStepName === 'collaboration' && (
  <CollaboratorFeatureSlide />
)}
```

**SharePage Integration:**

```typescript
// In SharePage.tsx, update onboarding rendering:
{showOnboarding && (
  <ViewerPreferencesOnboarding
    onComplete={() => setShowOnboarding(false)}
    isCollaborator={isCollaborator}  // NEW
  />
)}
```

---

## 3. File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `DocumentContentViewer.tsx` | MODIFY | Replace popup with InlineCommentPopup component, add Framer Motion animations, viewport boundary detection |
| `SharePage.tsx` | MODIFY | Replace `handleAddComment` pattern with `handleCommentSubmit`, pass `isCollaborator` to onboarding, remove CollaboratorCommentPanel usage for inline flow |
| `ViewerPreferencesOnboarding.tsx` | MODIFY | Add `isCollaborator` prop, conditional 4th step, render CollaboratorFeatureSlide |
| `CollaboratorFeatureSlide.tsx` | CREATE | New animated illustration component |
| `MobileDocumentOverlay.tsx` | MODIFY | Update `onAddComment` prop to `onCommentSubmit` with new signature |

### 3.1 Detailed Prop Rename Locations

The `onAddComment` callback changes to `onCommentSubmit` with a new signature. Update these locations:

**SharePage.tsx:**
- Line ~313: Rename `handleAddComment` function to `handleCommentSubmit` (already handles full submission)
- Line ~468: Update prop passed to `SharePageContent`
- Line ~514: Update type in `SharePageContentProps` interface
- Line ~548: Update destructured prop name
- Line ~802: Update prop passed to `DocumentContentViewer`
- Line ~681: Update prop passed to `MobileDocumentOverlay`

**DocumentContentViewer.tsx:**
- Line ~37: Rename prop from `onAddComment` to `onCommentSubmit`
- Line ~46: Update destructured prop
- Update all internal usages

**MobileDocumentOverlay.tsx:**
- Update prop interface
- Update prop usage when rendering `DocumentContentViewer`

---

## 4. Edge Cases & Error Handling

### Selection Edge Cases
1. **Selection spans multiple chunks** - Use the chunk containing the start of selection
2. **Selection near viewport edge** - Popup repositions to stay within bounds
3. **Very short selection (<3 chars)** - Don't show popup (existing behavior)
4. **Selection cleared by scroll** - Dismiss popup
5. **Mobile touch selection** - React's synthetic event system fires `onMouseUp` for touch events as well, so the existing handler works on mobile without additional `touchend` handling
6. **Keyboard dismissal** - Escape key closes popup at any state (collapsed or expanded)

### Comment Submission
1. **Empty comment** - Show inline error, don't submit
2. **Network error** - Show error in popup, allow retry
3. **Success** - Dismiss popup, clear selection, optionally show toast

### Onboarding
1. **Non-collaborator** - Skip collaboration step entirely
2. **Reduced motion preference** - Show static illustration
3. **Skip button** - Works same as before, marks onboarding complete

---

## 5. Testing Checklist

### Functional Tests
- [ ] Highlight text → popup appears above selection
- [ ] Click "Comment" → popup expands with textarea
- [ ] Textarea auto-focuses when popup expands
- [ ] Type comment → Post button enables
- [ ] Submit comment → API called, popup dismisses
- [ ] Cancel → popup collapses/dismisses
- [ ] Click outside → popup dismisses
- [ ] Escape key (collapsed) → popup dismisses
- [ ] Escape key (expanded) → popup dismisses

### Positioning Tests
- [ ] Selection at left edge → popup shifts right
- [ ] Selection at right edge → popup shifts left
- [ ] Selection at top → popup still appears above (or shifts below)
- [ ] Long document scroll → popup follows selection

### Onboarding Tests
- [ ] Collaborator sees 4 steps
- [ ] Non-collaborator sees 3 steps
- [ ] Animation plays in collaboration slide
- [ ] Reduced motion shows static illustration
- [ ] Skip works from any step
- [ ] Back/Next navigation works

### Mobile Tests
- [ ] Popup works in mobile overlay
- [ ] Touch selection triggers popup
- [ ] Popup doesn't overflow viewport
- [ ] Keyboard doesn't obscure input

### Design System Compliance
- [ ] Uses gold accent (#d4a54a)
- [ ] Glass card aesthetic (backdrop-blur, border)
- [ ] DM Sans for body text
- [ ] JetBrains Mono for labels
- [ ] No emojis
- [ ] Framer Motion animations (spring physics)

### Accessibility Tests
- [ ] Popup has role="dialog" and aria-label
- [ ] Textarea has aria-label
- [ ] Focus moves to textarea when expanded
- [ ] Escape key dismisses popup
- [ ] Reduced motion preference respected in onboarding animation

---

## 6. Implementation Order

1. **Create CollaboratorFeatureSlide.tsx** - New file, no dependencies
2. **Modify ViewerPreferencesOnboarding.tsx** - Add conditional step
3. **Modify SharePage.tsx** - Pass isCollaborator to onboarding
4. **Test onboarding** - Verify 3-step vs 4-step flow
5. **Modify DocumentContentViewer.tsx** - Replace popup with inline form
6. **Modify SharePage.tsx** - Update comment submission pattern
7. **Test comment flow** - Full end-to-end
8. **Polish** - Animations, edge cases, mobile

---

## 7. Rollback Plan

If issues arise:
1. Revert DocumentContentViewer.tsx to button-only popup
2. Revert SharePage.tsx to use CollaboratorCommentPanel
3. Keep onboarding changes (low risk, additive only)

The CollaboratorCommentPanel component remains unchanged and can be used as fallback.

---

## 8. Dependencies

**Existing:**
- Framer Motion (already installed)
- Lucide icons (already installed)
- Tailwind CSS (already configured)

**No new dependencies required.**

---

## 9. Performance Considerations

1. **Animation performance** - Use CSS transforms (translate, scale) for GPU acceleration
2. **Popup re-renders** - Memoize position calculations
3. **Onboarding illustration** - Use CSS animations where possible, Framer Motion for complex sequences
4. **Bundle size** - No new dependencies, minimal code addition (~300 lines total)
