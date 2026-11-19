import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env.js'
import { authenticate } from '../../middleware/auth.js'
import { rateLimit } from '../../middleware/rate-limit.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { AppError } from '../../shared/app-error.js'
import { success } from '../../shared/response.js'
import { changePassword, getCurrentUser, login, logout, rotateRefreshToken } from './auth.service.js'

const router = Router()
const loginSchema = z.object({ phoneNumber: z.string().min(8).max(30), password: z.string().min(1).max(200), clientType: z.enum(['WEB', 'MOBILE']).default('WEB') })
const refreshSchema = z.object({ refreshToken: z.string().min(20).optional() })
const passwordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(200) })
const cookieName = 'dukaanflow_refresh'

function readCookie(header: string | undefined, name: string) {
  return header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}
function setRefreshCookie(response: import('express').Response, token: string) {
  response.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict', secure: env.COOKIE_SECURE, path: '/api/v1/auth', maxAge: env.REFRESH_TOKEN_DAYS * 86_400_000 })
}

router.post('/login', rateLimit({ windowMs: 15 * 60_000, max: 10 }), validate(loginSchema), asyncHandler(async (request, response) => {
  const body = request.body as z.infer<typeof loginSchema>
  const session = await login(body, { userAgent: request.get('user-agent'), ipAddress: request.ip })
  setRefreshCookie(response, session.refreshToken)
  const { refreshToken, ...safeSession } = session
  return success(response, body.clientType === 'MOBILE' ? session : safeSession, 'Login successful')
}))
router.post('/refresh', validate(refreshSchema), asyncHandler(async (request, response) => {
  const refreshToken = request.body.refreshToken ?? readCookie(request.headers.cookie, cookieName)
  if (!refreshToken) throw new AppError(401, 'UNAUTHORIZED', 'Refresh token is required')
  const session = await rotateRefreshToken(refreshToken, { userAgent: request.get('user-agent'), ipAddress: request.ip })
  setRefreshCookie(response, session.refreshToken)
  const { refreshToken: _hidden, ...safeSession } = session
  return success(response, request.body.refreshToken ? session : safeSession)
}))
router.post('/logout', validate(refreshSchema), asyncHandler(async (request, response) => {
  await logout(request.body.refreshToken ?? readCookie(request.headers.cookie, cookieName))
  response.clearCookie(cookieName, { path: '/api/v1/auth' })
  return success(response, null, 'Logged out')
}))
router.get('/me', authenticate, asyncHandler(async (request, response) => success(response, await getCurrentUser(request.auth!.userId))))
router.post('/change-password', authenticate, validate(passwordSchema), asyncHandler(async (request, response) => {
  await changePassword(request.auth!.userId, request.body.currentPassword, request.body.newPassword)
  response.clearCookie(cookieName, { path: '/api/v1/auth' })
  return success(response, null, 'Password changed. Please log in again.')
}))

export const authRouter = router
