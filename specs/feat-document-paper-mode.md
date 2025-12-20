# Document Paper Mode

## Status
Draft

## Authors
- Claude Code (2025-12-20)

## Overview

Add a "paper mode" visual treatment for document viewing that creates a light-background document container within the dark-themed app. This creates a reading experience similar to Google Docs, Microsoft Word, or PDF readers where documents appear as "paper" floating over a dark background.

**Key insight:** Users are accustomed to viewing documents on light backgrounds. The current dark-on-dark rendering reduces readability and feels like "reconstructed data" rather than a native document reading experience.

## Background/Problem Statement

### Current State
- Document viewer (`DocumentContentViewer.tsx`) renders markdown on a dark background with light text
- All 6 existing viewer themes (default, nord, warm-reading, high-contrast, soft-charcoal, ocean-depth) are dark-mode variants
- Formatting issues with nested lists and indentation stem from fighting complex dark-mode CSS
- The document panel visually blends with the chat panel, lacking clear differentiation

### Problems
1. **Readability**: Dark backgrounds with light text are harder to read for long-form content
2. **Familiarity**: Users expect documents to look like documents (paper-like)
3. **Formatting**: Current CSS architecture makes list/heading styling complex
4. **Visual hierarchy**: No clear separation between chat (AI conversation) and document (reference material)

### User Decision Context
This spec implements decisions made during ideation:
- Paper color: `#F5F3EF` (warm cream)
- Toggle: Separate preference alongside existing themes
- Scope: Both `DocumentContentViewer` and `DocumentCapsule`
- Header treatment: Dark toolbar, light paper content
- Theme interaction: Paper mode is independent of app theme

## Goals

- Render documents with warm cream background (`#F5F3EF`) and dark text
- Create clear visual separation between chat (dark) and document (light) panels
- Improve nested list and heading rendering using Tailwind Typography prose classes
- Add user preference toggle for paper mode (default: enabled)
- Maintain existing dark mode as fallback option
- Ensure citation highlights work on light background
- No regressions in scroll-to-section or text selection features

## Non-Goals

- Mobile slide-up overlay experience (separate spec: `feat-mobile-document-overlay`)
- PDF.js integration for native PDF rendering
- Backend changes or data migration
- Changes to the chat panel theme
- Real-time collaborative editing

## Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@tailwindcss/typography` | ^0.5.19 | Prose classes for automatic nested element styling |
| `react-markdown` | existing | Markdown rendering (no change) |
| `remark-gfm` | existing | GitHub Flavored Markdown (no change) |

**Note:** Typography plugin is already installed but not used in DocumentContentViewer. This spec leverages it for paper mode.

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SharePage.tsx                                │
│  ┌─────────────────────┐     ┌────────────────────────────────────┐ │
│  │   Chat Panel        │     │   Document Panel                   │ │
│  │   (Dark theme)      │     │   (Dark outer background)          │ │
│  │                     │     │                                    │ │
│  │                     │     │   ┌──────────────────────────────┐ │ │
│  │                     │     │   │ Dark Toolbar (header)        │ │ │
│  │                     │     │   └──────────────────────────────┘ │ │
│  │                     │     │   ┌──────────────────────────────┐ │ │
│  │                     │     │   │                              │ │ │
│  │                     │     │   │   PAPER CONTAINER            │ │ │
│  │                     │     │   │   bg: #F5F3EF                │ │ │
│  │                     │     │   │   text: dark                 │ │ │
│  │                     │     │   │   shadow: elevation          │ │ │
│  │                     │     │   │   prose classes              │ │ │
│  │                     │     │   │                              │ │ │
│  │                     │     │   └──────────────────────────────┘ │ │
│  └─────────────────────┘     └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. CSS Variables (globals.css)

Add paper mode CSS variables alongside existing theme system:

```css
/* Paper Mode Variables - Document-specific light theme */
:root {
  /* Paper surface colors */
  --color-paper-bg: 40 23% 95%;           /* #F5F3EF warm cream */
  --color-paper-text: 0 0% 13%;           /* #222222 near-black */
  --color-paper-text-muted: 0 0% 40%;     /* #666666 muted */
  --color-paper-border: 0 0% 85%;         /* #D9D9D9 subtle border */
  --color-paper-shadow: 0 0% 0% / 0.08;   /* Soft shadow */

  /* Paper mode accent - warm gold that works on light bg */
  --color-paper-accent: 41 70% 45%;       /* Darker gold for contrast */
  --color-paper-accent-bg: 41 70% 45% / 0.15;
}

/* Citation highlight for paper mode */
.paper-mode .citation-highlight {
  animation: citation-glow-paper 2.5s ease-out forwards;
}

@keyframes citation-glow-paper {
  0% {
    background-color: hsl(41 70% 45% / 0.3);
    box-shadow: 0 0 0 4px hsl(41 70% 45% / 0.2);
  }
  70% {
    background-color: hsl(41 70% 45% / 0.3);
    box-shadow: 0 0 0 4px hsl(41 70% 45% / 0.2);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}
```

### 2. Viewer Preferences Extension

**File:** `frontend/src/components/viewer-prefs/viewerPrefsConfig.ts`

```typescript
// Add to ViewerPreferences interface
export interface ViewerPreferences {
  depth: DepthLevel
  fontFamily: FontFamily
  fontSize: FontSize
  theme: ThemeName
  paperMode: boolean        // NEW: Toggle for paper mode
  onboardingComplete: boolean
}

// Update DEFAULT_PREFERENCES
export const DEFAULT_PREFERENCES: ViewerPreferences = {
  depth: 'balanced',
  fontFamily: 'dm-sans',
  fontSize: 'medium',
  theme: 'default',
  paperMode: true,          // NEW: Default to paper mode enabled
  onboardingComplete: false,
}
```

**File:** `frontend/src/components/viewer-prefs/useViewerPreferences.ts`

```typescript
// Add updatePaperMode function
const updatePaperMode = useCallback((enabled: boolean) => {
  setPreferences(prev => ({ ...prev, paperMode: enabled }))
}, [])

// Return in hook
return {
  preferences,
  updateDepth,
  updateFont,
  updateFontSize,
  updateTheme,
  updatePaperMode,  // NEW
  markOnboardingComplete,
  resetOnboarding,
  resetAll,
}
```

### 3. Paper Container Component

Create a reusable paper container wrapper:

**File:** `frontend/src/components/ui/PaperContainer.tsx`

```typescript
import { cn } from '../../lib/utils'
import { useViewerPreferencesContext } from '../viewer-prefs'

interface PaperContainerProps {
  children: React.ReactNode
  className?: string
}

export function PaperContainer({ children, className }: PaperContainerProps) {
  const { preferences } = useViewerPreferencesContext()

  if (!preferences.paperMode) {
    // Dark mode fallback - pass through with existing styling
    return <div className={className}>{children}</div>
  }

  return (
    <div
      className={cn(
        // Paper surface
        "bg-[#F5F3EF] text-[#222222]",
        // Elevation/shadow for "floating paper" effect
        "rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)]",
        // Padding for paper margins
        "p-8",
        // Paper mode class for citation highlight targeting
        "paper-mode",
        className
      )}
    >
      {children}
    </div>
  )
}
```

### 4. DocumentContentViewer Updates

**File:** `frontend/src/components/DocumentContentViewer.tsx`

Key changes:
1. Wrap content area in `PaperContainer`
2. Use Tailwind Typography prose classes for paper mode
3. Maintain existing dark mode styling as fallback

```typescript
import { PaperContainer } from './ui/PaperContainer'
import { useViewerPreferencesContext } from './viewer-prefs'

export function DocumentContentViewer({ ... }) {
  const { preferences } = useViewerPreferencesContext()
  const isPaperMode = preferences.paperMode

  // ... existing code ...

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card-bg min-h-0">
      {/* Document Header - STAYS DARK (toolbar) */}
      <div className="p-4 border-b border-border shrink-0 min-h-0">
        {/* ... existing header code ... */}
      </div>

      {/* Document Content - PAPER MODE */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto min-h-0 relative",
          isPaperMode && "p-4 bg-background-elevated"  // Padding around paper
        )}
        style={{ overscrollBehavior: 'contain' }}
        onMouseUp={handleTextSelection}
      >
        {isPaperMode ? (
          <PaperContainer>
            <div
              className="prose prose-lg max-w-none
                prose-headings:font-display prose-headings:text-[#1a1a1a]
                prose-p:text-[#333333] prose-p:leading-relaxed
                prose-li:text-[#333333]
                prose-strong:text-[#1a1a1a] prose-strong:font-semibold
                prose-a:text-[#8B7355] prose-a:underline
                prose-blockquote:border-l-[#C4A77D] prose-blockquote:text-[#555555]
                prose-code:bg-[#E8E4DE] prose-code:text-[#333333] prose-code:rounded prose-code:px-1.5
                prose-pre:bg-[#E8E4DE]
                prose-hr:border-[#D9D9D9]"
            >
              {sectionedContent.map((section, idx) => (
                <section
                  key={section.sectionId || `chunk-${idx}`}
                  id={`section-${section.sectionId}`}
                  ref={(el) => { /* ... */ }}
                  className="mb-10 scroll-mt-20"
                >
                  {section.sectionTitle && (
                    <h2 className="text-xl font-display text-[#1a1a1a] mb-5 pb-2 border-b border-[#D9D9D9]">
                      {section.sectionTitle}
                    </h2>
                  )}
                  {section.chunks.map((chunk) => (
                    <div key={chunk.id} data-chunk-id={chunk.id}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {stripDuplicateHeading(chunk.content, section.sectionTitle)}
                      </ReactMarkdown>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </PaperContainer>
        ) : (
          // Existing dark mode implementation (unchanged)
          <div className="p-6 mx-auto" style={{ maxWidth: 'var(--max-line-document, 72ch)' }}>
            {/* ... existing dark mode content ... */}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 5. DocumentCapsule Updates

**File:** `frontend/src/components/DocumentCapsule.tsx`

Apply paper mode to the document list for visual consistency:

```typescript
import { useViewerPreferencesContext } from './viewer-prefs'

export function DocumentCapsule({ ... }) {
  const { preferences } = useViewerPreferencesContext()
  const isPaperMode = preferences.paperMode

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header stays dark */}
      <div className="mb-6">
        <h2 className="font-display text-xl text-foreground">{projectName}</h2>
        <p className="text-muted text-sm mt-1">Available Documents</p>
      </div>

      {/* Document list - paper mode applied */}
      <div className={cn(
        "space-y-3",
        isPaperMode && "bg-[#F5F3EF] rounded-lg p-4 shadow-md"
      )}>
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            isPaperMode={isPaperMode}
            onDocumentClick={onDocumentClick}
            onSectionClick={onSectionClick}
          />
        ))}
      </div>
    </div>
  )
}

// Update DocumentCard styling for paper mode
function DocumentCard({ doc, isPaperMode, ... }) {
  return (
    <div className={cn(
      "rounded-lg border transition-colors cursor-pointer",
      isPaperMode
        ? "bg-white border-[#E0DCD6] hover:border-[#C4A77D] text-[#333333]"
        : "bg-card-bg border-border hover:border-accent/50 text-foreground"
    )}>
      {/* ... card content ... */}
    </div>
  )
}
```

### 6. Paper Mode Toggle UI

Add to viewer preferences panel:

**File:** `frontend/src/components/viewer-prefs/ViewerPreferencesPanel.tsx`

```typescript
// Add paper mode toggle section
<div className="space-y-2">
  <label className="text-sm font-medium text-muted">Document Appearance</label>
  <div className="flex gap-2">
    <button
      onClick={() => updatePaperMode(true)}
      className={cn(
        "flex-1 px-3 py-2 rounded-lg border text-sm transition-colors",
        preferences.paperMode
          ? "bg-accent text-background border-accent"
          : "bg-card-bg text-foreground border-border hover:border-accent/50"
      )}
    >
      Paper (Light)
    </button>
    <button
      onClick={() => updatePaperMode(false)}
      className={cn(
        "flex-1 px-3 py-2 rounded-lg border text-sm transition-colors",
        !preferences.paperMode
          ? "bg-accent text-background border-accent"
          : "bg-card-bg text-foreground border-border hover:border-accent/50"
      )}
    >
      Integrated (Dark)
    </button>
  </div>
</div>
```

## User Experience

### Document Viewing Flow (Paper Mode Enabled)
1. User accesses share link → chat panel loads with dark theme
2. User clicks citation or document → document panel opens
3. Document content appears on warm cream paper background
4. Dark toolbar at top with filename and download button
5. Content uses proper typography with clear heading/list hierarchy
6. Citations highlight with warm gold glow on light background

### Preference Toggle Flow
1. User clicks preferences icon in viewer
2. "Document Appearance" section shows Paper/Integrated toggle
3. Selecting "Paper" applies light background immediately
4. Selecting "Integrated" reverts to dark mode styling
5. Preference persists across sessions via localStorage

### Visual Hierarchy
- **Chat panel**: Dark background (matches app theme)
- **Document panel container**: Slightly elevated dark background
- **Paper container**: Light cream `#F5F3EF` with shadow elevation
- **Document header**: Dark toolbar (filename, download) above paper

## Testing Strategy

### Unit Tests

**File:** `frontend/src/components/viewer-prefs/__tests__/useViewerPreferences.test.ts`

```typescript
describe('useViewerPreferences - paperMode', () => {
  // Purpose: Verify paperMode preference persists correctly
  it('should default paperMode to true', () => {
    const { result } = renderHook(() => useViewerPreferences())
    expect(result.current.preferences.paperMode).toBe(true)
  })

  // Purpose: Verify toggle updates state
  it('should update paperMode when toggled', () => {
    const { result } = renderHook(() => useViewerPreferences())
    act(() => result.current.updatePaperMode(false))
    expect(result.current.preferences.paperMode).toBe(false)
  })

  // Purpose: Verify localStorage persistence
  it('should persist paperMode to localStorage', () => {
    const { result } = renderHook(() => useViewerPreferences())
    act(() => result.current.updatePaperMode(false))

    const stored = JSON.parse(localStorage.getItem('viewer_preferences') || '{}')
    expect(stored.paperMode).toBe(false)
  })
})
```

### Component Tests

**File:** `frontend/src/components/__tests__/DocumentContentViewer.test.tsx`

```typescript
describe('DocumentContentViewer - Paper Mode', () => {
  // Purpose: Verify paper container renders in paper mode
  it('should render paper container when paperMode is true', () => {
    renderWithPreferences(<DocumentContentViewer {...props} />, { paperMode: true })
    expect(screen.getByTestId('paper-container')).toHaveClass('bg-[#F5F3EF]')
  })

  // Purpose: Verify dark mode renders when paper mode disabled
  it('should render dark mode when paperMode is false', () => {
    renderWithPreferences(<DocumentContentViewer {...props} />, { paperMode: false })
    expect(screen.queryByTestId('paper-container')).not.toBeInTheDocument()
  })

  // Purpose: Verify citation highlights work on light background
  it('should apply paper-mode class for citation highlighting', () => {
    renderWithPreferences(<DocumentContentViewer {...props} />, { paperMode: true })
    const container = screen.getByTestId('paper-container')
    expect(container).toHaveClass('paper-mode')
  })
})
```

### E2E Tests

**File:** `frontend/e2e/document-paper-mode.spec.ts`

```typescript
test.describe('Document Paper Mode', () => {
  // Purpose: Verify end-to-end paper mode experience
  test('should display document in paper mode by default', async ({ page }) => {
    await page.goto('/s/test-share-link')
    await page.click('[data-testid="document-item"]')

    const paperContainer = page.locator('[data-testid="paper-container"]')
    await expect(paperContainer).toBeVisible()
    await expect(paperContainer).toHaveCSS('background-color', 'rgb(245, 243, 239)')
  })

  // Purpose: Verify toggle persists across page reload
  test('should persist paper mode preference', async ({ page }) => {
    await page.goto('/s/test-share-link')

    // Disable paper mode
    await page.click('[data-testid="preferences-button"]')
    await page.click('button:has-text("Integrated")')

    // Reload and verify
    await page.reload()
    await page.click('[data-testid="document-item"]')

    await expect(page.locator('[data-testid="paper-container"]')).not.toBeVisible()
  })

  // Purpose: Verify citation highlight visibility on light background
  test('should highlight citations on paper background', async ({ page }) => {
    await page.goto('/s/test-share-link')
    await page.click('[data-testid="citation-link"]')

    const highlightedSection = page.locator('.citation-highlight')
    await expect(highlightedSection).toBeVisible()
  })
})
```

## Performance Considerations

| Concern | Mitigation |
|---------|------------|
| CSS class switching | Minimal impact - single className conditional |
| Prose classes bundle size | Already included via @tailwindcss/typography |
| Shadow rendering | GPU-accelerated, negligible impact |
| Preference reads | Already cached in React context |

**No significant performance impact expected.** Changes are purely CSS-based with no additional API calls or heavy computation.

## Security Considerations

| Concern | Status |
|---------|--------|
| XSS via user content | No change - ReactMarkdown already sanitizes |
| localStorage tampering | Low risk - cosmetic preference only |
| CSS injection | Not applicable - hardcoded values |

**No security concerns.** This is a visual styling change with no new attack surface.

## Documentation

### CLAUDE.md Update

Add to the "Viewer Preferences" section:

```markdown
## Paper Mode

**What:** Light-background document viewing mode (like Google Docs/Word)

**Toggle:** Viewer preferences → Document Appearance → Paper/Integrated

**Key files:**
- `frontend/src/components/ui/PaperContainer.tsx` - Reusable paper wrapper
- `frontend/src/components/DocumentContentViewer.tsx` - Main viewer with paper mode
- `frontend/src/styles/globals.css` - Paper mode CSS variables

**Paper color:** #F5F3EF (warm cream) for reduced eye strain
```

## Implementation Phases

### Phase 1: Core Paper Mode
1. Add CSS variables to globals.css
2. Create PaperContainer component
3. Update DocumentContentViewer with paper mode conditional
4. Add paperMode to viewer preferences interface
5. Test with existing documents

### Phase 2: Full Integration
1. Update DocumentCapsule with paper mode
2. Add paper mode toggle to preferences panel
3. Update citation highlight keyframes for light background
4. Ensure prose classes render all markdown elements correctly

### Phase 3: Polish
1. Fine-tune paper color and shadows
2. Handle edge cases (code blocks, tables, blockquotes)
3. Add any needed prose class overrides
4. Cross-browser testing

## Open Questions

1. **Font weight adjustment:** Should body text be slightly heavier on paper mode to match print expectations?
   - *Recommendation:* Start with default, adjust if feedback indicates need

2. **Print stylesheet:** Should paper mode also optimize for printing?
   - *Recommendation:* Defer to follow-up spec if needed

## References

- **Ideation document:** `docs/ideation/document-panel-paper-mode-redesign.md`
- **Tailwind Typography docs:** https://tailwindcss.com/docs/typography-plugin
- **Research sources:** Material Design elevation, Google Docs dark mode patterns
- **Related spec:** `feat-mobile-document-overlay` (deferred mobile experience)
