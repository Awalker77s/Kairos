import { serve } from 'std/http/server'
import { corsHeaders, getAdminClient, getUserFromAuthHeader, jsonResponse } from '../_shared/billing.ts'

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const user = await getUserFromAuthHeader(request)
  if (!user) {
    return jsonResponse({ error: 'Unauthorized.' }, 401)
  }

  const supabaseAdmin = getAdminClient()

  await supabaseAdmin.from('user_plan_overrides').delete().eq('user_id', user.id)

  const { data: corePlan } = await supabaseAdmin.from('plans').select('id').eq('code', 'CORE').single()
  if (corePlan?.id) {
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('user_id', user.id)
      .eq('plan_id', corePlan.id)
      .in('status', ['active', 'trialing', 'past_due'])
  }

  return jsonResponse({ success: true })
})
