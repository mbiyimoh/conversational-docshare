import { useState, useEffect } from 'react'

/**
 * Hook for detecting mobile viewport using matchMedia API.
 * @param breakpoint - The max width in pixels to consider "mobile" (default: 768px, Tailwind md breakpoint)
 * @returns true if viewport width is less than breakpoint
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < breakpoint
  })

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handler = (evt: MediaQueryListEvent) => setIsMobile(evt.matches)

    // Set initial value
    setIsMobile(mql.matches)

    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isMobile
}
