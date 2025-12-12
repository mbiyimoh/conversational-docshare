import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Button, Input, AccentText, GlowPulse } from '../components/ui'

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.register(email, password, name)
      api.setToken(response.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Atmospheric glow */}
      <GlowPulse className="w-96 h-96 -top-48 -left-48" />
      <GlowPulse className="w-80 h-80 -bottom-40 -right-40" color="purple" />

      <div className="relative w-full max-w-md px-4">
        <Card className="space-y-8">
          <div className="text-center">
            <h2 className="font-display text-3xl text-foreground">
              <AccentText>Create account</AccentText>
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
                id="name"
                type="text"
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />

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
                placeholder="Choose a password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              isLoading={loading}
              className="w-full"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>

            <p className="text-center text-sm text-muted">
              Already have an account?{' '}
              <a href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
                Sign in
              </a>
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
