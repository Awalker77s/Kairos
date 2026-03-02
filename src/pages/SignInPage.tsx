import { FormEvent, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SignInPage() {
  const { user, signIn, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email, password)
      const from = (location.state as { from?: { pathname: string } } | undefined)?.from?.pathname ?? '/dashboard'
      window.location.assign(from)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to continue with Google.')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-6xl items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-warm-border bg-warm-white p-8 shadow-lg">
        <h1 className="font-serif text-2xl font-semibold text-warm-black">Sign in to Kairos</h1>
        <p className="mt-2 text-sm text-warm-stone">Welcome back. Continue building your next project.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-warm-black">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          <label className="block text-sm font-medium text-warm-black">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-warm-border bg-cream px-3 py-2.5 text-warm-black outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
          </label>

          {error && <p className="rounded-lg border border-red-300/40 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-warm-black transition hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Signing in\u2026' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="mt-3 w-full rounded-lg border border-warm-border px-4 py-2.5 font-medium text-warm-black transition hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-70"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-warm-stone">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-gold hover:text-gold-dark">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  )
}
