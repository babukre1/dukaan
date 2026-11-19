import type { RequestHandler } from 'express'
import { AppError } from '../shared/app-error.js'

const attempts = new Map<string, { count: number; resetAt: number }>()
export function rateLimit(options: { windowMs: number; max: number }): RequestHandler {
  return (request, _response, next) => {
    const now = Date.now()
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown'
    const current = attempts.get(key)
    if (!current || current.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + options.windowMs })
      next(); return
    }
    current.count += 1
    if (current.count > options.max) { next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please try again later.')); return }
    next()
  }
}
