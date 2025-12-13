import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Button, Input, AccentText, GlowPulse } from '../components/ui'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
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
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Atmospheric glows */}
      <GlowPulse className="w-96 h-96 -top-48 left-1/4" />
      <GlowPulse className="w-80 h-80 bottom-1/4 -right-40" color="purple" />

      <div className="relative min-h-screen flex flex-col lg:flex-row items-center lg:justify-center gap-8 lg:gap-24 px-6 py-12 lg:py-0">
        {/* Hero Section */}
        <div className="flex-1 max-w-xl text-center lg:text-left">
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

          {/* Value Bullets */}
          <ul className="space-y-3 text-left inline-block">
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
              <span className="text-foreground font-body">Total mastery of every document detail</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
              <span className="text-foreground font-body">Speaks directly to your audience's needs</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
              <span className="text-foreground font-body">Guided conversation replaces endless scrolling</span>
            </li>
          </ul>
        </div>

        {/* Login Form */}
        <div className="w-full max-w-md flex-shrink-0">
          <Card className="space-y-8">
            <div className="text-center">
              <h2 className="font-display text-2xl text-foreground">
                <AccentText>Sign in</AccentText>
              </h2>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-4">
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
              </div>

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
        </div>
      </div>
    </div>
  )
}
