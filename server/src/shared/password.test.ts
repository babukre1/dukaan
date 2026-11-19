import assert from 'node:assert/strict'
import test from 'node:test'
import { assertStrongPassword } from './password.js'

test('accepts an eight-character password with letters and numbers', () => {
  assert.doesNotThrow(() => assertStrongPassword('00aa1122'))
})

test('rejects short passwords or passwords without both letters and numbers', () => {
  assert.throws(() => assertStrongPassword('aa1122'))
  assert.throws(() => assertStrongPassword('abcdefgh'))
  assert.throws(() => assertStrongPassword('00112233'))
})
