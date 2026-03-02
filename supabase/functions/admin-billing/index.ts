import { serve } from 'std/http/server'
import { corsHeaders, getAdminClient, getUserFromAuthHeader, isAdminEmail, jsonResponse } from '../_shared/billing.ts'

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const user = await getUserFromAuthHeader(request)
  if (!user || !isAdminEmail(user.email)) {
    return jsonResponse({ error: 'Forbidden.' }, 403)
  }

  const supabaseAdmin = getAdminClient()

  if (request.method === 'GET') {
    const { data: plans, error } = await supabaseAdmin
      .from('plans')
      .select('id, code, name, monthly_price_cents, platform_fee_bps, is_visible')
      .order('created_at', { ascending: true })

    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ plans })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405)
  }

  const body = await request.json().catch(() => null)
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'update_free_fee') {
    const freeFeeBps = Number(body?.platform_fee_bps)
    if (Number.isNaN(freeFeeBps) || freeFeeBps < 0 || freeFeeBps > 10000) {
      return jsonResponse({ error: 'platform_fee_bps must be between 0 and 10000.' }, 400)
    }

    const { error } = await supabaseAdmin.from('plans').update({ platform_fee_bps: freeFeeBps }).eq('code', 'FREE')
    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ success: true })
  }

  if (action === 'toggle_visibility') {
    const code = typeof body?.code === 'string' ? body.code : ''
    const isVisible = Boolean(body?.is_visible)

    const { error } = await supabaseAdmin.from('plans').update({ is_visible: isVisible }).eq('code', code)
    if (error) {
      return jsonResponse({ error: error.message }, 500)
    }

    return jsonResponse({ success: true })
  }

  if (action === 'assign_lifetime') {
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email) {
      return jsonResponse({ error: 'email is required.' }, 400)
    }

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers()

    if (listError) {
      return jsonResponse({ error: listError.message }, 500)
    }

    const targetUser = users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (!targetUser) {
      return jsonResponse({ error: 'User not found.' }, 404)
    }

    const { data: lifetimePlan } = await supabaseAdmin.from('plans').select('id').eq('code', 'LIFETIME').single()
    if (!lifetimePlan) {
      return jsonResponse({ error: 'LIFETIME plan missing.' }, 500)
    }

    const { error: upsertError } = await supabaseAdmin.from('user_plan_overrides').upsert(
      {
        user_id: targetUser.id,
        plan_id: lifetimePlan.id,
        assigned_by: user.id,
      },
      { onConflict: 'user_id' },
    )

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500)
    }

    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Unsupported action.' }, 400)
})
