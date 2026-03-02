import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const steps = [
  {
    number: '01',
    icon: '📝',
    title: 'Describe Your Space',
    copy: "Type a plain English description of your home or project. Kairos's AI turns it into a precise 2D floor plan instantly.",
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
    copy: 'Choose a design style and Kairos generates photorealistic room renders showing your space fully furnished and decorated.',
  },
]

export function LandingPage() {
  const { user } = useAuth()

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      <section className="py-24 text-center md:py-32">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-gold">AI-Powered Real Estate Design</p>
        <h1 className="mx-auto max-w-4xl font-serif text-5xl font-bold leading-tight text-warm-black md:text-7xl">
          From Sketch to Stunning in Seconds
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-warm-stone">
          Describe your space in plain English — Kairos generates a 2D floor plan, 3D walkthrough, and photorealistic room renders in minutes.
        </p>
        <Link
          to={user ? '/dashboard' : '/signup'}
          className="mt-10 inline-flex rounded-xl bg-gold px-8 py-4 text-base font-semibold text-warm-black shadow-lg shadow-gold/20 transition hover:bg-gold-dark hover:shadow-gold/30"
        >
          {user ? 'Go to Dashboard' : 'Start for Free'}
        </Link>
      </section>

      <section className="pb-20 md:pb-28">
        <h2 className="mb-12 text-center font-serif text-3xl font-semibold text-warm-black md:text-4xl">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.title}
              className="rounded-2xl border border-warm-border bg-warm-white p-8 shadow-sm transition hover:shadow-md"
            >
              <p className="font-serif text-4xl font-bold text-gold">{step.number}</p>
              <div className="mt-4 text-3xl" aria-hidden="true">
                {step.icon}
              </div>
              <h3 className="mt-4 font-serif text-xl font-semibold text-warm-black">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-warm-stone">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-20 rounded-xl border border-warm-border bg-warm-white px-6 py-6 text-center text-sm font-medium text-warm-stone md:text-base">
        Trusted by architects, contractors, and interior designers
      </section>

      <section className="pb-24">
        <div className="rounded-2xl bg-cognac px-8 py-16 text-center shadow-xl">
          <h2 className="font-serif text-3xl font-semibold text-cream md:text-4xl">Ready to Visualize Your Space?</h2>
          <p className="mx-auto mt-4 max-w-lg text-cream/80">
            Join thousands of professionals who trust Kairos to bring their designs to life.
          </p>
          <Link
            to={user ? '/dashboard' : '/signup'}
            className="mt-8 inline-flex rounded-xl bg-gold px-8 py-4 text-base font-semibold text-warm-black shadow-lg transition hover:bg-gold-dark"
          >
            {user ? 'Open Your Dashboard' : "Generate Your First Floor Plan — It's Free"}
          </Link>
        </div>
      </section>
    </main>
  )
}
