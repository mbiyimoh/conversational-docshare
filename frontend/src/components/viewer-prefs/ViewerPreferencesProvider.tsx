import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useViewerPreferences, UseViewerPreferencesReturn } from './useViewerPreferences'
import { THEME_OPTIONS, FONT_OPTIONS } from './viewerPrefsConfig'

const ViewerPreferencesContext = createContext<UseViewerPreferencesReturn | null>(null)

export function useViewerPreferencesContext() {
  const context = useContext(ViewerPreferencesContext)
  if (!context) {
    throw new Error('useViewerPreferencesContext must be used within ViewerPreferencesProvider')
  }
  return context
}

interface ViewerPreferencesProviderProps {
  children: ReactNode
}

export function ViewerPreferencesProvider({ children }: ViewerPreferencesProviderProps) {
  const preferencesState = useViewerPreferences()
  const { preferences } = preferencesState

  // Apply CSS variables to document root when theme changes
  useEffect(() => {
    const theme = THEME_OPTIONS.find(t => t.value === preferences.theme)
    if (!theme) return

    const root = document.documentElement
    root.style.setProperty('--color-bg', theme.colors.bg)
    root.style.setProperty('--color-bg-elevated', theme.colors.bgElevated)
    root.style.setProperty('--color-text', theme.colors.text)
    root.style.setProperty('--color-text-muted', theme.colors.textMuted)
    root.style.setProperty('--color-accent', theme.colors.accent)
    root.style.setProperty('--color-border', theme.colors.border)

    // Also set data attribute for potential CSS selectors
    root.dataset.theme = preferences.theme

    return () => {
      // Cleanup: remove data attribute (CSS vars persist, which is fine)
      delete root.dataset.theme
    }
  }, [preferences.theme])

  // Apply font family when it changes
  useEffect(() => {
    const font = FONT_OPTIONS.find(f => f.value === preferences.fontFamily)
    if (!font) return

    const root = document.documentElement
    root.style.setProperty('--font-body', font.fontStack)
  }, [preferences.fontFamily])

  return (
    <ViewerPreferencesContext.Provider value={preferencesState}>
      {children}
    </ViewerPreferencesContext.Provider>
  )
}
