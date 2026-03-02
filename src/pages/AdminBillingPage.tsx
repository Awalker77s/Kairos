import { FormEvent, useEffect, useState } from 'react'
import { assignLifetime, getAdminPlans, togglePlanVisibility, updateFreeFee } from '../lib/adminBilling'

export function AdminBillingPage() {
  const [plans, setPlans] = useState<Array<any>>([])
  const [platformFeePercent, setPlatformFeePercent] = useState('10')
  const [lifetimeEmail, setLifetimeEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const loadPlans = async () => {
    const payload = await getAdminPlans()
    setPlans(payload?.plans ?? [])

    const freePlan = payload?.plans?.find((plan: any) => plan.code === 'FREE')
    if (freePlan) {
      setPlatformFeePercent(String(freePlan.platform_fee_bps / 100))
    }
  }

  useEffect(() => {
    void loadPlans().catch((err) => setMessage(err instanceof Error ? err.message : 'Unable to load admin billing.'))
  }, [])

  const onUpdateFee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const bps = Math.round(Number(platformFeePercent) * 100)
    await updateFreeFee(bps)
    setMessage('Updated FREE platform fee.')
    await loadPlans()
  }

  const onAssignLifetime = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await assignLifetime(lifetimeEmail)
    setMessage(`Assigned LIFETIME to ${lifetimeEmail}.`)
    setLifetimeEmail('')
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-14">
      <h1 className="font-serif text-3xl font-bold text-warm-black">Admin Billing Controls</h1>
      {message && <p className="mt-4 rounded-lg border border-warm-border bg-warm-white px-4 py-3 text-sm text-warm-black">{message}</p>}

      <section className="mt-8 rounded-2xl border border-warm-border bg-warm-white p-6">
        <h2 className="font-serif text-xl font-semibold text-warm-black">Plans</h2>
        <ul className="mt-4 space-y-3">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between rounded-lg border border-warm-border px-4 py-3">
              <div>
                <p className="font-medium text-warm-black">{plan.name} ({plan.code})</p>
                <p className="text-xs text-warm-stone">Visible: {plan.is_visible ? 'Yes' : 'No'} • Fee: {plan.platform_fee_bps / 100}%</p>
              </div>
              <button
                type="button"
                onClick={() => void togglePlanVisibility(plan.code, !plan.is_visible).then(loadPlans)}
                className="rounded-lg border border-warm-border px-3 py-1.5 text-sm text-warm-black"
              >
                {plan.is_visible ? 'Hide' : 'Show'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onUpdateFee} className="mt-8 rounded-2xl border border-warm-border bg-warm-white p-6">
        <h2 className="font-serif text-xl font-semibold text-warm-black">Update FREE platform fee</h2>
        <input
          value={platformFeePercent}
          onChange={(event) => setPlatformFeePercent(event.target.value)}
          className="mt-4 w-40 rounded-lg border border-warm-border px-3 py-2"
        />
        <span className="ml-2 text-sm text-warm-stone">%</span>
        <div>
          <button type="submit" className="mt-4 rounded-lg bg-cognac px-4 py-2 text-sm font-semibold text-cream">Save fee</button>
        </div>
      </form>

      <form onSubmit={onAssignLifetime} className="mt-8 rounded-2xl border border-warm-border bg-warm-white p-6">
        <h2 className="font-serif text-xl font-semibold text-warm-black">Assign LIFETIME</h2>
        <input
          type="email"
          required
          placeholder="user@example.com"
          value={lifetimeEmail}
          onChange={(event) => setLifetimeEmail(event.target.value)}
          className="mt-4 w-full rounded-lg border border-warm-border px-3 py-2"
        />
        <button type="submit" className="mt-4 rounded-lg bg-cognac px-4 py-2 text-sm font-semibold text-cream">Assign</button>
      </form>
    </main>
  )
}
