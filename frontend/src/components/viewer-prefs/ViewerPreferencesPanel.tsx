import { cn } from '../../lib/utils'
import { useViewerPreferencesContext } from './ViewerPreferencesProvider'
import { DepthSelector } from './DepthSelector'
import { FontSelector } from './FontSelector'
import { ThemeSelector } from './ThemeSelector'

interface ViewerPreferencesPanelProps {
  className?: string
}

export function ViewerPreferencesPanel({ className }: ViewerPreferencesPanelProps) {
  const {
    preferences,
    updateDepth,
    updateFont,
    updateFontSize,
    updateTheme,
    updatePaperMode
  } = useViewerPreferencesContext()

  return (
    <div className={cn('space-y-6', className)}>
      {/* Document Appearance */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted">Document Appearance</label>
        <div className="flex gap-2">
          <button
            onClick={() => updatePaperMode(true)}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg border text-sm transition-colors",
              preferences.paperMode
                ? "bg-accent text-background border-accent"
                : "bg-card-bg text-foreground border-border hover:border-accent/50"
            )}
          >
            Paper (Light)
          </button>
          <button
            onClick={() => updatePaperMode(false)}
            className={cn(
              "flex-1 px-3 py-2 rounded-lg border text-sm transition-colors",
              !preferences.paperMode
                ? "bg-accent text-background border-accent"
                : "bg-card-bg text-foreground border-border hover:border-accent/50"
            )}
          >
            Integrated (Dark)
          </button>
        </div>
      </div>

      {/* Response Depth */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted">Response Detail Level</label>
        <DepthSelector
          value={preferences.depth}
          onChange={updateDepth}
        />
      </div>

      {/* Font Settings */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted">Font & Size</label>
        <FontSelector
          value={preferences.fontFamily}
          fontSize={preferences.fontSize}
          onChange={updateFont}
          onFontSizeChange={updateFontSize}
        />
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted">Color Scheme</label>
        <ThemeSelector
          value={preferences.theme}
          onChange={updateTheme}
        />
      </div>
    </div>
  )
}
