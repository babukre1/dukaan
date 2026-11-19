import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhoneNumber } from './phone.js'

test('normalizes international phone formatting', () => {
  assert.equal(normalizePhoneNumber('+252 61 234-5678'), '+252612345678')
  assert.equal(normalizePhoneNumber('00252 61 234 5678'), '+252612345678')
})

test('rejects local or malformed numbers', () => {
  assert.throws(() => normalizePhoneNumber('0612345678'))
  assert.throws(() => normalizePhoneNumber('+00012345678'))
})
