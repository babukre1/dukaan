import { AppError } from './app-error.js'

export function normalizePhoneNumber(input: string): string {
  const compact = input.trim().replace(/[\s().-]/g, '')
  const withPrefix = compact.startsWith('00') ? `+${compact.slice(2)}` : compact
  if (!/^\+[1-9]\d{7,14}$/.test(withPrefix)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Use an international phone number such as +25261XXXXXXX')
  }
  return withPrefix
}
