import { cn } from '../../lib/utils'
import { DEPTH_OPTIONS, DepthLevel } from './viewerPrefsConfig'

interface DepthSelectorProps {
  value: DepthLevel
  onChange: (depth: DepthLevel) => void
}

// Visual indicator dots showing depth level
function DepthIndicator({ level, isSelected }: { level: number; isSelected: boolean }) {
  return (
    <div className="flex gap-1 mt-1 md:mt-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-colors',
            i <= level
              ? isSelected ? 'bg-accent' : 'bg-muted'
              : 'bg-muted/30'
          )}
        />
      ))}
    </div>
  )
}

export function DepthSelector({ value, onChange }: DepthSelectorProps) {
  return (
    <div className="w-full">
      {/* Mobile: horizontal compact layout */}
      <div className="grid grid-cols-3 gap-2 md:hidden">
        {DEPTH_OPTIONS.map((option, index) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-center justify-center p-3 rounded-xl border transition-all',
              'text-center min-h-[70px]',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
              value === option.value
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
            )}
          >
            <span className="font-semibold text-xs leading-tight">{option.label}</span>
            <DepthIndicator level={index} isSelected={value === option.value} />
          </button>
        ))}
      </div>

      {/* Desktop: vertical cards with descriptions */}
      <div className="hidden md:flex flex-col gap-3">
        {DEPTH_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-start p-4 rounded-xl border transition-all',
              'text-left min-h-[44px]',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background',
              value === option.value
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-border bg-background-elevated/50 text-muted hover:border-accent/50 hover:text-foreground'
            )}
          >
            <span className="font-semibold text-sm">{option.label}</span>
            <span className="text-xs text-muted mt-1">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
