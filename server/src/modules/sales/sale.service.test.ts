import assert from 'node:assert/strict'
import test from 'node:test'
import { __testing } from './sale.service.js'

test('sales money and quantity calculations remain decimal safe', () => {
  assert.equal(__testing.cents('17.05'), 1705n)
  assert.equal(__testing.money(1705n), '17.05')
  assert.equal(__testing.milli('5.125'), 5125n)
  assert.equal(__testing.quantity(5125n), '5.125')
})

test('payment status is derived from authoritative amounts', () => {
  assert.equal(__testing.paymentStatus(1700n, 0n), 'UNPAID')
  assert.equal(__testing.paymentStatus(1700n, 800n), 'PARTIALLY_PAID')
  assert.equal(__testing.paymentStatus(1700n, 1700n), 'PAID')
  assert.equal(__testing.paymentStatus(0n, 0n), 'PAID')
})

test('duplicate product lines are merged before stock validation', () => {
  assert.deepEqual(__testing.mergeItems([
    { productId: 'b', quantity: '1.250' },
    { productId: 'a', quantity: '2.000' },
    { productId: 'b', quantity: '0.750' },
  ]), [
    { productId: 'a', amount: 2000n },
    { productId: 'b', amount: 2000n },
  ])
})

test('discount allocation always reconciles to the sale total', () => {
  const allocations = __testing.itemNetAllocations([
    { id: 'one', lineSubtotal: '10.00' },
    { id: 'two', lineSubtotal: '3.00' },
    { id: 'three', lineSubtotal: '4.00' },
  ], 1500n, 1700n)
  assert.equal([...allocations.values()].reduce((sum, value) => sum + value, 0n), 1500n)
})
