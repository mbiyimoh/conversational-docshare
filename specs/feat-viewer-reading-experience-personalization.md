# Viewer Reading Experience Personalization

**Status:** Draft
**Authors:** Claude Code
**Date:** 2025-12-19
**Related:**
- `docs/ideation/viewer-reading-experience-personalization.md` (ideation)
- `docs/ideation/stories-onboarding-flow.md` (onboarding pattern)
- `frontend/src/components/onboarding/` (existing Stories pattern)

---

## Overview

Implement a personalized reading experience for document capsule recipients with four major features:
1. **Smart scroll handling** - Replace forced auto-scroll with user-controlled scrolling and jump-to-bottom indicator
2. **Viewer preferences system** - Context provider, localStorage persistence, CSS theming
3. **Preference onboarding flow** - 3-step Stories-style configuration for depth, font, and color
4. **Progressive disclosure** - "Expand on that" button for AI response elaboration

---

## Background/Problem Statement

### Current Problems

**1. Auto-Scroll Hijacking (Critical UX Issue)**
- Current implementation in `ChatInterface.tsx:27-30` uses `scrollIntoView()` on every streaming update
- Users cannot read at their own pace during AI responses - viewport constantly snaps to bottom
- Pattern: `useEffect` fires on `[messages, streamingContent]` - dozens of times per second during streaming

**2. No Reading Customization**
- All viewers see identical typography and colors regardless of preferences
- Gold-on-dark theme may cause eye strain for extended reading sessions
- No control over response verbosity/depth

**3. Limited Response Interaction**
- Users must manually prompt for elaboration
- No quick way to get more detail on a specific response

### Root Cause Analysis

```typescript
// ChatInterface.tsx:27-30 - THE PROBLEM
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages, streamingContent])  // Fires constantly during streaming
```

**Why this is broken:**
- No user-intent detection - scrolls regardless of whether user manually scrolled away
- Uses viewport-level `scrollIntoView()` instead of container-scoped `scrollTo()`
- Violates CLAUDEMD guidance on scroll containment (see DocumentContentViewer.tsx:77-123 for correct pattern)

---

## Goals

- Enable viewers to read AI responses at their own pace during streaming
- Provide tasteful jump-to-bottom indicator when new content is available below
- Allow viewers to customize depth, font, and color theme preferences
- Offer progressive disclosure via "Expand on that" one-click elaboration
- Persist preferences across sessions using localStorage
- Maintain full accessibility (keyboard navigation, reduced motion, screen readers)
- Follow existing 33 Strategies design system while offering alternatives

---

## Non-Goals

- Backend persistence of viewer preferences (deferred to Spec B)
- Account detection and "Welcome back!" flow (deferred to Spec B)
- End-session "Save your experience" account creation CTA (deferred to Spec B)
- Creator-side customization of available themes
- Document viewer font customization (chat only for this spec)
- Voice/speech output controls

---

## Technical Dependencies

### Existing Dependencies (Already Installed)
| Package | Version | Usage |
|---------|---------|-------|
| `framer-motion` | ^11.18.2 | Animations, breathing glow, reduced motion hook |
| `react` | ^18.3.1 | Core framework |
| `tailwindcss` | ^3.4.17 | Styling |
| `react-markdown` | ^10.1.0 | Message rendering |

### New Dependencies Required
| Package | Version | Usage |
|---------|---------|-------|
| Google Fonts | N/A | Inter, Merriweather, Lora, Source Serif 4, Atkinson Hyperlegible |

### Existing Patterns to Follow
| Pattern | Location | Key Implementation |
|---------|----------|-------------------|
| Scroll containment | `DocumentContentViewer.tsx:187-233` | `container.scrollTo()` with manual position calculation |
| Safe localStorage | `useOnboardingState.ts:12-21` | `safeLocalStorage()` with private browsing fallback |
| Stories onboarding | `StoriesOnboarding.tsx` | Tap navigation, keyboard support, accessibility |
| Framer Motion a11y | `OnboardingSlide.tsx` | `useReducedMotion()` hook |
| CSS theming | `globals.css` | HSL CSS custom properties |

---

## Detailed Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SharePage.tsx                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ViewerPreferencesProvider                     │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │         (Applies CSS variables to :root)            │  │  │
│  │  │                                                     │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │  ViewerPreferencesOnboarding (if !complete)  │  │  │  │
│  │  │  │  - Step 1: Depth (concise/balanced/detailed) │  │  │  │
│  │  │  │  - Step 2: Font (6 options)                  │  │  │  │
│  │  │  │  - Step 3: Theme (5 options)                 │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  │                                                     │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │            ChatInterface                      │  │  │  │
│  │  │  │  - Smart scroll (Intersection Observer)      │  │  │  │
│  │  │  │  - JumpToBottomIndicator (floating pill)     │  │  │  │
│  │  │  │  - ChatMessage with ChatExpandButton         │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
frontend/src/components/
├── viewer-prefs/
│   ├── ViewerPreferencesProvider.tsx   # Context + CSS variable applicator
│   ├── ViewerPreferencesOnboarding.tsx # 3-step Stories flow
│   ├── PreferenceStep.tsx              # Individual step wrapper
│   ├── DepthSelector.tsx               # 3-option depth picker
│   ├── FontSelector.tsx                # 6-option font picker
│   ├── ThemeSelector.tsx               # 5-option theme picker
│   ├── PreviewResponse.tsx             # Live sample AI response
│   ├── useViewerPreferences.ts         # Hook for prefs access
│   ├── viewerPrefsConfig.ts            # Configuration constants
│   └── index.ts                        # Barrel export
│
├── chat/
│   ├── JumpToBottomIndicator.tsx       # Floating pill with glow
│   ├── ChatExpandButton.tsx            # "Expand on that" button
│   └── index.ts                        # Barrel export
```

### 1. Viewer Preferences Data Model

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

### 2. Preferences Hook (localStorage Persistence)

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

### 3. Preferences Context Provider

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

### 4. Smart Scroll Implementation

```typescript
// ChatInterface.tsx - Key modifications

import { useState, useEffect, useRef, useCallback } from 'react'
import { JumpToBottomIndicator } from './chat/JumpToBottomIndicator'

export function ChatInterface({ conversationId, onCitationClick, onMessagesChange }: ChatInterfaceProps) {
  // ... existing state ...

  // Smart scroll state
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showJumpIndicator, setShowJumpIndicator] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollSentinelRef = useRef<HTMLDivElement>(null)
  const userJustSentMessage = useRef(false)

  // Intersection Observer for bottom detection
  useEffect(() => {
    const sentinel = scrollSentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const atBottom = entry.isIntersecting
        setIsAtBottom(atBottom)

        if (atBottom) {
          setShowJumpIndicator(false)
          setUnreadCount(0)
        }
      },
      {
        root: container,
        threshold: 0.1,
        rootMargin: '100px' // Trigger slightly before reaching absolute bottom
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Show indicator when streaming and user not at bottom
  useEffect(() => {
    if (isStreaming && !isAtBottom && !userJustSentMessage.current) {
      setShowJumpIndicator(true)
    }
  }, [isStreaming, isAtBottom])

  // Track unread messages when not at bottom
  useEffect(() => {
    if (!isAtBottom && streamingContent) {
      // Count "chunks" that would represent new content
      setUnreadCount(prev => Math.min(prev + 1, 99))
    }
  }, [streamingContent, isAtBottom])

  // Smart auto-scroll: only when appropriate
  useEffect(() => {
    const container = scrollContainerRef.current
    const sentinel = scrollSentinelRef.current
    if (!container || !sentinel) return

    // Auto-scroll if:
    // 1. User was already at bottom, OR
    // 2. User just sent a message (explicit intent)
    if (isAtBottom || userJustSentMessage.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })

      // Reset the "just sent" flag after scroll
      if (userJustSentMessage.current) {
        setTimeout(() => {
          userJustSentMessage.current = false
        }, 500)
      }
    }
  }, [messages, streamingContent, isAtBottom])

  // Modified send handler
  const handleSendMessage = async (content: string) => {
    userJustSentMessage.current = true
    setShowJumpIndicator(false)
    setUnreadCount(0)

    // ... rest of existing send logic ...
  }

  // Jump to bottom handler
  const handleJumpToBottom = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    })
    setShowJumpIndicator(false)
    setUnreadCount(0)
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Messages container - add ref */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 relative"
      >
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            // ... existing props ...
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessage
            role="assistant"
            content={streamingContent}
            onCitationClick={onCitationClick}
          />
        )}

        {/* Loading indicator */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            {/* ... existing loading dots ... */}
          </div>
        )}

        {/* Scroll sentinel - invisible element at bottom */}
        <div ref={scrollSentinelRef} className="h-px" />

        {/* Original messagesEndRef for compatibility */}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to bottom indicator */}
      <JumpToBottomIndicator
        visible={showJumpIndicator}
        unreadCount={unreadCount}
        onClick={handleJumpToBottom}
      />

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
    </div>
  )
}
```

### 5. Jump to Bottom Indicator (with Breathing Glow)

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

### 6. Preference Onboarding Flow

```typescript
// ViewerPreferencesOnboarding.tsx

import { useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { GlowPulse } from '../ui'
import { ProgressBars } from '../onboarding/ProgressBars'
import { PreviewResponse } from './PreviewResponse'
import { DepthSelector } from './DepthSelector'
import { FontSelector } from './FontSelector'
import { ThemeSelector } from './ThemeSelector'
import { useViewerPreferencesContext } from './ViewerPreferencesProvider'
import { DepthLevel, FontFamily, ThemeName } from './viewerPrefsConfig'

interface ViewerPreferencesOnboardingProps {
  onComplete: () => void
}

const STEPS = ['depth', 'font', 'theme'] as const
type Step = typeof STEPS[number]

const STEP_TITLES: Record<Step, string> = {
  depth: 'How much detail do you prefer?',
  font: 'Choose your reading style',
  theme: 'Pick a color scheme'
}

export function ViewerPreferencesOnboarding({ onComplete }: ViewerPreferencesOnboardingProps) {
  const prefersReducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    preferences,
    updateDepth,
    updateFont,
    updateTheme,
    markOnboardingComplete
  } = useViewerPreferencesContext()

  const [currentStep, setCurrentStep] = useState(0)
  const isLastStep = currentStep === STEPS.length - 1

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1)
          }
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
          }
          break
        case 'Escape':
          handleSkip()
          break
        case 'Enter':
          if (isLastStep) {
            handleComplete()
          } else {
            setCurrentStep(prev => prev + 1)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentStep, isLastStep])

  // Focus trap and body scroll lock
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement
    containerRef.current?.focus()
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
      previousActiveElement?.focus()
    }
  }, [])

  const handleSkip = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [markOnboardingComplete, onComplete])

  const handleComplete = useCallback(() => {
    markOnboardingComplete()
    onComplete()
  }, [markOnboardingComplete, onComplete])

  const handleNext = useCallback(() => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }, [isLastStep, handleComplete])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleDepthChange = useCallback((depth: DepthLevel) => {
    updateDepth(depth)
  }, [updateDepth])

  const handleFontChange = useCallback((font: FontFamily) => {
    updateFont(font)
  }, [updateFont])

  const handleThemeChange = useCallback((theme: ThemeName) => {
    updateTheme(theme)
  }, [updateTheme])

  const currentStepName = STEPS[currentStep]

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Customize your reading experience"
      tabIndex={-1}
      className={cn(
        'fixed inset-0 z-50 bg-background',
        'flex flex-col min-h-screen',
        'outline-none'
      )}
    >
      {/* Atmospheric glow */}
      <GlowPulse className="w-96 h-96 -top-48 -left-48" />
      <GlowPulse className="w-80 h-80 -bottom-40 -right-40" color="purple" />

      {/* Progress bars */}
      <ProgressBars currentIndex={currentStep} total={STEPS.length} />

      {/* Skip button */}
      <div className="absolute top-16 right-5 z-10">
        <button
          onClick={handleSkip}
          className={cn(
            'px-4 py-2 text-sm font-medium text-muted',
            'hover:text-foreground transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent',
            'min-h-[44px] min-w-[44px]'
          )}
        >
          Skip
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-2xl mx-auto w-full">
        {/* Step title */}
        <motion.h2
          key={currentStepName}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          className="text-2xl md:text-3xl font-display text-foreground text-center mb-8"
        >
          {STEP_TITLES[currentStepName]}
        </motion.h2>

        {/* Preview response - always visible */}
        <div className="w-full mb-8">
          <PreviewResponse
            depth={preferences.depth}
            fontFamily={preferences.fontFamily}
            theme={preferences.theme}
          />
        </div>

        {/* Step-specific selector */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepName}
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {currentStepName === 'depth' && (
              <DepthSelector
                value={preferences.depth}
                onChange={handleDepthChange}
              />
            )}
            {currentStepName === 'font' && (
              <FontSelector
                value={preferences.fontFamily}
                onChange={handleFontChange}
              />
            )}
            {currentStepName === 'theme' && (
              <ThemeSelector
                value={preferences.theme}
                onChange={handleThemeChange}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="px-8 pb-12 flex items-center justify-between max-w-2xl mx-auto w-full">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'transition-colors min-h-[44px]',
            currentStep === 0
              ? 'text-muted cursor-not-allowed'
              : 'text-foreground hover:bg-background-elevated'
          )}
        >
          Back
        </button>

        <button
          onClick={handleNext}
          className={cn(
            'px-6 py-3 text-base font-semibold rounded-xl',
            'bg-accent text-background',
            'hover:bg-accent/90 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
            'min-h-[44px]'
          )}
        >
          {isLastStep ? "Let's go" : 'Next'}
        </button>
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite">
        Step {currentStep + 1} of {STEPS.length}: {STEP_TITLES[currentStepName]}
      </div>
    </div>
  )
}
```

### 7. Progressive Disclosure (Expand Button)

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

### 8. CSS Theme Variables Addition

```css
/* globals.css - Add to existing file */

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

### 9. Google Fonts Addition

```html
<!-- Add to frontend/index.html in <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Inter:wght@400;500;600&family=Lora:wght@400;600&family=Merriweather:wght@400;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
```

### 10. DepthSelector Component

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

### 11. FontSelector Component

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

### 12. ThemeSelector Component

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

### 13. PreviewResponse Component

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

### 14. Barrel Export Files

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

```typescript
// frontend/src/components/chat/index.ts

export { JumpToBottomIndicator } from './JumpToBottomIndicator'
export { ChatExpandButton } from './ChatExpandButton'
```

---

## User Experience

### Preference Onboarding Flow

1. User accesses share link and passes access gate
2. If `onboardingComplete: false` in localStorage, fullscreen onboarding appears
3. **Step 1 (Depth):** User sees sample response, taps Concise/Balanced/Detailed - response updates live
4. **Step 2 (Font):** User sees 6 font options, tapping changes sample response font immediately
5. **Step 3 (Theme):** User sees 5 color themes, entire preview updates to show theme
6. User clicks "Let's go" → onboarding dismissed, preferences saved
7. Skip button available at all times (top right)

### Smart Scroll Behavior

1. User sends message → auto-scroll to bottom (explicit intent)
2. AI starts streaming → content appears at bottom
3. User scrolls up to re-read → auto-scroll STOPS
4. Floating "Jump to latest" pill appears with unread count
5. Pill has subtle breathing glow animation (gold by default)
6. User clicks pill → smooth scroll to bottom, pill dismisses
7. When user naturally scrolls back to bottom → pill auto-dismisses

### Progressive Disclosure

1. AI response completes streaming
2. "Expand on that" button fades in below the response (300ms delay)
3. User clicks button → loading state shown
4. New elaborated response appends to conversation
5. Button on original message becomes hidden (one-time use)

---

## Testing Strategy

### Unit Tests

```typescript
// useViewerPreferences.test.ts
describe('useViewerPreferences', () => {
  // Purpose: Verify localStorage persistence works correctly
  it('should load preferences from localStorage on mount', () => {
    localStorage.setItem('viewer_preferences', JSON.stringify({ depth: 'detailed' }))
    const { result } = renderHook(() => useViewerPreferences())
    expect(result.current.preferences.depth).toBe('detailed')
  })

  // Purpose: Verify preference updates persist
  it('should persist preference changes to localStorage', () => {
    const { result } = renderHook(() => useViewerPreferences())
    act(() => result.current.updateTheme('nord'))
    const stored = JSON.parse(localStorage.getItem('viewer_preferences') || '{}')
    expect(stored.theme).toBe('nord')
  })

  // Purpose: Verify private browsing fallback
  it('should handle localStorage unavailability gracefully', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    const { result } = renderHook(() => useViewerPreferences())
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES)
  })
})
```

### Integration Tests

```typescript
// ViewerPreferencesOnboarding.test.tsx
describe('ViewerPreferencesOnboarding', () => {
  // Purpose: Verify 3-step flow completes
  it('should progress through all 3 steps and call onComplete', async () => {
    const onComplete = jest.fn()
    render(
      <ViewerPreferencesProvider>
        <ViewerPreferencesOnboarding onComplete={onComplete} />
      </ViewerPreferencesProvider>
    )

    // Navigate through steps
    await userEvent.click(screen.getByText('Next'))
    await userEvent.click(screen.getByText('Next'))
    await userEvent.click(screen.getByText("Let's go"))

    expect(onComplete).toHaveBeenCalled()
  })

  // Purpose: Verify live preview updates
  it('should update preview when depth selection changes', async () => {
    render(<ViewerPreferencesOnboarding onComplete={jest.fn()} />)

    const detailedButton = screen.getByText('Full Context')
    await userEvent.click(detailedButton)

    // Preview should show detailed response
    expect(screen.getByText(/Year 1/)).toBeInTheDocument()
  })

  // Purpose: Verify keyboard navigation accessibility
  it('should support keyboard navigation with arrow keys', async () => {
    render(<ViewerPreferencesOnboarding onComplete={jest.fn()} />)

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByText('Choose your reading style')).toBeInTheDocument()
  })
})
```

### E2E Tests

```typescript
// viewer-preferences.spec.ts
test.describe('Viewer Preferences', () => {
  test('complete preference onboarding flow', async ({ page }) => {
    // Access share link
    await page.goto('/share/test-slug')
    await page.fill('[data-testid="password-input"]', 'test-password')
    await page.click('text=Access Documents')

    // Onboarding should appear
    await expect(page.locator('text=How much detail')).toBeVisible()

    // Select detailed depth
    await page.click('text=Full Context')
    await page.click('text=Next')

    // Select font
    await page.click('text=Merriweather')
    await page.click('text=Next')

    // Select theme
    await page.click('text=Nord')
    await page.click("text=Let's go")

    // Verify chat is visible with Nord theme
    await expect(page.locator('[data-theme="nord"]')).toBeVisible()
  })

  test('smart scroll shows jump indicator when scrolled away', async ({ page }) => {
    // Setup: Access share link with existing conversation
    await page.goto('/share/test-slug')
    // ... authenticate ...

    // Send a message that will generate long response
    await page.fill('[data-testid="chat-input"]', 'Give me a detailed explanation')
    await page.click('[data-testid="send-button"]')

    // Wait for streaming to start
    await page.waitForSelector('[data-testid="streaming-indicator"]')

    // Scroll up
    await page.locator('[data-testid="messages-container"]').evaluate(el => {
      el.scrollTop = 0
    })

    // Jump indicator should appear
    await expect(page.locator('text=Jump to latest')).toBeVisible()

    // Click it
    await page.click('text=Jump to latest')

    // Should scroll to bottom and indicator disappears
    await expect(page.locator('text=Jump to latest')).not.toBeVisible()
  })
})
```

---

## Performance Considerations

### Font Loading
- Use `font-display: swap` to prevent FOIT (Flash of Invisible Text)
- Preconnect to Google Fonts (`<link rel="preconnect">`)
- Only load weights actually used (400, 500, 600, 700)

### Theme Switching
- CSS custom properties update instantly (no React re-render needed for color changes)
- `data-theme` attribute allows CSS-only theme variations
- No flash on initial load: preferences loaded synchronously in useState initializer

### Scroll Performance
- Intersection Observer is highly performant (browser-native)
- Single observer instance, not per-message
- Debounce not needed - IO handles this efficiently

### Bundle Size
- New components are small (~5KB total estimated)
- Framer Motion already in bundle
- Google Fonts loaded async (not in JS bundle)

---

## Security Considerations

### localStorage Data
- Only stores UI preferences (no sensitive data)
- No PII stored in preferences
- Private browsing mode gracefully handled

### CSS Injection
- Theme colors are predefined constants (not user-input)
- No dynamic CSS generation from user strings

---

## Documentation

### Files to Update
- `CLAUDE.md` - Add "Viewer Preferences" section
- `developer-guides/share-link-access-guide.md` - Document new onboarding flow

### New Documentation Needed
- None for this spec (inline code comments sufficient)

---

## Implementation Phases

### Phase 1: Smart Scroll (Critical Bug Fix)
- Modify `ChatInterface.tsx` to use Intersection Observer
- Create `JumpToBottomIndicator.tsx` component
- Test scroll behavior on desktop and mobile

### Phase 2: Preferences Infrastructure
- Create `useViewerPreferences.ts` hook
- Create `ViewerPreferencesProvider.tsx` context
- Add theme CSS variables to `globals.css`
- Add Google Fonts to `index.html`

### Phase 3: Preference Onboarding
- Create `ViewerPreferencesOnboarding.tsx`
- Create step components (Depth, Font, Theme selectors)
- Create `PreviewResponse.tsx` for live preview
- Integrate into `SharePage.tsx`

### Phase 4: Progressive Disclosure
- Create `ChatExpandButton.tsx`
- Modify `ChatMessage.tsx` to include expand button
- Track expanded message IDs in `ChatInterface.tsx`
- Handle expansion request in message sending

### Phase 5: Polish & Testing
- Write unit tests for hooks
- Write integration tests for onboarding flow
- Write E2E tests for full journey
- Accessibility audit (keyboard nav, screen readers)

---

## Open Questions

1. **Settings access after onboarding** - Should there be a gear icon to re-open preferences? Where should it live?
   - **Recommendation:** Add small settings icon in chat header, opens modal with preference controls

2. **Theme persistence scope** - Should theme apply to document viewer panel too, or just chat?
   - **Recommendation:** Apply to entire SharePage (both panels) for consistency

3. **Depth preference backend integration** - Should depth preference be sent to backend to influence AI response length?
   - **Recommendation:** Yes, include in system prompt context. Deferred to Phase 4 refinement.

---

## References

- Ideation document: `docs/ideation/viewer-reading-experience-personalization.md`
- Stories onboarding pattern: `frontend/src/components/onboarding/StoriesOnboarding.tsx`
- Scroll containment best practice: `frontend/src/components/DocumentContentViewer.tsx:187-233`
- Framer Motion docs: https://www.framer.com/motion/
- Intersection Observer API: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- WCAG contrast requirements: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
