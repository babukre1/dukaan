import type { RequestHandler } from 'express'
import jwt from 'jsonwebtoken'
import { db } from '../config/database.js'
import { env } from '../config/env.js'
import { AppError, forbidden, unauthorized } from '../shared/app-error.js'
import { effectiveSubscriptionStatus, type EffectiveSubscriptionStatus } from '../shared/subscription-time.js'

export type PlatformRole = 'ADMIN' | 'OWNER'
export type AuthContext = {
  userId: string; fullName: string; phoneNumber: string; platformRole: PlatformRole; mustChangePassword: boolean
  shopId?: string; shopName?: string; accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'; subscriptionStatus?: EffectiveSubscriptionStatus
}
type TokenPayload = jwt.JwtPayload & { sub: string; role: PlatformRole; version: number }

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? []
    if (scheme !== 'Bearer' || !token) throw unauthorized()
    const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as TokenPayload
    if (!payload.sub || !payload.role) throw unauthorized()
    const result = await db.query({
      text: `SELECT u."id", u."fullName", u."phoneNumber", u."platformRole", u."mustChangePassword", u."tokenVersion", u."isActive",
        s."id" AS "shopId", s."name" AS "shopName", s."accountStatus",
        ss."startsAt", ss."expiresAt", ss."status" AS "subscriptionRecordStatus", sp."type" AS "planType"
        FROM "users" u
        LEFT JOIN "shop_memberships" sm ON sm."userId" = u."id" AND sm."isActive" = TRUE
        LEFT JOIN "shops" s ON s."id" = sm."shopId"
        LEFT JOIN "shop_subscriptions" ss ON ss."shopId" = s."id"
        LEFT JOIN "subscription_plans" sp ON sp."id" = ss."planId"
        WHERE u."id" = $1 LIMIT 1`, values: [payload.sub],
    })
    const user = result.rows[0]
    if (!user?.isActive || user.tokenVersion !== payload.version || user.platformRole !== payload.role) throw unauthorized('Session is no longer valid')
    const subscriptionStatus = user.startsAt && user.expiresAt
      ? effectiveSubscriptionStatus({ startsAt: user.startsAt, expiresAt: user.expiresAt, status: user.subscriptionRecordStatus, planType: user.planType }) : undefined
    request.auth = {
      userId: user.id, fullName: user.fullName, phoneNumber: user.phoneNumber, platformRole: user.platformRole,
      mustChangePassword: user.mustChangePassword,
      ...(user.shopId ? { shopId: user.shopId, shopName: user.shopName, accountStatus: user.accountStatus, subscriptionStatus } : {}),
    }
    next()
  } catch (error) { next(error instanceof AppError ? error : unauthorized('Session is invalid or expired')) }
}

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.auth?.platformRole !== 'ADMIN') return next(forbidden('Administrator access is required'))
  if (request.auth.mustChangePassword) return next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing'))
  next()
}
export const requireOwner: RequestHandler = (request, _response, next) => {
  if (request.auth?.platformRole !== 'OWNER' || !request.auth.shopId) return next(forbidden('Shop owner access is required'))
  if (request.auth.mustChangePassword) return next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Change the temporary password before continuing'))
  next()
}
export function requireShopAccess(mode: 'read' | 'write'): RequestHandler {
  return (request, _response, next) => {
    const auth = request.auth
    if (!auth?.shopId) return next(forbidden())
    if (auth.accountStatus === 'SUSPENDED') return next(new AppError(403, 'SHOP_SUSPENDED', 'This shop account is suspended'))
    if (auth.accountStatus === 'INACTIVE') return next(new AppError(403, 'SHOP_INACTIVE', 'This shop account is inactive'))
    if (mode === 'write') {
      if (!auth.subscriptionStatus) return next(new AppError(403, 'SUBSCRIPTION_REQUIRED', 'A subscription is required'))
      if (auth.subscriptionStatus === 'EXPIRED') return next(new AppError(403, 'SUBSCRIPTION_EXPIRED', 'The subscription has expired; access is read-only'))
      if (!['ACTIVE', 'TRIAL'].includes(auth.subscriptionStatus)) return next(new AppError(403, 'SUBSCRIPTION_REQUIRED', 'The subscription is not active'))
    }
    next()
  }
}
