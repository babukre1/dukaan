import { createHash, randomBytes, randomUUID } from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import type pg from 'pg'
import { db, withTransaction } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError, unauthorized } from '../../shared/app-error.js'
import { normalizePhoneNumber } from '../../shared/phone.js'
import { assertStrongPassword, hashPassword, verifyPassword } from '../../shared/password.js'

type UserRow = { id: string; fullName: string; phoneNumber: string; passwordHash: string; platformRole: 'ADMIN' | 'OWNER'; isActive: boolean; mustChangePassword: boolean; tokenVersion: number }
type SessionMeta = { userAgent?: string; ipAddress?: string }

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const refreshExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 86_400_000)
const accessToken = (user: UserRow) => jwt.sign(
  { role: user.platformRole, version: user.tokenVersion }, env.ACCESS_TOKEN_SECRET,
  { subject: user.id, expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] },
)

async function createRefreshSession(client: pg.PoolClient, userId: string, meta: SessionMeta, familyId = randomUUID()) {
  const token = randomBytes(48).toString('base64url')
  const result = await client.query(
    `INSERT INTO "refresh_sessions" ("userId", "familyId", "tokenHash", "expiresAt", "userAgent", "ipAddress")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING "id"`,
    [userId, familyId, tokenHash(token), refreshExpiry(), meta.userAgent?.slice(0, 300), meta.ipAddress?.slice(0, 64)],
  )
  return { token, sessionId: result.rows[0].id }
}

function publicUser(user: UserRow) {
  return { id: user.id, fullName: user.fullName, phoneNumber: user.phoneNumber, platformRole: user.platformRole, mustChangePassword: user.mustChangePassword }
}

export async function login(input: { phoneNumber: string; password: string }, meta: SessionMeta) {
  const phone = normalizePhoneNumber(input.phoneNumber)
  const result = await db.query('SELECT * FROM "users" WHERE "phoneNumber" = $1 LIMIT 1', [phone])
  const user = result.rows[0] as UserRow | undefined
  if (!user || !user.isActive || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Phone number or password is incorrect')
  }
  return withTransaction(async (client) => {
    const refresh = await createRefreshSession(client, user.id, meta)
    await client.query('UPDATE "users" SET "lastLoginAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1', [user.id])
    return { accessToken: accessToken(user), refreshToken: refresh.token, expiresIn: env.ACCESS_TOKEN_TTL, user: publicUser(user) }
  })
}

export async function rotateRefreshToken(refreshToken: string, meta: SessionMeta) {
  const rotated = await withTransaction(async (client) => {
    const result = await client.query(
      `SELECT rs.*, u."fullName", u."phoneNumber", u."passwordHash", u."platformRole", u."isActive", u."mustChangePassword", u."tokenVersion"
       FROM "refresh_sessions" rs JOIN "users" u ON u."id" = rs."userId" WHERE rs."tokenHash" = $1 FOR UPDATE`,
      [tokenHash(refreshToken)],
    )
    const session = result.rows[0]
    if (!session) throw unauthorized('Refresh session is invalid')
    if (session.revokedAt) {
      await client.query('UPDATE "refresh_sessions" SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP) WHERE "familyId" = $1', [session.familyId])
      return null
    }
    if (!session.isActive || new Date(session.expiresAt) <= new Date()) throw unauthorized('Refresh session has expired')
    const refresh = await createRefreshSession(client, session.userId, meta, session.familyId)
    await client.query('UPDATE "refresh_sessions" SET "revokedAt" = CURRENT_TIMESTAMP, "replacedBy" = $2 WHERE "id" = $1', [session.id, refresh.sessionId])
    const user = session as UserRow
    return { accessToken: accessToken(user), refreshToken: refresh.token, expiresIn: env.ACCESS_TOKEN_TTL, user: publicUser(user) }
  })
  if (!rotated) throw unauthorized('Refresh token reuse detected; please log in again')
  return rotated
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return
  await db.query('UPDATE "refresh_sessions" SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP) WHERE "tokenHash" = $1', [tokenHash(refreshToken)])
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  assertStrongPassword(newPassword)
  const result = await db.query('SELECT * FROM "users" WHERE "id" = $1', [userId])
  const user = result.rows[0] as UserRow | undefined
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) throw new AppError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect')
  const passwordHash = await hashPassword(newPassword)
  await withTransaction(async (client) => {
    await client.query(`UPDATE "users" SET "passwordHash"=$2, "mustChangePassword"=FALSE, "tokenVersion"="tokenVersion"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, [userId, passwordHash])
    await client.query('UPDATE "refresh_sessions" SET "revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP) WHERE "userId"=$1', [userId])
  })
}

export async function getCurrentUser(userId: string) {
  const result = await db.query(
    `SELECT u."id",u."fullName",u."phoneNumber",u."platformRole",u."isActive",u."mustChangePassword",
      s."id" AS "shopId",s."name" AS "shopName",s."phoneNumber" AS "shopPhoneNumber",s."currencyCode",s."accountStatus"
     FROM "users" u LEFT JOIN "shop_memberships" sm ON sm."userId"=u."id" AND sm."isActive"=TRUE
     LEFT JOIN "shops" s ON s."id"=sm."shopId" WHERE u."id"=$1`, [userId],
  )
  return result.rows[0]
}
