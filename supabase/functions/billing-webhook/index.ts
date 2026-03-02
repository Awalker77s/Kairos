import { serve } from 'std/http/server'
import Stripe from 'npm:stripe@14.25.0'
import { corsHeaders, getAdminClient, jsonResponse } from '../_shared/billing.ts'

function calculatePlatformFee(amountCents: number, platformFeeBps: number) {
  return Math.round((amountCents * platformFeeBps) / 10000)
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeKey || !webhookSecret) {
    return jsonResponse({ error: 'Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.' }, 500)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return jsonResponse({ error: 'Missing stripe-signature header.' }, 400)
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (error) {
    return jsonResponse({ error: `Invalid webhook signature: ${error instanceof Error ? error.message : 'Unknown error'}` }, 400)
  }

  const supabaseAdmin = getAdminClient()

  const { data: existingEvent } = await supabaseAdmin
    .from('billing_webhook_events')
    .select('stripe_event_id')
    .eq('stripe_event_id', event.id)
    .maybeSingle()

  if (existingEvent) {
    return jsonResponse({ received: true, duplicate: true })
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata?.user_id

    let planCode = 'FREE'
    if (subscription.items.data[0]?.price?.id === Deno.env.get('STRIPE_CORE_PRICE_ID')) {
      planCode = 'CORE'
    }

    const { data: plan } = await supabaseAdmin.from('plans').select('id').eq('code', planCode).single()

    if (userId && plan?.id) {
      await supabaseAdmin.from('subscriptions').upsert(
        {
          user_id: userId,
          plan_id: plan.id,
          status: subscription.status,
          stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : null,
          stripe_subscription_id: subscription.id,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        },
        { onConflict: 'stripe_subscription_id' },
      )
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const projectId = paymentIntent.metadata?.project_id
    const userId = paymentIntent.metadata?.user_id

    if (projectId && userId && typeof paymentIntent.amount === 'number') {
      const { data: plan } = await supabaseAdmin.rpc('get_user_plan', { target_user_id: userId }).single()

      const platformFeeBps = typeof plan?.platform_fee_bps === 'number' ? plan.platform_fee_bps : 0
      const platformFeeCents = calculatePlatformFee(paymentIntent.amount, platformFeeBps)
      const netAmountCents = paymentIntent.amount - platformFeeCents

      await supabaseAdmin.from('transactions').upsert(
        {
          project_id: projectId,
          user_id: userId,
          amount_cents: paymentIntent.amount,
          currency: paymentIntent.currency,
          stripe_payment_intent_id: paymentIntent.id,
          status: 'succeeded',
          platform_fee_cents: platformFeeCents,
          net_amount_cents: netAmountCents,
        },
        { onConflict: 'stripe_payment_intent_id' },
      )
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    if (charge.payment_intent && typeof charge.payment_intent === 'string') {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('stripe_payment_intent_id', charge.payment_intent)
    }
  }

  await supabaseAdmin.from('billing_webhook_events').insert({ stripe_event_id: event.id })

  return jsonResponse({ received: true })
})
