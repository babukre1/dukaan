import assert from 'node:assert/strict'
import test from 'node:test'
import { assertStrongPassword } from './password.js'
import { PASSWORD_MIN_LENGTH, strongPasswordSchema } from './password-policy.js'

test('accepts an eight-character password with letters and numbers', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8)
  assert.equal(strongPasswordSchema.safeParse('00aa1122').success, true)
  assert.doesNotThrow(() => assertStrongPassword('00aa1122'))
})

test('rejects short passwords or passwords without both letters and numbers', () => {
  assert.throws(() => assertStrongPassword('aa1122'))
  assert.throws(() => assertStrongPassword('abcdefgh'))
  assert.throws(() => assertStrongPassword('00112233'))
})
