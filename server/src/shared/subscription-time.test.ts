import assert from 'node:assert/strict'
import test from 'node:test'
import { addCalendarDuration, effectiveSubscriptionStatus } from './subscription-time.js'

test('weekly trial adds seven UTC calendar days', () => {
  assert.equal(addCalendarDuration(new Date('2026-01-21T10:00:00Z'), 'DAY', 7).toISOString(), '2026-01-28T10:00:00.000Z')
})

test('calendar month clamps end-of-month dates', () => {
  assert.equal(addCalendarDuration(new Date('2026-01-31T12:00:00Z'), 'MONTH', 1).toISOString(), '2026-02-28T12:00:00.000Z')
  assert.equal(addCalendarDuration(new Date('2028-01-31T12:00:00Z'), 'MONTH', 1).toISOString(), '2028-02-29T12:00:00.000Z')
})

test('calendar year handles leap day consistently', () => {
  assert.equal(addCalendarDuration(new Date('2028-02-29T12:00:00Z'), 'YEAR', 1).toISOString(), '2029-02-28T12:00:00.000Z')
})

test('exclusive expiration boundary becomes expired at expiresAt', () => {
  const input = { startsAt: new Date('2026-01-01Z'), expiresAt: new Date('2026-02-01Z'), status: 'ACTIVE', planType: 'PAID' }
  assert.equal(effectiveSubscriptionStatus(input, new Date('2026-01-31T23:59:59Z')), 'ACTIVE')
  assert.equal(effectiveSubscriptionStatus(input, new Date('2026-02-01Z')), 'EXPIRED')
})

test('trial and cancellation states override normal paid state', () => {
  const base = { startsAt: new Date('2026-01-01Z'), expiresAt: new Date('2027-01-01Z') }
  assert.equal(effectiveSubscriptionStatus({ ...base, status: 'ACTIVE', planType: 'TRIAL' }, new Date('2026-02-01Z')), 'TRIAL')
  assert.equal(effectiveSubscriptionStatus({ ...base, status: 'CANCELLED', planType: 'PAID' }, new Date('2026-02-01Z')), 'CANCELLED')
})
