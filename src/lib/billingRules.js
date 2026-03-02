export function calculatePlatformFeeCents(amountCents, platformFeeBps) {
  return Math.round((amountCents * platformFeeBps) / 10000)
}

export function resolveEntitlements(planCode) {
  if (planCode === 'FREE') {
    return {
      maxProjects: 3,
      exportsEnabled: false,
      teamMembers: 0,
    }
  }

  return {
    maxProjects: null,
    exportsEnabled: true,
    teamMembers: 5,
  }
}
