import { useState, useCallback, useMemo } from 'react'
import { safeLocalStorage } from '../../lib/utils'

const STORAGE_KEY = 'onboarding_complete'

interface OnboardingState {
  isComplete: boolean
  markComplete: () => void
  reset: () => void // For "Take Tour" re-trigger
}

export function useOnboardingState(): OnboardingState {
  const storage = useMemo(() => safeLocalStorage(), [])

  const [isComplete, setIsComplete] = useState(() => {
    return storage?.getItem(STORAGE_KEY) === 'true'
  })

  const markComplete = useCallback(() => {
    storage?.setItem(STORAGE_KEY, 'true')
    setIsComplete(true)
  }, [storage])

  const reset = useCallback(() => {
    storage?.removeItem(STORAGE_KEY)
    setIsComplete(false)
  }, [storage])

  return { isComplete, markComplete, reset }
}
