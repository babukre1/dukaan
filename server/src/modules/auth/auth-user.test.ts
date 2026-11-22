import assert from 'node:assert/strict'
import test from 'node:test'
import { userFromRefreshSession } from './auth-user.js'

test('refresh sessions issue access tokens for the user, not the session row', () => {
  const user = userFromRefreshSession({
    userId: 'user-123',
    fullName: 'Platform Admin',
    phoneNumber: '+252611602428',
    passwordHash: 'hash',
    platformRole: 'ADMIN',
    isActive: true,
    mustChangePassword: false,
    tokenVersion: 2,
  })

  assert.equal(user.id, 'user-123')
  assert.equal(user.tokenVersion, 2)
})
