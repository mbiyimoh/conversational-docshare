# Viewer Reading Experience Personalization

**Slug:** viewer-reading-experience-personalization
**Author:** Claude Code
**Date:** 2025-12-19
**Branch:** preflight/viewer-reading-experience-personalization
**Related:**
- `docs/ideation/viewer-experience-enhancements.md` (prior viewer work)
- `docs/ideation/stories-onboarding-flow.md` (onboarding pattern reference)
- `frontend/src/pages/SharePage.tsx` (main viewer page)
- `frontend/src/components/ChatInterface.tsx` (chat with auto-scroll)
- `frontend/src/components/onboarding/` (existing Stories onboarding pattern)

---

## 1) Intent & Assumptions

**Task brief:** Improve the readability and interaction experience for document capsule recipients through four vectors:
1. General readability improvements (typography, letter-spacing, fonts, color schemes)
2. Viewer onboarding that captures reading preferences (depth, font style, color scheme)
3. Progressive disclosure ("Expand on that" button for AI responses)
4. Smart scroll handling (replace forced auto-scroll with "jump to bottom" indicator)

**Assumptions:**
- Viewers access documents via share links (no authentication required beyond access verification)
- Preference storage can use localStorage (server-side persistence is optional Phase 2)
- Existing Stories onboarding pattern can be adapted for preference collection
- The current 33 Strategies design system is the default, but alternatives are offered
- Font choices must be web-safe or from Google Fonts (already loaded: DM Sans, Instrument Serif, JetBrains Mono)
- Progressive disclosure is limited to one expansion per response (prevents infinite recursion)

**Out of scope:**
- Creator-side customization (this is viewer-controlled)
- Backend persistence of viewer preferences (localStorage only for MVP)
- Custom brand themes per project (future feature)
- Voice/speech output controls
- PDF/document viewer font customization (chat only for MVP)

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `frontend/src/pages/SharePage.tsx` | Main viewer page. Uses Resplit panels, ChatInterface, DocumentContentViewer. localStorage already used for panel ratio persistence. |
| `frontend/src/components/ChatInterface.tsx:27-30` | Auto-scroll uses `scrollIntoView({ behavior: 'smooth' })` on every message/streamingContent change. Root cause of scroll-hijacking. |
| `frontend/src/components/ChatMessage.tsx` | Message rendering with ReactMarkdown. Styling is hardcoded, not preference-aware. |
| `frontend/src/styles/globals.css` | Full design token system. Gold accent (#d4a54a), font stacks defined. CSS custom properties make theming easy. |
| `frontend/src/components/onboarding/StoriesOnboarding.tsx` | Existing Stories pattern with tap navigation, keyboard support, accessibility. Perfect template for preference collection. |
| `frontend/src/components/onboarding/useOnboardingState.ts` | localStorage helper with safe fallback. Can extend for viewer preferences. |
| `.claude/skills/33-strategies-frontend-design.md` | Brand guidelines: gold accent, dark theme, DM Sans body, Instrument Serif display. |

---

## 3) Codebase Map

### Primary Components/Modules

| Path | Role | Changes Needed |
|------|------|----------------|
| `frontend/src/pages/SharePage.tsx` | Viewer entry point | Add preference provider, onboarding intercept |
| `frontend/src/components/ChatInterface.tsx` | Chat container | Replace auto-scroll with jump indicator |
| `frontend/src/components/ChatMessage.tsx` | Message rendering | Apply preference-based styling |
| NEW: `frontend/src/components/viewer-prefs/ViewerPreferencesOnboarding.tsx` | Preference collection Stories | Create new component |
| NEW: `frontend/src/components/viewer-prefs/ViewerPreferencesProvider.tsx` | Context provider for prefs | Create new component |
| NEW: `frontend/src/components/ChatExpandButton.tsx` | "Expand on that" button | Create new component |

### Shared Dependencies
- **State:** React Context for preferences (new ViewerPreferencesContext)
- **Storage:** localStorage with safe fallback (extend existing pattern)
- **Styling:** CSS custom properties (existing globals.css system)
- **Animation:** Framer Motion (already installed)

### Data Flow

```
Viewer accesses share link
       |
       v
Check localStorage('viewer_prefs')
       |
  [not set] --> Show ViewerPreferencesOnboarding
       |
       v
User configures: Depth -> Font -> Color
       |
       v
Preferences saved to localStorage
       |
       v
ViewerPreferencesProvider applies CSS variables
       |
       v
ChatInterface/ChatMessage respect preferences
```

### Potential Blast Radius

**SAFE to modify:**
- `frontend/src/pages/SharePage.tsx` (add context provider)
- `frontend/src/components/ChatInterface.tsx` (scroll behavior)
- `frontend/src/components/ChatMessage.tsx` (styling)

**LOW RISK:**
- New components in `frontend/src/components/viewer-prefs/`
- New CSS variables in `globals.css`

**NO IMPACT:**
- Creator dashboard, document upload, agent configuration
- Testing Dojo (separate chat implementation)

---

## 4) Root Cause Analysis

### Auto-Scroll Issue

**Repro steps:**
1. Access a share link, start conversation
2. Ask a long question that triggers a multi-paragraph response
3. While AI is streaming (typing), try to scroll up to re-read earlier content
4. Observe: viewport snaps back to bottom

**Observed vs Expected:**
- **Observed:** `scrollIntoView` fires on every `streamingContent` state change (dozens of times per second)
- **Expected:** User should be able to read at their own pace; system should indicate new content is available below

**Evidence:**
```typescript
// ChatInterface.tsx:27-30
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages, streamingContent])  // <-- Fires constantly during streaming
```

**Root cause:** The auto-scroll effect has no user-intent detection. It scrolls regardless of whether the user manually scrolled away.

**Solution:** Implement intersection observer pattern to detect if user is at bottom. Only auto-scroll if:
1. User was already at bottom when new content arrived, OR
2. User just sent a message (explicit intent to see response)

---

## 5) Research

### A. Typography Best Practices for Readability

| Factor | Optimal Value | Current State | Action |
|--------|--------------|---------------|--------|
| Line height | 1.5-1.6 (150-160%) | Not explicitly set | Add `leading-relaxed` (1.625) |
| Line length | 50-75 characters | Max-width 80% of container | Reduce to ~66ch |
| Letter spacing | Font defaults or +0.02em for body | Not set | Use font defaults, slight positive for small text |
| Font size | 16-18px minimum for body | Uses Tailwind defaults | Confirm 16px base |

### B. Font Recommendations

#### Serif Fonts (3 options)
| Font | Why It's Readable | Google Fonts |
|------|-------------------|--------------|
| **Merriweather** | Large x-height, generous spacing, designed for screens | Yes |
| **Lora** | Calligraphy-inspired with excellent screen rendering | Yes |
| **Source Serif 4** | Adobe's open-source, optimized for long-form reading | Yes |

#### Sans-Serif Fonts (3 options)
| Font | Why It's Readable | Google Fonts | Current? |
|------|-------------------|--------------|----------|
| **Inter** | Industry standard, massive glyph set, variable weight | Yes | No |
| **DM Sans** | Geometric but warm, great at small sizes | Yes | **Current** |
| **Atkinson Hyperlegible** | Designed for visually impaired, extremely clear | Yes | No |

**Recommendation:** Offer 6 font options:
- **Serif:** Merriweather, Lora, Source Serif 4
- **Sans-serif:** DM Sans (current), Inter, Atkinson Hyperlegible

### C. Color Scheme Recommendations

**Current analysis:** Gold (#d4a54a) on dark (#0a0a0f) has excellent contrast (7:1+) but warm tones can cause fatigue for long reading sessions.

#### 5 Theme Options

| Theme | Text Color | Background | Accent | Vibe |
|-------|------------|------------|--------|------|
| **33 Strategies (Default)** | #f5f5f5 | #0a0a0f | #d4a54a | Premium dark, warm gold |
| **Nord** | #e5e9f0 | #2e3440 | #88c0d0 | Cool blue-gray, technical |
| **Warm Reading** | #e8dcc8 | #2a2218 | #d4a54a | Sepia-tinted, paper-like |
| **High Contrast** | #ffffff | #000000 | #facc15 | Maximum clarity, accessibility-first |
| **Soft Charcoal** | #e0e0e0 | #1a1a1a | #8b5cf6 | Softer dark, purple accent |

**Implementation:** CSS custom properties make theme switching trivial. User selection updates `:root` variables.

### D. Progressive Disclosure Pattern

**Industry examples:**
- **Claude Desktop:** No explicit expand button, but uses markdown disclosure elements
- **ChatGPT:** Advanced options collapsed by default, no per-response expansion
- **Perplexity:** "Related questions" as follow-up prompts (similar concept)

**Proposed implementation:**
1. After each AI response, show subtle "Expand on that" button
2. Button sends special prompt: `[EXPANSION REQUEST] Please elaborate on your previous response with more context and detail.`
3. Expansion response is appended (not replaced), visually distinguished
4. Button disabled after one use per response (prevents infinite expansion)

**Technical approach:**
- Track `expandedMessageIds` in state
- Button conditionally rendered based on message role and expansion state
- Backend receives expansion as normal message but with context hint

### E. Smart Scroll Pattern (Claude Desktop Style)

**Target behavior:**
1. During streaming, check if user is within 100px of bottom
2. If at bottom: auto-scroll to keep pace with streaming
3. If scrolled away: show floating "Jump to latest" indicator
4. Clicking indicator scrolls to bottom and dismisses it
5. Indicator auto-dismisses when streaming completes AND user reaches bottom

**Implementation using Intersection Observer:**
```tsx
// Create sentinel element at bottom
<div ref={scrollSentinelRef} className="h-px" />

// Watch visibility
const [isAtBottom, setIsAtBottom] = useState(true)
useEffect(() => {
  const observer = new IntersectionObserver(
    ([entry]) => setIsAtBottom(entry.isIntersecting),
    { root: scrollContainerRef.current, threshold: 1.0 }
  )
  observer.observe(scrollSentinelRef.current)
  return () => observer.disconnect()
}, [])

// Only auto-scroll if user is at bottom
useEffect(() => {
  if (isAtBottom) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
}, [streamingContent, isAtBottom])
```

---

## 6) Clarification

### Q1: Preference Persistence Scope
Where should viewer preferences be stored?

**Options:**
- **A) localStorage only (MVP)** - Per-device, no backend changes
- **B) Server-side with viewer identity** - Requires email capture, persists across devices
- **C) URL parameters** - Shareable preference links, but cluttered URLs

**Recommendation:** Option A for MVP. Server persistence can be Phase 2 after email collection flow is refined.
>> local storage only, but one thing I do think we ought to add to the scope is also using "save your reading preferences" as another hook for getting the viewer to actually create an account whenever they exit the page or go to end the session, so we should also create a new table somewhere for each user that is basically something that tries to capture their recipient/receiver preferences as far as how they like to consume information. It's fine if it's empty for existing users, maybe we just have a pop-up prompt for people who haven't set it up, that appears at the beginning of each of their sessions until they've configured their standard preferences.

---

### Q2: Onboarding Flow Integration
When should the preference onboarding appear?

**Options:**
- **A) Before access gate** - User sets preferences, then enters password
- **B) After access granted, before chat** - Seamless but adds friction to first message
- **C) Optional via settings icon** - Zero friction, but most users won't discover it

**Recommendation:** Option B - After access is granted, show preferences once. Include "Skip" option. Add settings icon for later access.
>> option B

---

### Q3: Depth Preference Language
How should we describe the depth options?

**Options:**
- **A) "Concise" vs "Detailed"** - Simple, familiar
- **B) "Executive Summary" vs "Full Context"** - Business-oriented
- **C) "Quick bites" vs "Deep dives"** - Casual, friendly
- **D) Show examples directly** - Let the sample response speak for itself

**Recommendation:** Option D combined with A. Show the sample response changing as user selects, with labels "Concise" and "Detailed".
>>  option D sounds good, but let's create three levels of standard depth so that there's something between quick bites and deep dives

---

### Q4: Font Preview Behavior
Should fonts change immediately on selection or require confirmation?

**Options:**
- **A) Live preview (immediate change)** - More interactive
- **B) Preview pane only, confirm to apply** - Safer, less visual jarring
- **C) Apply on "Next" button** - Clear step progression

**Recommendation:** Option A - Live preview is more engaging and matches the "see it as you configure" vision. The fake response updates immediately.
>> option a for sure

---

### Q5: Expansion Button Location
Where should "Expand on that" appear?

**Options:**
- **A) Inline at bottom of AI message** - Most discoverable
- **B) Floating action in corner of message bubble** - Subtle, less intrusive
- **C) In message hover menu** - Clean, but hidden on mobile

**Recommendation:** Option A - Inline at bottom, styled subtly but clearly visible. Mobile-friendly.
>> option A

---

### Q6: Jump Indicator Style
What should the "jump to bottom" indicator look like?

**Options:**
- **A) Floating pill with arrow + unread count** - Claude style
- **B) Simple down arrow icon in corner** - Minimal
- **C) Toast notification style** - More attention-grabbing

**Recommendation:** Option A - Floating pill provides clear affordance and the count creates urgency/awareness.
>> option a. And let's give it a slight background glow and maybe even some slight "breathing animation" to give it the feeling of "life" that helps the user recognize its purpose and actionability. these things should be subtle though, lets be tasteful

---

## 7) Proposed Implementation Approach

### Component Structure

```
frontend/src/components/
  viewer-prefs/
    ViewerPreferencesProvider.tsx   # Context provider, CSS variable applicator
    ViewerPreferencesOnboarding.tsx # Stories-style preference collection
    PreferenceStep.tsx              # Individual step component
    PreviewResponse.tsx             # Fake AI response that updates live
    useViewerPreferences.ts         # Hook for accessing/updating prefs
    viewerPrefsConfig.ts            # Font options, color themes, depth levels

  chat/
    ChatExpandButton.tsx            # "Expand on that" button
    JumpToBottomIndicator.tsx       # Floating scroll indicator
```

### Preference Data Model

```typescript
interface ViewerPreferences {
  depth: 'concise' | 'detailed'
  fontFamily: 'dm-sans' | 'inter' | 'atkinson' | 'merriweather' | 'lora' | 'source-serif'
  theme: 'default' | 'nord' | 'warm-reading' | 'high-contrast' | 'soft-charcoal'
  onboardingComplete: boolean
}

const DEFAULT_PREFS: ViewerPreferences = {
  depth: 'concise',
  fontFamily: 'dm-sans',
  theme: 'default',
  onboardingComplete: false
}
```

### Onboarding Flow (3 Steps)

| Step | Question | Options | Preview Update |
|------|----------|---------|----------------|
| 1 | "How much detail do you prefer?" | Concise / Detailed | Sample response changes length |
| 2 | "Choose your reading style" | 6 font options | Sample response changes font |
| 3 | "Pick a color scheme" | 5 theme options | Entire preview pane changes colors |

### Sample Response Content

```typescript
const SAMPLE_RESPONSES = {
  concise: {
    user: "What are the key financial projections?",
    assistant: "Revenue is projected to grow 3x by 2026, reaching $15M ARR. Key drivers include enterprise expansion and product-led growth."
  },
  detailed: {
    user: "What are the key financial projections?",
    assistant: `Our financial model projects significant growth across three time horizons:

**Year 1 (2024):** $3.5M ARR with focus on SMB customers
- 500 paying customers at $7K ACV
- 85% gross margins from SaaS model

**Year 2 (2025):** $8M ARR via enterprise expansion
- Average deal size increases to $25K
- Sales team scales from 5 to 15 reps

**Year 3 (2026):** $15M ARR with product-led growth
- Self-serve tier drives 40% of new revenue
- International expansion begins

The projections assume 15% monthly churn reduction through improved onboarding.`
  }
}
```

### Theme CSS Variables

```css
/* Theme: Nord */
[data-theme="nord"] {
  --color-bg: 220 16% 22%;          /* #2e3440 */
  --color-bg-elevated: 222 16% 28%; /* #3b4252 */
  --color-text: 218 27% 94%;        /* #e5e9f0 */
  --color-accent: 193 43% 67%;      /* #88c0d0 */
}

/* Theme: Warm Reading */
[data-theme="warm-reading"] {
  --color-bg: 30 20% 13%;           /* #2a2218 */
  --color-bg-elevated: 30 18% 18%;
  --color-text: 35 30% 85%;         /* #e8dcc8 */
  --color-accent: 41 57% 54%;       /* Keep gold */
}
```

### Smart Scroll Implementation

```tsx
// ChatInterface.tsx - Key changes

const [isAtBottom, setIsAtBottom] = useState(true)
const [showJumpIndicator, setShowJumpIndicator] = useState(false)
const scrollContainerRef = useRef<HTMLDivElement>(null)
const scrollSentinelRef = useRef<HTMLDivElement>(null)

// Intersection Observer for bottom detection
useEffect(() => {
  const sentinel = scrollSentinelRef.current
  const container = scrollContainerRef.current
  if (!sentinel || !container) return

  const observer = new IntersectionObserver(
    ([entry]) => {
      setIsAtBottom(entry.isIntersecting)
      if (entry.isIntersecting) {
        setShowJumpIndicator(false)
      }
    },
    { root: container, threshold: 0.1 }
  )

  observer.observe(sentinel)
  return () => observer.disconnect()
}, [])

// Show indicator when streaming and not at bottom
useEffect(() => {
  if (isStreaming && !isAtBottom) {
    setShowJumpIndicator(true)
  }
}, [isStreaming, isAtBottom, streamingContent])

// Only auto-scroll when appropriate
useEffect(() => {
  if (isAtBottom) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
}, [messages, streamingContent, isAtBottom])
```

### Expansion Button Integration

```tsx
// ChatMessage.tsx additions

interface ChatMessageProps {
  // ... existing props
  messageId: string
  isExpanded?: boolean
  onExpand?: (messageId: string) => void
}

// After message content:
{role === 'assistant' && !isExpanded && onExpand && (
  <ChatExpandButton
    onClick={() => onExpand(messageId)}
    label="Expand on that"
  />
)}
```

---

## 8) Technical Specifications

### New Files

```typescript
// useViewerPreferences.ts
export function useViewerPreferences() {
  // Returns { prefs, updatePref, resetPrefs }
  // Uses localStorage with safe fallback
}

// ViewerPreferencesProvider.tsx
export function ViewerPreferencesProvider({ children }: Props) {
  // Reads prefs from hook
  // Applies CSS variables to document root
  // Provides context to children
}

// JumpToBottomIndicator.tsx
interface JumpIndicatorProps {
  unreadCount?: number
  onClick: () => void
  visible: boolean
}
```

### API Changes

None required for MVP. The "Expand on that" prompt is sent as a normal chat message with contextual hint.

Backend receives:
```json
{
  "message": "Please elaborate on your previous response with more context and detail."
}
```

The conversation history provides enough context for the AI to understand what to expand on.

### Google Fonts Addition

```html
<!-- Add to index.html or globals.css -->
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Merriweather:wght@400;700&family=Lora:wght@400;600&family=Source+Serif+4:wght@400;600&family=Atkinson+Hyperlegible:wght@400;700&display=swap');
```

---

## 9) Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Font loading performance | Medium | Low | Use `font-display: swap`, preconnect to Google Fonts |
| Theme flashing on load | Medium | Medium | Load prefs synchronously before React hydration, or use CSS `:has()` |
| Expansion prompt confusion | Low | Low | Clear UI indication that this generates a follow-up, not edit |
| Jump indicator annoying | Low | Medium | Auto-hide after streaming completes, smooth transitions |
| Preference onboarding fatigue | Medium | Medium | Keep to 3 steps max, clear skip option, remember completion |

---

## 10) Success Criteria

1. **Readability improvement measurable** - User testing shows reduced eye strain, faster comprehension
2. **Preference onboarding < 30 seconds** - 3 taps + done, or skip anytime
3. **Scroll control restored** - User can read at own pace during streaming
4. **Jump indicator intuitive** - Users understand immediately, no explanation needed
5. **Expansion discoverable** - 50%+ of users try "Expand on that" at least once
6. **Theme changes instant** - No flicker, no reload, CSS-only switching

---

## 11) Implementation Phases

### Phase 1: Smart Scroll (Highest Impact, Lowest Risk)
- Replace auto-scroll with intersection observer pattern
- Add JumpToBottomIndicator component
- Test on mobile and desktop

### Phase 2: Viewer Preferences Infrastructure
- Create ViewerPreferencesProvider and hook
- Implement localStorage persistence
- Add CSS variable theme system

### Phase 3: Preference Onboarding
- Build ViewerPreferencesOnboarding using Stories pattern
- Create sample response preview component
- Integrate into SharePage after access

### Phase 4: Progressive Disclosure
- Add ChatExpandButton component
- Track expansion state per message
- Backend prompt handling (simple message)

### Phase 5: Polish & Typography
- Add Google Fonts for new options
- Fine-tune line height, letter spacing
- Test accessibility (screen readers, reduced motion)

---

## Appendix: Design Mockups

### Preference Onboarding - Step 1 (Depth)

```
┌──────────────────────────────────────────────────┐
│  [====○    ]  Progress: 1/3                      │
│                                                  │
│       How much detail do you prefer?             │
│                                                  │
│   ┌─────────────────────────────────────────┐   │
│   │ User: What are the key projections?     │   │
│   │                                         │   │
│   │ AI: [Sample response that changes       │   │
│   │      based on selection below]          │   │
│   └─────────────────────────────────────────┘   │
│                                                  │
│       ┌───────────┐    ┌───────────┐           │
│       │  Concise  │    │  Detailed │           │
│       └───────────┘    └───────────┘           │
│                                                  │
│                   [Skip]                         │
└──────────────────────────────────────────────────┘
```

### Jump to Bottom Indicator

```
┌────────────────────────────────────────┐
│  [Chat messages scrolled up...]        │
│                                        │
│                                        │
│              ┌─────────────────────┐   │
│              │  ↓  2 new messages  │   │  <- Floating pill
│              └─────────────────────┘   │
├────────────────────────────────────────┤
│  [Input field]                   [→]   │
└────────────────────────────────────────┘
```

### Expand Button Location

```
┌────────────────────────────────────────┐
│ AI: Revenue is projected to grow 3x   │
│     by 2026, reaching $15M ARR.       │
│                                        │
│            [↓ Expand on that]          │  <- Subtle button
└────────────────────────────────────────┘
```

---

*Ready for clarification responses and spec creation.*
