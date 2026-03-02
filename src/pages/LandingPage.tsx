import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const steps = [
  {
    number: '01',
    icon: '📝',
    title: 'Describe Your Space',
    copy: "Type a plain English description of your home or project. Kairo's AI turns it into a precise 2D floor plan instantly.",
  },
  {
    number: '02',
    icon: '🏡',
    title: 'Walk Through in 3D',
    copy: 'Your floor plan is automatically extruded into an interactive 3D model. Orbit, pan, and explore every room before anything is built.',
  },
  {
    number: '03',
    icon: '🛋️',
    title: 'See It Furnished',
    copy: 'Choose a design style and Kairo generates photorealistic room renders showing your space fully furnished and decorated.',
  },
]

export function LandingPage() {
  const { user, loading } = useAuth()

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4">
      <section className="py-20 text-center md:py-24">
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">From sketch to stunning in seconds</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-stone">
          Describe your space in plain English — Kairo generates a 2D floor plan, 3D walkthrough, and photorealistic room renders in minutes
        </p>
        <Link
          to="/signup"
          className="mt-8 inline-flex rounded-xl bg-brand-orange px-7 py-3 font-semibold text-brand-black transition hover:bg-amber"
        >
          Start for Free
        </Link>
      </section>

      <section className="pb-16 md:pb-20">
        <h2 className="mb-8 text-center text-2xl font-semibold md:text-3xl">How it works</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/10 bg-charcoal/70 p-6 shadow-lg shadow-black/20">
              <p className="text-4xl font-bold text-brand-orange">{step.number}</p>
              <div className="mt-3 text-3xl" aria-hidden="true">
                {step.icon}
              </div>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-16 rounded-xl border border-white/10 bg-white/5 px-6 py-5 text-center text-sm text-stone md:text-base">
        Trusted by architects, contractors, and designers
      </section>

      <section className="pb-20">
        <div className="rounded-2xl bg-charcoal px-6 py-12 text-center shadow-xl shadow-black/30">
          <h2 className="text-2xl font-semibold md:text-3xl">Ready to visualize your space?</h2>
          <Link
            to="/signup"
            className="mt-6 inline-flex rounded-xl bg-brand-orange px-7 py-3 font-semibold text-brand-black transition hover:bg-amber"
          >
            Generate Your First Floor Plan — It's Free
          </Link>
        </div>
      </section>
    </main>
  )
}
