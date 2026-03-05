import type { ReactNode } from "react";
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
    copy: "Type a plain English description like \"3 bedroom modern apartment with open kitchen.\" No technical jargon needed — just describe what you envision and Kairos handles the rest.",
    detail: "Input: Text description → Output: Architectural brief",
  },
  {
    number: "02",
    icon: "📐",
    title: "AI Generates Your Floor Plan",
    copy: "Kairos instantly produces a professional 2D architectural floor plan with accurate room proportions, labeled spaces, and proper dimensions. Ready to share or export.",
    detail: "Input: Brief → Output: 2D Floor Plan",
  },
  {
    number: "03",
    icon: "🏗️",
    title: "Visualize in 3D",
    copy: "Watch your floor plan transform into a fully navigable 3D model. Orbit, pan, and explore every room from any angle — before anything is built.",
    detail: "Input: Floor Plan → Output: 3D Walkthrough",
  },
  {
    number: "04",
    icon: "🖼️",
    title: "Render Every Room",
    copy: "Get photorealistic room renders complete with furniture, lighting, and materials. Perfect for client presentations, listings, and design approvals.",
    detail: "Input: 3D Model → Output: Photorealistic Renders",
  },
];

const stats = [
  { value: "10,000+", label: "Floor Plans Generated" },
  { value: "500+", label: "Real Estate Firms" },
  { value: "3x", label: "Faster Than Traditional Methods" },
  { value: "98%", label: "Client Satisfaction" },
];

const features = [
  {
    headline: "Professional Floor Plans in Seconds",
    body: "Describe any property in plain English and Kairos generates accurate, architect-quality 2D floor plans instantly. No CAD software. No drafting skills required.",
    bullets: ["Accurate room proportions", "Labeled spaces", "Export to PDF"],
    visual: "floor-plan",
  },
  {
    headline: "Bring Properties to Life in 3D",
    body: "Transform any floor plan into a fully navigable 3D model. Let clients walk through a property before it's built or before they visit.",
    bullets: ["Real-time 3D navigation", "Shareable links", "Mobile friendly"],
    visual: "3d-model",
  },
  {
    headline: "Photorealistic Room Renders",
    body: "Generate stunning furnished room renders that help buyers visualize the space. Perfect for listings, pitches, and client presentations.",
    bullets: [
      "AI furniture placement",
      "Multiple design styles",
      "High resolution exports",
    ],
    visual: "renders",
  },
];

const audiences = [
  {
    icon: "🏢",
    title: "Real Estate Developers",
    description: "Visualize projects before breaking ground. Present investors with photorealistic renders and walkable 3D models.",
  },
  {
    icon: "🏡",
    title: "Property Agents",
    description: "Impress buyers with immersive property previews. Stand out from every other listing with AI-generated visuals.",
  },
  {
    icon: "🎨",
    title: "Interior Designers",
    description: "Present concepts with photorealistic renders. Show clients multiple design styles in minutes, not weeks.",
  },
  {
    icon: "👷",
    title: "Architects & Contractors",
    description: "Generate floor plans from briefs instantly. Go from client conversation to professional blueprint in a single session.",
  },
];

const testimonials = [
  {
    quote: "Kairos cut our visualization turnaround from 3 days to 3 minutes. Our clients are blown away.",
    name: "Sarah M.",
    role: "Real Estate Developer",
  },
  {
    quote: "I used to pay $500 per render. Now I generate them myself in seconds.",
    name: "James T.",
    role: "Property Agent",
  },
  {
    quote: "The floor plan tool alone is worth every penny. It's become part of every client pitch.",
    name: "Priya K.",
    role: "Interior Designer",
  },
];

const featureVisuals: Record<string, ReactNode> = {
  "floor-plan": (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-warm-border bg-cream-dark">
      <div className="absolute inset-4 rounded-lg border-2 border-dashed border-gold/30">
        <div className="absolute left-4 top-4 h-1/3 w-2/5 rounded border border-warm-stone/30 bg-warm-white/60 p-2">
          <span className="text-[10px] font-medium text-warm-stone">Living Room</span>
        </div>
        <div className="absolute right-4 top-4 h-1/3 w-2/5 rounded border border-warm-stone/30 bg-warm-white/60 p-2">
          <span className="text-[10px] font-medium text-warm-stone">Kitchen</span>
        </div>
        <div className="absolute bottom-4 left-4 h-2/5 w-[45%] rounded border border-warm-stone/30 bg-warm-white/60 p-2">
          <span className="text-[10px] font-medium text-warm-stone">Master Bedroom</span>
        </div>
        <div className="absolute bottom-4 right-4 h-[35%] w-1/4 rounded border border-warm-stone/30 bg-warm-white/60 p-2">
          <span className="text-[10px] font-medium text-warm-stone">Bath</span>
        </div>
        <div className="absolute bottom-4 left-[52%] h-[35%] w-1/5 rounded border border-warm-stone/30 bg-warm-white/60 p-2">
          <span className="text-[10px] font-medium text-warm-stone">Bed 2</span>
        </div>
      </div>
      <div className="absolute bottom-2 right-3 text-[9px] font-medium text-warm-stone/60">Kairos Generated</div>
    </div>
  ),
  "3d-model": (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-warm-border bg-cream-dark">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative">
          {/* Simple isometric box representation */}
          <div className="h-32 w-48 -skew-x-6 transform rounded-lg border-2 border-gold/40 bg-gradient-to-br from-cognac/10 to-gold/10 shadow-lg" />
          <div className="absolute -right-3 -top-6 h-10 w-10 rounded-full border-2 border-gold/40 bg-gold/10 flex items-center justify-center">
            <span className="text-xs text-gold">3D</span>
          </div>
          <div className="absolute -bottom-2 left-4 text-[10px] font-medium text-warm-stone">Orbit & Navigate</div>
        </div>
      </div>
      <div className="absolute left-3 top-3 flex gap-1.5">
        <div className="h-2 w-2 rounded-full bg-gold/40" />
        <div className="h-2 w-2 rounded-full bg-warm-stone/30" />
        <div className="h-2 w-2 rounded-full bg-warm-stone/30" />
      </div>
    </div>
  ),
  renders: (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-warm-border bg-cream-dark">
      <div className="absolute inset-0 bg-gradient-to-br from-cognac/5 via-gold/5 to-cream-dark" />
      <div className="absolute inset-4 rounded-lg bg-gradient-to-br from-cognac/10 to-gold/10">
        <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
          <div className="h-2 w-3/4 rounded bg-warm-stone/20" />
          <div className="h-2 w-1/2 rounded bg-warm-stone/15" />
          <div className="h-6 w-12 rounded bg-gold/20 flex items-center justify-center">
            <span className="text-[8px] text-gold">HD</span>
          </div>
        </div>
        <div className="absolute right-4 top-4 flex gap-1">
          <div className="h-8 w-8 rounded border border-warm-stone/20 bg-warm-white/40" />
          <div className="h-8 w-8 rounded border border-gold/30 bg-gold/10" />
          <div className="h-8 w-8 rounded border border-warm-stone/20 bg-warm-white/40" />
        </div>
      </div>
      <div className="absolute left-6 top-6 text-[10px] font-medium text-warm-stone">Photorealistic Output</div>
    </div>
  ),
};

export function LandingPage() {
  const { user } = useAuth();
  useScrollAnimations();

  return (
    <>
      <ArchitecturalCanvas />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-6">
        {/* ─── Section 1: Hero ─── */}
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

          {/* Trust indicators */}
          <div
            className="animate-section-child mx-auto mt-8 flex flex-col items-center gap-4 text-sm text-warm-stone sm:flex-row sm:justify-center sm:gap-8"
            data-animate-child
          >
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">⚡</span> Generate in under 60 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">🏆</span> Used by 500+ real estate professionals
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">🔒</span> No credit card required
            </span>
          </div>

          {/* Mock UI screenshot */}
          <div
            className="animate-section-child mx-auto mt-12 max-w-3xl"
            data-animate-child
          >
            <div className="overflow-hidden rounded-xl border border-warm-border bg-warm-white shadow-2xl shadow-warm-black/10">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-warm-border bg-cream-dark px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-warm-stone/30" />
                  <div className="h-3 w-3 rounded-full bg-warm-stone/20" />
                  <div className="h-3 w-3 rounded-full bg-warm-stone/20" />
                </div>
                <div className="ml-4 flex-1">
                  <div className="mx-auto w-48 rounded-md bg-warm-white px-3 py-1 text-center text-[11px] text-warm-stone">
                    app.kairos.design
                  </div>
                </div>
              </div>
              {/* Mock editor body */}
              <div className="grid grid-cols-1 md:grid-cols-3">
                {/* Sidebar */}
                <div className="border-b border-warm-border p-4 md:border-b-0 md:border-r">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">
                    Project Editor
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg bg-gold/10 px-3 py-2 text-left text-xs text-warm-black">
                      <span className="font-medium">Step 1:</span> Describe your space
                    </div>
                    <div className="rounded-lg bg-cream-dark px-3 py-2 text-left text-xs text-warm-stone">
                      <span className="font-medium">Step 2:</span> Generate floor plan
                    </div>
                    <div className="rounded-lg bg-cream-dark px-3 py-2 text-left text-xs text-warm-stone">
                      <span className="font-medium">Step 3:</span> View in 3D
                    </div>
                    <div className="rounded-lg bg-cream-dark px-3 py-2 text-left text-xs text-warm-stone">
                      <span className="font-medium">Step 4:</span> Room renders
                    </div>
                  </div>
                </div>
                {/* Main area */}
                <div className="col-span-2 p-4">
                  <div className="mb-2 text-left text-xs font-medium text-warm-stone">
                    Describe your property
                  </div>
                  <div className="rounded-lg border border-gold/30 bg-cream px-3 py-2 text-left text-sm text-warm-black">
                    3 bedroom modern apartment with open kitchen and balcony...
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-warm-black">
                      Generate
                    </div>
                    <div className="text-[11px] text-warm-stone">
                      ~30 seconds
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="aspect-[3/2] rounded-lg border border-warm-border bg-cream-dark" />
                    <div className="aspect-[3/2] rounded-lg border border-warm-border bg-cream-dark" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Section 2: Stats Bar ─── */}
        <section className="mb-20 md:mb-28" data-animate>
          <div className="rounded-2xl bg-cognac px-6 py-10 shadow-xl md:py-14">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="animate-section-child text-center"
                  data-animate-child
                >
                  <p className="font-serif text-3xl font-bold text-gold md:text-4xl">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm text-cream/80">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Section 3: How It Works (expanded) ─── */}
        <section className="pb-20 md:pb-28" data-animate>
          <p
            className="animate-section-child mb-3 text-center text-sm font-medium uppercase tracking-[0.2em] text-gold"
            data-animate-child
          >
            Simple 4-Step Process
          </p>
          <h2
            className="animate-section-child mb-4 text-center font-serif text-3xl font-semibold text-warm-black md:text-4xl"
            data-animate-child
          >
            How It Works
          </h2>
          <p
            className="animate-section-child mx-auto mb-14 max-w-2xl text-center text-warm-stone"
            data-animate-child
          >
            Go from a text description to photorealistic property visuals in
            four effortless steps.
          </p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article
                key={step.title}
                className="animate-section-child group rounded-2xl border border-warm-border bg-warm-white p-8 shadow-sm transition hover:shadow-md"
                data-animate-child
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 text-3xl transition group-hover:bg-gold/20">
                  <span aria-hidden="true">{step.icon}</span>
                </div>
                <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wider text-gold">
                  Step {step.number}
                </p>
                <h3 className="mb-3 font-serif text-xl font-semibold text-warm-black">
                  {step.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-warm-stone">
                  {step.copy}
                </p>
                <span className="inline-block rounded-full bg-cream-dark px-3 py-1 text-[11px] font-medium text-warm-stone">
                  {step.detail}
                </span>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Section 4: Feature Highlights ─── */}
        <section className="pb-20 md:pb-28">
          <div className="space-y-20 md:space-y-28">
            {features.map((feature, i) => {
              const reversed = i % 2 === 1;
              return (
                <div
                  key={feature.headline}
                  className={`flex flex-col items-center gap-10 md:flex-row md:gap-16 ${
                    reversed ? "md:flex-row-reverse" : ""
                  }`}
                  data-animate
                >
                  {/* Visual */}
                  <div
                    className="animate-section-child w-full md:w-1/2"
                    data-animate-child
                  >
                    {featureVisuals[feature.visual]}
                  </div>
                  {/* Text */}
                  <div className="w-full md:w-1/2">
                    <p
                      className="animate-section-child mb-2 text-sm font-medium uppercase tracking-[0.2em] text-gold"
                      data-animate-child
                    >
                      Feature
                    </p>
                    <h3
                      className="animate-section-child mb-4 font-serif text-2xl font-semibold text-warm-black md:text-3xl"
                      data-animate-child
                    >
                      {feature.headline}
                    </h3>
                    <p
                      className="animate-section-child mb-6 leading-relaxed text-warm-stone"
                      data-animate-child
                    >
                      {feature.body}
                    </p>
                    <ul className="space-y-2">
                      {feature.bullets.map((b) => (
                        <li
                          key={b}
                          className="animate-section-child flex items-center gap-2 text-sm text-warm-black"
                          data-animate-child
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[10px] text-gold">
                            ✓
                          </span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Section 5: Who It's For ─── */}
        <section className="pb-20 md:pb-28" data-animate>
          <p
            className="animate-section-child mb-3 text-center text-sm font-medium uppercase tracking-[0.2em] text-gold"
            data-animate-child
          >
            Built For Your Industry
          </p>
          <h2
            className="animate-section-child mb-14 text-center font-serif text-3xl font-semibold text-warm-black md:text-4xl"
            data-animate-child
          >
            Who It's For
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {audiences.map((a) => (
              <article
                key={a.title}
                className="animate-section-child rounded-2xl border border-warm-border bg-warm-white p-8 text-center shadow-sm transition hover:shadow-md"
                data-animate-child
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gold/10 text-3xl">
                  <span aria-hidden="true">{a.icon}</span>
                </div>
                <h3 className="mb-2 font-serif text-lg font-semibold text-warm-black">
                  {a.title}
                </h3>
                <p className="text-sm leading-relaxed text-warm-stone">
                  {a.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Section 6: Testimonials ─── */}
        <section className="pb-20 md:pb-28" data-animate>
          <p
            className="animate-section-child mb-3 text-center text-sm font-medium uppercase tracking-[0.2em] text-gold"
            data-animate-child
          >
            What Our Users Say
          </p>
          <h2
            className="animate-section-child mb-14 text-center font-serif text-3xl font-semibold text-warm-black md:text-4xl"
            data-animate-child
          >
            Trusted by Professionals
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {testimonials.map((t) => (
              <blockquote
                key={t.name}
                className="animate-section-child rounded-2xl border border-warm-border bg-warm-white p-8 shadow-sm transition hover:shadow-md"
                data-animate-child
              >
                <div className="mb-4 text-2xl text-gold" aria-hidden="true">
                  "
                </div>
                <p className="mb-6 text-sm leading-relaxed text-warm-black italic">
                  {t.quote}
                </p>
                <footer className="border-t border-warm-border pt-4">
                  <p className="font-serif text-sm font-semibold text-warm-black">
                    {t.name}
                  </p>
                  <p className="text-xs text-warm-stone">{t.role}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* ─── Section 7: CTA Banner ─── */}
        <section className="pb-24" data-animate>
          <div className="rounded-2xl bg-cognac px-8 py-16 text-center shadow-xl md:py-20">
            <h2
              className="animate-section-child mx-auto max-w-3xl font-serif text-3xl font-semibold text-cream md:text-4xl"
              data-animate-child
            >
              Ready to Transform How You Visualize Properties?
            </h2>
            <p
              className="animate-section-child mx-auto mt-4 max-w-lg text-cream/80"
              data-animate-child
            >
              Join hundreds of real estate professionals already using{" "}
              <BrandWordmark size="sm" className="align-middle" /> to bring
              their designs to life.
            </p>
            <div
              className="animate-section-child mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
              data-animate-child
            >
              <Link
                to={user ? "/dashboard" : "/signup"}
                className="inline-flex rounded-xl bg-gold px-8 py-4 text-base font-semibold text-warm-black shadow-lg transition hover:bg-gold-dark"
              >
                {user ? "Go to Dashboard" : "Start for Free"}
              </Link>
              <a
                href="#"
                className="inline-flex rounded-xl border-2 border-cream/40 px-8 py-4 text-base font-semibold text-cream transition hover:border-cream hover:bg-cream/10"
              >
                Book a Demo
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
