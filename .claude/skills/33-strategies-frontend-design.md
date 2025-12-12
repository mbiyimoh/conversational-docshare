# 33 Strategies — Frontend Design Skill

Create distinctive, premium interfaces for 33 Strategies products. Use this skill when building any 33 Strategies web component, page, application, or presentation deck. Generates refined, dark-themed interfaces with gold accents that reflect sophisticated AI consulting.

---

## Brand Aesthetic

**Tone:** Luxury editorial meets technical precision. Think high-end consulting, not startup SaaS. Refined, confident, minimal but not sparse. Dark, atmospheric, intentional.

**Avoid:** Generic AI aesthetics (purple gradients, Inter font, rounded pastel cards). No "startup landing page" energy. No visual clutter. No emojis in visualizations.

---

## Typography

### Font Stack
```css
--font-display: "Instrument Serif", Georgia, serif;
--font-body: "DM Sans", -apple-system, sans-serif;
--font-mono: "JetBrains Mono", monospace;
```

### Google Fonts Import
```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap');
```

### Usage Rules
| Role | Font | Usage |
|------|------|-------|
| Display/Headlines | Instrument Serif | Headlines, hero text, numbers/stats, the "33" in brand name |
| Body/UI | DM Sans | Paragraphs, buttons, descriptions, form inputs |
| Technical/Labels | JetBrains Mono | Section markers, tags, code, uppercase labels |

### Type Scale
```jsx
// Hero headlines
className="text-5xl md:text-6xl lg:text-7xl font-display"

// Section headlines  
className="text-3xl md:text-4xl lg:text-5xl font-display"

// Body text
className="text-base md:text-lg font-body"

// Section labels (uppercase, tracked)
className="text-xs font-mono font-medium tracking-[0.2em] uppercase"
```

### Section Marker Format
Always format as: `01 — THE TITLE` (number, em-dash, uppercase title in gold)

---

## Color System

### Core Palette
```css
/* Backgrounds - Dark with subtle blue undertone */
--color-bg: #0a0a0f;
--color-bg-elevated: #0d0d14;
--color-bg-card: rgba(255,255,255,0.03);

/* Text Hierarchy */
--color-text: #f5f5f5;
--color-text-muted: #888888;
--color-text-dim: #555555;

/* Primary Accent - Warm Gold */
--color-accent: #d4a54a;
--color-accent-glow: rgba(212,165,74,0.3);

/* Borders */
--color-border: rgba(255,255,255,0.08);

/* Semantic Colors */
--color-green: #4ade80;    /* Value creation, growth, success */
--color-blue: #60a5fa;     /* Information, secondary accent */
--color-purple: #a78bfa;   /* Engagements, transformation */
--color-red: #f87171;      /* Warnings, alerts */
```

### Tailwind Equivalents
```
bg: bg-[#0a0a0f]
text: text-white or text-zinc-100
muted: text-zinc-400
dim: text-zinc-500/text-zinc-600
accent: text-[#d4a54a]
green: text-green-400
blue: text-blue-400
purple: text-purple-400
border: border-white/10 or border-zinc-800
```

### Gold Usage
Gold (#d4a54a) is the signature accent. Use for:
- The "33" in "33 Strategies"
- Key phrases within headlines
- Section labels/markers
- Stats and numbers
- CTAs and active states
- Progress indicators

### Headline Pattern
```jsx
<h2 className="font-display text-4xl">
  Technology is plateauing. <span className="text-[#d4a54a]">Value creation is just starting.</span>
</h2>
```

---

## Component Patterns

### Glass Card
```jsx
const GlassCard = ({ children, glow = false }) => (
  <div
    className="rounded-xl p-5 border backdrop-blur-sm"
    style={{
      background: 'rgba(255,255,255,0.03)',
      borderColor: glow ? '#d4a54a' : 'rgba(255,255,255,0.08)',
      boxShadow: glow ? '0 0 40px rgba(212,165,74,0.3)' : 'none',
    }}
  >
    {children}
  </div>
);
```

### Section Label
```jsx
<p 
  className="text-xs font-medium tracking-[0.2em] uppercase mb-4"
  style={{ color: '#d4a54a', fontFamily: 'JetBrains Mono' }}
>
  01 — THE THESIS
</p>
```

### Accent Text
```jsx
const AccentText = ({ children }) => (
  <span style={{ color: '#d4a54a' }}>{children}</span>
);

// Usage
<h1><AccentText>33</AccentText> Strategies</h1>
```

### Stat Display
```jsx
<div className="text-center">
  <p className="text-4xl font-display text-[#d4a54a]">10+</p>
  <p className="text-xs text-zinc-500">Year opportunity</p>
</div>
```

---

## Motion & Animation

### Principles
- Subtle and refined—never flashy
- Scroll-triggered reveals with staggered delays
- Smooth ease curves for premium feel

### Framer Motion Reveal
```jsx
const RevealText = ({ children, delay = 0 }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, margin: "-5%" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};
```

### Stagger Pattern
```jsx
<RevealText delay={0}>Title</RevealText>
<RevealText delay={0.1}>Subtitle</RevealText>
<RevealText delay={0.2}>Body</RevealText>
```

### Scroll Progress Bar
```jsx
const ProgressBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div 
      className="fixed top-0 left-0 right-0 h-1 origin-left z-50" 
      style={{ scaleX, background: '#d4a54a' }} 
    />
  );
};
```

### Glow Pulse
```jsx
animate={{ opacity: [0.3, 0.15, 0.3], scale: [1, 1.05, 1] }}
transition={{ duration: 3, repeat: Infinity }}
```

---

## Backgrounds & Depth

### Atmospheric Glows
Position colored orbs behind key content:
```jsx
<div className="absolute top-1/3 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-15"
     style={{ background: '#d4a54a' }} />
```

### Layering Structure
```jsx
<section className="relative">
  {/* Background glow - behind everything */}
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute ... blur-3xl opacity-10" />
  </div>
  
  {/* Content - above background */}
  <div className="relative z-10">
    {content}
  </div>
</section>
```

---

## Visualizations & Icons

### Rules
- **Never use emojis** in visualizations—use abstract geometric SVG shapes
- Consistent stroke widths: 1.5px for standard, 2px for emphasis
- Color-code by function using semantic palette
- Animate entrances with scale/opacity transitions

### Icon Style Guide
| Concept | Shape |
|---------|-------|
| Vision | Radiating lines from center point |
| Execution | Forward chevrons (>>) |
| Analytics | Line chart with endpoint dot |
| Documents | Stacked layered rectangles |
| Growth | Ascending bars |
| Network | Connected nodes |
| Expansion | Plus sign in dashed circle |
| Person/Operator | Circle head + curved body path |

### SVG Styling
```jsx
<g stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round">
  {/* icon paths */}
</g>
```

---

## Spacing System

### Section Padding
```jsx
className="px-6 md:px-12 lg:px-16 py-12"
```

### Card Padding
- Standard: `p-5`
- Large: `p-6` or `p-8`

### Gaps
- Between cards: `gap-4` or `gap-6`
- Between sections: `gap-8` or `gap-12`

### Border Radius
- Small elements: `rounded-lg` (8px)
- Cards: `rounded-xl` (12px)
- Large containers: `rounded-2xl` (16px)

---

## Responsive Breakpoints

| Prefix | Width | Usage |
|--------|-------|-------|
| (none) | <640px | Mobile |
| `sm:` | 640px | Small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Large desktop |

Common responsive pattern:
```jsx
className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
className="px-6 md:px-12 lg:px-16"
className="grid md:grid-cols-2 lg:grid-cols-3"
```

---

## Tech Stack

- **Framework:** React + Tailwind CSS
- **Animations:** Framer Motion
- **Build:** Next.js 14 (App Router) for web decks
- **Icons:** Custom SVG only
- **Components:** Custom-built to maintain brand consistency

### Key Dependencies
```json
{
  "framer-motion": "^10.16.0",
  "tailwindcss": "^3.3.0"
}
```

---

## Quick Reference Card

```
FONTS
Display: Instrument Serif (headlines, "33", stats)
Body: DM Sans (paragraphs, UI)  
Mono: JetBrains Mono (labels, code)

COLORS
Background: #0a0a0f
Text: #f5f5f5 / #888 / #555
Gold accent: #d4a54a
Glow: rgba(212,165,74,0.3)
Border: rgba(255,255,255,0.08)
Green: #4ade80 | Blue: #60a5fa | Purple: #a78bfa

PATTERNS
Section label: "01 — TITLE" in gold, uppercase, tracked
Headline: "Plain text. Gold key phrase."
Cards: Glass effect with blur, subtle border
Motion: Fade up on scroll, 0.5s duration, staggered delays
```

---

## Brand Voice in UI

- Confident, not boastful
- Clear, not clever  
- Premium, not pretentious
- Founder-to-founder peer energy
- "Build brilliant things with brilliant people"

---

Remember: 33 Strategies interfaces should feel like stepping into a refined, thoughtful space—not a generic SaaS dashboard. Every element should feel intentional and premium.