import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { continueOnFreePlan, createCoreCheckout, getUserPlan, getVisiblePlans } from '../lib/billing'
import { useAuth } from '../context/AuthContext'

export function PricingPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Array<any>>([])
  const [currentPlan, setCurrentPlan] = useState<string>('FREE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [visiblePlans, plan] = await Promise.all([getVisiblePlans(), user ? getUserPlan() : Promise.resolve(null)])
        setPlans(visiblePlans.filter((entry) => entry.code !== 'LIFETIME'))
        setCurrentPlan(plan?.code ?? 'FREE')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load plans.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user])

  const freePlan = useMemo(() => plans.find((plan) => plan.code === 'FREE'), [plans])
  const corePlan = useMemo(() => plans.find((plan) => plan.code === 'CORE'), [plans])

  const chooseCore = async () => {
    const payload = await createCoreCheckout()
    if (payload?.url) {
      window.location.href = payload.url as string
    }
  }

  const chooseFree = async () => {
    await continueOnFreePlan()
    setCurrentPlan('FREE')
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <h1 className="text-center font-serif text-4xl font-bold text-warm-black">Pricing</h1>
      <p className="mt-3 text-center text-warm-stone">Simple plans for every stage of your design business.</p>

      {error && <p className="mt-6 rounded-lg border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-12 text-center text-warm-stone">Loading plans…</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <PlanCard
            title="Free"
            subtitle={`Free — we take ${(freePlan?.platform_fee_bps ?? 1000) / 100}% per project`}
            features={['Up to 3 projects', 'Exports disabled', 'No team seats']}
            current={currentPlan === 'FREE'}
            cta={user ? 'Continue Free' : 'Sign in to start'}
            onClick={user ? () => void chooseFree() : undefined}
          />
          <PlanCard
            title="Core"
            subtitle="$10 / month — 0% platform fee"
            features={['Unlimited projects', 'Exports enabled', 'Up to 5 team members']}
            current={currentPlan === 'CORE' || currentPlan === 'LIFETIME'}
            cta={user ? 'Choose Core' : 'Sign in to subscribe'}
            highlighted
            onClick={user ? () => void chooseCore() : undefined}
          />
        </div>
      )}

      {!user && (
        <p className="mt-8 text-center text-sm text-warm-stone">
          Already have an account? <Link to="/signin" className="font-semibold text-cognac">Sign in</Link>
        </p>
      )}

      {corePlan && <p className="mt-8 text-center text-xs text-warm-stone">Core is billed monthly through Stripe.</p>}
    </main>
  )
}

function PlanCard({
  title,
  subtitle,
  features,
  cta,
  current,
  onClick,
  highlighted = false,
}: {
  title: string
  subtitle: string
  features: string[]
  cta: string
  current: boolean
  onClick?: () => void
  highlighted?: boolean
}) {
  return (
    <section className={`rounded-2xl border p-6 ${highlighted ? 'border-gold bg-gold/10' : 'border-warm-border bg-warm-white'}`}>
      <h2 className="font-serif text-2xl font-semibold text-warm-black">{title}</h2>
      <p className="mt-2 text-warm-stone">{subtitle}</p>
      <ul className="mt-5 space-y-2 text-sm text-warm-black">
        {features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClick}
        className="mt-6 w-full rounded-lg bg-cognac px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-cognac-light"
      >
        {current ? 'Your current plan' : cta}
      </button>
    </section>
  )
}
