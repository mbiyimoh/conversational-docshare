# 33 Strategies Brand Reskin Kit

A portable package for applying the 33 Strategies brand identity to any web application.

## Quick Start

Copy this entire `brand-reskin-kit/` folder to your target project, then prompt your AI assistant:

> "Go look in `brand-reskin-kit/` and use what you find there to reskin this application with the 33 Strategies brand identity."

## What's Included

| File | Purpose |
|------|---------|
| `BRAND-IDENTITY.md` | Complete brand guide: typography, colors, components, patterns |
| `OVERHAUL-SPEC-TEMPLATE.md` | Implementation spec template - adapt to your project |
| `EXECUTION-CHECKLIST.md` | Step-by-step checklist for systematic overhaul |
| `design-overhaul.md` | Slash command definition (copy to `.claude/commands/`) |

## Usage Workflow

### 1. Copy the Kit
```bash
cp -r brand-reskin-kit/ /path/to/target-project/
```

### 2. Install the Slash Command (Optional)
```bash
mkdir -p /path/to/target-project/.claude/commands/design
cp brand-reskin-kit/design-overhaul.md /path/to/target-project/.claude/commands/design/overhaul.md
```

Then use `/design:overhaul <component-or-page>` for guided reskinning.

### 3. Adapt the Spec Template
Open `OVERHAUL-SPEC-TEMPLATE.md` and fill in your project-specific details:
- List your pages and components
- Identify your current styling approach
- Note any framework-specific considerations

### 4. Execute Systematically
Use `EXECUTION-CHECKLIST.md` to track progress through the overhaul phases.

## Brand Quick Reference

### Typography
- **Display/Headlines:** Instrument Serif (Google Fonts)
- **Body/UI:** DM Sans (Google Fonts)
- **Mono/Labels:** JetBrains Mono (Google Fonts)

### Core Colors
```css
--background: #0a0a0f;        /* Dark with blue undertone */
--card: rgba(255,255,255,0.03); /* Glass effect base */
--text-primary: #f5f5f5;
--text-secondary: #888888;
--text-tertiary: #555555;
--accent-gold: #d4a54a;       /* Key phrases, CTAs, stats */
--border: rgba(255,255,255,0.08);
```

### Key Patterns
- Section labels: `01 — TITLE` (gold, uppercase, mono, letter-spaced)
- Headlines: Plain text with gold key phrase
- Cards: Glass effect with backdrop-blur, subtle border
- Motion: Framer Motion fade-up on scroll, 0.5s, staggered

### Critical Rules
- NO emojis in visualizations - use geometric SVG shapes
- NO Inter font, purple gradients, or generic "AI slop" aesthetics
- Always dark mode
- Luxury editorial meets technical precision

## Estimated Effort

| Phase | Scope | Typical Duration |
|-------|-------|------------------|
| Foundation | Typography, colors, base styles | 2-4 hours |
| Shared Components | Buttons, cards, inputs | 4-8 hours |
| Pages | Per page reskin | 1-2 hours each |
| Polish | Animations, empty states | 2-4 hours |

## Dependencies to Install

```bash
# Fonts (add to index.html or via @import)
# - Instrument Serif
# - DM Sans
# - JetBrains Mono

# Animation library
npm install framer-motion

# If using Tailwind, extend config (see BRAND-IDENTITY.md)
```

## Questions?

The brand identity document contains comprehensive guidance for edge cases, accessibility considerations, and component-specific patterns.
