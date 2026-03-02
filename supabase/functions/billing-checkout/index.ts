import { serve } from 'std/http/server'
import Stripe from 'npm:stripe@14.25.0'
import { corsHeaders, getAdminClient, getUserFromAuthHeader, jsonResponse } from '../_shared/billing.ts'

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const corePriceId = Deno.env.get('STRIPE_CORE_PRICE_ID')
  const appUrl = Deno.env.get('APP_URL')

  if (!stripeKey || !corePriceId || !appUrl) {
    return jsonResponse({ error: 'Missing STRIPE_SECRET_KEY, STRIPE_CORE_PRICE_ID, or APP_URL.' }, 500)
  }

  const user = await getUserFromAuthHeader(request)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
  const supabaseAdmin = getAdminClient()

  const { data: existingSubscription } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: existingSubscription?.stripe_customer_id ?? undefined,
    customer_email: existingSubscription?.stripe_customer_id ? undefined : user.email ?? undefined,
    line_items: [
      {
        price: corePriceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/billing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=canceled`,
    allow_promotion_codes: true,
    metadata: {
      user_id: user.id,
      plan_code: 'CORE',
    },
  })

  return jsonResponse({ url: session.url })
})
