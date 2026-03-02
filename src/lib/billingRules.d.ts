export type PlanCode = 'FREE' | 'CORE' | 'LIFETIME'

export type PlanEntitlements = {
  maxProjects: number | null
  exportsEnabled: boolean
  teamMembers: number
}

export declare function calculatePlatformFeeCents(amountCents: number, platformFeeBps: number): number
export declare function resolveEntitlements(planCode: PlanCode): PlanEntitlements
