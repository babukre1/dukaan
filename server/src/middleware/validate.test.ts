import assert from 'node:assert/strict'
import test from 'node:test'
import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { validate } from './validate.js'

test('preserves coerced query values and defaults with the Express 5 query getter', () => {
  const request = {} as Request
  Object.defineProperty(request, 'query', {
    configurable: true,
    get: () => ({ limit: '50', search: '' }),
  })

  let nextCalled = false
  const middleware = validate(z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sort: z.enum(['name', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }), 'query')

  middleware(request, {} as Response, (() => { nextCalled = true }) as NextFunction)

  assert.equal(nextCalled, true)
  assert.deepEqual(request.query, {
    page: 1,
    limit: 50,
    search: '',
    sort: 'createdAt',
    order: 'desc',
  })
})
