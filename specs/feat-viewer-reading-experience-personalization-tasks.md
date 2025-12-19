# Viewer Reading Experience Personalization - Task Breakdown

**Generated from:** `specs/feat-viewer-reading-experience-personalization.md`
**Date:** 2025-12-19
**Status:** Ready for Implementation

---

## Overview

This document breaks down the Viewer Reading Experience Personalization spec into actionable implementation tasks organized by phase. Each task includes file paths, dependencies, and implementation notes.

---

## Execution Strategy

### Parallelization Analysis

Two independent workstreams identified that can be developed without conflicts:

| Workstream A: Smart Scroll | Workstream B: Preferences System |
|---------------------------|----------------------------------|
| `chat/JumpToBottomIndicator.tsx` (new) | `viewer-prefs/*` (all new files) |
| `chat/index.ts` (new) | `globals.css` (additions only) |
| `ChatInterface.tsx` (modify) | `index.html` (font additions) |

**Key insight:** These workstreams don't share any files during development.

### Execution Order

```
PHASE A: Smart Scroll (Workstream A)
├── Task 1.1: JumpToBottomIndicator component
├── Task 1.2: chat/index.ts barrel export
└── Task 1.3: ChatInterface.tsx smart scroll logic

PHASE B: Preferences System (Workstream B)
├── Task 2.1: viewerPrefsConfig.ts
├── Task 2.2: useViewerPreferences.ts hook
├── Task 2.3: ViewerPreferencesProvider.tsx
├── Task 2.4: globals.css theme variables
├── Task 2.5: index.html Google Fonts
├── Task 3.1: DepthSelector.tsx
├── Task 3.2: FontSelector.tsx
├── Task 3.3: ThemeSelector.tsx
├── Task 3.4: PreviewResponse.tsx
├── Task 3.5: ViewerPreferencesOnboarding.tsx
└── Task 3.6: viewer-prefs/index.ts barrel

PHASE C: Integration (Sequential - touches shared files)
└── Task 3.7: SharePage.tsx integration

PHASE D: Progressive Disclosure (Sequential - modifies ChatInterface)
├── Task 4.1: ChatExpandButton.tsx
├── Task 4.2: ChatMessage.tsx expand button
└── Task 4.3: ChatInterface.tsx expansion handling

PHASE E: Testing & Polish
├── Task 5.1-5.3: Unit/Integration/E2E tests
├── Task 5.4: Accessibility audit
└── Task 5.5: CLAUDE.md documentation
```

### Why This Order?

1. **Smart Scroll first** - Fixes critical UX bug, quick win (3 tasks)
2. **Preferences System second** - All new files, zero merge conflict risk (11 tasks)
3. **Integration third** - Single file combines both workstreams
4. **Progressive Disclosure fourth** - Modifies files already touched by Smart Scroll
5. **Testing last** - Validates complete implementation

---

## Phase 1: Smart Scroll (Critical Bug Fix)

**Priority:** P0 - Fixes critical UX issue
**Estimated Complexity:** Medium

### Task 1.1: Create JumpToBottomIndicator Component

**File:** `frontend/src/components/chat/JumpToBottomIndicator.tsx`
**Dependencies:** `framer-motion`, `lucide-react`
**New File:** Yes

**Implementation:**
```typescript
// JumpToBottomIndicator.tsx

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface JumpToBottomIndicatorProps {
  visible: boolean
  unreadCount?: number
  onClick: () => void
}

export function JumpToBottomIndicator({
  visible,
  unreadCount = 0,
  onClick
}: JumpToBottomIndicatorProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.button
            onClick={onClick}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full',
              'bg-background-elevated border border-border',
              'text-sm font-medium text-foreground',
              'shadow-lg cursor-pointer',
              'hover:bg-background-elevated/80 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
              'min-h-[44px]' // Touch target
            )}
            // Breathing glow animation
            animate={prefersReducedMotion ? {} : {
              boxShadow: [
                '0 0 0 0 hsl(var(--color-accent) / 0)',
                '0 0 20px 4px hsl(var(--color-accent) / 0.3)',
                '0 0 0 0 hsl(var(--color-accent) / 0)'
              ]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            <ChevronDown className="w-4 h-4" />
            <span>
              {unreadCount > 0
                ? `${unreadCount} new`
                : 'Jump to latest'
              }
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Task 1.2: Create Chat Barrel Export

**File:** `frontend/src/components/chat/index.ts`
**New File:** Yes

**Implementation:**
```typescript
// frontend/src/components/chat/index.ts

export { JumpToBottomIndicator } from './JumpToBottomIndicator'
export { ChatExpandButton } from './ChatExpandButton'
```

### Task 1.3: Modify ChatInterface for Smart Scroll

**File:** `frontend/src/components/ChatInterface.tsx`
**Dependencies:** Task 1.1
**New File:** No - Modify existing

**Key Changes:**
1. Add scroll state tracking refs
2. Add Intersection Observer for bottom detection
3. Replace auto-scroll useEffect with smart scroll logic
4. Add JumpToBottomIndicator integration

**Critical Points:**
- Replace the problematic `useEffect` at lines 27-30
- Use `container.scrollTo()` instead of `scrollIntoView()`
- Track `userJustSentMessage` to allow auto-scroll on user action
- Use Intersection Observer with `rootMargin: '100px'` for early detection

**State Additions:**
```typescript
const [isAtBottom, setIsAtBottom] = useState(true)
const [showJumpIndicator, setShowJumpIndicator] = useState(false)
const [unreadCount, setUnreadCount] = useState(0)
const scrollContainerRef = useRef<HTMLDivElement>(null)
const scrollSentinelRef = useRef<HTMLDivElement>(null)
const userJustSentMessage = useRef(false)
```

**Verification:**
- [ ] User can scroll up during streaming without viewport snapping back
- [ ] Jump indicator appears when user scrolls away during streaming
- [ ] Jump indicator has breathing glow animation
- [ ] Clicking jump indicator scrolls to bottom smoothly
- [ ] Sending a message auto-scrolls to bottom

---

## Phase 2: Preferences Infrastructure

**Priority:** P1 - Foundation for personalization
**Estimated Complexity:** Medium

### Task 2.1: Create viewerPrefsConfig.ts

**File:** `frontend/src/components/viewer-prefs/viewerPrefsConfig.ts`
**New File:** Yes

**Implementation:**
```typescript
// viewerPrefsConfig.ts

export type DepthLevel = 'concise' | 'balanced' | 'detailed'
export type FontFamily = 'dm-sans' | 'inter' | 'atkinson' | 'merriweather' | 'lora' | 'source-serif'
export type ThemeName = 'default' | 'nord' | 'warm-reading' | 'high-contrast' | 'soft-charcoal'

export interface ViewerPreferences {
  depth: DepthLevel
  fontFamily: FontFamily
  theme: ThemeName
  onboardingComplete: boolean
}

export const DEFAULT_PREFERENCES: ViewerPreferences = {
  depth: 'balanced',
  fontFamily: 'dm-sans',
  theme: 'default',
  onboardingComplete: false
}

export const DEPTH_OPTIONS: Array<{
  value: DepthLevel
  label: string
  description: string
}> = [
  { value: 'concise', label: 'Quick Summary', description: 'Key points only' },
  { value: 'balanced', label: 'Balanced', description: 'Context with key details' },
  { value: 'detailed', label: 'Full Context', description: 'Comprehensive with examples' }
]

export const FONT_OPTIONS: Array<{
  value: FontFamily
  label: string
  category: 'sans-serif' | 'serif'
  fontStack: string
}> = [
  { value: 'dm-sans', label: 'DM Sans', category: 'sans-serif', fontStack: '"DM Sans", sans-serif' },
  { value: 'inter', label: 'Inter', category: 'sans-serif', fontStack: '"Inter", sans-serif' },
  { value: 'atkinson', label: 'Atkinson', category: 'sans-serif', fontStack: '"Atkinson Hyperlegible", sans-serif' },
  { value: 'merriweather', label: 'Merriweather', category: 'serif', fontStack: '"Merriweather", serif' },
  { value: 'lora', label: 'Lora', category: 'serif', fontStack: '"Lora", serif' },
  { value: 'source-serif', label: 'Source Serif', category: 'serif', fontStack: '"Source Serif 4", serif' }
]

// Sample responses for live preview during onboarding
export const SAMPLE_RESPONSES: Record<DepthLevel, string> = {
  concise: "Revenue grows 3x to $15M ARR by 2026. Key drivers: enterprise expansion and product-led growth.",
  balanced: "Revenue is projected to grow 3x by 2026, reaching $15M ARR. Year 1 focuses on SMB ($3.5M), Year 2 on enterprise expansion ($8M), and Year 3 adds product-led growth channels. The projections assume 15% monthly churn reduction.",
  detailed: `Our financial model projects growth across three horizons:

**Year 1 (2024):** $3.5M ARR
- 500 paying customers at $7K ACV
- 85% gross margins from SaaS model

**Year 2 (2025):** $8M ARR
- Average deal size increases to $25K
- Sales team scales from 5 to 15 reps

**Year 3 (2026):** $15M ARR
- Self-serve tier drives 40% of new revenue
- International expansion begins

The projections assume 15% monthly churn reduction through improved onboarding.`
}

export const SAMPLE_USER_QUESTION = "What are the key financial projections?"

export const THEME_OPTIONS: Array<{
  value: ThemeName
  label: string
  colors: {
    bg: string
    bgElevated: string
    text: string
    textMuted: string
    accent: string
    border: string
  }
}> = [
  {
    value: 'default',
    label: '33 Strategies',
    colors: {
      bg: '240 20% 4%',           // #0a0a0f
      bgElevated: '240 18% 5%',
      text: '0 0% 96%',           // #f5f5f5
      textMuted: '0 0% 53%',
      accent: '41 57% 54%',       // #d4a54a
      border: '0 0% 100% / 0.08'
    }
  },
  {
    value: 'nord',
    label: 'Nord',
    colors: {
      bg: '220 16% 22%',          // #2e3440
      bgElevated: '222 16% 28%',
      text: '218 27% 94%',        // #e5e9f0
      textMuted: '219 28% 72%',
      accent: '193 43% 67%',      // #88c0d0
      border: '220 16% 36% / 0.5'
    }
  },
  {
    value: 'warm-reading',
    label: 'Warm Reading',
    colors: {
      bg: '30 20% 13%',           // #2a2218
      bgElevated: '30 18% 18%',
      text: '35 30% 85%',         // #e8dcc8
      textMuted: '35 20% 60%',
      accent: '41 57% 54%',       // Keep gold
      border: '30 15% 25% / 0.5'
    }
  },
  {
    value: 'high-contrast',
    label: 'High Contrast',
    colors: {
      bg: '0 0% 0%',              // #000000
      bgElevated: '0 0% 8%',
      text: '0 0% 100%',          // #ffffff
      textMuted: '0 0% 70%',
      accent: '48 96% 53%',       // #facc15
      border: '0 0% 100% / 0.2'
    }
  },
  {
    value: 'soft-charcoal',
    label: 'Soft Charcoal',
    colors: {
      bg: '0 0% 10%',             // #1a1a1a
      bgElevated: '0 0% 14%',
      text: '0 0% 88%',           // #e0e0e0
      textMuted: '0 0% 55%',
      accent: '258 90% 66%',      // #8b5cf6
      border: '0 0% 100% / 0.1'
    }
  }
]
```

### Task 2.2: Create useViewerPreferences Hook

**File:** `frontend/src/components/viewer-prefs/useViewerPreferences.ts`
**Dependencies:** Task 2.1
**New File:** Yes

**Implementation:**
```typescript
// useViewerPreferences.ts

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ViewerPreferences,
  DEFAULT_PREFERENCES,
  DepthLevel,
  FontFamily,
  ThemeName
} from './viewerPrefsConfig'

const STORAGE_KEY = 'viewer_preferences'

// Safe localStorage with private browsing fallback
function safeLocalStorage(): Storage | null {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, testKey)
    localStorage.removeItem(testKey)
    return localStorage
  } catch {
    return null
  }
}

export interface UseViewerPreferencesReturn {
  preferences: ViewerPreferences
  updateDepth: (depth: DepthLevel) => void
  updateFont: (font: FontFamily) => void
  updateTheme: (theme: ThemeName) => void
  markOnboardingComplete: () => void
  resetOnboarding: () => void
  resetAll: () => void
}

export function useViewerPreferences(): UseViewerPreferencesReturn {
  const storage = useMemo(() => safeLocalStorage(), [])

  const [preferences, setPreferences] = useState<ViewerPreferences>(() => {
    if (!storage) return DEFAULT_PREFERENCES

    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES

    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_PREFERENCES
    }
  })

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    storage?.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences, storage])

  const updateDepth = useCallback((depth: DepthLevel) => {
    setPreferences(prev => ({ ...prev, depth }))
  }, [])

  const updateFont = useCallback((fontFamily: FontFamily) => {
    setPreferences(prev => ({ ...prev, fontFamily }))
  }, [])

  const updateTheme = useCallback((theme: ThemeName) => {
    setPreferences(prev => ({ ...prev, theme }))
  }, [])

  const markOnboardingComplete = useCallback(() => {
    setPreferences(prev => ({ ...prev, onboardingComplete: true }))
  }, [])

  const resetOnboarding = useCallback(() => {
    setPreferences(prev => ({ ...prev, onboardingComplete: false }))
  }, [])

  const resetAll = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    storage?.removeItem(STORAGE_KEY)
  }, [storage])

  return {
    preferences,
    updateDepth,
    updateFont,
    updateTheme,
    markOnboardingComplete,
    resetOnboarding,
    resetAll
  }
}
```

### Task 2.3: Create ViewerPreferencesProvider

**File:** `frontend/src/components/viewer-prefs/ViewerPreferencesProvider.tsx`
**Dependencies:** Task 2.1, Task 2.2
**New File:** Yes

**Implementation:**
```typescript
// ViewerPreferencesProvider.tsx

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useViewerPreferences, UseViewerPreferencesReturn } from './useViewerPreferences'
import { THEME_OPTIONS, FONT_OPTIONS, ThemeName, FontFamily } from './viewerPrefsConfig'

const ViewerPreferencesContext = createContext<UseViewerPreferencesReturn | null>(null)

export function useViewerPreferencesContext() {
  const context = useContext(ViewerPreferencesContext)
  if (!context) {
    throw new Error('useViewerPreferencesContext must be used within ViewerPreferencesProvider')
  }
  return context
}

interface ViewerPreferencesProviderProps {
  children: ReactNode
}

export function ViewerPreferencesProvider({ children }: ViewerPreferencesProviderProps) {
  const preferencesState = useViewerPreferences()
  const { preferences } = preferencesState

  // Apply CSS variables to document root when theme changes
  useEffect(() => {
    const theme = THEME_OPTIONS.find(t => t.value === preferences.theme)
    if (!theme) return

    const root = document.documentElement
    root.style.setProperty('--color-bg', theme.colors.bg)
    root.style.setProperty('--color-bg-elevated', theme.colors.bgElevated)
    root.style.setProperty('--color-text', theme.colors.text)
    root.style.setProperty('--color-text-muted', theme.colors.textMuted)
    root.style.setProperty('--color-accent', theme.colors.accent)
    root.style.setProperty('--color-border', theme.colors.border)

    // Also set data attribute for potential CSS selectors
    root.dataset.theme = preferences.theme

    return () => {
      // Cleanup: remove data attribute (CSS vars persist, which is fine)
      delete root.dataset.theme
    }
  }, [preferences.theme])

  // Apply font family when it changes
  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.value === preferences.fontFamily)
    if (!font) return

    const root = document.documentElement
    root.style.setProperty('--font-body', font.fontStack)
  }, [preferences.fontFamily])

  return (
    <ViewerPreferencesContext.Provider value={preferencesState}>
      {children}
    </ViewerPreferencesContext.Provider>
  )
}
```

### Task 2.4: Add Theme CSS Variables to globals.css

**File:** `frontend/src/styles/globals.css`
**New File:** No - Modify existing

**Add CSS:**
```css
/* Theme variants - applied via data-theme attribute or CSS variables */
[data-theme="nord"] {
  --color-bg: 220 16% 22%;
  --color-bg-elevated: 222 16% 28%;
  --color-bg-card: 220 16% 26% / 0.5;
  --color-text: 218 27% 94%;
  --color-text-muted: 219 28% 72%;
  --color-text-dim: 219 20% 55%;
  --color-accent: 193 43% 67%;
  --color-accent-glow: 193 43% 67% / 0.3;
  --color-border: 220 16% 36% / 0.5;
}

[data-theme="warm-reading"] {
  --color-bg: 30 20% 13%;
  --color-bg-elevated: 30 18% 18%;
  --color-bg-card: 30 15% 20% / 0.5;
  --color-text: 35 30% 85%;
  --color-text-muted: 35 20% 60%;
  --color-text-dim: 35 15% 45%;
  --color-accent: 41 57% 54%;
  --color-accent-glow: 41 57% 54% / 0.3;
  --color-border: 30 15% 25% / 0.5;
}

[data-theme="high-contrast"] {
  --color-bg: 0 0% 0%;
  --color-bg-elevated: 0 0% 8%;
  --color-bg-card: 0 0% 5% / 0.8;
  --color-text: 0 0% 100%;
  --color-text-muted: 0 0% 70%;
  --color-text-dim: 0 0% 50%;
  --color-accent: 48 96% 53%;
  --color-accent-glow: 48 96% 53% / 0.4;
  --color-border: 0 0% 100% / 0.2;
}

[data-theme="soft-charcoal"] {
  --color-bg: 0 0% 10%;
  --color-bg-elevated: 0 0% 14%;
  --color-bg-card: 0 0% 12% / 0.5;
  --color-text: 0 0% 88%;
  --color-text-muted: 0 0% 55%;
  --color-text-dim: 0 0% 40%;
  --color-accent: 258 90% 66%;
  --color-accent-glow: 258 90% 66% / 0.3;
  --color-border: 0 0% 100% / 0.1;
}

/* Jump indicator breathing animation */
@keyframes breathe-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 hsl(var(--color-accent) / 0);
  }
  50% {
    box-shadow: 0 0 20px 4px hsl(var(--color-accent) / 0.3);
  }
}

.animate-breathe-glow {
  animation: breathe-glow 2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-breathe-glow {
    animation: none;
  }
}
```

### Task 2.5: Add Google Fonts to index.html

**File:** `frontend/index.html`
**New File:** No - Modify existing

**Add to `<head>`:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Inter:wght@400;500;600&family=Lora:wght@400;600&family=Merriweather:wght@400;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
```

---

## Phase 3: Preference Onboarding

**Priority:** P1 - User-facing feature
**Estimated Complexity:** High

### Task 3.1: Create DepthSelector Component

**File:** `frontend/src/components/viewer-prefs/DepthSelector.tsx`
**Dependencies:** Task 2.1
**New File:** Yes

**Implementation:**
```typescript
// DepthSelector.tsx

import { cn } from '../../lib/utils'
import { DEPTH_OPTIONS, DepthLevel } from './viewerPrefsConfig'

interface DepthSelectorProps {
  value: DepthLevel
  onChange: (depth: DepthLevel) => void
}

export function DepthSelector({ value, onChange }: DepthSelectorProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      {DEPTH_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex flex-col items-start p-4 rounded-xl border transition-all',
            'text-left min-h-[44px]',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
            value === option.value
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
          )}
        >
          <span className="font-semibold text-sm">{option.label}</span>
          <span className="text-xs text-muted mt-1">{option.description}</span>
        </button>
      ))}
    </div>
  )
}
```

### Task 3.2: Create FontSelector Component

**File:** `frontend/src/components/viewer-prefs/FontSelector.tsx`
**Dependencies:** Task 2.1
**New File:** Yes

**Implementation:**
```typescript
// FontSelector.tsx

import { cn } from '../../lib/utils'
import { FONT_OPTIONS, FontFamily } from './viewerPrefsConfig'

interface FontSelectorProps {
  value: FontFamily
  onChange: (font: FontFamily) => void
}

export function FontSelector({ value, onChange }: FontSelectorProps) {
  const sansSerif = FONT_OPTIONS.filter(f => f.category === 'sans-serif')
  const serif = FONT_OPTIONS.filter(f => f.category === 'serif')

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Sans-Serif Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Sans-Serif</p>
        <div className="grid grid-cols-3 gap-3">
          {sansSerif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-4 rounded-xl border transition-all',
                'text-base min-h-[60px]',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                value === font.value
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serif Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Serif</p>
        <div className="grid grid-cols-3 gap-3">
          {serif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-4 rounded-xl border transition-all',
                'text-base min-h-[60px]',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                value === font.value
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Task 3.3: Create ThemeSelector Component

**File:** `frontend/src/components/viewer-prefs/ThemeSelector.tsx`
**Dependencies:** Task 2.1
**New File:** Yes

**Implementation:**
```typescript
// ThemeSelector.tsx

import { cn } from '../../lib/utils'
import { THEME_OPTIONS, ThemeName } from './viewerPrefsConfig'

interface ThemeSelectorProps {
  value: ThemeName
  onChange: (theme: ThemeName) => void
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
      {THEME_OPTIONS.map((theme) => (
        <button
          key={theme.value}
          onClick={() => onChange(theme.value)}
          className={cn(
            'flex flex-col items-center p-4 rounded-xl border transition-all',
            'min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
            value === theme.value
              ? 'border-accent ring-2 ring-accent/30'
              : 'border-border hover:border-accent/50'
          )}
        >
          {/* Color preview swatch */}
          <div className="flex gap-1 mb-2">
            <div
              className="w-6 h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.bg})` }}
              title="Background"
            />
            <div
              className="w-6 h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.text})` }}
              title="Text"
            />
            <div
              className="w-6 h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
              title="Accent"
            />
          </div>
          <span className={cn(
            'text-sm font-medium',
            value === theme.value ? 'text-foreground' : 'text-muted'
          )}>
            {theme.label}
          </span>
        </button>
      ))}
    </div>
  )
}
```

### Task 3.4: Create PreviewResponse Component

**File:** `frontend/src/components/viewer-prefs/PreviewResponse.tsx`
**Dependencies:** Task 2.1, `react-markdown`
**New File:** Yes

**Implementation:**
```typescript
// PreviewResponse.tsx

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { cn } from '../../lib/utils'
import {
  SAMPLE_RESPONSES,
  SAMPLE_USER_QUESTION,
  FONT_OPTIONS,
  THEME_OPTIONS,
  DepthLevel,
  FontFamily,
  ThemeName
} from './viewerPrefsConfig'

interface PreviewResponseProps {
  depth: DepthLevel
  fontFamily: FontFamily
  theme: ThemeName
}

export function PreviewResponse({ depth, fontFamily, theme }: PreviewResponseProps) {
  const font = useMemo(
    () => FONT_OPTIONS.find(f => f.value === fontFamily),
    [fontFamily]
  )

  const themeColors = useMemo(
    () => THEME_OPTIONS.find(t => t.value === theme)?.colors,
    [theme]
  )

  const responseContent = SAMPLE_RESPONSES[depth]

  if (!themeColors) return null

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: `hsl(${themeColors.bg})`,
        borderColor: `hsl(${themeColors.border})`,
        fontFamily: font?.fontStack
      }}
    >
      {/* User message */}
      <div className="p-4 flex justify-end">
        <div
          className="max-w-[80%] rounded-lg px-4 py-2"
          style={{
            backgroundColor: `hsl(${themeColors.accent})`,
            color: `hsl(${themeColors.bg})`
          }}
        >
          <p className="text-sm">{SAMPLE_USER_QUESTION}</p>
        </div>
      </div>

      {/* AI response */}
      <div className="p-4 pt-0 flex justify-start">
        <div
          className="max-w-[80%] rounded-lg px-4 py-2 border"
          style={{
            backgroundColor: `hsl(${themeColors.bgElevated})`,
            borderColor: `hsl(${themeColors.border})`,
            color: `hsl(${themeColors.text})`
          }}
        >
          <div className={cn(
            'prose prose-sm max-w-none',
            'prose-headings:text-inherit prose-p:text-inherit',
            'prose-strong:text-inherit prose-li:text-inherit'
          )}>
            <ReactMarkdown>{responseContent}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Task 3.5: Create ViewerPreferencesOnboarding Component

**File:** `frontend/src/components/viewer-prefs/ViewerPreferencesOnboarding.tsx`
**Dependencies:** Tasks 3.1-3.4, `framer-motion`, existing `ProgressBars`, `GlowPulse`
**New File:** Yes

**Full implementation in spec Section 6**

### Task 3.6: Create viewer-prefs Barrel Export

**File:** `frontend/src/components/viewer-prefs/index.ts`
**Dependencies:** Tasks 2.1-2.3, 3.1-3.5
**New File:** Yes

**Implementation:**
```typescript
// frontend/src/components/viewer-prefs/index.ts

export { ViewerPreferencesProvider, useViewerPreferencesContext } from './ViewerPreferencesProvider'
export { ViewerPreferencesOnboarding } from './ViewerPreferencesOnboarding'
export { useViewerPreferences } from './useViewerPreferences'
export { DepthSelector } from './DepthSelector'
export { FontSelector } from './FontSelector'
export { ThemeSelector } from './ThemeSelector'
export { PreviewResponse } from './PreviewResponse'
export * from './viewerPrefsConfig'
```

### Task 3.7: Integrate into SharePage.tsx

**File:** `frontend/src/pages/SharePage.tsx`
**Dependencies:** Task 3.6
**New File:** No - Modify existing

**Key Changes:**
1. Wrap existing content with `ViewerPreferencesProvider`
2. Conditionally render `ViewerPreferencesOnboarding` when `!onboardingComplete`
3. Add state to track when onboarding completes

---

## Phase 4: Progressive Disclosure

**Priority:** P2 - Enhancement
**Estimated Complexity:** Medium

### Task 4.1: Create ChatExpandButton Component

**File:** `frontend/src/components/chat/ChatExpandButton.tsx`
**Dependencies:** `framer-motion`, `lucide-react`
**New File:** Yes

**Implementation:**
```typescript
// ChatExpandButton.tsx

import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ChatExpandButtonProps {
  onClick: () => void
  disabled?: boolean
  isLoading?: boolean
}

export function ChatExpandButton({
  onClick,
  disabled = false,
  isLoading = false
}: ChatExpandButtonProps) {
  const prefersReducedMotion = useReducedMotion()

  if (disabled && !isLoading) return null

  return (
    <motion.button
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.2 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'flex items-center gap-1.5 mt-3 px-3 py-1.5',
        'text-xs font-medium text-muted',
        'rounded-md border border-border',
        'hover:text-foreground hover:border-accent/50 hover:bg-accent/5',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <>
          <span className="h-3 w-3 animate-spin rounded-full border border-muted border-t-accent" />
          <span>Expanding...</span>
        </>
      ) : (
        <>
          <ChevronDown className="w-3 h-3" />
          <span>Expand on that</span>
        </>
      )}
    </motion.button>
  )
}
```

### Task 4.2: Add Expand Button to ChatMessage

**File:** `frontend/src/components/ChatMessage.tsx`
**Dependencies:** Task 4.1
**New File:** No - Modify existing

**Key Changes:**
1. Add `ChatExpandButton` after assistant message content
2. Track expanded state per message ID
3. Pass expand handler to parent

### Task 4.3: Handle Expansion in ChatInterface

**File:** `frontend/src/components/ChatInterface.tsx`
**Dependencies:** Task 4.2
**New File:** No - Modify existing

**Key Changes:**
1. Track set of expanded message IDs
2. Add expansion handler that sends follow-up "expand" prompt
3. Mark message as expanded after response received

---

## Phase 5: Polish & Testing

**Priority:** P2 - Quality assurance
**Estimated Complexity:** Medium

### Task 5.1: Unit Tests for useViewerPreferences

**File:** `frontend/src/components/viewer-prefs/__tests__/useViewerPreferences.test.ts`
**New File:** Yes

### Task 5.2: Integration Tests for Onboarding

**File:** `frontend/src/components/viewer-prefs/__tests__/ViewerPreferencesOnboarding.test.tsx`
**New File:** Yes

### Task 5.3: E2E Tests for Full Journey

**File:** `frontend/tests/viewer-preferences.spec.ts`
**New File:** Yes

### Task 5.4: Accessibility Audit

**Manual Testing Checklist:**
- [ ] Keyboard navigation works (arrow keys, Enter, Escape)
- [ ] Screen reader announces step changes
- [ ] Focus trap works in onboarding modal
- [ ] 44px minimum touch targets on all interactive elements
- [ ] `prefers-reduced-motion` disables animations
- [ ] WCAG contrast ratios met for all themes

### Task 5.5: Update CLAUDE.md

**File:** `CLAUDE.md`
**New File:** No - Modify existing

Add "Viewer Preferences" section documenting:
- localStorage key: `viewer_preferences`
- Component structure under `viewer-prefs/`
- Theme CSS variable system
- How to add new themes

---

## Dependency Graph

```
Phase 1 (Smart Scroll):
  1.1 → 1.2 → 1.3

Phase 2 (Preferences Infrastructure):
  2.1 → 2.2 → 2.3
  2.4 (parallel)
  2.5 (parallel)

Phase 3 (Onboarding):
  3.1, 3.2, 3.3, 3.4 (parallel, depend on 2.1)
  → 3.5 (depends on 3.1-3.4)
  → 3.6 → 3.7

Phase 4 (Progressive Disclosure):
  4.1 → 4.2 → 4.3

Phase 5 (Testing):
  5.1-5.5 (parallel, after all implementation)
```

---

## Implementation Order Recommendation

1. **Start with Phase 1** - Fixes critical UX bug, quick win
2. **Phase 2 next** - Builds foundation for personalization
3. **Phase 3** - User-facing onboarding flow
4. **Phase 4** - Enhancement feature
5. **Phase 5** - Parallel with Phase 4 if time permits

Total estimated tasks: 18
Critical path: Tasks 1.1-1.3 → 2.1-2.3 → 3.1-3.7

---

## Verification Criteria

After implementation, verify:

1. **Smart Scroll**
   - [ ] User can scroll up during AI streaming without viewport snapping
   - [ ] Jump indicator appears with breathing glow
   - [ ] Clicking indicator scrolls to bottom

2. **Preferences**
   - [ ] Preferences persist across browser sessions
   - [ ] Theme colors apply immediately on selection
   - [ ] Font changes apply to chat messages

3. **Onboarding**
   - [ ] 3-step flow works with live preview
   - [ ] Skip button available at all times
   - [ ] Keyboard navigation (arrow keys, Enter, Escape)

4. **Progressive Disclosure**
   - [ ] Expand button appears after streaming completes
   - [ ] One-time use per message
   - [ ] Loading state during expansion

5. **Accessibility**
   - [ ] Screen reader compatible
   - [ ] Reduced motion support
   - [ ] 44px touch targets
