import { Link, NavLink, useNavigate } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { useAuth } from '../context/AuthContext'

export function Layout({ children }: PropsWithChildren) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-warm-border bg-cream/90 backdrop-blur-sm">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-serif text-2xl font-bold tracking-tight text-warm-black">
            Kairos
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <NavItem to="/">Features</NavItem>
            <NavItem to="/pricing">Pricing</NavItem>
            
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="rounded-lg border border-warm-border px-4 py-2 text-sm font-medium text-warm-black transition hover:border-gold hover:text-gold"
                >
                  Dashboard
                </Link>
                <Link
                  to="/billing"
                  className="rounded-lg border border-warm-border px-4 py-2 text-sm font-medium text-warm-black transition hover:border-gold hover:text-gold"
                >
                  Billing
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => navigate('/'))
                  }}
                  className="rounded-lg bg-cognac px-4 py-2 text-sm font-semibold text-cream transition hover:bg-cognac-light"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className="rounded-lg border border-warm-border px-4 py-2 text-sm font-medium text-warm-black transition hover:border-gold hover:text-gold"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-warm-black transition hover:bg-gold-dark"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {children}

      <footer className="mt-20 border-t border-cognac/20 bg-cognac">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-10 text-sm text-cream/80 md:grid-cols-2">
          <p className="font-serif text-base text-cream">
            &copy; {new Date().getFullYear()} Kairos. From sketch to stunning in seconds.
          </p>
          <div className="flex gap-6 md:justify-end">
            <a href="#" className="transition hover:text-gold-light">
              Docs
            </a>
            <a href="#" className="transition hover:text-gold-light">
              Privacy
            </a>
            <a href="#" className="transition hover:text-gold-light">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function NavItem({ to, children }: PropsWithChildren<{ to: string }>) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-sm font-medium transition-colors ${isActive ? 'text-gold' : 'text-warm-stone hover:text-warm-black'}`
      }
    >
      {children}
    </NavLink>
  )
}
