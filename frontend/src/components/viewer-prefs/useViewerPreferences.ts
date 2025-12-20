import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  ViewerPreferences,
  DEFAULT_PREFERENCES,
  DepthLevel,
  FontFamily,
  FontSize,
  ThemeName
} from './viewerPrefsConfig'
import { safeLocalStorage } from '../../lib/utils'

const STORAGE_KEY = 'viewer_preferences'

export interface UseViewerPreferencesReturn {
  preferences: ViewerPreferences
  updateDepth: (depth: DepthLevel) => void
  updateFont: (font: FontFamily) => void
  updateFontSize: (fontSize: FontSize) => void
  updateTheme: (theme: ThemeName) => void
  updatePaperMode: (paperMode: boolean) => void
  markOnboardingComplete: () => void
  resetOnboarding: () => void
  resetAll: () => void
}

export function useViewerPreferences(): UseViewerPreferencesReturn {
  const storage = useMemo(() => safeLocalStorage(), [])

  const [preferences, setPreferences] = useState<ViewerPreferences>(() => {
    if (!storage) return DEFAULT_PREFERENCES

    const stored = storage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_PREFERENCES

    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    } catch {
      return DEFAULT_PREFERENCES
    }
  })

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    storage?.setItem(STORAGE_KEY, JSON.stringify(preferences))
  }, [preferences, storage])

  const updateDepth = useCallback((depth: DepthLevel) => {
    setPreferences(prev => ({ ...prev, depth }))
  }, [])

  const updateFont = useCallback((fontFamily: FontFamily) => {
    setPreferences(prev => ({ ...prev, fontFamily }))
  }, [])

  const updateFontSize = useCallback((fontSize: FontSize) => {
    setPreferences(prev => ({ ...prev, fontSize }))
  }, [])

  const updateTheme = useCallback((theme: ThemeName) => {
    setPreferences(prev => ({ ...prev, theme }))
  }, [])

  const updatePaperMode = useCallback((paperMode: boolean) => {
    setPreferences(prev => ({ ...prev, paperMode }))
  }, [])

  const markOnboardingComplete = useCallback(() => {
    setPreferences(prev => ({ ...prev, onboardingComplete: true }))
  }, [])

  const resetOnboarding = useCallback(() => {
    setPreferences(prev => ({ ...prev, onboardingComplete: false }))
  }, [])

  const resetAll = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    storage?.removeItem(STORAGE_KEY)
  }, [storage])

  return {
    preferences,
    updateDepth,
    updateFont,
    updateFontSize,
    updateTheme,
    updatePaperMode,
    markOnboardingComplete,
    resetOnboarding,
    resetAll
  }
}
