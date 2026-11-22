import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export function validate(schema: ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.parse(request[source])
    if (source === 'query') {
      // Express 5 exposes req.query as a configurable getter without a setter.
      // Define an own value so coercions and defaults survive into later handlers.
      Object.defineProperty(request, 'query', {
        value: parsed,
        writable: true,
        enumerable: true,
        configurable: true,
      })
    } else {
      Object.assign(request[source], parsed)
    }
    next()
  }
}
