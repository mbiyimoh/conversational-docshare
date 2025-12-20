export type DepthLevel = 'concise' | 'balanced' | 'detailed'
export type FontFamily = 'dm-sans' | 'inter' | 'atkinson' | 'merriweather' | 'lora' | 'source-serif'
export type FontSize = 'small' | 'medium' | 'large'
export type ThemeName = 'default' | 'nord' | 'warm-reading' | 'high-contrast' | 'soft-charcoal' | 'ocean-depth'

export interface ViewerPreferences {
  depth: DepthLevel
  fontFamily: FontFamily
  fontSize: FontSize
  theme: ThemeName
  onboardingComplete: boolean
  paperMode: boolean
}

export const DEFAULT_PREFERENCES: ViewerPreferences = {
  depth: 'balanced',
  fontFamily: 'dm-sans',
  fontSize: 'medium',
  theme: 'default',
  onboardingComplete: false,
  paperMode: true
}

export const DEPTH_OPTIONS: Array<{
  value: DepthLevel
  label: string
  description: string
}> = [
  { value: 'concise', label: 'Quick Summary', description: 'Key points only' },
  { value: 'balanced', label: 'Balanced', description: 'Context with key details' },
  { value: 'detailed', label: 'Full Context', description: 'Comprehensive with examples' }
]

export const FONT_SIZE_OPTIONS: Array<{
  value: FontSize
  label: string
  cssValue: string
  previewSize: string
}> = [
  { value: 'small', label: 'Small', cssValue: '14px', previewSize: '0.875rem' },
  { value: 'medium', label: 'Medium', cssValue: '16px', previewSize: '1rem' },
  { value: 'large', label: 'Large', cssValue: '18px', previewSize: '1.125rem' }
]

export const FONT_OPTIONS: Array<{
  value: FontFamily
  label: string
  category: 'sans-serif' | 'serif'
  fontStack: string
}> = [
  { value: 'dm-sans', label: 'DM Sans', category: 'sans-serif', fontStack: '"DM Sans", sans-serif' },
  { value: 'inter', label: 'Inter', category: 'sans-serif', fontStack: '"Inter", sans-serif' },
  { value: 'atkinson', label: 'Atkinson', category: 'sans-serif', fontStack: '"Atkinson Hyperlegible", sans-serif' },
  { value: 'merriweather', label: 'Merriweather', category: 'serif', fontStack: '"Merriweather", serif' },
  { value: 'lora', label: 'Lora', category: 'serif', fontStack: '"Lora", serif' },
  { value: 'source-serif', label: 'Source Serif', category: 'serif', fontStack: '"Source Serif 4", serif' }
]

// Sample responses for live preview during onboarding
export const SAMPLE_RESPONSES: Record<DepthLevel, string> = {
  concise: "Revenue grows 3x to $15M ARR by 2026. Key drivers: enterprise expansion and product-led growth.",
  balanced: "Revenue is projected to grow 3x by 2026, reaching $15M ARR. Year 1 focuses on SMB ($3.5M), Year 2 on enterprise expansion ($8M), and Year 3 adds product-led growth channels. The projections assume 15% monthly churn reduction.",
  detailed: `Our financial model projects growth across three horizons:

**Year 1 (2024):** $3.5M ARR
- 500 paying customers at $7K ACV
- 85% gross margins from SaaS model

**Year 2 (2025):** $8M ARR
- Average deal size increases to $25K
- Sales team scales from 5 to 15 reps

**Year 3 (2026):** $15M ARR
- Self-serve tier drives 40% of new revenue
- International expansion begins

The projections assume 15% monthly churn reduction through improved onboarding.`
}

export const SAMPLE_USER_QUESTION = "What are the key financial projections?"

export const THEME_OPTIONS: Array<{
  value: ThemeName
  label: string
  colors: {
    bg: string
    bgElevated: string
    text: string
    textMuted: string
    accent: string
    border: string
  }
}> = [
  {
    value: 'default',
    label: '33 Strategies',
    colors: {
      bg: '240 20% 4%',           // #0a0a0f
      bgElevated: '240 18% 5%',
      text: '0 0% 96%',           // #f5f5f5
      textMuted: '0 0% 53%',
      accent: '41 57% 54%',       // #d4a54a
      border: '0 0% 100% / 0.08'
    }
  },
  {
    value: 'nord',
    label: 'Nord',
    colors: {
      bg: '220 16% 22%',          // #2e3440
      bgElevated: '222 16% 28%',
      text: '218 27% 94%',        // #e5e9f0
      textMuted: '219 28% 72%',
      accent: '193 43% 67%',      // #88c0d0
      border: '220 16% 36% / 0.5'
    }
  },
  {
    value: 'warm-reading',
    label: 'Warm Reading',
    colors: {
      bg: '30 20% 13%',           // #2a2218
      bgElevated: '30 18% 18%',
      text: '35 30% 85%',         // #e8dcc8
      textMuted: '35 20% 60%',
      accent: '41 57% 54%',       // Keep gold
      border: '30 15% 25% / 0.5'
    }
  },
  {
    value: 'high-contrast',
    label: 'High Contrast',
    colors: {
      bg: '0 0% 0%',              // #000000
      bgElevated: '0 0% 8%',
      text: '0 0% 100%',          // #ffffff
      textMuted: '0 0% 70%',
      accent: '48 96% 53%',       // #facc15
      border: '0 0% 100% / 0.2'
    }
  },
  {
    value: 'soft-charcoal',
    label: 'Soft Charcoal',
    colors: {
      bg: '0 0% 10%',             // #1a1a1a
      bgElevated: '0 0% 14%',
      text: '0 0% 88%',           // #e0e0e0
      textMuted: '0 0% 55%',
      accent: '258 90% 66%',      // #8b5cf6
      border: '0 0% 100% / 0.1'
    }
  },
  {
    value: 'ocean-depth',
    label: 'Ocean Depth',
    colors: {
      bg: '210 50% 8%',           // Deep ocean blue-black
      bgElevated: '210 45% 12%',
      text: '185 40% 92%',        // Soft cyan-white
      textMuted: '200 25% 55%',
      accent: '175 60% 50%',      // Teal accent
      border: '200 40% 30% / 0.4'
    }
  }
]
