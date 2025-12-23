# Mobile Document Viewer Overlay Pattern

**Slug:** mobile-document-viewer-overlay
**Author:** Claude Code
**Date:** 2025-12-22
**Branch:** feat/mobile-document-viewer-overlay
**Related:** SharePage.tsx, DocumentContentViewer.tsx, ChatInterface.tsx

---

## 1) Intent & Assumptions

**Task brief:** Implement a mobile-responsive pattern where the side-by-side UX (chat + document panel) is replaced with a single-panel view on mobile. Chat "owns" the viewport by default. A small icon representing the document capsule triggers the document viewer panel to slide in from the right as a full-viewport overlay. Users can close/hide the overlay via an X button or other obvious affordance to return to chat. Citation clicks in chat should also trigger the same overlay pattern.

**Assumptions:**
- Mobile breakpoint is `<768px` (Tailwind `md` breakpoint)
- Desktop continues to use the current `Resplit` side-by-side layout
- The document viewer overlay should preserve existing functionality (section highlighting, citation navigation, scroll position)
- Both the "document capsule" icon trigger and citation clicks should open the overlay
- Animation should slide in from the right
- Return to chat should be obvious and accessible

**Out of scope:**
- Swipe gestures for dismissal (enhancement for future)
- Browser back button integration with overlay state
- Tablet-specific intermediate layouts (using md breakpoint only)
- Changes to desktop layout or Resplit behavior
- Changes to DocumentContentViewer internals (only wrapping/container changes)

---

## 2) Pre-reading Log

- `frontend/src/pages/SharePage.tsx`: Main share page with Resplit layout, manages `panelMode` (capsule vs document), document selection, citation click handling. Uses `react-resplit` for desktop split view. 718 lines.
- `frontend/src/components/DocumentContentViewer.tsx`: Document viewer with section highlighting, markdown rendering, collaborator comments. Uses `scrollContainerRef` for scroll management. 584 lines.
- `frontend/src/components/ChatInterface.tsx`: Chat component with streaming messages, citation click handler passed via props. 504 lines.
- `frontend/src/components/DocumentCapsule.tsx`: Expandable document list with section navigation. 198 lines.
- `frontend/tailwind.config.js`: Uses default Tailwind breakpoints (sm: 640px, md: 768px, lg: 1024px). Custom color system.
- `CLAUDE.md`: Design system notes - Framer Motion for animations, specific color palette, no emojis.

---

## 3) Codebase Map

**Primary components/modules:**
- `SharePage.tsx` (line 64-717): Main layout orchestrator, needs mobile detection and conditional rendering
- `SharePageContent` (line 522-717): Inner component with Resplit layout, needs mobile overlay variant
- `DocumentContentViewer.tsx`: Document display, wraps into overlay on mobile
- `DocumentCapsule.tsx`: Document list, shown inline on mobile with trigger icon

**Shared dependencies:**
- `react-resplit`: Only used on desktop
- `ViewerPreferencesProvider`: Wraps both layouts
- `lookupDocumentByFilename()`: Citation resolution (same for both)
- Tailwind utilities + custom CSS variables
- Lucide icons (`ArrowLeft`, `X`, `FileText`)

**Data flow:**
1. User taps document icon/citation → `handleCitationClick` or `handleDocumentClick`
2. Sets `selectedDocumentId` and `panelMode: 'document'`
3. On mobile: Overlay opens with `DocumentContentViewer`
4. On desktop: Right panel shows `DocumentContentViewer`
5. Close/back action → `handleBackToCapsule` resets state

**Feature flags/config:**
- No feature flags currently
- Mobile detection will be new utility

**Potential blast radius:**
- `SharePage.tsx` (main changes)
- May need new `MobileDocumentOverlay.tsx` component
- CSS for overlay animations
- Minor touch to `ChatInterface` if header icon needed

---

## 4) Root Cause Analysis

*N/A - This is a new feature, not a bug fix.*

---

## 5) Research

### Research Findings

**Potential Solution 1: Headless UI Dialog + Transition**

**Description:** Use `@headlessui/react` Dialog component with TransitionChild for slide-in animation.

**Pros:**
- Built-in accessibility (focus trap, ARIA, escape key)
- Clean transition API with data attributes
- Well-documented, battle-tested
- Already aligned with Tailwind ecosystem

**Cons:**
- Adds dependency (~8kb gzipped)
- Dialog semantics may be overkill for panel

**Complexity:** Medium

---

**Potential Solution 2: Custom Overlay with Tailwind Transforms**

**Description:** Build custom overlay using Tailwind `translate-x-full` → `translate-x-0` with conditional rendering.

**Pros:**
- No additional dependencies
- Full control over behavior
- Lightweight

**Cons:**
- Must implement focus trap manually
- Must handle escape key manually
- More code to maintain
- Accessibility implementation burden

**Complexity:** Medium-High

---

**Potential Solution 3: Framer Motion AnimatePresence**

**Description:** Use Framer Motion for exit/enter animations with gesture support.

**Pros:**
- Already mentioned in CLAUDE.md design system
- Natural spring physics
- Potential for swipe-to-dismiss gestures later
- Smooth exit animations

**Cons:**
- Larger bundle (~30kb)
- Still need focus management
- Steeper learning curve

**Complexity:** Medium

---

### Recommendation

**Recommended: Hybrid approach - Framer Motion + Custom Focus Management**

Rationale:
1. CLAUDE.md already mentions Framer Motion for animations ("Framer Motion fade-up")
2. Provides natural spring animations and AnimatePresence for clean exit
3. Can add swipe gestures later without refactoring
4. Custom useEffect for escape key and body scroll lock is simple
5. Focus management can use `focus-trap-react` (~3kb) or simple custom hook

**Architecture:**
```
SharePage.tsx
├── (desktop ≥768px) Resplit layout (existing)
└── (mobile <768px)
    ├── ChatPanel (full width)
    ├── FloatingDocButton (fixed position, triggers overlay)
    └── MobileDocumentOverlay (Framer Motion slide-in)
        ├── Header with "Back to Chat" + X button
        └── DocumentContentViewer or DocumentCapsule
```

---

## 6) Clarification

1. **Trigger icon placement:** Should the document capsule trigger icon be in the chat header area (top-right) or a floating action button (bottom-right)?
   - *Recommendation:* Top-right header icon to match existing header pattern and avoid covering chat input.

2. **Overlay vs Page transition:** Should the overlay animate on top of chat (preserving chat state) or should it be a navigation that unmounts chat?
   - *Recommendation:* Overlay on top (preserve chat state, faster perceived performance).

3. **Document Capsule in mobile:** When user taps the document icon, should it show:
   - A) Document Capsule list (user picks document) → then full document, OR
   - B) Directly open last-viewed document OR
   - C) Show capsule with "View Full Document" CTA per document?
   - *Recommendation:* Show Document Capsule first (option A), consistent with desktop capsule pattern.

4. **Citation click behavior:** When tapping a citation:
   - A) Open overlay directly to that document+section, OR
   - B) Open capsule with that document expanded?
   - *Recommendation:* Open directly to document+section (option A), as citations are specific references.

5. **Header on mobile overlay:** Should the overlay header show:
   - A) Just "Back to Chat" / X, OR
   - B) "Back to Chat" + document title, OR
   - C) Same header as desktop document view?
   - *Recommendation:* "Back to Chat" on left + document title + X on right (option B).

6. **Scroll lock:** Should background (chat) scroll be locked when overlay is open?
   - *Recommendation:* Yes, prevent background scroll for cleaner mobile UX.

---

## 7) Implementation Approach

### File Changes

**New Files:**
- `frontend/src/components/MobileDocumentOverlay.tsx` - Slide-in overlay component
- `frontend/src/hooks/useIsMobile.ts` - Media query hook for breakpoint detection

**Modified Files:**
- `frontend/src/pages/SharePage.tsx` - Conditional rendering for mobile vs desktop
- `frontend/src/index.css` - Keyframes for slide animation (if not using Framer Motion)

### Component Structure

```tsx
// useIsMobile.ts
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mql.matches)

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
```

```tsx
// MobileDocumentOverlay.tsx
interface MobileDocumentOverlayProps {
  isOpen: boolean
  onClose: () => void
  mode: 'capsule' | 'document'
  documentId?: string
  // ... other props from SharePage
}

export function MobileDocumentOverlay({
  isOpen,
  onClose,
  mode,
  documentId,
  ...props
}: MobileDocumentOverlayProps) {
  // Escape key handler
  // Body scroll lock
  // Focus management

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Slide-in panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 bg-background flex flex-col"
          >
            {/* Header */}
            <header className="flex items-center justify-between p-4 border-b border-border">
              <button onClick={onClose} className="flex items-center gap-2 text-accent">
                <ArrowLeft className="w-5 h-5" />
                Back to Chat
              </button>
              <button onClick={onClose} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {mode === 'capsule' ? (
                <DocumentCapsule {...capsuleProps} />
              ) : (
                <DocumentContentViewer {...viewerProps} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

```tsx
// SharePage.tsx changes
function SharePageContent({ ... }) {
  const isMobile = useIsMobile()
  const [mobileOverlayOpen, setMobileOverlayOpen] = useState(false)

  // Open overlay when document/citation is clicked on mobile
  useEffect(() => {
    if (isMobile && (panelMode === 'document' || selectedDocumentId)) {
      setMobileOverlayOpen(true)
    }
  }, [isMobile, panelMode, selectedDocumentId])

  const handleMobileClose = () => {
    setMobileOverlayOpen(false)
    handleBackToCapsule()
  }

  if (isMobile) {
    return (
      <div className="h-screen bg-background flex flex-col">
        {/* Header with document trigger icon */}
        <header className="border-b border-border p-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl text-foreground">
              <AccentText>{project.name}</AccentText>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPanelMode('capsule')
                setMobileOverlayOpen(true)
              }}
              className="p-2 rounded-lg bg-card-bg border border-border"
              aria-label="View documents"
            >
              <FileText className="w-5 h-5 text-accent" />
            </button>
            {/* End conversation button */}
          </div>
        </header>

        {/* Full-width chat */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            conversationId={conversationId}
            onCitationClick={handleCitationClick}
            onMessagesChange={setMessages}
          />
        </div>

        {/* Mobile overlay */}
        <MobileDocumentOverlay
          isOpen={mobileOverlayOpen}
          onClose={handleMobileClose}
          mode={panelMode}
          documentId={selectedDocumentId}
          {...otherProps}
        />
      </div>
    )
  }

  // Desktop: existing Resplit layout
  return (
    <div className="h-screen bg-background overflow-hidden">
      <Resplit.Root direction="horizontal" className="h-full">
        {/* ... existing desktop code ... */}
      </Resplit.Root>
    </div>
  )
}
```

### Animation Details

**Slide-in from right:**
```css
/* Initial state (off-screen) */
transform: translateX(100%);

/* Animate to (on-screen) */
transform: translateX(0);

/* Timing */
transition: transform 300ms ease-out;
```

**With Framer Motion:**
```tsx
initial={{ x: '100%' }}
animate={{ x: 0 }}
exit={{ x: '100%' }}
transition={{ type: 'spring', damping: 25, stiffness: 300 }}
```

### Accessibility Requirements

1. **Focus trap:** Focus should stay within overlay while open
2. **Escape key:** Pressing Escape closes overlay
3. **ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-label`
4. **Screen reader:** Announce "Document viewer opened"
5. **Touch targets:** Close button ≥44x44px

### Testing Checklist

- [ ] Mobile viewport shows chat full-width by default
- [ ] Document icon visible in header
- [ ] Tapping document icon opens capsule overlay
- [ ] Overlay slides in from right smoothly
- [ ] "Back to Chat" closes overlay
- [ ] X button closes overlay
- [ ] Escape key closes overlay
- [ ] Citation clicks open document directly in overlay
- [ ] Section highlighting works in overlay
- [ ] Scroll position preserved when reopening
- [ ] Background scroll locked when overlay open
- [ ] Desktop layout unchanged (Resplit still works)
- [ ] Resize from mobile to desktop works cleanly
