import { cn } from '../../lib/utils'
import { useViewerPreferencesContext } from '../viewer-prefs'

interface PaperContainerProps {
  children: React.ReactNode
  className?: string
}

export function PaperContainer({ children, className }: PaperContainerProps) {
  const { preferences } = useViewerPreferencesContext()

  if (!preferences.paperMode) {
    // Dark mode fallback - pass through with existing styling
    return <div className={className}>{children}</div>
  }

  return (
    <div
      className={cn(
        // Paper surface
        'bg-[#F5F3EF] text-[#222222]',
        // Elevation/shadow for "floating paper" effect
        'rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.15)]',
        // Padding for paper margins
        'p-8',
        // Paper mode class for citation highlight targeting
        'paper-mode',
        className
      )}
      data-testid="paper-container"
    >
      {children}
    </div>
  )
}
