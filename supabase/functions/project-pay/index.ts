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
  if (!stripeKey) {
    return jsonResponse({ error: 'Missing STRIPE_SECRET_KEY.' }, 500)
  }

  const user = await getUserFromAuthHeader(request)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const body = await request.json().catch(() => null)
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  const amountCents = Number(body?.amount_cents)
  const currency = typeof body?.currency === 'string' ? body.currency : 'usd'

  if (!projectId || Number.isNaN(amountCents) || amountCents <= 0) {
    return jsonResponse({ error: 'projectId and positive amount_cents are required.' }, 400)
  }

  const supabaseAdmin = getAdminClient()
  const { data: project, error: projectError } = await supabaseAdmin
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return jsonResponse({ error: 'Project not found.' }, 404)
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' })
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      project_id: projectId,
      user_id: user.id,
    },
  })

  await supabaseAdmin.from('transactions').insert({
    project_id: projectId,
    user_id: user.id,
    amount_cents: amountCents,
    currency,
    stripe_payment_intent_id: paymentIntent.id,
    status: 'pending',
    platform_fee_cents: 0,
    net_amount_cents: amountCents,
  })

  return jsonResponse({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id })
})
