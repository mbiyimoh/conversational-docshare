import { cn } from '../../lib/utils'
import { THEME_OPTIONS, ThemeName } from './viewerPrefsConfig'

interface ThemeSelectorProps {
  value: ThemeName
  onChange: (theme: ThemeName) => void
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3 w-full">
      {THEME_OPTIONS.map((theme) => (
        <button
          key={theme.value}
          onClick={() => onChange(theme.value)}
          className={cn(
            'flex flex-col items-center p-2 md:p-4 rounded-xl border transition-all',
            'min-h-[65px] md:min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
            value === theme.value
              ? 'border-accent ring-2 ring-accent/30'
              : 'border-border hover:border-accent/50'
          )}
        >
          {/* Color preview swatch */}
          <div className="flex gap-0.5 md:gap-1 mb-1 md:mb-2">
            <div
              className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.bg})` }}
              title="Background"
            />
            <div
              className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.text})` }}
              title="Text"
            />
            <div
              className="w-4 h-4 md:w-6 md:h-6 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${theme.colors.accent})` }}
              title="Accent"
            />
          </div>
          <span className={cn(
            'text-xs md:text-sm font-medium text-center leading-tight',
            value === theme.value ? 'text-foreground' : 'text-muted'
          )}>
            {theme.label}
          </span>
        </button>
      ))}
    </div>
  )
}
