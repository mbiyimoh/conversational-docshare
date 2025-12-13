# Landing Page Hero Copy

**Slug:** landing-page-hero-copy
**Author:** Claude Code
**Date:** 2025-12-13
**Related:** 33 Strategies brand guidelines

---

## 1) Intent & Assumptions

**Task brief:** Add a hero section to the landing page with "Conversational DocShare" header, "BY 33 STRATEGIES" sub-header, a punchy problem-acknowledging tagline, and concise bullet points explaining the AI agent value proposition.

**Assumptions:**
- Landing page is currently the LoginPage at "/" route
- Hero section should appear above the login form
- Must follow 33 Strategies design system (luxury editorial, dark theme, gold accents)
- Copy should be miserly with words but impactful

**Out of scope:**
- Full marketing website with multiple sections
- Detailed feature explanations
- Pricing information
- Testimonials or social proof

---

## 2) Pre-reading Log

- `frontend/src/App.tsx`: Root route "/" renders LoginPage
- `frontend/src/pages/LoginPage.tsx`: Current landing experience - centered login card with atmospheric glows
- `.claude/skills/33-strategies-frontend-design.md`: Full brand guidelines - Instrument Serif for headlines, JetBrains Mono for labels, gold accent #d4a54a
- `frontend/src/components/ui/`: Available components include AccentText, SectionLabel, RevealText, GlowPulse, Card

---

## 3) Codebase Map

**Primary components/modules:**
- `pages/LoginPage.tsx` - Will be modified to include hero section
- `components/ui/accent-text.tsx` - Gold accent wrapper
- `components/ui/section-label.tsx` - "01 — TITLE" format labels
- `components/ui/reveal-text.tsx` - Scroll-triggered animations

**Shared dependencies:**
- Tailwind CSS with custom theme colors
- Framer Motion for animations
- Google Fonts (Instrument Serif, DM Sans, JetBrains Mono)

**Data flow:** Static content, no data fetching required

**Potential blast radius:** LoginPage only - isolated change

---

## 4) Root Cause Analysis

N/A - This is a new feature, not a bug fix.

---

## 5) Research Findings

### Headline Patterns

**Problem-first formulas work best for B2B:**
- Acknowledge the pain before presenting solution
- Worth 70% of page value according to copywriting research
- Creates immediate emotional connection

### AI Agent Positioning

- Frame as "extension of you" not replacement
- "Force multiplier" language resonates with founders
- Emphasize expertise delivery, not automation

### Luxury Tone Markers

- Minimalist word choice
- Sensory language ("refined", "thoughtful")
- Invitation CTAs vs. pushy commands
- Confident declarations, not superlatives

### Proposed Copy Options

**Option A: Direct Problem Acknowledgment**
> "Let's be honest: nobody reads your documents."

**Option B: Softer Problem Framing**
> "Your documents deserve better than being skimmed."

**Option C: Question Format**
> "What if your documents could speak for you?"

### Bullet Point Approaches

**Benefit-led, active voice:**
- Train an AI that communicates like you
- Deliver documents through conversation
- Guide recipients to exactly what they need

---

## 6) Clarifications Needed

1. **Tagline tone:** Prefer the direct "Let's be honest: nobody reads..." or softer "Your documents deserve better"?

2. **Bullet count:** 3 tight bullets or 4 with slightly more detail?

3. **CTA language:** Keep simple "Sign in" or add "Get Started" for new users?

4. **Sub-header styling:** "BY 33 STRATEGIES" in gold accent or muted gray?

---

## 7) Proposed Copy

### Header Block
```
CONVERSATIONAL DOCSHARE
by 33 Strategies
```

### Tagline (Option A - Recommended)
```
Let's be honest: nobody reads the documents you send them.

Now they don't have to.
```

### Value Bullets
```
- Train an AI agent that represents you
- Deliver documents through conversation, not attachments
- Recipients explore by asking questions, not scrolling
```

### Alternative Tagline (Option B)
```
Your expertise, delivered conversationally.

An AI agent trained to represent you guides recipients
through your documents—so they engage instead of skim.
```

---

## 8) Implementation Approach

1. Create `LandingHero` component with:
   - Large "Conversational DocShare" headline (Instrument Serif)
   - Small "by 33 Strategies" sub-header (JetBrains Mono, muted)
   - Tagline with gold accent on key phrase
   - 3 bullet points with subtle left border accent

2. Modify `LoginPage.tsx`:
   - Split into two-column layout on desktop
   - Hero on left, login card on right
   - Stack vertically on mobile

3. Use existing UI components:
   - `AccentText` for gold highlights
   - `RevealText` for scroll animations
   - `GlowPulse` for atmospheric background

---

## 9) Visual Concept

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │                         │  │                         │  │
│  │  CONVERSATIONAL         │  │      ┌──────────┐       │  │
│  │  DOCSHARE               │  │      │  Sign in │       │  │
│  │  by 33 Strategies       │  │      ├──────────┤       │  │
│  │                         │  │      │  Email   │       │  │
│  │  Let's be honest:       │  │      ├──────────┤       │  │
│  │  nobody reads the       │  │      │ Password │       │  │
│  │  documents you send.    │  │      ├──────────┤       │  │
│  │                         │  │      │ [Submit] │       │  │
│  │  Now they don't         │  │      └──────────┘       │  │
│  │  have to.               │  │                         │  │
│  │                         │  │                         │  │
│  │  • Train an AI agent    │  │                         │  │
│  │  • Deliver via chat     │  │                         │  │
│  │  • Recipients explore   │  │                         │  │
│  │                         │  │                         │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
