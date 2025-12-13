# 33 Strategies Design System Overhaul Specification

**Project:** [YOUR PROJECT NAME]
**Status:** Draft
**Last Updated:** [DATE]

---

## 1. Overview

### 1.1 Objective

Transform [PROJECT NAME]'s visual identity to align with the 33 Strategies brand: a luxury editorial aesthetic that combines sophisticated typography, dark cinematic backgrounds, and gold accents.

### 1.2 Current State Assessment

**Framework:** [React / Vue / Next.js / etc.]
**Styling Approach:** [Tailwind / CSS Modules / styled-components / etc.]
**Current Design:** [Describe current visual style]
**Pain Points:** [List visual issues to address]

### 1.3 Target State

- Dark theme (#0a0a0f background) as default
- Instrument Serif for display typography
- DM Sans for body/UI typography
- JetBrains Mono for labels and technical text
- Gold (#d4a54a) as primary accent color
- Glass card effects with subtle borders
- Scroll-triggered animations via Framer Motion

---

## 2. Project Inventory

### 2.1 Pages to Reskin

| Page | Route | Priority | Complexity | Notes |
|------|-------|----------|------------|-------|
| [Page 1] | `/route` | High | Medium | [Notes] |
| [Page 2] | `/route` | High | Low | [Notes] |
| [Page 3] | `/route` | Medium | High | [Notes] |
| ... | ... | ... | ... | ... |

### 2.2 Shared Components

| Component | File Path | Used In | Notes |
|-----------|-----------|---------|-------|
| Button | `/components/Button.tsx` | Multiple | [Notes] |
| Card | `/components/Card.tsx` | Multiple | [Notes] |
| Input | `/components/Input.tsx` | Forms | [Notes] |
| ... | ... | ... | ... |

### 2.3 Layout Components

| Component | File Path | Notes |
|-----------|-----------|-------|
| Header/Nav | `/components/Header.tsx` | [Notes] |
| Sidebar | `/components/Sidebar.tsx` | [Notes] |
| Footer | `/components/Footer.tsx` | [Notes] |
| ... | ... | ... |

---

## 3. Implementation Plan

### Phase 1: Foundation (Day 1)

**Goal:** Establish design system infrastructure without breaking existing functionality.

#### 3.1.1 Typography Setup

```bash
# Add fonts to index.html or via package
```

Update tailwind.config.js:
```javascript
fontFamily: {
  serif: ['Instrument Serif', 'Georgia', 'serif'],
  sans: ['DM Sans', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Consolas', 'monospace'],
}
```

#### 3.1.2 Color Tokens

Add to tailwind.config.js or CSS variables:
```javascript
colors: {
  brand: {
    bg: '#0a0a0f',
    elevated: '#111116',
    gold: '#d4a54a',
    'gold-hover': '#e5b85b',
  },
  // ...
}
```

#### 3.1.3 Base Styles

Update global CSS:
```css
body {
  background-color: #0a0a0f;
  color: #f5f5f5;
  font-family: 'DM Sans', system-ui, sans-serif;
}
```

#### 3.1.4 Dependencies

```bash
npm install framer-motion
```

### Phase 2: Shared Components (Day 2-3)

**Goal:** Create/update reusable components following brand patterns.

| Component | Status | Assignee |
|-----------|--------|----------|
| Button (Primary) | [ ] | |
| Button (Secondary) | [ ] | |
| Card (Glass) | [ ] | |
| Badge | [ ] | |
| Input | [ ] | |
| Select | [ ] | |
| SectionLabel | [ ] | |
| Stat | [ ] | |

### Phase 3: Page Reskins (Day 4-6)

**Goal:** Apply brand identity to all pages systematically.

| Page | Status | Assignee | Notes |
|------|--------|----------|-------|
| [Page 1] | [ ] | | |
| [Page 2] | [ ] | | |
| [Page 3] | [ ] | | |
| ... | | | |

### Phase 4: Polish (Day 7)

**Goal:** Add animations, refine details, ensure consistency.

- [ ] Scroll reveal animations on key sections
- [ ] Hover states on all interactive elements
- [ ] Empty state designs
- [ ] Loading state designs
- [ ] Error state designs
- [ ] Page transition animations
- [ ] Reduced motion support

---

## 4. Component Specifications

### 4.1 Button

**Primary Button:**
- Background: #d4a54a
- Hover: #e5b85b
- Text: #0a0a0f (dark on gold)
- Font: DM Sans 500
- Padding: 12px 24px
- Border radius: 6px

**Secondary Button:**
- Background: transparent
- Hover: rgba(255,255,255,0.06)
- Border: 1px solid rgba(255,255,255,0.12)
- Text: #f5f5f5
- Font: DM Sans 500

### 4.2 Card

**Glass Card:**
- Background: rgba(255,255,255,0.03)
- Backdrop blur: 4px
- Border: 1px solid rgba(255,255,255,0.08)
- Border radius: 8px
- Optional: Gold glow shadow

### 4.3 Section Label

**Format:** `XX — TITLE`
- Number: Gold (#d4a54a)
- Separator: Em-dash, 30% opacity
- Title: Gold, uppercase
- Font: JetBrains Mono 12px
- Letter spacing: 0.2em

### 4.4 Headlines

**With Accent:**
- Font: Instrument Serif
- Default text: #f5f5f5
- Accent phrase: #d4a54a
- No quotes around accent

### 4.5 Form Inputs

- Background: rgba(255,255,255,0.03)
- Border: 1px solid rgba(255,255,255,0.12)
- Focus border: #d4a54a at 50% opacity
- Focus ring: #d4a54a at 20% opacity
- Placeholder: #555555
- Text: #f5f5f5

---

## 5. Animation Specifications

### 5.1 Scroll Reveal

```typescript
initial={{ opacity: 0, y: 20 }}
whileInView={{ opacity: 1, y: 0 }}
viewport={{ once: true, margin: '-50px' }}
transition={{ duration: 0.5, ease: 'easeOut' }}
```

### 5.2 Stagger Children

- Stagger delay: 0.1s
- Initial delay: 0.2s

### 5.3 Hover Effects

- Cards: translateY(-4px)
- Buttons: Background color transition
- Duration: 200ms

---

## 6. Quality Checklist

### 6.1 Visual Consistency

- [ ] All text uses correct font family
- [ ] All colors match brand palette
- [ ] All spacing is consistent
- [ ] All borders use correct opacity
- [ ] No remnants of old design system

### 6.2 Accessibility

- [ ] Color contrast meets WCAG AA
- [ ] Focus states visible on all interactive elements
- [ ] Reduced motion respected
- [ ] Screen reader compatibility maintained

### 6.3 Responsiveness

- [ ] All pages work on mobile (375px+)
- [ ] All pages work on tablet (768px+)
- [ ] All pages work on desktop (1024px+)

### 6.4 Performance

- [ ] Fonts loaded efficiently (preconnect)
- [ ] Animations use GPU-accelerated properties
- [ ] No layout shifts during load

---

## 7. Testing Strategy

### 7.1 Visual Regression

- Screenshot each page before/after
- Compare component rendering across browsers

### 7.2 Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 7.3 Device Testing

- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] iPad
- [ ] Desktop

---

## 8. Rollback Plan

If issues are discovered post-deployment:

1. Git revert to pre-overhaul commit
2. Deploy previous version
3. Document issues for next iteration

---

## 9. Success Criteria

- [ ] All pages render with new brand identity
- [ ] No visual regressions in functionality
- [ ] Performance metrics unchanged or improved
- [ ] Accessibility audit passes
- [ ] Stakeholder approval received

---

## Appendix A: File Changes

List all files that will be modified:

```
src/
├── index.css (or global styles)
├── tailwind.config.js
├── components/
│   ├── [Component1].tsx
│   ├── [Component2].tsx
│   └── ...
├── pages/
│   ├── [Page1].tsx
│   ├── [Page2].tsx
│   └── ...
└── index.html (fonts)
```

---

## Appendix B: Reference Materials

- Brand Identity Guide: `BRAND-IDENTITY.md`
- Execution Checklist: `EXECUTION-CHECKLIST.md`
- Original 33 Strategies website: [URL if available]
