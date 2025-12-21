import { cn } from '../../lib/utils'
import { FONT_OPTIONS, FONT_SIZE_OPTIONS, FontFamily, FontSize } from './viewerPrefsConfig'

interface FontSelectorProps {
  value: FontFamily
  fontSize: FontSize
  onChange: (font: FontFamily) => void
  onFontSizeChange: (fontSize: FontSize) => void
}

export function FontSelector({ value, fontSize, onChange, onFontSizeChange }: FontSelectorProps) {
  const sansSerif = FONT_OPTIONS.filter(f => f.category === 'sans-serif')
  const serif = FONT_OPTIONS.filter(f => f.category === 'serif')

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Font Style Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Font Style</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {sansSerif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-3 rounded-xl border transition-all',
                'text-base min-h-[50px]',
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
        <div className="grid grid-cols-3 gap-3">
          {serif.map((font) => (
            <button
              key={font.value}
              onClick={() => onChange(font.value)}
              style={{ fontFamily: font.fontStack }}
              className={cn(
                'flex items-center justify-center p-3 rounded-xl border transition-all',
                'text-base min-h-[50px]',
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

      {/* Font Size Section */}
      <div>
        <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Text Size</p>
        <div className="grid grid-cols-3 gap-3">
          {FONT_SIZE_OPTIONS.map((size) => (
            <button
              key={size.value}
              onClick={() => onFontSizeChange(size.value)}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
                'min-h-[60px] gap-1',
                'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
                fontSize === size.value
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
              )}
            >
              <span
                className="font-medium"
                style={{ fontSize: size.previewSize }}
              >
                Aa
              </span>
              <span className="text-xs text-muted">{size.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
