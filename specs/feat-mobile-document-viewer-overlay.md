# Specification: Mobile Document Viewer Overlay

**Status:** Ready for Implementation
**Created:** 2025-12-22
**Ideation:** `docs/ideation/mobile-document-viewer-overlay.md`

---

## Overview

Replace the side-by-side Resplit layout with a mobile-optimized single-panel UX for viewports under 768px. Chat owns the viewport by default; documents open as a full-screen slide-in overlay from the right.

---

## User Stories

1. **As a mobile viewer**, I want to see the chat in full width so I have maximum space for conversation.
2. **As a mobile viewer**, I want to tap a document icon to browse available documents without leaving the chat context.
3. **As a mobile viewer**, I want citation links to open the referenced document section in an overlay so I can read the source.
4. **As a mobile viewer**, I want a clear "Back to Chat" button so I can easily return to my conversation.

---

## Technical Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Mobile breakpoint | `<768px` (Tailwind `md`) |
| Trigger placement | Top-right header icon |
| Overlay behavior | Animate on top of chat (preserve state) |
| Document icon tap | Shows Document Capsule first |
| Citation tap | Opens document+section directly |
| Overlay header | "Back to Chat" left + document title + X right |
| Scroll lock | Yes, lock background scroll |
| Animation library | Framer Motion (spring physics) |

---

## Component Architecture

```
SharePage.tsx
├── useIsMobile() hook
├── (mobile <768px)
│   ├── MobileHeader
│   │   ├── Project title
│   │   ├── Document icon trigger (FileText)
│   │   └── End conversation button
│   ├── ChatInterface (full width)
│   └── MobileDocumentOverlay (portal)
│       ├── Backdrop (semi-transparent)
│       └── Panel (slides from right)
│           ├── OverlayHeader
│           │   ├── Back to Chat button
│           │   ├── Document title (when viewing doc)
│           │   └── X close button
│           └── Content
│               ├── DocumentCapsule (mode: capsule)
│               └── DocumentContentViewer (mode: document)
└── (desktop ≥768px)
    └── Resplit layout (existing, unchanged)
```

---

## File Changes

### New Files

#### `frontend/src/hooks/useIsMobile.ts`

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

#### `frontend/src/components/MobileDocumentOverlay.tsx`

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

### Modified Files

#### `frontend/src/pages/SharePage.tsx`

**Changes:**
1. Import `useIsMobile` hook
2. Import `MobileDocumentOverlay` component
3. Add `mobileOverlayOpen` state
4. Modify `SharePageContent` to conditionally render mobile or desktop layout
5. Add document icon trigger in mobile header

**Key modifications to `SharePageContent`:**

```typescript
// Add import
import { useIsMobile } from '../hooks/useIsMobile'
import { MobileDocumentOverlay } from '../components/MobileDocumentOverlay'
import { FileText } from 'lucide-react'

// Inside SharePageContent component:
function SharePageContent({ ...props }) {
  const { preferences } = useViewerPreferencesContext()
  const [showOnboarding, setShowOnboarding] = useState(!preferences.onboardingComplete)
  const isMobile = useIsMobile()
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false)

  // Track selected document title for overlay header
  const selectedDocumentTitle = selectedDocumentId
    ? documents.find(d => d.id === selectedDocumentId)?.filename
    : undefined

  // Handle opening overlay when document/citation is selected on mobile
  useEffect(() => {
    if (isMobile && panelMode === 'document' && selectedDocumentId) {
      setMobileOverlayOpen(true)
    }
  }, [isMobile, panelMode, selectedDocumentId])

  // Mobile document icon click
  const handleMobileDocumentIconClick = () => {
    setPanelMode('capsule')
    setMobileOverlayOpen(true)
  }

  // Mobile overlay close
  const handleMobileOverlayClose = () => {
    setMobileOverlayOpen(false)
    // Don't reset document state - user may reopen
  }

  // Mobile back to capsule (from document view within overlay)
  const handleMobileBackToCapsule = () => {
    handleBackToCapsule() // Uses existing handler
    // Stay in overlay, just switch to capsule mode
  }

  // Wrap document click handlers to open overlay on mobile
  const handleDocumentClickMobile = (documentId: string) => {
    handleDocumentClick(documentId)
    if (isMobile) setMobileOverlayOpen(true)
  }

  const handleSectionClickMobile = (documentId: string, sectionId: string) => {
    handleSectionClick(documentId, sectionId)
    if (isMobile) setMobileOverlayOpen(true)
  }

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

  // DESKTOP LAYOUT (existing code unchanged)
  return (
    <div className="h-screen bg-background overflow-hidden">
      <Resplit.Root direction="horizontal" className="h-full">
        {/* ... existing desktop layout ... */}
      </Resplit.Root>
      {/* ... existing modals and drawers ... */}
    </div>
  )
}
```

---

## Dependencies

**Required package (if not already installed):**
```bash
npm install framer-motion
```

Check if already in `package.json` before installing.

---

## Behavior Specifications

### Mobile Detection
- Uses `window.matchMedia('(max-width: 767px)')` for reactive breakpoint detection
- SSR-safe with initial state check
- Re-renders on viewport resize/orientation change

### Overlay Animation
- **Entry:** Slide from `translateX(100%)` to `translateX(0)` with spring physics
- **Exit:** Reverse animation
- **Backdrop:** Fade in/out with 0.2s duration
- **Timing:** Spring with `damping: 28`, `stiffness: 300` (snappy but not jarring)

### State Management
- `mobileOverlayOpen`: Controls overlay visibility
- `panelMode`: 'capsule' | 'document' (reused from existing state)
- Chat state preserved while overlay is open (no unmounting)
- Scroll positions preserved in both chat and document viewer

### Navigation Flow
1. **Tap document icon** → Opens overlay with Document Capsule
2. **Tap document in capsule** → Overlay switches to DocumentContentViewer
3. **Tap "Back" in document view** → Returns to capsule (stays in overlay)
4. **Tap "Back to Chat" in capsule view** → Closes overlay
5. **Tap X button** → Closes overlay (from any state)
6. **Press Escape** → Closes overlay
7. **Tap citation in chat** → Opens overlay directly to document+section

### Accessibility
- `role="dialog"` and `aria-modal="true"` on overlay panel
- `aria-label` with document title
- Focus trap within overlay (browser handles with modal)
- Escape key closes overlay
- Close button has `aria-label`
- Backdrop is `aria-hidden="true"`
- Touch targets ≥44x44px

### Scroll Lock
- `document.body.style.overflow = 'hidden'` when overlay opens
- Restored to `''` when overlay closes
- Prevents background scroll on iOS and Android

---

## Edge Cases

1. **Resize from mobile to desktop while overlay open**: Overlay remains functional, Resplit won't render until overlay closed and resize detected
2. **Citation click when overlay already open**: Update document/section, keep overlay open
3. **Back button from capsule with no previous document**: Close overlay entirely
4. **Orientation change**: Media query listener handles, layout adapts
5. **Rapid open/close**: AnimatePresence handles transition interruption

---

## Testing Checklist

### Mobile (<768px)
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

### Desktop (≥768px)
- [ ] Resplit layout renders (unchanged from before)
- [ ] No document icon in header
- [ ] No MobileDocumentOverlay rendered
- [ ] All existing functionality works

### Accessibility
- [ ] Keyboard navigation within overlay works
- [ ] Screen reader announces dialog
- [ ] Focus moves to overlay when opened
- [ ] Focus returns to trigger when closed

### Responsive
- [ ] Resize from desktop to mobile shows mobile layout
- [ ] Resize from mobile to desktop shows desktop layout
- [ ] Orientation change works correctly

---

## Rollback Plan

If issues arise:
1. Remove `isMobile` conditional in `SharePageContent`
2. Remove `MobileDocumentOverlay` import and component
3. Desktop Resplit layout remains unchanged as fallback

---

## Future Enhancements (Out of Scope)

- Swipe right gesture to dismiss overlay
- Browser back button integration (history.pushState)
- Tablet-specific layout (768px-1024px with narrower panels)
- Gesture-based document navigation within overlay
