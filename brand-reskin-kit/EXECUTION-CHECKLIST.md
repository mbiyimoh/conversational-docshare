# 33 Strategies Design Overhaul - Execution Checklist

Use this checklist to systematically apply the 33 Strategies brand identity to your application.

---

## Pre-Flight

- [ ] Read `BRAND-IDENTITY.md` completely
- [ ] Inventory all pages in the application
- [ ] Inventory all shared components
- [ ] Take "before" screenshots of each page
- [ ] Create a git branch for the overhaul
- [ ] Fill out `OVERHAUL-SPEC-TEMPLATE.md` with project details

---

## Phase 1: Foundation

### Typography

- [ ] Add Google Fonts link to `index.html`:
  ```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- [ ] Update Tailwind config with font families
- [ ] Verify fonts load correctly (check Network tab)

### Colors

- [ ] Add brand colors to Tailwind config or CSS variables
- [ ] Update global background to `#0a0a0f`
- [ ] Update global text color to `#f5f5f5`
- [ ] Remove any light mode styles

### Base Styles

- [ ] Update `body` styles in global CSS
- [ ] Set default font-family to DM Sans
- [ ] Remove any conflicting reset styles

### Dependencies

- [ ] Install framer-motion: `npm install framer-motion`
- [ ] Verify installation: `npm ls framer-motion`

### Verification

- [ ] App loads without errors
- [ ] Background is dark (#0a0a0f)
- [ ] Text is readable (light on dark)
- [ ] Fonts are loading (check DevTools)

---

## Phase 2: Shared Components

### Buttons

- [ ] **Primary Button**
  - [ ] Gold background (#d4a54a)
  - [ ] Dark text (#0a0a0f)
  - [ ] Hover state (#e5b85b)
  - [ ] DM Sans font
  - [ ] Proper padding and radius

- [ ] **Secondary Button**
  - [ ] Transparent background
  - [ ] White/[0.12] border
  - [ ] Light text (#f5f5f5)
  - [ ] Hover background (white/[0.06])

- [ ] **Ghost/Text Button**
  - [ ] Transparent background
  - [ ] Gold or light text
  - [ ] Hover underline or opacity change

### Cards

- [ ] **Glass Card**
  - [ ] Background: rgba(255,255,255,0.03)
  - [ ] Backdrop-blur: sm (4px)
  - [ ] Border: 1px rgba(255,255,255,0.08)
  - [ ] Border radius: 8px
  - [ ] Optional gold glow variant

### Form Elements

- [ ] **Text Input**
  - [ ] Dark background (white/[0.03])
  - [ ] Subtle border (white/[0.12])
  - [ ] Gold focus ring
  - [ ] Placeholder color (#555555)

- [ ] **Select/Dropdown**
  - [ ] Matching input styles
  - [ ] Custom arrow if possible
  - [ ] Dark dropdown options

- [ ] **Checkbox/Radio**
  - [ ] Custom styling with gold accent
  - [ ] Focus states

- [ ] **Textarea**
  - [ ] Matching input styles
  - [ ] Resize handle styled or hidden

### UI Elements

- [ ] **Badge/Tag**
  - [ ] Gold variant (primary)
  - [ ] Default variant (muted)
  - [ ] Success/warning variants
  - [ ] JetBrains Mono font
  - [ ] Uppercase, letter-spaced

- [ ] **Section Label**
  - [ ] Format: "XX — TITLE"
  - [ ] Gold color
  - [ ] JetBrains Mono
  - [ ] Letter spacing 0.2em

- [ ] **Stat Display**
  - [ ] Large Instrument Serif number
  - [ ] Gold color for value
  - [ ] Muted label below

### Navigation

- [ ] **Header/Navbar**
  - [ ] Dark background
  - [ ] Logo placement
  - [ ] Nav links styled
  - [ ] Mobile menu (if applicable)

- [ ] **Sidebar** (if applicable)
  - [ ] Dark background
  - [ ] Active state with gold
  - [ ] Hover states

- [ ] **Footer**
  - [ ] Dark background
  - [ ] Muted text
  - [ ] Link hover states

### Modals/Dialogs

- [ ] **Modal Overlay**
  - [ ] Dark semi-transparent backdrop
  - [ ] Blur effect (optional)

- [ ] **Modal Content**
  - [ ] Glass card styling
  - [ ] Close button styled
  - [ ] Focus trap working

### Tables

- [ ] **Table Header**
  - [ ] JetBrains Mono font
  - [ ] Uppercase, letter-spaced
  - [ ] Muted color

- [ ] **Table Rows**
  - [ ] Subtle border between rows
  - [ ] Hover state
  - [ ] Alternating backgrounds (optional)

### Loading States

- [ ] **Spinner/Loader**
  - [ ] Gold color
  - [ ] Appropriate size
  - [ ] Smooth animation

- [ ] **Skeleton Loader**
  - [ ] Matching glass effect
  - [ ] Shimmer animation

---

## Phase 3: Pages

For each page, complete the following:

### Page: [Name] ____________________

- [ ] Section labels added (01 — TITLE format)
- [ ] Headlines use Instrument Serif
- [ ] Key phrases highlighted in gold
- [ ] Body text uses DM Sans
- [ ] Cards converted to glass style
- [ ] Buttons use brand styling
- [ ] Forms use brand styling
- [ ] Proper spacing between sections
- [ ] Remove any old brand colors
- [ ] Check mobile responsiveness

### Page: [Name] ____________________

- [ ] Section labels added
- [ ] Headlines use Instrument Serif
- [ ] Key phrases highlighted in gold
- [ ] Body text uses DM Sans
- [ ] Cards converted to glass style
- [ ] Buttons use brand styling
- [ ] Forms use brand styling
- [ ] Proper spacing between sections
- [ ] Remove any old brand colors
- [ ] Check mobile responsiveness

### Page: [Name] ____________________

- [ ] Section labels added
- [ ] Headlines use Instrument Serif
- [ ] Key phrases highlighted in gold
- [ ] Body text uses DM Sans
- [ ] Cards converted to glass style
- [ ] Buttons use brand styling
- [ ] Forms use brand styling
- [ ] Proper spacing between sections
- [ ] Remove any old brand colors
- [ ] Check mobile responsiveness

*(Copy this section for each page)*

---

## Phase 4: Polish

### Animations

- [ ] Install framer-motion (if not done)
- [ ] Add scroll reveal to hero sections
- [ ] Add scroll reveal to feature cards
- [ ] Add stagger animation to lists
- [ ] Add hover lift to cards
- [ ] Add page transitions (optional)
- [ ] Test reduced motion preference

### Empty States

- [ ] Design empty state component
- [ ] Apply to all empty data scenarios
- [ ] Include helpful message and CTA

### Error States

- [ ] Style error messages
- [ ] Style error pages (404, 500)
- [ ] Ensure contrast on error colors

### Backgrounds

- [ ] Add gradient overlays where appropriate
- [ ] Add noise texture (optional)
- [ ] Add grid pattern (optional)

### Micro-interactions

- [ ] Button hover/active states
- [ ] Link hover states
- [ ] Focus ring consistency
- [ ] Transition timing consistency

---

## Phase 5: Quality Assurance

### Visual Audit

- [ ] Compare "before" and "after" screenshots
- [ ] No remnants of old design system
- [ ] Consistent spacing throughout
- [ ] Consistent typography throughout
- [ ] Consistent color usage throughout

### Accessibility Audit

- [ ] Run Lighthouse accessibility audit
- [ ] Check color contrast (use DevTools)
- [ ] Verify focus states are visible
- [ ] Test with keyboard navigation
- [ ] Test reduced motion setting

### Responsive Audit

- [ ] Test at 375px (mobile)
- [ ] Test at 768px (tablet)
- [ ] Test at 1024px (desktop)
- [ ] Test at 1440px (large desktop)
- [ ] No horizontal overflow
- [ ] Text is readable at all sizes

### Cross-Browser Testing

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Performance Check

- [ ] Fonts load without flash
- [ ] No layout shift on load
- [ ] Animations are smooth
- [ ] Page load time acceptable

---

## Deployment

- [ ] Create pull request with screenshots
- [ ] Get design approval
- [ ] Merge to main/production
- [ ] Verify production deployment
- [ ] Take final "after" screenshots

---

## Post-Launch

- [ ] Monitor for visual bugs
- [ ] Collect user feedback
- [ ] Document any deviations from spec
- [ ] Update spec with lessons learned

---

## Quick Reference

### Colors
```
Background:    #0a0a0f
Elevated:      #111116
Surface:       rgba(255,255,255,0.03)
Text Primary:  #f5f5f5
Text Secondary:#888888
Text Tertiary: #555555
Gold:          #d4a54a
Gold Hover:    #e5b85b
Border:        rgba(255,255,255,0.08)
```

### Fonts
```
Headlines:     font-serif (Instrument Serif)
Body:          font-sans (DM Sans)
Labels:        font-mono (JetBrains Mono)
```

### Common Classes
```
Glass card:    bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-lg
Section label: font-mono text-xs tracking-[0.2em] uppercase text-[#d4a54a]
Gold text:     text-[#d4a54a]
```
