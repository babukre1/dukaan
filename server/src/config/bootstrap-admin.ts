import { strongPasswordSchema } from '../shared/password-policy.js'
import { normalizePhoneNumber } from '../shared/phone.js'

export type BootstrapAdmin = {
  name: string
  phone: string
  password: string
}

type BootstrapAdminResult = {
  admin: BootstrapAdmin | null
  warning?: string
}

export function readBootstrapAdmin(environment: NodeJS.ProcessEnv): BootstrapAdminResult {
  const name = environment.BOOTSTRAP_ADMIN_NAME?.trim()
  const phone = environment.BOOTSTRAP_ADMIN_PHONE?.trim()
  const password = environment.BOOTSTRAP_ADMIN_PASSWORD

  if (!password || password.startsWith('replace-')) return { admin: null }
  if (!name || !phone) {
    return {
      admin: null,
      warning: 'Bootstrap admin skipped: BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_PHONE, and BOOTSTRAP_ADMIN_PASSWORD must all be configured.',
    }
  }

  let normalizedPhone: string
  try {
    normalizedPhone = normalizePhoneNumber(phone)
  } catch {
    return {
      admin: null,
      warning: 'Bootstrap admin skipped: BOOTSTRAP_ADMIN_PHONE must be an international number such as +252611602428.',
    }
  }

  if (!strongPasswordSchema.safeParse(password).success) {
    return {
      admin: null,
      warning: 'Bootstrap admin skipped: BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters and include a letter and a number.',
    }
  }

  return { admin: { name, phone: normalizedPhone, password } }
}
