import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import { Card, Button, Input, AccentText, GlowPulse } from '../components/ui'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.login(email, password)
      api.setToken(response.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col">
      {/* Atmospheric glows */}
      <GlowPulse className="w-96 h-96 -top-48 left-1/4" />
      <GlowPulse className="w-80 h-80 bottom-1/4 -right-40" color="purple" />

      <div className="relative flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-24 px-6 py-16 lg:py-12">
        {/* Hero Section */}
        <div className="lg:flex-1 max-w-xl text-center lg:text-left">
          {/* Brand Header */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-foreground mb-2">
            <AccentText>Conversational</AccentText> DocShare
          </h1>
          <p className="text-xs font-mono font-medium tracking-[0.2em] uppercase text-dim mb-8">
            by 33 Strategies
          </p>

          {/* Tagline */}
          <p className="font-display text-xl sm:text-2xl text-muted mb-3">
            What if your documents could <AccentText>speak for you</AccentText>?
          </p>
          <p className="text-muted font-body mb-8">
            Train an AI that represents you—and presents your documents <AccentText>better than even you would</AccentText>.
          </p>

          {/* Feature Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl lg:max-w-xl">
            <div className="p-4 rounded-xl border border-border bg-white/[0.02] backdrop-blur-sm text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm text-foreground font-body">Total mastery of every document detail</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-white/[0.02] backdrop-blur-sm text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-foreground font-body">Speaks directly to your audience's needs</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-white/[0.02] backdrop-blur-sm text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-accent/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-foreground font-body">Guided conversation replaces endless scrolling</p>
            </div>
          </div>

          {/* Sign In Section */}
          <div className="w-full max-w-md mt-8 mx-auto">
            <AnimatePresence mode="wait">
              {!showLoginForm ? (
                <motion.div
                  key="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <Button
                    onClick={() => setShowLoginForm(true)}
                    className="px-8"
                  >
                    Sign in
                  </Button>
                  <p className="mt-4 text-sm text-muted">
                    Don't have an account?{' '}
                    <a href="/register" className="font-medium text-accent hover:text-accent/80 transition-colors">
                      Sign up
                    </a>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <Card className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl text-foreground">
                        <AccentText>Sign in</AccentText>
                      </h2>
                      <button
                        onClick={() => setShowLoginForm(false)}
                        className="text-dim hover:text-muted transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                      {error && (
                        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                          {error}
                        </div>
                      )}

                      <Input
                        id="email"
                        type="email"
                        label="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                      />

                      <Input
                        id="password"
                        type="password"
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                      />

                      <Button
                        type="submit"
                        disabled={loading}
                        isLoading={loading}
                        className="w-full"
                      >
                        {loading ? 'Signing in...' : 'Sign in'}
                      </Button>

                      <p className="text-center text-sm text-muted">
                        Don't have an account?{' '}
                        <a href="/register" className="font-medium text-accent hover:text-accent/80 transition-colors">
                          Sign up
                        </a>
                      </p>
                    </form>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
