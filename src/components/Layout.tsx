import { Link, NavLink } from 'react-router-dom'
import type { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-brand-black/80 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-bold text-off-white">
            Kairo
          </Link>
          <div className="hidden items-center gap-6 md:flex">
            <NavItem to="/">Features</NavItem>
            <NavItem to="/pricing">Pricing</NavItem>
            <NavItem to="/blog">Blog</NavItem>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/signin" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-off-white hover:border-amber">
              Sign In
            </Link>
            <Link to="/signup" className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-black hover:bg-amber">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {children}

      <footer className="mt-16 border-t border-white/10">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 text-sm text-stone md:grid-cols-2">
          <p>© {new Date().getFullYear()} Kairo. From sketch to stunning in seconds.</p>
          <div className="flex gap-4 md:justify-end">
            <a href="#" className="hover:text-amber">
              Docs
            </a>
            <a href="#" className="hover:text-amber">
              Privacy
            </a>
            <a href="#" className="hover:text-amber">
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
    <NavLink to={to} className="text-sm text-stone transition-colors hover:text-off-white">
      {children}
    </NavLink>
  )
}
