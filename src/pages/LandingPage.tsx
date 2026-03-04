import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BrandWordmark } from "../components/BrandWordmark";
import { ArchitecturalCanvas } from "../components/ArchitecturalCanvas";
import { useScrollAnimations } from "../hooks/useScrollAnimations";

const steps = [
  {
    number: "01",
    icon: "📝",
    title: "Describe Your Space",
    copy: "Type a plain English description of your home or project. Kairos's AI turns it into a precise 2D floor plan instantly.",
  },
  {
    number: "02",
    icon: "🏡",
    title: "Walk Through in 3D",
    copy: "Your floor plan is automatically extruded into an interactive 3D model. Orbit, pan, and explore every room before anything is built.",
  },
  {
    number: "03",
    icon: "🛋️",
    title: "See It Furnished",
    copy: "Choose a design style and Kairos generates photorealistic room renders showing your space fully furnished and decorated.",
  },
];

export function LandingPage() {
  const { user } = useAuth();
  useScrollAnimations();

  return (
    <>
      <ArchitecturalCanvas />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6">
        {/* Hero Section */}
        <section className="py-24 text-center md:py-32" data-animate>
          <p
            className="animate-section-child mb-4 text-sm font-medium uppercase tracking-[0.2em] text-gold"
            data-animate-child
          >
            AI-Powered Real Estate Design
          </p>
          <h1
            className="animate-section-child mx-auto max-w-4xl font-serif text-5xl font-bold leading-tight text-warm-black md:text-7xl"
            data-animate-child
          >
            From Sketch to Stunning in Seconds
          </h1>
          <p
            className="animate-section-child mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-warm-stone"
            data-animate-child
          >
            Describe your space in plain English —{" "}
            <BrandWordmark size="sm" className="align-middle" /> generates a 2D
            floor plan, 3D walkthrough, and photorealistic room renders in
            minutes.
          </p>
          <div className="animate-section-child relative mt-10 inline-block" data-animate-child>
            <span className="hero-glow absolute inset-0 rounded-xl bg-gold" />
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="relative inline-flex rounded-xl bg-gold px-8 py-4 text-base font-semibold text-warm-black shadow-lg shadow-gold/20 transition hover:bg-gold-dark hover:shadow-gold/30"
            >
              {user ? "Go to Dashboard" : "Start for Free"}
            </Link>
          </div>
        </section>

        {/* How It Works */}
        <section className="pb-20 md:pb-28" data-animate>
          <h2
            className="animate-section-child mb-12 text-center font-serif text-3xl font-semibold text-warm-black md:text-4xl"
            data-animate-child
          >
            How It Works
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <article
                key={step.title}
                className="animate-section-child rounded-2xl border border-warm-border bg-warm-white p-8 shadow-sm transition hover:shadow-md"
                data-animate-child
              >
                <p className="font-serif text-4xl font-bold text-gold">
                  {step.number}
                </p>
                <div className="mt-4 text-3xl" aria-hidden="true">
                  {step.icon}
                </div>
                <h3 className="mt-4 font-serif text-xl font-semibold text-warm-black">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-warm-stone">
                  {step.copy}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Trust Statement */}
        <section
          className="mb-20 rounded-xl border border-warm-border bg-warm-white px-6 py-6 text-center text-sm font-medium text-warm-stone md:text-base"
          data-animate
        >
          <span className="animate-section-child inline-block" data-animate-child>
            Trusted by architects, contractors, and interior designers
          </span>
        </section>

        {/* Final CTA */}
        <section className="pb-24" data-animate>
          <div className="rounded-2xl bg-cognac px-8 py-16 text-center shadow-xl">
            <h2
              className="animate-section-child font-serif text-3xl font-semibold text-cream md:text-4xl"
              data-animate-child
            >
              Ready to Visualize Your Space?
            </h2>
            <p
              className="animate-section-child mx-auto mt-4 max-w-lg text-cream/80"
              data-animate-child
            >
              Join thousands of professionals who trust{" "}
              <BrandWordmark size="sm" className="align-middle" /> to bring their
              designs to life.
            </p>
            <div className="animate-section-child mt-8" data-animate-child>
              <Link
                to={user ? "/dashboard" : "/signup"}
                className="inline-flex rounded-xl bg-gold px-8 py-4 text-base font-semibold text-warm-black shadow-lg transition hover:bg-gold-dark"
              >
                {user
                  ? "Open Your Dashboard"
                  : "Generate Your First Floor Plan — It's Free"}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
