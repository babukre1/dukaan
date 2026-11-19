import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../shared/app-error.js'

export const notFound: RequestHandler = (request, response) => {
  response.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: `Route ${request.method} ${request.path} was not found` } })
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'The request is invalid', details: error.flatten() } }); return
  }
  if (error instanceof AppError) {
    response.status(error.status).json({ success: false, error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }); return
  }
  const postgresCode = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (postgresCode === '23505') {
    response.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'A record with those details already exists' } }); return
  }
  request.log?.error({ err: error }, 'Unhandled request error')
  response.status(500).json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } })
}
