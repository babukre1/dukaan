import assert from 'node:assert/strict'
import test from 'node:test'
import { readBootstrapAdmin } from './bootstrap-admin.js'

test('accepts a valid production bootstrap administrator', () => {
  const result = readBootstrapAdmin({
    BOOTSTRAP_ADMIN_NAME: 'Platform Admin',
    BOOTSTRAP_ADMIN_PHONE: '+252611602428',
    BOOTSTRAP_ADMIN_PASSWORD: '00aa1122',
  })

  assert.deepEqual(result, {
    admin: {
      name: 'Platform Admin',
      phone: '+252611602428',
      password: '00aa1122',
    },
  })
})

test('does not crash deployment for an invalid optional bootstrap phone', () => {
  const result = readBootstrapAdmin({
    BOOTSTRAP_ADMIN_NAME: 'Platform Admin',
    BOOTSTRAP_ADMIN_PHONE: 'invalid-phone',
    BOOTSTRAP_ADMIN_PASSWORD: '00aa1122',
  })

  assert.equal(result.admin, null)
  assert.match(result.warning ?? '', /international number/)
})

test('ignores the documented placeholder password', () => {
  assert.deepEqual(readBootstrapAdmin({
    BOOTSTRAP_ADMIN_NAME: 'Platform Admin',
    BOOTSTRAP_ADMIN_PHONE: '+252611602428',
    BOOTSTRAP_ADMIN_PASSWORD: 'replace-with-a-strong-temporary-password',
  }), { admin: null })
})
