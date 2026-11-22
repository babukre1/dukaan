export type UserRow = {
  id: string
  fullName: string
  phoneNumber: string
  passwordHash: string
  platformRole: 'ADMIN' | 'OWNER'
  isActive: boolean
  mustChangePassword: boolean
  tokenVersion: number
}

export type RefreshSessionUserRow = Omit<UserRow, 'id'> & {
  userId: string
}

export function userFromRefreshSession(session: RefreshSessionUserRow): UserRow {
  return {
    id: session.userId,
    fullName: session.fullName,
    phoneNumber: session.phoneNumber,
    passwordHash: session.passwordHash,
    platformRole: session.platformRole,
    isActive: session.isActive,
    mustChangePassword: session.mustChangePassword,
    tokenVersion: Number(session.tokenVersion),
  }
}
