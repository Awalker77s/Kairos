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
  const appUrl = Deno.env.get('APP_URL')

  if (!stripeKey || !appUrl) {
    return jsonResponse({ error: 'Missing STRIPE_SECRET_KEY or APP_URL.' }, 500)
  }

  const user = await getUserFromAuthHeader(request)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const supabaseAdmin = getAdminClient()
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscription?.stripe_customer_id) {
    return jsonResponse({ error: 'No billing profile found for this user.' }, 400)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  })

  return jsonResponse({ url: session.url })
})
