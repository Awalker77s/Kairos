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
    <main className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-6xl items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-charcoal/70 p-8 shadow-2xl shadow-black/30">
        <h1 className="text-2xl font-semibold text-off-white">Sign in to Kairos</h1>
        <p className="mt-2 text-sm text-stone">Welcome back. Continue building your next project.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-stone">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-brand-black px-3 py-2 text-off-white outline-none ring-brand-orange/50 transition focus:ring"
            />
          </label>

          <label className="block text-sm text-stone">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-white/15 bg-brand-black px-3 py-2 text-off-white outline-none ring-brand-orange/50 transition focus:ring"
            />
          </label>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-orange px-4 py-2 font-semibold text-brand-black transition hover:bg-amber disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="mt-3 w-full rounded-lg border border-white/20 px-4 py-2 font-medium text-off-white transition hover:border-amber disabled:cursor-not-allowed disabled:opacity-70"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-stone">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-amber hover:text-brand-orange">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  )
}
