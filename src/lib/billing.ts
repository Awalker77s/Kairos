import { supabase } from './supabase'

import type { PlanCode, PlanEntitlements } from './billingRules'

export type ResolvedPlan = {
  code: PlanCode
  name: string
  platformFeeBps: number
  platformFeePercent: number
  subscriptionStatus: string
  currentPeriodEnd: string | null
  entitlements: PlanEntitlements
}

export async function getUserPlan(): Promise<ResolvedPlan> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('You must be signed in to access billing.')
  }

  const { data, error } = await supabase.rpc('get_user_plan', { target_user_id: user.id }).single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to resolve plan.')
  }

  const code = data.plan_code as PlanCode

  return {
    code,
    name: data.plan_name,
    platformFeeBps: data.platform_fee_bps,
    platformFeePercent: data.platform_fee_bps / 100,
    subscriptionStatus: data.subscription_status,
    currentPeriodEnd: data.current_period_end,
    entitlements: {
      maxProjects: data.max_projects,
      exportsEnabled: data.exports_enabled,
      teamMembers: data.team_members,
    },
  }
}

async function invoke(functionName: string, body?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createCoreCheckout() {
  return invoke('billing-checkout')
}

export async function createBillingPortal() {
  return invoke('billing-portal')
}

export async function continueOnFreePlan() {
  return invoke('billing-set-free')
}

export async function getVisiblePlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('id, code, name, monthly_price_cents, platform_fee_bps, is_visible')
    .eq('is_visible', true)
    .order('monthly_price_cents', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createProjectPayment(projectId: string, amountCents: number, currency = 'usd') {
  return invoke('project-pay', { projectId, amount_cents: amountCents, currency })
}

export async function getTransactionsByProject(projectId: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
