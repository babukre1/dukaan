import { db, withTransaction } from '../../config/database.js'
import { AppError, notFound } from '../../shared/app-error.js'
import { hashPassword } from '../../shared/password.js'
import { normalizePhoneNumber } from '../../shared/phone.js'
import { effectiveSubscriptionStatus } from '../../shared/subscription-time.js'

async function audit(client: import('pg').PoolClient, input: { actorId: string; shopId?: string; action: string; entityType: string; entityId: string; metadata?: unknown }) {
  await client.query(`INSERT INTO "admin_audit_logs" ("actorUserId","shopId","action","entityType","entityId","metadata") VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.actorId, input.shopId, input.action, input.entityType, input.entityId, input.metadata ? JSON.stringify(input.metadata) : null])
}

function shopView(row: Record<string, unknown>) {
  const subscriptionStatus = row.startsAt && row.expiresAt
    ? effectiveSubscriptionStatus({ startsAt: new Date(String(row.startsAt)), expiresAt: new Date(String(row.expiresAt)), status: String(row.subscriptionRecordStatus), planType: String(row.planType) }) : null
  return { ...row, subscriptionStatus }
}

export async function createShop(input: { name: string; phoneNumber: string; currencyCode: string; ownerFullName: string; ownerPhoneNumber: string; temporaryPassword?: string; reuseOwnerAccount?: boolean }, actorId: string) {
  const shopPhone = normalizePhoneNumber(input.phoneNumber); const ownerPhone = normalizePhoneNumber(input.ownerPhoneNumber)
  return withTransaction(async (client) => {
    const existing = await client.query('SELECT * FROM "users" WHERE "phoneNumber"=$1 FOR UPDATE', [ownerPhone])
    let owner = existing.rows[0]
    if (owner) {
      if (!input.reuseOwnerAccount) throw new AppError(409, 'DUPLICATE_PHONE_NUMBER', 'An account already uses this owner phone; explicitly confirm account reuse')
      if (owner.platformRole !== 'OWNER') throw new AppError(409, 'DUPLICATE_PHONE_NUMBER', 'That phone number belongs to a platform administrator')
    } else {
      if (!input.temporaryPassword) throw new AppError(400, 'VALIDATION_ERROR', 'A temporary password is required for a new owner')
      const passwordHash = await hashPassword(input.temporaryPassword)
      const created = await client.query(`INSERT INTO "users" ("fullName","phoneNumber","passwordHash","platformRole","mustChangePassword") VALUES ($1,$2,$3,'OWNER',TRUE) RETURNING *`, [input.ownerFullName, ownerPhone, passwordHash])
      owner = created.rows[0]
    }
    const shopResult = await client.query(`INSERT INTO "shops" ("name","phoneNumber","currencyCode","accountStatus") VALUES ($1,$2,$3,'ACTIVE') RETURNING *`, [input.name, shopPhone, input.currencyCode.toUpperCase()])
    const shop = shopResult.rows[0]
    await client.query(`INSERT INTO "shop_memberships" ("shopId","userId","role") VALUES ($1,$2,'OWNER')`, [shop.id, owner.id])
    await audit(client, { actorId, shopId: shop.id, action: 'SHOP_CREATED', entityType: 'SHOP', entityId: shop.id, metadata: { ownerUserId: owner.id } })
    if (!existing.rowCount) await audit(client, { actorId, shopId: shop.id, action: 'OWNER_CREATED', entityType: 'USER', entityId: owner.id })
    return { ...shop, owner: { id: owner.id, fullName: owner.fullName, phoneNumber: owner.phoneNumber, mustChangePassword: owner.mustChangePassword } }
  })
}

export async function listShops(input: { page: number; limit: number; search?: string; accountStatus?: string; subscriptionStatus?: string; sort: string; order: string }) {
  const values: unknown[] = []; const where: string[] = []
  if (input.search) { values.push(`%${input.search.toLowerCase()}%`); where.push(`(LOWER(s."name") LIKE $${values.length} OR s."phoneNumber" LIKE $${values.length})`) }
  if (input.accountStatus) { values.push(input.accountStatus); where.push(`s."accountStatus"=$${values.length}`) }
  const sortable: Record<string, string> = { name: 's."name"', createdAt: 's."createdAt"', expiresAt: 'ss."expiresAt"' }
  const sort = sortable[input.sort] ?? sortable.createdAt; const order = input.order === 'asc' ? 'ASC' : 'DESC'
  const base = `FROM "shops" s JOIN "shop_memberships" sm ON sm."shopId"=s."id" AND sm."role"='OWNER' AND sm."isActive"=TRUE
    JOIN "users" u ON u."id"=sm."userId" LEFT JOIN "shop_subscriptions" ss ON ss."shopId"=s."id" LEFT JOIN "subscription_plans" sp ON sp."id"=ss."planId" ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`
  const [rows, count] = await Promise.all([
    db.query(`SELECT s.*,u."id" AS "ownerId",u."fullName" AS "ownerName",u."phoneNumber" AS "ownerPhoneNumber",ss."startsAt",ss."expiresAt",ss."status" AS "subscriptionRecordStatus",sp."name" AS "planName",sp."type" AS "planType" ${base} ORDER BY ${sort} ${order} LIMIT $${values.push(input.limit)} OFFSET $${values.push((input.page - 1) * input.limit)}`, values),
    db.query(`SELECT COUNT(*)::int AS count ${base}`, values.slice(0, values.length - 2)),
  ])
  let items = rows.rows.map(shopView)
  if (input.subscriptionStatus) items = items.filter((item) => item.subscriptionStatus === input.subscriptionStatus)
  return { items, pagination: { page: input.page, limit: input.limit, total: count.rows[0].count, pages: Math.ceil(count.rows[0].count / input.limit) } }
}

export async function getShop(id: string) {
  const result = await db.query(`SELECT s.*,u."id" AS "ownerId",u."fullName" AS "ownerName",u."phoneNumber" AS "ownerPhoneNumber",u."isActive" AS "ownerIsActive",u."mustChangePassword",
    ss."id" AS "subscriptionId",ss."startsAt",ss."expiresAt",ss."status" AS "subscriptionRecordStatus",ss."snapshotPrice",sp."id" AS "planId",sp."name" AS "planName",sp."type" AS "planType"
    FROM "shops" s JOIN "shop_memberships" sm ON sm."shopId"=s."id" AND sm."role"='OWNER' AND sm."isActive"=TRUE JOIN "users" u ON u."id"=sm."userId"
    LEFT JOIN "shop_subscriptions" ss ON ss."shopId"=s."id" LEFT JOIN "subscription_plans" sp ON sp."id"=ss."planId" WHERE s."id"=$1`, [id])
  if (!result.rowCount) throw notFound('Shop not found')
  return shopView(result.rows[0])
}

export async function updateShop(id: string, input: { name?: string; phoneNumber?: string; currencyCode?: string }, actorId: string) {
  const phone = input.phoneNumber ? normalizePhoneNumber(input.phoneNumber) : undefined
  return withTransaction(async (client) => {
    const result = await client.query(`UPDATE "shops" SET "name"=COALESCE($2,"name"),"phoneNumber"=COALESCE($3,"phoneNumber"),"currencyCode"=COALESCE($4,"currencyCode"),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *`, [id, input.name, phone, input.currencyCode?.toUpperCase()])
    if (!result.rowCount) throw notFound('Shop not found')
    await audit(client, { actorId, shopId: id, action: 'SHOP_UPDATED', entityType: 'SHOP', entityId: id })
    return result.rows[0]
  })
}

export async function setShopStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE', actorId: string, reason?: string) {
  return withTransaction(async (client) => {
    const current = await client.query('SELECT "accountStatus" FROM "shops" WHERE "id"=$1 FOR UPDATE', [id]); if (!current.rowCount) throw notFound('Shop not found')
    const result = await client.query('UPDATE "shops" SET "accountStatus"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *', [id, status])
    await audit(client, { actorId, shopId: id, action: `SHOP_${status}`, entityType: 'SHOP', entityId: id, metadata: { previousStatus: current.rows[0].accountStatus, reason } })
    return result.rows[0]
  })
}

export async function listOwners(input: { page: number; limit: number; search?: string; isActive?: boolean }) {
  const values: unknown[] = []; const where = [`u."platformRole"='OWNER'`]
  if (input.search) { values.push(`%${input.search.toLowerCase()}%`); where.push(`(LOWER(u."fullName") LIKE $${values.length} OR u."phoneNumber" LIKE $${values.length})`) }
  if (input.isActive !== undefined) { values.push(input.isActive); where.push(`u."isActive"=$${values.length}`) }
  const result = await db.query(`SELECT u."id",u."fullName",u."phoneNumber",u."isActive",u."mustChangePassword",u."createdAt",COUNT(sm."shopId")::int AS "shopCount" FROM "users" u LEFT JOIN "shop_memberships" sm ON sm."userId"=u."id" AND sm."isActive"=TRUE WHERE ${where.join(' AND ')} GROUP BY u."id" ORDER BY u."createdAt" DESC LIMIT $${values.push(input.limit)} OFFSET $${values.push((input.page - 1) * input.limit)}`, values)
  return { items: result.rows, pagination: { page: input.page, limit: input.limit } }
}

export async function setOwnerStatus(id: string, isActive: boolean, actorId: string) {
  return withTransaction(async (client) => {
    const result = await client.query(`UPDATE "users" SET "isActive"=$2,"tokenVersion"="tokenVersion"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "platformRole"='OWNER' RETURNING "id","fullName","phoneNumber","isActive"`, [id, isActive])
    if (!result.rowCount) throw notFound('Owner not found')
    if (!isActive) await client.query('UPDATE "refresh_sessions" SET "revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP) WHERE "userId"=$1', [id])
    await audit(client, { actorId, action: isActive ? 'OWNER_ACTIVATED' : 'OWNER_DEACTIVATED', entityType: 'USER', entityId: id })
    return result.rows[0]
  })
}

export async function resetOwnerPassword(id: string, temporaryPassword: string, actorId: string) {
  const passwordHash = await hashPassword(temporaryPassword)
  await withTransaction(async (client) => {
    const result = await client.query(`UPDATE "users" SET "passwordHash"=$2,"mustChangePassword"=TRUE,"tokenVersion"="tokenVersion"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "platformRole"='OWNER' RETURNING "id"`, [id, passwordHash])
    if (!result.rowCount) throw notFound('Owner not found')
    await client.query('UPDATE "refresh_sessions" SET "revokedAt"=COALESCE("revokedAt",CURRENT_TIMESTAMP) WHERE "userId"=$1', [id])
    await audit(client, { actorId, action: 'OWNER_PASSWORD_RESET', entityType: 'USER', entityId: id })
  })
}

export async function dashboard() {
  const result = await db.query(`SELECT
    COUNT(*)::int AS "totalShops",
    COUNT(*) FILTER (WHERE s."accountStatus"='ACTIVE')::int AS "activeShops",
    COUNT(*) FILTER (WHERE s."accountStatus"='SUSPENDED')::int AS "suspendedShops",
    COUNT(*) FILTER (WHERE ss."status"='ACTIVE' AND ss."startsAt"<=CURRENT_TIMESTAMP AND ss."expiresAt">CURRENT_TIMESTAMP AND sp."type"='PAID')::int AS "activeSubscriptions",
    COUNT(*) FILTER (WHERE ss."status"='ACTIVE' AND ss."startsAt"<=CURRENT_TIMESTAMP AND ss."expiresAt">CURRENT_TIMESTAMP AND sp."type"='TRIAL')::int AS "trialShops",
    COUNT(*) FILTER (WHERE ss."status"='ACTIVE' AND ss."expiresAt">CURRENT_TIMESTAMP AND ss."expiresAt"<=CURRENT_TIMESTAMP+INTERVAL '30 days')::int AS "expiringSoon"
    FROM "shops" s LEFT JOIN "shop_subscriptions" ss ON ss."shopId"=s."id" LEFT JOIN "subscription_plans" sp ON sp."id"=ss."planId"`)
  return result.rows[0]
}
