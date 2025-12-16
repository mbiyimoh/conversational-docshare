# Task Breakdown: 33 Strategies Design System Overhaul

**Generated:** 2025-12-10
**Source:** specs/feat-33-strategies-design-system-overhaul.md
**Total Tasks:** 28 tasks across 4 phases

---

## Overview

Transform the Conversational Document IDE from generic SaaS styling to the 33 Strategies premium dark theme with gold accents, custom typography, glass effects, and Framer Motion animations.

**Scope:** 47 frontend files (41 components + 6 pages)
**New Dependencies:** framer-motion ^11.15.0

---

## Phase 1: Foundation

### Task 1.1: Install Dependencies and Add Fonts
**Description:** Install framer-motion and add Google Fonts to index.html
**Size:** Small
**Priority:** High
**Dependencies:** None
**Can run parallel with:** None (must complete first)

**Technical Requirements:**
```bash
cd frontend && npm install framer-motion@^11.15.0
```

**index.html changes:**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Conversational Document Share</title>
    <!-- Google Fonts: 33 Strategies Typography -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Serif&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Acceptance Criteria:**
- [ ] `npm ls framer-motion` shows ^11.15.0
- [ ] Google Fonts preconnect links present
- [ ] Fonts load without errors in browser

---

### Task 1.2: Update globals.css with Design Tokens
**Description:** Replace existing CSS variables with 33 Strategies design tokens
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** Task 1.3

**Technical Requirements:**

Replace the entire `@layer base { :root { ... } }` section in `frontend/src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* 33 Strategies Dark Theme */
    --color-bg: 240 20% 4%;           /* #0a0a0f */
    --color-bg-elevated: 240 18% 5%;   /* #0d0d14 */
    --color-bg-card: 0 0% 100% / 0.03; /* rgba(255,255,255,0.03) */

    /* Text Hierarchy */
    --color-text: 0 0% 96%;            /* #f5f5f5 */
    --color-text-muted: 0 0% 53%;      /* #888888 */
    --color-text-dim: 0 0% 33%;        /* #555555 */

    /* Gold Accent */
    --color-accent: 41 57% 54%;        /* #d4a54a */
    --color-accent-glow: 41 57% 54% / 0.3;

    /* Borders */
    --color-border: 0 0% 100% / 0.08;

    /* Semantic Colors */
    --color-success: 142 69% 58%;      /* #4ade80 */
    --color-info: 217 91% 68%;         /* #60a5fa */
    --color-purple: 270 91% 65%;       /* #a78bfa */
    --color-warning: 38 92% 50%;       /* #f59e0b */
    --color-destructive: 0 84% 60%;    /* #f87171 */

    /* Typography */
    --font-display: "Instrument Serif", Georgia, serif;
    --font-body: "DM Sans", -apple-system, sans-serif;
    --font-mono: "JetBrains Mono", monospace;

    /* Spacing */
    --radius: 0.75rem;

    /* Legacy shadcn compatibility */
    --background: var(--color-bg);
    --foreground: var(--color-text);
    --card: var(--color-bg-card);
    --card-foreground: var(--color-text);
    --primary: var(--color-accent);
    --primary-foreground: var(--color-bg);
    --secondary: var(--color-bg-elevated);
    --secondary-foreground: var(--color-text);
    --muted: var(--color-bg-elevated);
    --muted-foreground: var(--color-text-muted);
    --accent: var(--color-accent);
    --accent-foreground: var(--color-bg);
    --destructive: var(--color-destructive);
    --destructive-foreground: var(--color-text);
    --border: var(--color-border);
    --input: var(--color-border);
    --ring: var(--color-accent);
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground font-body;
  }
}

/* Backdrop filter fallback */
@supports not (backdrop-filter: blur(4px)) {
  .backdrop-blur-sm {
    background: rgba(20, 20, 30, 0.95) !important;
  }
}

/* Citation Highlight Animation - Updated for dark theme */
@keyframes citation-glow {
  0% {
    background-color: hsl(var(--color-accent) / 0.3);
    box-shadow: 0 0 0 4px hsl(var(--color-accent) / 0.2);
  }
  70% {
    background-color: hsl(var(--color-accent) / 0.3);
    box-shadow: 0 0 0 4px hsl(var(--color-accent) / 0.2);
  }
  100% {
    background-color: transparent;
    box-shadow: none;
  }
}

.citation-highlight {
  animation: citation-glow 2.5s ease-out forwards;
  border-radius: 0.25rem;
  transition: background-color 0.3s ease-out, box-shadow 0.3s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .citation-highlight {
    animation: none;
    background-color: hsl(var(--color-accent) / 0.2);
    border-left: 4px solid hsl(var(--color-accent));
    box-shadow: none;
  }
}
```

**Acceptance Criteria:**
- [ ] All CSS variables defined correctly
- [ ] Body has dark background when app loads
- [ ] Font families fallback to system fonts
- [ ] Citation highlight uses gold instead of yellow

---

### Task 1.3: Extend Tailwind Config
**Description:** Add 33 Strategies colors and fonts to Tailwind configuration
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1
**Can run parallel with:** Task 1.2

**Technical Requirements:**

Update `frontend/tailwind.config.js`:

```typescript
import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // 33 Strategies Brand Colors
        background: 'hsl(var(--color-bg))',
        'background-elevated': 'hsl(var(--color-bg-elevated))',
        'card-bg': 'hsl(var(--color-bg-card))',
        foreground: 'hsl(var(--color-text))',
        muted: 'hsl(var(--color-text-muted))',
        dim: 'hsl(var(--color-text-dim))',
        accent: {
          DEFAULT: 'hsl(var(--color-accent))',
          glow: 'hsl(var(--color-accent-glow))',
        },
        border: 'hsl(var(--color-border))',
        // Semantic Colors
        success: 'hsl(var(--color-success))',
        info: 'hsl(var(--color-info))',
        purple: 'hsl(var(--color-purple))',
        warning: 'hsl(var(--color-warning))',
        destructive: 'hsl(var(--color-destructive))',
        // Legacy shadcn compatibility
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--color-bg-elevated))',
          foreground: 'hsl(var(--color-text))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [typography],
}
```

**Acceptance Criteria:**
- [ ] `bg-background` applies #0a0a0f
- [ ] `text-accent` applies #d4a54a
- [ ] `font-display` applies Instrument Serif
- [ ] `font-body` applies DM Sans
- [ ] `font-mono` applies JetBrains Mono

---

### Task 1.4: Create Button Component
**Description:** Create reusable Button component with CVA variants
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3
**Can run parallel with:** Task 1.5, 1.6, 1.7, 1.8

**Technical Requirements:**

Create `frontend/src/components/ui/button.tsx`:

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-lg font-body font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-background hover:bg-accent/90',
        secondary: 'bg-card-bg border border-border text-foreground hover:bg-white/5',
        ghost: 'text-muted hover:text-foreground hover:bg-white/5',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border bg-transparent text-foreground hover:bg-white/5',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-sm',
        lg: 'h-12 px-6 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    // Context-aware loading spinner color
    const spinnerColor = variant === 'default' ? 'border-background' : 'border-accent'

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <span className={cn('mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent', spinnerColor)} />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

**Acceptance Criteria:**
- [ ] Default variant has gold background
- [ ] Secondary variant has glass effect
- [ ] Loading spinner color matches context (gold on dark, dark on gold)
- [ ] Focus ring uses gold accent
- [ ] All sizes render correctly

---

### Task 1.5: Create Card Component
**Description:** Create Glass Card component with optional glow
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3
**Can run parallel with:** Task 1.4, 1.6, 1.7, 1.8

**Technical Requirements:**

Create `frontend/src/components/ui/card.tsx`:

```tsx
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl p-5 backdrop-blur-sm',
          'bg-card-bg border',
          glow
            ? 'border-accent shadow-[0_0_40px_hsl(var(--color-accent-glow))]'
            : 'border-border',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-display text-xl text-foreground', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted', className)} {...props} />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-muted', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-4 flex items-center', className)} {...props} />
  )
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
```

**Acceptance Criteria:**
- [ ] Card has glass effect (backdrop-blur-sm)
- [ ] Default border is subtle (rgba(255,255,255,0.08))
- [ ] Glow prop adds gold shadow
- [ ] CardTitle uses Instrument Serif font

---

### Task 1.6: Create Badge Component
**Description:** Create Badge component with semantic color variants
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3
**Can run parallel with:** Task 1.4, 1.5, 1.7, 1.8

**Technical Requirements:**

Create `frontend/src/components/ui/badge.tsx`:

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-body transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent/10 text-accent border border-accent/20',
        secondary: 'bg-white/5 text-muted border border-border',
        success: 'bg-success/10 text-success border border-success/20',
        warning: 'bg-warning/10 text-warning border border-warning/20',
        destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
        info: 'bg-info/10 text-info border border-info/20',
        purple: 'bg-purple/10 text-purple border border-purple/20',
        outline: 'border border-border text-foreground bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
```

**Acceptance Criteria:**
- [ ] Default badge uses gold accent
- [ ] Success badge uses green (#4ade80)
- [ ] Warning badge uses orange (#f59e0b)
- [ ] Destructive badge uses red (#f87171)
- [ ] Purple badge uses #a78bfa

---

### Task 1.7: Create Input and Textarea Components
**Description:** Create dark-themed form input components
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.2, Task 1.3
**Can run parallel with:** Task 1.4, 1.5, 1.6, 1.8

**Technical Requirements:**

Create `frontend/src/components/ui/input.tsx`:

```tsx
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium font-body text-muted mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-background-elevated px-3 py-2',
            'font-body text-foreground placeholder:text-dim',
            'border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-destructive font-body">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
```

Create `frontend/src/components/ui/textarea.tsx`:

```tsx
import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium font-body text-muted mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border bg-background-elevated px-3 py-2',
            'font-body text-foreground placeholder:text-dim',
            'border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors resize-none',
            error && 'border-destructive focus:border-destructive focus:ring-destructive/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-destructive font-body">{error}</p>
        )}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
```

**Acceptance Criteria:**
- [ ] Inputs have dark background (#0d0d14)
- [ ] Focus state uses gold ring
- [ ] Error state uses red styling
- [ ] Labels use DM Sans font
- [ ] Placeholder text uses dim color

---

### Task 1.8: Create Modal Component
**Description:** Create animated Modal component with Framer Motion
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2, Task 1.3
**Can run parallel with:** Task 1.4, 1.5, 1.6, 1.7

**Technical Requirements:**

Create `frontend/src/components/ui/modal.tsx`:

```tsx
import { motion, AnimatePresence } from 'framer-motion'
import { forwardRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { Card } from './card'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ isOpen, onClose, children, className, size = 'md', showCloseButton = true }, ref) => {
    // Close on Escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      if (isOpen) {
        document.addEventListener('keydown', handleEscape)
        document.body.style.overflow = 'hidden'
      }
      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.body.style.overflow = 'unset'
      }
    }, [isOpen, onClose])

    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
            />

            {/* Modal container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                ref={ref}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                className={cn('w-full', sizeClasses[size])}
              >
                <Card className={cn('relative shadow-2xl', className)}>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
                      aria-label="Close modal"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                  {children}
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    )
  }
)
Modal.displayName = 'Modal'

const ModalHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4 pr-8', className)} {...props} />
  )
)
ModalHeader.displayName = 'ModalHeader'

const ModalTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('font-display text-2xl text-foreground', className)} {...props} />
  )
)
ModalTitle.displayName = 'ModalTitle'

const ModalDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted mt-1', className)} {...props} />
  )
)
ModalDescription.displayName = 'ModalDescription'

const ModalContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-muted', className)} {...props} />
  )
)
ModalContent.displayName = 'ModalContent'

const ModalFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-6 flex items-center justify-end gap-3', className)} {...props} />
  )
)
ModalFooter.displayName = 'ModalFooter'

export { Modal, ModalHeader, ModalTitle, ModalDescription, ModalContent, ModalFooter }
```

**Acceptance Criteria:**
- [ ] Modal animates in with scale and opacity
- [ ] Backdrop has blur effect
- [ ] Closes on Escape key
- [ ] Closes on backdrop click
- [ ] Body scroll is locked when open
- [ ] Uses Card component for glass effect

---

### Task 1.9: Create Animation Components
**Description:** Create SectionLabel, AccentText, RevealText, ScrollProgress, GlowPulse
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.1, Task 1.2, Task 1.3
**Can run parallel with:** Task 1.4-1.8

**Technical Requirements:**

Create `frontend/src/components/ui/section-label.tsx`:

```tsx
import { cn } from '../../lib/utils'

interface SectionLabelProps {
  number: string | number
  title: string
  className?: string
}

export function SectionLabel({ number, title, className }: SectionLabelProps) {
  const formattedNumber = String(number).padStart(2, '0')

  return (
    <p
      className={cn(
        'text-xs font-mono font-medium tracking-[0.2em] uppercase text-accent mb-4',
        className
      )}
    >
      {formattedNumber} — {title}
    </p>
  )
}
```

Create `frontend/src/components/ui/accent-text.tsx`:

```tsx
import { cn } from '../../lib/utils'

interface AccentTextProps {
  children: React.ReactNode
  className?: string
}

export function AccentText({ children, className }: AccentTextProps) {
  return (
    <span className={cn('text-accent', className)}>
      {children}
    </span>
  )
}
```

Create `frontend/src/components/ui/reveal-text.tsx`:

```tsx
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'
import { cn } from '../../lib/utils'

interface RevealTextProps {
  children: React.ReactNode
  delay?: number
  className?: string
  once?: boolean
}

export function RevealText({ children, delay = 0, className, once = false }: RevealTextProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once, margin: '-5%' })
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.4, 0.25, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

Create `frontend/src/components/ui/scroll-progress.tsx`:

```tsx
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return null
  }

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 origin-left z-50 bg-accent"
      style={{ scaleX }}
    />
  )
}
```

Create `frontend/src/components/ui/glow-pulse.tsx`:

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface GlowPulseProps {
  className?: string
  color?: 'accent' | 'purple' | 'info'
}

export function GlowPulse({ className, color = 'accent' }: GlowPulseProps) {
  const prefersReducedMotion = useReducedMotion()

  const colorMap = {
    accent: 'bg-accent',
    purple: 'bg-purple',
    info: 'bg-info',
  }

  if (prefersReducedMotion) {
    return (
      <div
        className={cn(
          'absolute rounded-full blur-3xl opacity-15',
          colorMap[color],
          className
        )}
      />
    )
  }

  return (
    <motion.div
      className={cn(
        'absolute rounded-full blur-3xl opacity-15',
        colorMap[color],
        className
      )}
      animate={{
        opacity: [0.3, 0.15, 0.3],
        scale: [1, 1.05, 1]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut'
      }}
    />
  )
}
```

**Acceptance Criteria:**
- [ ] SectionLabel formats as "01 — TITLE" in gold
- [ ] RevealText animates on scroll
- [ ] ScrollProgress shows gold bar at top
- [ ] GlowPulse creates atmospheric effect
- [ ] All respect prefers-reduced-motion

---

### Task 1.10: Create Barrel Export and Verify Foundation
**Description:** Create index.ts barrel export and verify all foundation components work
**Size:** Small
**Priority:** High
**Dependencies:** Task 1.4-1.9
**Can run parallel with:** None

**Technical Requirements:**

Create `frontend/src/components/ui/index.ts`:

```tsx
// Core components
export { Button, buttonVariants } from './button'
export type { ButtonProps } from './button'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'

export { Badge, badgeVariants } from './badge'
export type { BadgeProps } from './badge'

export { Input } from './input'
export type { InputProps } from './input'

export { Textarea } from './textarea'
export type { TextareaProps } from './textarea'

export { Modal, ModalHeader, ModalTitle, ModalDescription, ModalContent, ModalFooter } from './modal'

// Typography & Labels
export { SectionLabel } from './section-label'
export { AccentText } from './accent-text'

// Animation components
export { RevealText } from './reveal-text'
export { ScrollProgress } from './scroll-progress'
export { GlowPulse } from './glow-pulse'
```

**Verification Steps:**
1. Run `cd frontend && npm run dev`
2. App should start without errors
3. Body should have dark background (#0a0a0f)
4. Create a test page to verify each component renders

**Acceptance Criteria:**
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes without errors
- [ ] All exports are accessible from '@/components/ui'
- [ ] Body background is #0a0a0f
- [ ] Fonts load correctly (check Network tab)

---

## Phase 2: Page Migrations

### Task 2.1: Migrate LoginPage
**Description:** Update LoginPage.tsx to use 33 Strategies design system
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.10
**Can run parallel with:** Task 2.2

**Technical Requirements:**

Update `frontend/src/pages/LoginPage.tsx` with:
- Dark background (bg-background)
- Glass Card for form
- Gold accent on "Sign in" heading
- Atmospheric glow behind card
- Use Button component
- Use Input component
- Update link colors to accent

**Color Migration:**
- `bg-gray-50` → `bg-background`
- `bg-white` → Remove (Card handles it)
- `text-3xl font-bold` → `font-display text-3xl`
- `bg-blue-600` → Use `<Button>` component
- `text-blue-600` → `text-accent`

**Acceptance Criteria:**
- [ ] Page has dark background
- [ ] Form is in glass card
- [ ] "Sign in" has gold accent
- [ ] Primary button is gold
- [ ] Link uses gold color
- [ ] No hardcoded gray/blue colors

---

### Task 2.2: Migrate RegisterPage
**Description:** Update RegisterPage.tsx to match LoginPage styling
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.10
**Can run parallel with:** Task 2.1

**Technical Requirements:**

Apply same patterns as LoginPage:
- Dark background
- Glass Card for form
- Gold accents
- Use shared UI components

**Acceptance Criteria:**
- [ ] Consistent with LoginPage
- [ ] All form inputs use Input component
- [ ] Primary button uses Button component
- [ ] No hardcoded colors

---

### Task 2.3: Migrate DashboardPage
**Description:** Update DashboardPage.tsx with section labels, glass cards, and gold stats
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.10
**Can run parallel with:** Task 2.4

**Technical Requirements:**

**Header changes:**
- Dark background for header
- Gold accent on "Dashboard" or key text
- Secondary buttons use ghost variant

**Section changes:**
- Add SectionLabel components ("01 — MY PROJECTS", etc.)
- Project cards use Card component with hover glow
- Empty state: Replace emoji with geometric SVG

**Stats/badges:**
- Document/conversation counts in gold
- Status badges use Badge component
- "Configured" → success variant
- "Setup needed" → warning variant

**Modal:**
- CreateProjectModal uses Modal component
- Form inputs use Input component

**Acceptance Criteria:**
- [ ] Dark header and background
- [ ] Section labels in gold
- [ ] Project cards have glass effect
- [ ] Cards glow on hover
- [ ] Empty state has geometric SVG (no emoji)
- [ ] Status badges use semantic colors
- [ ] Modal uses shared component

---

### Task 2.4: Migrate ProjectPage
**Description:** Update ProjectPage.tsx with tab styling and panel backgrounds
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.10
**Can run parallel with:** Task 2.3

**Technical Requirements:**

**Tab navigation:**
- Gold indicator for active tab
- Ghost variant for inactive tabs
- Dark background for tab bar

**Panel backgrounds:**
- Each section in glass card or dark container
- Proper spacing and borders

**Acceptance Criteria:**
- [ ] Tab bar has dark background
- [ ] Active tab has gold indicator
- [ ] Content panels have proper styling
- [ ] Back button uses Button component

---

### Task 2.5: Migrate SharePage
**Description:** Update SharePage.tsx with dark chat interface and document panel
**Size:** Large
**Priority:** High
**Dependencies:** Task 1.10, Task 2.1
**Can run parallel with:** Task 2.6

**Technical Requirements:**

**Chat interface:**
- Dark background
- Message bubbles with glass effect
- User messages: gold border/accent
- Assistant messages: default glass

**Document panel:**
- Dark reading mode
- Citation highlights in gold (already updated in globals.css)
- Document capsule with glass effect

**Acceptance Criteria:**
- [ ] Chat has dark background
- [ ] Message bubbles are styled correctly
- [ ] Document panel is dark
- [ ] Citations highlight in gold

---

### Task 2.6: Migrate SavedThreadPage
**Description:** Update SavedThreadPage.tsx with dark theme
**Size:** Medium
**Priority:** High
**Dependencies:** Task 1.10
**Can run parallel with:** Task 2.5

**Technical Requirements:**

Match SharePage patterns:
- Dark background
- Glass cards for thread display
- Consistent message styling

**Acceptance Criteria:**
- [ ] Consistent with SharePage
- [ ] All elements use design tokens
- [ ] No hardcoded colors

---

## Phase 3: Component Migrations

### Task 3.1: Migrate Tier 1 Components (Chat)
**Description:** Update ChatInterface, ChatMessage, ChatInput
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.5
**Can run parallel with:** Task 3.2, 3.3

**Technical Requirements:**

**ChatInterface.tsx:**
- Dark container
- Loading dots in gold
- Error banner with destructive styling

**ChatMessage.tsx:**
- User bubble: glass + gold accent
- Assistant bubble: glass
- Citation links in gold

**ChatInput.tsx:**
- Dark textarea
- Gold send button
- Gold focus ring

**Acceptance Criteria:**
- [ ] Chat container is dark
- [ ] Loading indicator uses gold
- [ ] Messages have appropriate styling
- [ ] Input uses design tokens

---

### Task 3.2: Migrate Tier 1 Components (Documents)
**Description:** Update DocumentUpload, DocumentCapsule, DocumentViewer, DocumentEditor, DocumentVersionHistory
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** Task 3.1, 3.3

**Technical Requirements:**

**DocumentUpload.tsx:**
- Glass cards for file list
- Status badges use Badge component
- Buttons use Button component
- Replace emoji empty state with SVG

**DocumentCapsule.tsx:**
- Dark container
- Glass cards for outline items
- Gold for active section

**Acceptance Criteria:**
- [ ] File list uses glass cards
- [ ] All badges use semantic variants
- [ ] Empty state has geometric SVG

---

### Task 3.3: Migrate Tier 1 Components (Profile & Recommendations)
**Description:** Update AgentProfile, AgentInterview, RecommendationPanel, RecommendationCard
**Size:** Large
**Priority:** High
**Dependencies:** Task 2.4
**Can run parallel with:** Task 3.1, 3.2

**Technical Requirements:**

**AgentProfile.tsx:**
- Glass cards for sections
- Gold for version dropdown active state
- Loading spinner in gold

**RecommendationCard.tsx:**
- Type-based coloring:
  - ADD → success
  - REMOVE → destructive
  - MODIFY → info

**Acceptance Criteria:**
- [ ] Profile sections in glass cards
- [ ] Recommendation cards use semantic colors
- [ ] All buttons/badges use shared components

---

### Task 3.4: Migrate Tier 2 Components (Testing Dojo)
**Description:** Update TestingDojo suite (6 components)
**Size:** Large
**Priority:** Medium
**Dependencies:** Task 3.1
**Can run parallel with:** Task 3.5

**Components:**
- TestingDojo.tsx
- DojoChat.tsx
- SessionManager.tsx
- CommentSidebar.tsx
- CommentOverlay.tsx
- NavigationModal.tsx

**Acceptance Criteria:**
- [ ] All 6 components use design tokens
- [ ] Modals use shared Modal component
- [ ] Chat follows ChatInterface patterns

---

### Task 3.5: Migrate Tier 2 Components (Other)
**Description:** Update remaining Tier 2 components
**Size:** Large
**Priority:** Medium
**Dependencies:** Task 3.2, 3.3
**Can run parallel with:** Task 3.4

**Components:**
- DocumentEditor.tsx
- DocumentVersionHistory.tsx
- DocumentContentViewer.tsx
- EndSessionModal.tsx
- LeaveMessageModal.tsx
- AudienceProfileAIModal.tsx
- CollaboratorProfileAIModal.tsx
- CollaboratorCommentPanel.tsx

**Acceptance Criteria:**
- [ ] All modals use shared Modal
- [ ] Forms use Input/Textarea
- [ ] Buttons use Button component

---

### Task 3.6: Migrate Tier 3 Components
**Description:** Update remaining low-frequency components
**Size:** Medium
**Priority:** Low
**Dependencies:** Task 3.4, 3.5
**Can run parallel with:** Task 4.1

**Components:**
- SavedThreadsSection.tsx
- SavedProfilesSection.tsx
- ProfileSectionContent.tsx
- AnalyticsDashboard.tsx
- ConversationDetailPanel.tsx
- CommonQuestionsCard.tsx
- KnowledgeGapsCard.tsx
- DocumentSuggestionsCard.tsx
- Plus remaining utility components

**Acceptance Criteria:**
- [ ] All components use design tokens
- [ ] No hardcoded colors remain
- [ ] Consistent with design system

---

## Phase 4: Polish & Animations

### Task 4.1: Add Animations to Key Sections
**Description:** Add RevealText animations to Dashboard and Project headers
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.6
**Can run parallel with:** Task 4.2

**Technical Requirements:**

Add RevealText wrapping to:
- Dashboard page title and stats
- Project page section headers
- SharePage welcome message

Add staggered delays:
```tsx
<RevealText delay={0}>Title</RevealText>
<RevealText delay={0.1}>Subtitle</RevealText>
<RevealText delay={0.2}>Body</RevealText>
```

**Acceptance Criteria:**
- [ ] Elements fade up on scroll
- [ ] Stagger creates smooth sequence
- [ ] Works correctly in all browsers

---

### Task 4.2: Add Atmospheric Glows
**Description:** Add GlowPulse backgrounds to hero areas
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 3.6
**Can run parallel with:** Task 4.1

**Technical Requirements:**

Add GlowPulse to:
- Login/Register pages (behind card)
- Dashboard empty state
- SharePage welcome area

**Acceptance Criteria:**
- [ ] Glows create atmospheric depth
- [ ] Don't interfere with content
- [ ] Respect reduced-motion

---

### Task 4.3: Theme Recharts for Analytics
**Description:** Update AnalyticsDashboard to use dark theme with gold/purple accents
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.6
**Can run parallel with:** Task 4.4

**Technical Requirements:**

Update Recharts configuration:
- Dark axis lines and labels
- Gold primary series
- Purple secondary series
- Dark tooltip background with glass effect

**Acceptance Criteria:**
- [ ] Charts have dark background
- [ ] Series use gold/purple
- [ ] Tooltips are styled
- [ ] Grid lines are subtle

---

### Task 4.4: Create Geometric SVG Icons for Empty States
**Description:** Replace emoji in empty states with geometric SVG icons
**Size:** Medium
**Priority:** Medium
**Dependencies:** Task 3.6
**Can run parallel with:** Task 4.3

**Technical Requirements:**

Create icons following the icon style guide:
- Documents → Stacked layered rectangles
- Growth/Ascending → Ascending bars
- Network → Connected nodes

Replace in:
- DashboardPage empty project state
- DocumentUpload empty state
- Any other emoji empty states

**Acceptance Criteria:**
- [ ] All emoji replaced with SVG
- [ ] Icons follow geometric style guide
- [ ] Icons use gold accent color

---

### Task 4.5: Update Favicon and Verify Complete
**Description:** Update favicon and perform final verification
**Size:** Small
**Priority:** Medium
**Dependencies:** Task 4.1-4.4
**Can run parallel with:** None

**Technical Requirements:**

1. Create/update favicon with 33 Strategies brand (gold on dark)
2. Run comprehensive verification:
   - All pages load with dark background
   - All buttons are gold or glass
   - No hardcoded colors (search codebase)
   - Fonts load correctly
   - Animations work
   - Reduced motion respected

**Verification Commands:**
```bash
# Search for hardcoded blue
grep -r "bg-blue" frontend/src --include="*.tsx"
grep -r "text-blue" frontend/src --include="*.tsx"

# Search for hardcoded gray
grep -r "bg-gray" frontend/src --include="*.tsx"
grep -r "text-gray" frontend/src --include="*.tsx"
```

**Acceptance Criteria:**
- [ ] Favicon updated
- [ ] Zero hardcoded blue/gray colors
- [ ] All acceptance criteria from previous tasks met
- [ ] Multi-Claude verification passes

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Foundation | 10 tasks | High |
| Phase 2: Pages | 6 tasks | High |
| Phase 3: Components | 6 tasks | High/Medium |
| Phase 4: Polish | 5 tasks | Medium |
| **Total** | **27 tasks** | |

### Parallel Execution Opportunities

**Phase 1 (after Task 1.3):**
- Tasks 1.4-1.9 can all run in parallel

**Phase 2 (after Task 1.10):**
- Tasks 2.1-2.2 in parallel
- Tasks 2.3-2.4 in parallel
- Tasks 2.5-2.6 in parallel

**Phase 3:**
- Tasks 3.1-3.3 in parallel
- Tasks 3.4-3.5 in parallel

**Phase 4:**
- Tasks 4.1-4.4 in parallel

### Critical Path

1. Task 1.1 (Dependencies)
2. Task 1.2 + 1.3 (Tokens + Config)
3. Tasks 1.4-1.9 (Components)
4. Task 1.10 (Verify Foundation)
5. Phase 2 (Pages)
6. Phase 3 (Components)
7. Phase 4 (Polish)
8. Task 4.5 (Final Verification)
