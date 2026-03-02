const steps = [
  {
    icon: '✍️',
    title: 'Text → Floor Plan',
    copy: 'Describe your home in plain English and generate a structured 2D plan with rooms, doors, and windows.',
  },
  {
    icon: '🏗️',
    title: 'Floor Plan → 3D',
    copy: 'Convert layout JSON into a navigable 3D architectural model for rapid spatial validation.',
  },
  {
    icon: '🛋️',
    title: '3D → Renders',
    copy: 'Generate photorealistic furnished room images in your chosen style for client-ready presentations.',
  },
]

export function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4">
      <section className="py-20">
        <p className="mb-4 inline-flex rounded-full border border-brand-orange/40 bg-brand-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber">
          AI visualization platform for homes and spaces
        </p>
        <h1 className="max-w-4xl text-4xl font-bold leading-tight md:text-6xl">From sketch to stunning in seconds.</h1>
        <p className="mt-6 max-w-2xl text-lg text-stone">
          Kairo transforms natural language descriptions into 2D floor plans, interactive 3D walkthroughs, and photorealistic furnished room renders—so architects, contractors, and designers can move from concept to client-ready visuals fast.
        </p>
        <button className="mt-8 rounded-xl bg-brand-orange px-6 py-3 font-semibold text-brand-black transition hover:bg-amber">
          Try the Three-Step Demo
        </button>
      </section>

      <section className="pb-20">
        <h2 className="mb-8 text-2xl font-semibold md:text-3xl">One workflow. Three steps.</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/10 bg-charcoal/70 p-6 shadow-lg shadow-black/20">
              <div className="mb-4 text-2xl" aria-hidden="true">
                {step.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-stone">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
