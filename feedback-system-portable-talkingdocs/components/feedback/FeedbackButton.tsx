'use client'

import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

/**
 * Floating feedback button
 *
 * Fixed to bottom-left corner of screen (z-50).
 * Navigates to /feedback page on click.
 *
 * Add to your root layout.tsx to make it visible on all pages:
 * ```tsx
 * import { FeedbackButton } from '@/components/feedback/FeedbackButton'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <FeedbackButton />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export function FeedbackButton() {
  const router = useRouter()

  return (
    <Button
      onClick={() => router.push('/feedback')}
      className="fixed bottom-6 left-6 z-50 shadow-lg"
      size="lg"
    >
      <MessageSquarePlus className="mr-2 h-5 w-5" />
      Give Feedback
    </Button>
  )
}
