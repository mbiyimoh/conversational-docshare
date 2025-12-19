import { cn } from '../../lib/utils'
import { DEPTH_OPTIONS, DepthLevel } from './viewerPrefsConfig'

interface DepthSelectorProps {
  value: DepthLevel
  onChange: (depth: DepthLevel) => void
}

export function DepthSelector({ value, onChange }: DepthSelectorProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
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
  )
}
