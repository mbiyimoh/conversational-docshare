/**
 * Example Layout Integration
 *
 * Copy this pattern into your app/layout.tsx to add the global feedback button.
 * The FeedbackButton will appear on all pages in the bottom-left corner.
 */

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'  // Or your toast library
import { FeedbackButton } from '@/components/feedback/FeedbackButton'
import './globals.css'

// Your auth provider (update import path as needed)
// import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Your App',
  description: 'Your app description',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap with your auth provider */}
        {/* <AuthProvider> */}
          {children}

          {/* Toast notifications (required for feedback toasts) */}
          <Toaster />

          {/* Global feedback button - appears on all pages */}
          <FeedbackButton />
        {/* </AuthProvider> */}
      </body>
    </html>
  )
}
