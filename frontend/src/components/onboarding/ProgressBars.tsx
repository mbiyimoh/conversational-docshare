import { cn } from '../../lib/utils'

interface ProgressBarsProps {
  currentIndex: number
  total: number
}

export function ProgressBars({ currentIndex, total }: ProgressBarsProps) {
  return (
    <div
      className="flex gap-1.5 px-5 pt-14"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Slide ${currentIndex + 1} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 h-0.5 rounded-full transition-all duration-300',
            i <= currentIndex
              ? 'bg-accent shadow-[0_0_8px_hsl(var(--color-accent-glow))]'
              : 'bg-white/10'
          )}
        />
      ))}
    </div>
  )
}
