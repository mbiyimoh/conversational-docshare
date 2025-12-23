# Task Breakdown: Mobile Document Viewer Overlay

**Generated:** 2025-12-22
**Source:** specs/feat-mobile-document-viewer-overlay.md

## Overview

Implement mobile-responsive document viewer overlay pattern for the SharePage. On mobile viewports (<768px), replace the side-by-side Resplit layout with a single-panel chat view and a slide-in document overlay.

---

## Phase 1: Foundation

### Task 1.1: Create useIsMobile Hook

**Description:** Create a reusable hook for detecting mobile viewport using matchMedia API
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (foundation task)

**Technical Requirements:**
- Use `window.matchMedia` for reactive breakpoint detection
- Default breakpoint: 768px (Tailwind `md`)
- SSR-safe with typeof window check
- Clean up event listener on unmount

**Implementation:**

Create file `frontend/src/hooks/useIsMobile.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)

    // Set initial value
    setIsMobile(mql.matches)

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
```

**Acceptance Criteria:**
- [ ] Hook returns `true` when viewport < 768px
- [ ] Hook returns `false` when viewport >= 768px
- [ ] Hook updates on viewport resize
- [ ] Hook updates on orientation change
- [ ] No memory leaks (event listener cleaned up)

---

### Task 1.2: Create MobileDocumentOverlay Component

**Description:** Create the slide-in overlay component with Framer Motion animations
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** None

**Technical Requirements:**
- Use Framer Motion for slide-in animation (already installed in project)
- Spring physics: `damping: 28, stiffness: 300`
- Backdrop with fade animation (0.2s)
- Escape key closes overlay
- Body scroll lock when open
- Accessible: `role="dialog"`, `aria-modal="true"`, `aria-label`

**Implementation:**

Create file `frontend/src/components/MobileDocumentOverlay.tsx`:

```typescript
import { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import { DocumentCapsule } from './DocumentCapsule'
import { DocumentContentViewer } from './DocumentContentViewer'

interface MobileDocumentOverlayProps {
  isOpen: boolean
  onClose: () => void
  mode: 'capsule' | 'document'
  // Document capsule props
  documents: Array<{
    id: string
    filename: string
    title: string
    summary?: string
    outline?: Array<{ id: string; title: string; level: number; position: number }>
  }>
  projectName: string
  onDocumentClick: (documentId: string) => void
  onSectionClick: (documentId: string, sectionId: string) => void
  // Document viewer props
  selectedDocumentId: string | null
  selectedDocumentTitle?: string
  shareSlug: string
  highlightSectionId: string | null
  highlightKey: number
  isCollaborator: boolean
  onAddComment?: (selection: { chunkId: string; startOffset: number; endOffset: number; text: string }) => void
  onBackToCapsule: () => void
}

export function MobileDocumentOverlay({
  isOpen,
  onClose,
  mode,
  documents,
  projectName,
  onDocumentClick,
  onSectionClick,
  selectedDocumentId,
  selectedDocumentTitle,
  shareSlug,
  highlightSectionId,
  highlightKey,
  isCollaborator,
  onAddComment,
  onBackToCapsule,
}: MobileDocumentOverlayProps) {
  // Escape key handler
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Lock body scroll
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  // Handle back button in document mode
  const handleBack = () => {
    if (mode === 'document') {
      onBackToCapsule()
    } else {
      onClose()
    }
  }

  const headerTitle = mode === 'document' && selectedDocumentTitle
    ? selectedDocumentTitle
    : 'Documents'

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-in panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={headerTitle}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-border bg-background-elevated shrink-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {mode === 'document' ? 'Back' : 'Back to Chat'}
                </span>
              </button>

              {mode === 'document' && selectedDocumentTitle && (
                <span className="text-sm text-muted truncate max-w-[40%] text-center">
                  {selectedDocumentTitle}
                </span>
              )}

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-card-bg transition-colors"
                aria-label="Close document viewer"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {mode === 'capsule' ? (
                <DocumentCapsule
                  documents={documents}
                  projectName={projectName}
                  onDocumentClick={onDocumentClick}
                  onSectionClick={onSectionClick}
                />
              ) : selectedDocumentId ? (
                <DocumentContentViewer
                  documentId={selectedDocumentId}
                  shareSlug={shareSlug}
                  highlightSectionId={highlightSectionId}
                  highlightKey={highlightKey}
                  isCollaborator={isCollaborator}
                  onAddComment={isCollaborator ? onAddComment : undefined}
                />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

**Acceptance Criteria:**
- [ ] Overlay slides in from right with spring animation
- [ ] Backdrop fades in/out
- [ ] Escape key closes overlay
- [ ] X button closes overlay
- [ ] "Back to Chat" shows in capsule mode
- [ ] "Back" shows in document mode (returns to capsule)
- [ ] Document title shows in header when viewing document
- [ ] Body scroll is locked when overlay open
- [ ] ARIA attributes present for accessibility

---

## Phase 2: SharePage Integration

### Task 2.1: Add Mobile State and Handlers to SharePageContent

**Description:** Add mobile detection, overlay state, and mobile-specific handlers to SharePageContent
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2
**Can run parallel with:** None

**Technical Requirements:**
- Import useIsMobile hook
- Add mobileOverlayOpen state
- Create mobile-specific handlers that work with existing state
- Handle auto-close when resizing from mobile to desktop
- Preserve existing desktop functionality unchanged

**Implementation:**

Modify `frontend/src/pages/SharePage.tsx`:

**Step 1: Add imports at top of file:**
```typescript
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileDocumentOverlay } from '../components/MobileDocumentOverlay'
import { FileText } from 'lucide-react'
```

**Step 2: Add to SharePageContentProps interface (note: `setPanelMode` needs to be added):**
```typescript
interface SharePageContentProps {
  // ... existing props ...
  setPanelMode: React.Dispatch<React.SetStateAction<'capsule' | 'document'>>
}
```

**Step 3: Update parent SharePage to pass setPanelMode:**
In the `SharePage` component where `SharePageContent` is rendered, add `setPanelMode={setPanelMode}` to props.

**Step 4: Add mobile state and handlers inside SharePageContent function:**
```typescript
function SharePageContent({
  // ... existing destructured props ...
  setPanelMode, // ADD THIS
}: SharePageContentProps) {
  const { preferences } = useViewerPreferencesContext()
  const [showOnboarding, setShowOnboarding] = useState(!preferences.onboardingComplete)

  // ADD: Mobile detection and state
  const isMobile = useIsMobile()
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false)

  // ADD: Track selected document title for overlay header
  const selectedDocumentTitle = selectedDocumentId
    ? documents.find(d => d.id === selectedDocumentId)?.filename
    : undefined

  // ADD: Auto-close overlay when resizing from mobile to desktop
  useEffect(() => {
    if (!isMobile && mobileOverlayOpen) {
      setMobileOverlayOpen(false)
    }
  }, [isMobile, mobileOverlayOpen])

  // ADD: Handle opening overlay when document/citation is selected on mobile
  useEffect(() => {
    if (isMobile && panelMode === 'document' && selectedDocumentId) {
      setMobileOverlayOpen(true)
    }
  }, [isMobile, panelMode, selectedDocumentId])

  // ADD: Mobile document icon click handler
  const handleMobileDocumentIconClick = () => {
    setPanelMode('capsule')
    setMobileOverlayOpen(true)
  }

  // ADD: Mobile overlay close handler
  const handleMobileOverlayClose = () => {
    setMobileOverlayOpen(false)
  }

  // ADD: Mobile back to capsule handler
  const handleMobileBackToCapsule = () => {
    handleBackToCapsule()
  }

  // ADD: Wrap document click handlers to open overlay on mobile
  const handleDocumentClickMobile = (documentId: string) => {
    handleDocumentClick(documentId)
    if (isMobile) setMobileOverlayOpen(true)
  }

  const handleSectionClickMobile = (documentId: string, sectionId: string) => {
    handleSectionClick(documentId, sectionId)
    if (isMobile) setMobileOverlayOpen(true)
  }

  // ... rest of component (onboarding check, etc.) ...
}
```

**Acceptance Criteria:**
- [ ] useIsMobile hook imported and called
- [ ] mobileOverlayOpen state added
- [ ] setPanelMode passed from parent
- [ ] Auto-close effect works on resize
- [ ] Citation click triggers overlay open on mobile
- [ ] All handlers created and functional

---

### Task 2.2: Implement Mobile Layout in SharePageContent

**Description:** Add conditional rendering for mobile layout with full-width chat and overlay
**Size:** Medium
**Priority:** High
**Dependencies:** Task 2.1
**Can run parallel with:** None

**Technical Requirements:**
- Conditional render based on isMobile
- Mobile header with project name, document icon, and end button
- Full-width ChatInterface
- MobileDocumentOverlay component
- EndSessionModal (same as desktop)
- Desktop layout remains UNCHANGED

**Implementation:**

Add mobile layout branch in SharePageContent, after onboarding check but before desktop return:

```typescript
  // Show onboarding if not complete
  if (showOnboarding && !preferences.onboardingComplete) {
    return (
      <ViewerPreferencesOnboarding
        onComplete={() => setShowOnboarding(false)}
      />
    )
  }

  // MOBILE LAYOUT
  if (isMobile) {
    return (
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="border-b border-border p-4 bg-background-elevated shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-lg text-foreground truncate">
                <AccentText>{project.name}</AccentText>
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {/* Document capsule trigger */}
              <button
                onClick={handleMobileDocumentIconClick}
                className="p-2 rounded-lg bg-card-bg border border-border hover:border-accent/50 transition-colors"
                aria-label="View documents"
              >
                <FileText className="w-5 h-5 text-accent" />
              </button>
              {/* End conversation button */}
              {conversationId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowEndModal(true)}
                  data-testid="end-conversation-button"
                >
                  End
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Full-width Chat */}
        <div className="flex-1 overflow-hidden min-h-0">
          <ChatInterface
            conversationId={conversationId}
            onCitationClick={handleCitationClick}
            onMessagesChange={setMessages}
          />
        </div>

        {/* Mobile Document Overlay */}
        <MobileDocumentOverlay
          isOpen={mobileOverlayOpen}
          onClose={handleMobileOverlayClose}
          mode={panelMode}
          documents={documents}
          projectName={project.name}
          onDocumentClick={handleDocumentClickMobile}
          onSectionClick={handleSectionClickMobile}
          selectedDocumentId={selectedDocumentId}
          selectedDocumentTitle={selectedDocumentTitle}
          shareSlug={slug}
          highlightSectionId={highlightSectionId}
          highlightKey={highlightKey}
          isCollaborator={isCollaborator}
          onAddComment={handleAddComment}
          onBackToCapsule={handleMobileBackToCapsule}
        />

        {/* End Session Modal */}
        {showEndModal && conversationId && conversationStartedAt && (
          <EndSessionModal
            conversationId={conversationId}
            messageCount={messages.length}
            startedAt={conversationStartedAt}
            projectName={project.name}
            onClose={() => setShowEndModal(false)}
            onEnded={() => setShowEndModal(false)}
          />
        )}
      </div>
    )
  }

  // DESKTOP LAYOUT (existing code - no changes needed)
  return (
    <div className="h-screen bg-background overflow-hidden">
      <Resplit.Root direction="horizontal" className="h-full">
        {/* ... existing desktop layout unchanged ... */}
      </Resplit.Root>
      {/* ... existing modals and drawers ... */}
    </div>
  )
```

**Acceptance Criteria:**
- [ ] Mobile layout renders when viewport < 768px
- [ ] Desktop layout renders when viewport >= 768px
- [ ] Mobile header shows project name (truncated if long)
- [ ] Document icon visible in top-right of mobile header
- [ ] End button visible in mobile header
- [ ] Chat fills full width on mobile
- [ ] Overlay component renders with all props
- [ ] Desktop layout UNCHANGED

---

## Phase 3: Testing & Verification

### Task 3.1: Manual Testing Verification

**Description:** Verify all mobile functionality works correctly
**Size:** Small
**Priority:** High
**Dependencies:** Task 2.2
**Can run parallel with:** None

**Testing Checklist:**

**Mobile (<768px):**
- [ ] Chat fills full width on initial load
- [ ] Document icon visible in header (top-right)
- [ ] Tapping document icon opens overlay with capsule
- [ ] Overlay slides in from right smoothly
- [ ] Backdrop visible behind overlay
- [ ] "Back to Chat" button visible in capsule mode
- [ ] Tapping document in capsule shows document viewer
- [ ] "Back" button in document mode returns to capsule
- [ ] X button closes overlay from any mode
- [ ] Escape key closes overlay
- [ ] Citation clicks open document directly in overlay
- [ ] Section highlighting works in overlay
- [ ] Background scroll is locked when overlay open
- [ ] Chat scroll position preserved after closing overlay

**Desktop (>=768px):**
- [ ] Resplit layout renders (unchanged from before)
- [ ] No document icon in header
- [ ] No MobileDocumentOverlay rendered
- [ ] All existing functionality works

**Responsive:**
- [ ] Resize from desktop to mobile shows mobile layout
- [ ] Resize from mobile to desktop shows desktop layout
- [ ] Orientation change works correctly

**Acceptance Criteria:**
- [ ] All mobile tests pass
- [ ] All desktop tests pass (no regressions)
- [ ] All responsive tests pass

---

## Summary

| Phase | Tasks | Dependencies |
|-------|-------|--------------|
| Phase 1: Foundation | 1.1 useIsMobile hook | None |
| | 1.2 MobileDocumentOverlay | 1.1 |
| Phase 2: Integration | 2.1 Mobile state/handlers | 1.1, 1.2 |
| | 2.2 Mobile layout | 2.1 |
| Phase 3: Testing | 3.1 Manual verification | 2.2 |

**Total Tasks:** 5
**Parallel Opportunities:** None (linear dependency chain)
**Estimated Implementation Order:** 1.1 → 1.2 → 2.1 → 2.2 → 3.1
