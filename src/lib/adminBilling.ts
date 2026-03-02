import { supabase } from './supabase'

async function invokeAdmin(body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST') {
  const { data, error } = await supabase.functions.invoke('admin-billing', {
    method,
    body,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getAdminPlans() {
  return invokeAdmin(undefined, 'GET')
}

export async function updateFreeFee(platformFeeBps: number) {
  return invokeAdmin({ action: 'update_free_fee', platform_fee_bps: platformFeeBps })
}

export async function togglePlanVisibility(code: string, isVisible: boolean) {
  return invokeAdmin({ action: 'toggle_visibility', code, is_visible: isVisible })
}

export async function assignLifetime(email: string) {
  return invokeAdmin({ action: 'assign_lifetime', email })
}
