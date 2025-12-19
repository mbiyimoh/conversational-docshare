import { cn } from '../../lib/utils'
import { FONT_OPTIONS, FontFamily } from './viewerPrefsConfig'

interface FontSelectorProps {
  value: FontFamily
  onChange: (font: FontFamily) => void
}

export function FontSelector({ value, onChange }: FontSelectorProps) {
  const sansSerif = FONT_OPTIONS.filter(f => f.category === 'sans-serif')
  const serif = FONT_OPTIONS.filter(f => f.category === 'serif')

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Sans-Serif Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Sans-Serif</p>
        <div className="grid grid-cols-3 gap-3">
          {sansSerif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-4 rounded-xl border transition-all',
                'text-base min-h-[60px]',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                value === font.value
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>

      {/* Serif Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Serif</p>
        <div className="grid grid-cols-3 gap-3">
          {serif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-4 rounded-xl border transition-all',
                'text-base min-h-[60px]',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                value === font.value
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
              )}
            >
              {font.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
