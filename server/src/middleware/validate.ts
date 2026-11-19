import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export function validate(schema: ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (request, _response, next) => {
    Object.assign(request[source], schema.parse(request[source]))
    next()
  }
}
