# 33 Strategies Design Overhaul Command

**Usage:** `/design:overhaul <component-or-page>`

**Description:** Apply the 33 Strategies brand identity to a specific component or page.

---

## Instructions for AI Assistant

You are reskinning `$ARGUMENTS` to match the 33 Strategies brand identity.

### Step 1: Read the Brand Guide

First, read `brand-reskin-kit/BRAND-IDENTITY.md` to understand the complete design system.

### Step 2: Analyze Current State

Read the current implementation of `$ARGUMENTS`:
- Identify the file path(s)
- Note current styling approach (Tailwind, CSS, styled-components, etc.)
- List all visual elements that need updating

### Step 3: Apply Brand Patterns

Transform the component/page following these rules:

**Typography:**
- Headlines/display text → `font-serif` (Instrument Serif)
- Body/UI text → `font-sans` (DM Sans)
- Labels/technical text → `font-mono` (JetBrains Mono)

**Colors:**
- Background → `#0a0a0f` or `bg-brand-bg`
- Text → `#f5f5f5` / `#888888` / `#555555`
- Accent → `#d4a54a` for CTAs, highlights, key phrases
- Borders → `rgba(255,255,255,0.08)`

**Components:**
- Cards → Glass effect: `bg-white/[0.03] backdrop-blur-sm border border-white/[0.08]`
- Section headers → Add label: `01 — TITLE` format
- Headlines with emphasis → Plain text + gold key phrase

**Spacing:**
- Section gaps: `py-16` or `py-24`
- Content gaps: `gap-6` or `gap-8`
- Generous whitespace

### Step 4: Add Animations (if appropriate)

For visible content sections, add scroll reveal:

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true }}
  transition={{ duration: 0.5 }}
>
  {/* content */}
</motion.div>
```

### Step 5: Verify Changes

After making changes:
1. Ensure no TypeScript/build errors
2. Check responsive behavior
3. Verify dark theme consistency
4. Confirm all interactive states (hover, focus)

### Step 6: Report

Summarize what was changed:
- Files modified
- Key visual changes
- Any issues encountered
- Suggested follow-up improvements

---

## Anti-Patterns to Avoid

- NO emojis in UI - use geometric SVG shapes
- NO Inter font or system fonts for display
- NO purple/blue gradients
- NO white/light backgrounds
- NO thick borders or heavy shadows
- NO excessive animations

---

## Quick Reference

```css
/* Core colors */
--background: #0a0a0f;
--text: #f5f5f5;
--gold: #d4a54a;
--border: rgba(255,255,255,0.08);

/* Glass card */
.glass {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.08);
}

/* Section label */
.label {
  font-family: 'JetBrains Mono';
  font-size: 0.75rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #d4a54a;
}
```
