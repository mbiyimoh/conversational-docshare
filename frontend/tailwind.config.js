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
