import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-4 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-charcoal/70 p-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-brand-orange">Kairo</p>
        <h1 className="mt-3 text-4xl font-bold">Page not found</h1>
        <p className="mt-3 text-stone">The page you are looking for does not exist or may have been moved.</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-lg bg-brand-orange px-6 py-3 font-semibold text-brand-black transition hover:bg-amber"
        >
          Go Home
        </Link>
      </section>
    </main>
  )
}
