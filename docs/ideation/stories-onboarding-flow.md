# Stories-Style Onboarding Flow

**Slug:** stories-onboarding-flow
**Author:** Claude Code
**Date:** 2025-12-13
**Branch:** preflight/stories-onboarding-flow
**Related:** Pattern doc provided by user (Instagram Stories-Like Experience Pattern)

---

## 1) Intent & Assumptions

- **Task brief:** Create a 3-5 slide Instagram Stories-style onboarding experience for new users immediately after signup. The flow explains the mental model of the product: creators upload documents, configure an AI agent via interview, share links, and viewers chat with AI instead of reading docs. Uses tap-to-navigate, segmented progress bars, animated transitions, and the 33 Strategies premium dark theme.

- **Assumptions:**
  - Onboarding shows once after first registration (not on subsequent logins)
  - User can skip at any time
  - Should complete in under 60 seconds
  - Must work well on both desktop and mobile
  - Will follow existing 33 Strategies design system (gold accent, dark theme)
  - Existing Framer Motion setup can be leveraged
  - No backend changes required (completion state stored client-side)

- **Out of scope:**
  - Interactive product tours (tooltips highlighting UI elements)
  - Onboarding for viewers/recipients (separate flow)
  - Video or audio content in slides
  - Account setup wizard (collecting additional profile info)
  - A/B testing infrastructure for slide variants

---

## 2) Pre-reading Log

| File | Takeaway |
|------|----------|
| `frontend/src/App.tsx` | Simple routing setup. Registration → `/dashboard`. Onboarding intercept point is clear. |
| `frontend/src/pages/RegisterPage.tsx` | After successful registration, navigates to `/dashboard`. Onboarding could intercept here or wrap Dashboard. |
| `frontend/src/pages/DashboardPage.tsx` | Entry point for new users. Could conditionally show onboarding overlay on first visit. |
| `frontend/src/components/ui/glow-pulse.tsx` | Existing atmospheric glow component with Framer Motion. Reusable for onboarding background. |
| `frontend/src/components/ui/accent-text.tsx` | Simple gold accent text wrapper. Use for key phrases. |
| `frontend/src/styles/globals.css` | Full 33 Strategies design tokens defined. Gold: `#d4a54a`, fonts, colors all ready. |
| `frontend/tailwind.config.js` | Design system integrated into Tailwind. Can use `text-accent`, `bg-background`, etc. |
| `frontend/src/hooks/useSpeechRecognition.ts` | Existing hook pattern. Could create `useOnboardingComplete` hook similarly. |
| `README.md` | Product mental model: Creators upload → AI config via interview → Share → Viewers chat with AI. |
| User-provided pattern doc | Complete Stories implementation pattern with code examples for progress bars, tap navigation, animations. |

---

## 3) Codebase Map

### Primary Components/Modules
| Path | Role |
|------|------|
| `frontend/src/pages/RegisterPage.tsx` | Registration form, redirects to dashboard on success |
| `frontend/src/pages/DashboardPage.tsx` | Main entry after login, lists projects |
| `frontend/src/App.tsx` | Route definitions |
| `frontend/src/components/ui/*` | Shared UI components (Button, Card, Modal, GlowPulse, AccentText) |

### Shared Dependencies
- **Theme/Design:** `globals.css` CSS variables, Tailwind config
- **Animations:** Framer Motion (`motion`, `useReducedMotion`)
- **Utils:** `frontend/src/lib/utils.ts` (cn classname helper)
- **Routing:** react-router-dom

### Data Flow (for this feature)
```
Registration Success
       ↓
Check localStorage('onboarding_complete')
       ↓
  [not complete] → Show StoriesOnboarding component
       ↓
  User taps through slides or skips
       ↓
  Set localStorage('onboarding_complete', 'true')
       ↓
  Navigate to Dashboard (or reveal Dashboard if overlay)
```

### Feature Flags/Config
- None currently. Could add `VITE_ENABLE_ONBOARDING` env var if needed.

### Potential Blast Radius
- **Low:** Self-contained component with localStorage persistence
- **Affected files:** `RegisterPage.tsx` or `DashboardPage.tsx` (conditional render)
- **Risk:** None to existing functionality; purely additive feature

---

## 4) Root Cause Analysis

**N/A** — This is a new feature, not a bug fix.

---

## 5) Research

### Research Findings

**Key Insight #1: 3-5 Slides Maximum**
Users abandon onboarding flows after viewing 3-4 items. Research confirms limiting to essential concepts only.

**Key Insight #2: Benefits Over Features**
Most effective onboarding communicates *what users can achieve* rather than *what buttons do*. For our product:
- BAD: "Upload documents in the Documents tab"
- GOOD: "Your documents come alive through conversation"

**Key Insight #3: Familiar Interaction Pattern**
Instagram Stories patterns are now universally understood. Tap right = advance, tap left = back. Segmented progress bars create completion motivation (Zeigarnik Effect).

**Key Insight #4: Accessibility is Non-Negotiable**
- Keyboard navigation (Arrow keys, Tab, Escape to skip)
- `prefers-reduced-motion` must disable animations
- ARIA landmarks and live regions for screen readers
- 44px minimum touch targets

**Key Insight #5: Show Once, Skip Always**
- Persist completion state (localStorage sufficient for MVP)
- Always show skip option (ideally visible from slide 1)
- Provide "Take Tour" option in help menu for re-access

### Potential Solutions

#### Option A: Dedicated Route (`/onboarding`)
**Pros:**
- Clean separation of concerns
- Easy to test independently
- Can redirect away if already completed
- URL shareable for debugging

**Cons:**
- Extra route to manage
- Flash of redirect if checking completion status
- Doesn't feel as seamless

#### Option B: Fullscreen Overlay on Dashboard
**Pros:**
- No route change, seamless flow
- Dashboard loads in background (feels faster)
- Modern "modal takeover" pattern

**Cons:**
- Slightly more complex state management
- Must ensure overlay truly blocks interaction

#### Option C: Post-Registration Intercept Component
**Pros:**
- Cleanest integration point (right after registration)
- Only runs for new users naturally
- Can replace navigation behavior temporarily

**Cons:**
- Login flow needs separate handling if we want to re-show

### Recommendation

**Option B: Fullscreen Overlay on Dashboard** with completion state in localStorage.

**Rationale:**
1. Seamless user experience (no route change flicker)
2. Dashboard preloads while user views onboarding (perceived performance)
3. Matches the "immersive Stories" pattern from the reference doc
4. Simple implementation using existing Modal/overlay patterns
5. Can easily add "Take Tour" help menu item to re-trigger

---

## 6) Clarification

**Questions for the user:**

### Q1: Slide Content Strategy
The product mental model has 4 key concepts:
1. Upload documents
2. Configure AI via interview
3. Share links
4. Viewers chat instead of read

**Options:**
- **A) 4 slides** — One per concept (Upload → Configure → Share → Chat)
- **B) 3 slides** — Condensed (Problem → Solution → Action)
- **C) 5 slides** — Welcome + 4 concepts

**Recommendation:** Option A (4 slides) — Each concept is distinct and deserves focus.

### Q2: Visual Style for Icons
The pattern doc uses simple Unicode symbols (◆, ◎, ◈, →). Should we use:
- **A) Unicode symbols** — Minimal, matches pattern doc
- **B) Custom SVG icons** — Can be more meaningful (document, chat bubble, share, etc.)
- **C) Animated Lottie illustrations** — Most premium feel, more work

**Recommendation:** Option B (Custom SVG icons) — More meaningful for concept communication while staying lightweight.

### Q3: Skip Behavior
When user skips onboarding:
- **A) Skip button always visible** — Most user-friendly
- **B) Skip appears after first slide** — Ensures they see at least intro
- **C) "Tap to skip" text below progress** — Subtle but clear

**Recommendation:** Option A — User autonomy builds trust.

### Q4: Call-to-Action on Final Slide
What should the final action be?
- **A) "Get Started" → Shows Dashboard**
- **B) "Create First Project" → Opens new project modal**
- **C) "Upload Documents" → Goes directly to project + upload**

**Recommendation:** Option A — Lower friction; let them explore first.

### Q5: Re-access Mechanism
Should users be able to re-view onboarding?
- **A) No re-access** — One-time only
- **B) Help menu "Take Tour"** — Optional re-trigger
- **C) Settings toggle** — Reset onboarding state

**Recommendation:** Option B — Useful for users who skipped but later want guidance.

---

## 7) Proposed Implementation Approach

### Component Structure

```
frontend/src/components/
  onboarding/
    StoriesOnboarding.tsx     # Main component
    OnboardingSlide.tsx       # Individual slide
    ProgressBars.tsx          # Segmented progress indicator
    onboardingContent.ts      # Slide content data
    useOnboardingState.ts     # localStorage persistence hook
```

### Integration Point

```tsx
// DashboardPage.tsx
import { StoriesOnboarding } from '../components/onboarding/StoriesOnboarding'
import { useOnboardingState } from '../components/onboarding/useOnboardingState'

export function DashboardPage() {
  const { isComplete, markComplete } = useOnboardingState()

  return (
    <div className="min-h-screen bg-background">
      {!isComplete && (
        <StoriesOnboarding onComplete={markComplete} />
      )}
      {/* Rest of dashboard */}
    </div>
  )
}
```

### Proposed Slide Content (4 slides)

| # | Title | Subtitle | Icon Concept |
|---|-------|----------|--------------|
| 1 | "Share Documents, Not Reading Lists" | "Turn your documents into conversations that your audience actually engages with." | Document → Speech bubble transformation |
| 2 | "Train Your AI in Minutes" | "Answer a few questions. We'll configure an AI that speaks your language and knows your content." | Brain/interview icon |
| 3 | "One Link, Instant Access" | "Share a single link. No logins required. Your audience gets answers immediately." | Share/link icon |
| 4 | "Ready to Transform How You Share?" | "Create your first project and see the magic happen." | Sparkle/magic icon |

### Design Alignment with 33 Strategies

| Element | Pattern Doc | 33 Strategies Mapping |
|---------|-------------|----------------------|
| Background | `#000000` | `bg-background` (`#0a0a0f`) — Close enough, use existing |
| Accent | `#C9A962` | `text-accent` (`#d4a54a`) — Perfect match |
| Text | `#ffffff` | `text-foreground` (`#f5f5f5`) — Already configured |
| Secondary text | `rgba(255,255,255,0.7)` | `text-muted` — Existing |
| Font | SF Pro Display | Use existing `font-display` (Instrument Serif for headlines) |
| Animation | Custom CSS keyframes | Leverage Framer Motion (already installed) |
| Glow effects | Radial gradients | Reuse `<GlowPulse />` component |

### Accessibility Checklist

- [ ] Keyboard navigation (← → to navigate, Escape to skip)
- [ ] `prefers-reduced-motion` check (disable animations)
- [ ] ARIA: `role="dialog"`, `aria-label`, `aria-live` for slide changes
- [ ] Focus management (trap focus in overlay)
- [ ] Skip link visible/accessible
- [ ] Touch targets ≥ 44px

### Estimated Scope

| Task | Complexity |
|------|------------|
| `StoriesOnboarding.tsx` with tap navigation | Medium |
| `ProgressBars.tsx` | Low |
| `OnboardingSlide.tsx` with animations | Medium |
| `useOnboardingState.ts` hook | Low |
| SVG icons (4) | Low-Medium |
| Accessibility implementation | Medium |
| Integration into DashboardPage | Low |
| "Take Tour" help menu item (optional) | Low |

---

## 8) Next Steps

1. **User clarifies** Questions 1-5 in Clarification section
2. **Create spec** with final decisions locked in
3. **Implement** component structure
4. **Test** accessibility and mobile responsiveness
5. **Deploy** behind feature flag if desired

---

## Appendix: Pattern Doc Code Reference

The user-provided pattern document includes complete working code for:
- Tap navigation handler
- Segmented progress bars with glow
- CSS keyframe animations (fadeInUp, iconPulse)
- Staggered content animation with `key` prop pattern
- Design system tokens
- Optional: Particle grid canvas animation
- Optional: Ambient glow orbs

All patterns can be adapted to use existing 33 Strategies design tokens and Framer Motion instead of raw CSS keyframes.
