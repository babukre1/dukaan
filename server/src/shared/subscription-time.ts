export type DurationUnit = 'DAY' | 'MONTH' | 'YEAR'

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function addCalendarDuration(start: Date, unit: DurationUnit, count: number): Date {
  if (!Number.isInteger(count) || count <= 0) throw new Error('Duration count must be a positive integer')
  const result = new Date(start)
  if (unit === 'DAY') {
    result.setUTCDate(result.getUTCDate() + count)
    return result
  }
  const day = result.getUTCDate()
  result.setUTCDate(1)
  if (unit === 'MONTH') result.setUTCMonth(result.getUTCMonth() + count)
  else result.setUTCFullYear(result.getUTCFullYear() + count)
  result.setUTCDate(Math.min(day, daysInUtcMonth(result.getUTCFullYear(), result.getUTCMonth())))
  return result
}

export type EffectiveSubscriptionStatus = 'PENDING' | 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
export function effectiveSubscriptionStatus(input: { startsAt: Date; expiresAt: Date; status: string; planType: string }, now = new Date()): EffectiveSubscriptionStatus {
  if (input.status === 'CANCELLED') return 'CANCELLED'
  if (now < input.startsAt || input.status === 'PENDING') return 'PENDING'
  if (now >= input.expiresAt) return 'EXPIRED'
  return input.planType === 'TRIAL' ? 'TRIAL' : 'ACTIVE'
}
