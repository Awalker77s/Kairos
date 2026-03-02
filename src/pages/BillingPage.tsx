import { useEffect, useState } from 'react'
import { createBillingPortal, getUserPlan } from '../lib/billing'

export function BillingPage() {
  const [plan, setPlan] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void getUserPlan()
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load billing details.'))
  }, [])

  const openPortal = async () => {
    const payload = await createBillingPortal()
    if (payload?.url) {
      window.location.href = payload.url as string
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <h1 className="font-serif text-3xl font-bold text-warm-black">Billing</h1>
      <p className="mt-2 text-warm-stone">Manage your subscription and payment details.</p>
      {error && <p className="mt-6 rounded-lg border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {plan && (
        <section className="mt-8 rounded-2xl border border-warm-border bg-warm-white p-6">
          <div className="space-y-2">
            <p><strong>Current plan:</strong> {plan.name}</p>
            <p><strong>Status:</strong> {plan.subscriptionStatus}</p>
            <p><strong>Platform fee:</strong> {plan.platformFeePercent}%</p>
            <p><strong>Next renewal:</strong> {plan.currentPeriodEnd ? new Date(plan.currentPeriodEnd).toLocaleDateString() : 'N/A'}</p>
          </div>
          <button
            type="button"
            onClick={() => void openPortal()}
            className="mt-6 rounded-lg bg-cognac px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-cognac-light"
          >
            Manage billing
          </button>
        </section>
      )}
    </main>
  )
}
