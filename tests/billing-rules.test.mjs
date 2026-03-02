import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePlatformFeeCents, resolveEntitlements } from '../src/lib/billingRules.js'

test('calculatePlatformFeeCents returns rounded fee', () => {
  assert.equal(calculatePlatformFeeCents(10000, 1000), 1000)
  assert.equal(calculatePlatformFeeCents(999, 333), 33)
})

test('resolveEntitlements returns free plan limits', () => {
  assert.deepEqual(resolveEntitlements('FREE'), {
    maxProjects: 3,
    exportsEnabled: false,
    teamMembers: 0,
  })
})

test('resolveEntitlements returns full limits for paid plans', () => {
  assert.deepEqual(resolveEntitlements('CORE'), {
    maxProjects: null,
    exportsEnabled: true,
    teamMembers: 5,
  })
  assert.deepEqual(resolveEntitlements('LIFETIME'), {
    maxProjects: null,
    exportsEnabled: true,
    teamMembers: 5,
  })
})
