import { useState } from 'react'
import { Link } from 'react-router-dom'
import { continueOnFreePlan, createCoreCheckout } from '../lib/billing'
import { useAuth } from '../context/AuthContext'

type Plan = {
  name: string
  price: number | null
  description: string
  features: string[]
  cta: string
  highlighted: boolean
}

const plans: Plan[] = [
  {
    name: 'Free',
    price: 0,
    description: 'Get started with AI-powered floor plans',
    features: [
      '3 projects per month',
      'Floor plan generation',
      'Basic 2D exports',
      'Community support',
    ],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for independent agents and designers',
    features: [
      '15 projects per month',
      'Floor plan generation',
      '3D model renders',
      'HD exports',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 79,
    description: 'For growing real estate teams and firms',
    features: [
      'Unlimited projects',
      'Floor plan generation',
      '3D model renders',
      'Room renders & furnishing',
      'Team collaboration (up to 5 members)',
      'Priority support',
      'Custom branding on exports',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: null,
    description: 'Custom solutions for large brokerages and developers',
    features: [
      'Unlimited everything',
      'Unlimited team members',
      'Dedicated account manager',
      'Priority support & SLA',
      'Custom integrations',
      'White label options',
      'Onboarding & training',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

const premiumFeatures = new Set(['Team collaboration (up to 5 members)', 'Priority support'])

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="inline-block h-3.5 w-3.5 text-warm-stone"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function PricingPage() {
  const { user } = useAuth()
  const [annual, setAnnual] = useState(false)

  const chooseCore = async () => {
    const payload = await createCoreCheckout()
    if (payload?.url) {
      window.location.href = payload.url as string
    }
  }

  const chooseFree = async () => {
    await continueOnFreePlan()
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return null
    if (price === 0) return 0
    return annual ? Math.round(price * 0.8) : price
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-14">
      <h1 className="text-center font-serif text-4xl font-bold text-warm-black">Pricing</h1>
      <p className="mt-3 text-center text-warm-stone">Simple plans for every stage of your design business.</p>

      {/* Monthly / Annual Toggle */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!annual ? 'text-warm-black' : 'text-warm-stone'}`}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual((prev) => !prev)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${annual ? 'bg-gold' : 'bg-warm-border'}`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform ${annual ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-warm-black' : 'text-warm-stone'}`}>
          Annual <span className="text-gold">(save 20%)</span>
        </span>
      </div>

      {/* Plan Cards */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const displayPrice = formatPrice(plan.price)
          const isEnterprise = plan.name === 'Enterprise'
          const isPro = plan.highlighted
          const isFreeOrStarter = plan.name === 'Free' || plan.name === 'Starter'

          return (
            <section
              key={plan.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                isPro
                  ? 'border-2 border-gold bg-gold/10 shadow-lg'
                  : isEnterprise
                    ? 'border-cognac/30 bg-cognac text-cream'
                    : 'border-warm-border bg-warm-white'
              }`}
            >
              {/* Most Popular Badge */}
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold px-4 py-1 text-xs font-bold uppercase tracking-wide text-warm-black">
                  Most Popular
                </div>
              )}

              <h2
                className={`font-serif text-2xl font-semibold ${isEnterprise ? 'text-cream' : 'text-warm-black'}`}
              >
                {plan.name}
              </h2>

              {/* Price */}
              <div className="mt-3">
                {displayPrice === null ? (
                  <span className={`text-3xl font-bold ${isEnterprise ? 'text-cream' : 'text-warm-black'}`}>
                    Custom
                  </span>
                ) : displayPrice === 0 ? (
                  <span className="text-3xl font-bold text-warm-black">$0<span className="text-base font-normal text-warm-stone">/mo</span></span>
                ) : (
                  <span className={`text-3xl font-bold ${isEnterprise ? 'text-cream' : 'text-warm-black'}`}>
                    ${displayPrice}<span className={`text-base font-normal ${isEnterprise ? 'text-cream/70' : 'text-warm-stone'}`}>/mo</span>
                  </span>
                )}
                {annual && plan.price !== null && plan.price > 0 && (
                  <p className={`mt-1 text-xs ${isEnterprise ? 'text-cream/60' : 'text-warm-stone'}`}>
                    billed annually at ${Math.round(plan.price * 0.8 * 12)}/yr
                  </p>
                )}
              </div>

              <p className={`mt-3 text-sm ${isEnterprise ? 'text-cream/80' : 'text-warm-stone'}`}>
                {plan.description}
              </p>

              {/* Features */}
              <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${isEnterprise ? 'text-cream/90' : 'text-warm-black'}`}>
                {plan.features.map((feature) => {
                  const locked = isFreeOrStarter && premiumFeatures.has(feature)
                  return (
                    <li key={feature} className="flex items-start gap-2">
                      {locked ? (
                        <span className="mt-0.5 shrink-0"><LockIcon /></span>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isEnterprise ? 'text-gold-light' : 'text-gold'}`}
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                      <span className={locked ? 'text-warm-stone' : ''}>{feature}</span>
                    </li>
                  )
                })}
              </ul>

              {/* CTA Button */}
              <button
                type="button"
                onClick={
                  plan.name === 'Free' && user
                    ? () => void chooseFree()
                    : plan.name === 'Enterprise'
                      ? undefined
                      : user
                        ? () => void chooseCore()
                        : undefined
                }
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  isPro
                    ? 'bg-gold text-warm-black hover:bg-gold-light'
                    : plan.name === 'Free'
                      ? 'border-2 border-cognac/40 bg-transparent text-cognac hover:border-cognac hover:bg-cognac/5'
                      : isEnterprise
                        ? 'bg-cream text-cognac hover:bg-cream-dark'
                        : 'bg-cognac text-cream hover:bg-cognac-light'
                }`}
              >
                {!user && plan.name !== 'Enterprise' ? 'Sign in to start' : plan.cta}
              </button>
            </section>
          )
        })}
      </div>

      {!user && (
        <p className="mt-8 text-center text-sm text-warm-stone">
          Already have an account? <Link to="/signin" className="font-semibold text-cognac">Sign in</Link>
        </p>
      )}

      <p className="mt-8 text-center text-xs text-warm-stone">
        Paid plans are billed monthly through Stripe. Annual billing saves 20%.
      </p>
    </main>
  )
}
