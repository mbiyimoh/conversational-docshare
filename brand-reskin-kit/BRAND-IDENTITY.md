# 33 Strategies Brand Identity Guide

Complete reference for implementing the 33 Strategies visual identity in web applications.

---

## Design Philosophy

**Luxury editorial meets technical precision.** The 33 Strategies brand conveys sophisticated strategy consulting through:
- Dark, cinematic backgrounds
- Gold accents for emphasis
- Refined typography hierarchy
- Subtle glass effects and animations
- Zero visual clutter or "AI slop" aesthetics

---

## Typography System

### Font Stack

| Role | Font | Weight | Use Case |
|------|------|--------|----------|
| Display | Instrument Serif | 400 | Headlines, hero text, key statistics |
| Body | DM Sans | 400, 500, 600 | Paragraphs, UI text, buttons, forms |
| Mono | JetBrains Mono | 400, 500 | Section labels, code, technical markers |

### Installation

```html
<!-- Add to index.html <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
}
```

### Typography Scale

```css
/* Headlines - Instrument Serif */
.headline-xl { font-size: 3.5rem; line-height: 1.1; }  /* 56px */
.headline-lg { font-size: 2.5rem; line-height: 1.15; } /* 40px */
.headline-md { font-size: 1.875rem; line-height: 1.2; } /* 30px */
.headline-sm { font-size: 1.5rem; line-height: 1.25; } /* 24px */

/* Body - DM Sans */
.body-lg { font-size: 1.125rem; line-height: 1.7; }   /* 18px */
.body-md { font-size: 1rem; line-height: 1.6; }       /* 16px */
.body-sm { font-size: 0.875rem; line-height: 1.5; }   /* 14px */

/* Labels - JetBrains Mono */
.label {
  font-size: 0.75rem;      /* 12px */
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
```

---

## Color System

### Core Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0f;           /* Main background - dark with blue undertone */
  --bg-elevated: #111116;          /* Cards, modals */
  --bg-surface: rgba(255,255,255,0.03); /* Glass effect base */

  /* Text */
  --text-primary: #f5f5f5;         /* Headlines, primary content */
  --text-secondary: #888888;       /* Body text, descriptions */
  --text-tertiary: #555555;        /* Disabled, placeholders */

  /* Accent */
  --accent-gold: #d4a54a;          /* Primary accent - CTAs, highlights */
  --accent-gold-hover: #e5b85b;    /* Gold hover state */
  --accent-gold-muted: rgba(212, 165, 74, 0.15); /* Gold backgrounds */

  /* Borders */
  --border-subtle: rgba(255,255,255,0.08);
  --border-default: rgba(255,255,255,0.12);
  --border-strong: rgba(255,255,255,0.2);

  /* Semantic */
  --success: #4ade80;
  --warning: #fbbf24;
  --error: #ef4444;
  --info: #60a5fa;
}
```

### Tailwind Color Extensions

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0a0a0f',
          elevated: '#111116',
          gold: '#d4a54a',
          'gold-hover': '#e5b85b',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.03)',
          hover: 'rgba(255,255,255,0.06)',
        },
      },
      borderColor: {
        subtle: 'rgba(255,255,255,0.08)',
        default: 'rgba(255,255,255,0.12)',
      },
    },
  },
}
```

---

## Component Patterns

### Section Label

Format: `XX — TITLE` (number, em-dash, uppercase title)

```tsx
interface SectionLabelProps {
  number: string;
  title: string;
}

function SectionLabel({ number, title }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="font-mono text-xs tracking-[0.2em] text-[#d4a54a]">
        {number}
      </span>
      <span className="text-[#d4a54a]/30">—</span>
      <span className="font-mono text-xs tracking-[0.2em] uppercase text-[#d4a54a]">
        {title}
      </span>
    </div>
  );
}

// Usage: <SectionLabel number="01" title="Overview" />
```

### Headline with Accent

Plain text with gold key phrase.

```tsx
interface AccentHeadlineProps {
  before: string;
  accent: string;
  after?: string;
}

function AccentHeadline({ before, accent, after }: AccentHeadlineProps) {
  return (
    <h2 className="font-serif text-4xl text-[#f5f5f5]">
      {before}
      <span className="text-[#d4a54a]">{accent}</span>
      {after}
    </h2>
  );
}

// Usage: <AccentHeadline before="Technology is plateauing. " accent="Value creation is just starting." />
```

### Glass Card

```tsx
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

function GlassCard({ children, className = '', glow = false }: GlassCardProps) {
  return (
    <div
      className={`
        bg-white/[0.03]
        backdrop-blur-sm
        border border-white/[0.08]
        rounded-lg
        ${glow ? 'shadow-[0_0_30px_rgba(212,165,74,0.1)]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
```

### Primary Button

```tsx
function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="
        bg-[#d4a54a] hover:bg-[#e5b85b]
        text-[#0a0a0f] font-medium
        px-6 py-3 rounded-md
        transition-colors duration-200
        font-sans text-sm
      "
      {...props}
    >
      {children}
    </button>
  );
}
```

### Secondary Button

```tsx
function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="
        bg-transparent hover:bg-white/[0.06]
        text-[#f5f5f5] font-medium
        px-6 py-3 rounded-md
        border border-white/[0.12] hover:border-white/[0.2]
        transition-all duration-200
        font-sans text-sm
      "
      {...props}
    >
      {children}
    </button>
  );
}
```

### Stat Display

```tsx
interface StatProps {
  value: string;
  label: string;
}

function Stat({ value, label }: StatProps) {
  return (
    <div className="text-center">
      <div className="font-serif text-5xl text-[#d4a54a] mb-2">
        {value}
      </div>
      <div className="font-mono text-xs tracking-[0.1em] uppercase text-[#888888]">
        {label}
      </div>
    </div>
  );
}
```

### Badge

```tsx
type BadgeVariant = 'gold' | 'default' | 'success' | 'warning';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    gold: 'bg-[#d4a54a]/15 text-[#d4a54a] border-[#d4a54a]/30',
    default: 'bg-white/[0.06] text-[#888888] border-white/[0.12]',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  };

  return (
    <span className={`
      inline-flex items-center
      px-2.5 py-0.5 rounded-full
      text-xs font-medium font-mono uppercase tracking-wider
      border
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
}
```

---

## Animation Patterns

### Dependencies

```bash
npm install framer-motion
```

### Scroll Reveal

```tsx
import { motion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
}

function Reveal({ children, delay = 0 }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

### Staggered Children

```tsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' }
  },
};

function StaggeredList({ items }: { items: React.ReactNode[] }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {items.map((item, i) => (
        <motion.div key={i} variants={itemVariants}>
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Hover Lift

```tsx
import { motion } from 'framer-motion';

function HoverCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white/[0.03] border border-white/[0.08] rounded-lg"
    >
      {children}
    </motion.div>
  );
}
```

### Page Transitions

```tsx
import { motion, AnimatePresence } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
```

---

## Background Patterns

### Gradient Overlay

```css
.brand-gradient {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(212, 165, 74, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(212, 165, 74, 0.05) 0%, transparent 40%),
    #0a0a0f;
}
```

### Noise Texture

```css
.brand-texture {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  mix-blend-mode: overlay;
  pointer-events: none;
}
```

### Grid Pattern

```css
.brand-grid {
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}
```

---

## Form Elements

### Text Input

```tsx
function TextInput({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-2">
      <label className="block font-mono text-xs tracking-[0.1em] uppercase text-[#888888]">
        {label}
      </label>
      <input
        className="
          w-full px-4 py-3
          bg-white/[0.03]
          border border-white/[0.12]
          rounded-md
          text-[#f5f5f5] placeholder:text-[#555555]
          focus:outline-none focus:border-[#d4a54a]/50 focus:ring-1 focus:ring-[#d4a54a]/20
          transition-colors
          font-sans
        "
        {...props}
      />
    </div>
  );
}
```

### Select

```tsx
function Select({ label, options, ...props }: {
  label: string;
  options: { value: string; label: string }[]
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="space-y-2">
      <label className="block font-mono text-xs tracking-[0.1em] uppercase text-[#888888]">
        {label}
      </label>
      <select
        className="
          w-full px-4 py-3
          bg-white/[0.03]
          border border-white/[0.12]
          rounded-md
          text-[#f5f5f5]
          focus:outline-none focus:border-[#d4a54a]/50
          transition-colors
          font-sans
          appearance-none
          cursor-pointer
        "
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-[#111116]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## Layout Patterns

### Page Container

```tsx
function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {children}
      </div>
    </div>
  );
}
```

### Section

```tsx
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`py-16 md:py-24 ${className}`}>
      {children}
    </section>
  );
}
```

### Two-Column Layout

```tsx
function TwoColumn({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}
```

---

## Accessibility

### Focus States

All interactive elements must have visible focus states:

```css
/* Default focus ring for brand */
.focus-brand:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #0a0a0f, 0 0 0 4px #d4a54a;
}
```

### Color Contrast

| Combination | Contrast Ratio | WCAG |
|-------------|----------------|------|
| #f5f5f5 on #0a0a0f | 18.1:1 | AAA |
| #888888 on #0a0a0f | 5.9:1 | AA |
| #d4a54a on #0a0a0f | 7.3:1 | AAA |

### Motion Preferences

```tsx
import { useReducedMotion } from 'framer-motion';

function AnimatedComponent() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      Content
    </motion.div>
  );
}
```

---

## Anti-Patterns

### DO NOT

- Use emojis in visualizations or UI - use geometric SVG shapes instead
- Use Inter, system fonts, or generic sans-serif as primary
- Use purple/blue gradients (generic "AI" aesthetic)
- Use bright/saturated colors for backgrounds
- Use thick borders or heavy shadows
- Add excessive animations or transitions
- Use light mode or white backgrounds

### DO

- Use Instrument Serif for display, DM Sans for body
- Use gold (#d4a54a) as the primary accent
- Keep backgrounds dark (#0a0a0f to #111116)
- Use subtle glass effects (3-6% white opacity)
- Use thin borders (8-12% white opacity)
- Use restrained, purposeful animations
- Maintain generous whitespace

---

## CSS Custom Properties (Full Set)

```css
:root {
  /* Typography */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', Consolas, monospace;

  /* Backgrounds */
  --bg-primary: #0a0a0f;
  --bg-elevated: #111116;
  --bg-surface: rgba(255, 255, 255, 0.03);
  --bg-surface-hover: rgba(255, 255, 255, 0.06);

  /* Text */
  --text-primary: #f5f5f5;
  --text-secondary: #888888;
  --text-tertiary: #555555;

  /* Accent */
  --accent-gold: #d4a54a;
  --accent-gold-hover: #e5b85b;
  --accent-gold-muted: rgba(212, 165, 74, 0.15);
  --accent-gold-glow: rgba(212, 165, 74, 0.1);

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);

  /* Semantic */
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-error: #ef4444;
  --color-info: #60a5fa;

  /* Spacing */
  --section-gap: 6rem;
  --content-gap: 1.5rem;

  /* Borders */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-default: 200ms ease;
  --transition-slow: 300ms ease;
}
```
