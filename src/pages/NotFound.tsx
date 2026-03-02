import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl items-center justify-center px-6 py-16">
      <section className="w-full max-w-xl rounded-2xl border border-warm-border bg-warm-white p-12 text-center shadow-lg">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">Kairos</p>
        <h1 className="mt-3 font-serif text-4xl font-bold text-warm-black">Page Not Found</h1>
        <p className="mt-3 text-warm-stone">The page you are looking for does not exist or may have been moved.</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-lg bg-gold px-6 py-3 font-semibold text-warm-black transition hover:bg-gold-dark"
        >
          Go Home
        </Link>
      </section>
    </main>
  )
}
