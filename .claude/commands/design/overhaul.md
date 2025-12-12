Overhaul the design of $ARGUMENTS to match the 33 Strategies brand.

## Process

1. **Read the design system** at `.claude/skills/33-strategies-frontend-design.md`

2. **Audit the target** - explore the current implementation:
   - Identify all colors being used (hex codes, Tailwind classes)
   - Identify fonts and typography patterns
   - Identify component patterns (cards, buttons, inputs, modals)
   - Identify animation usage

3. **Create a change plan** listing specific changes needed:
   - Typography changes (fonts to replace, weights, sizes)
   - Color changes (specific hex codes to update)
   - Component patterns to refactor (cards → glass cards, etc.)
   - Animation additions (Framer Motion reveals, etc.)
   - Background treatments (atmospheric glows, depth layers)

4. **Present the plan and WAIT for approval** - DO NOT code yet

5. **After approval**, implement changes incrementally:
   - Start with foundational changes (CSS variables, fonts, colors)
   - Then update components one at a time
   - Pause after each major change for review if needed

6. **Summarize all changes** when complete

---

## 33 Strategies Design Quick Reference

### Fonts
- Display/Headlines: `Instrument Serif` (headlines, stats, "33")
- Body/UI: `DM Sans` (paragraphs, buttons, forms)
- Mono/Labels: `JetBrains Mono` (section markers, code, uppercase labels)

### Core Colors
- Background: `#0a0a0f` (dark with subtle blue undertone)
- Elevated: `#0d0d14`
- Card: `rgba(255,255,255,0.03)`
- Text: `#f5f5f5` / `#888888` / `#555555`
- Gold accent: `#d4a54a`
- Gold glow: `rgba(212,165,74,0.3)`
- Border: `rgba(255,255,255,0.08)`
- Green: `#4ade80` | Blue: `#60a5fa` | Purple: `#a78bfa`

### Key Patterns
- Section labels: `01 — TITLE` (gold, uppercase, tracked mono)
- Headlines: Plain text with gold key phrase
- Cards: Glass effect with backdrop-blur, subtle border
- Motion: Fade up on scroll, 0.5s, staggered delays

### Rules
- NO emojis in visualizations - use geometric SVG shapes
- NO purple gradients, Inter font, or generic AI aesthetics
- Use Framer Motion for animations
- Luxury editorial meets technical precision
