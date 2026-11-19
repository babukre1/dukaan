import type pg from 'pg'
import { db, withTransaction } from '../../config/database.js'
import { AppError, notFound } from '../../shared/app-error.js'
import { addCalendarDuration, effectiveSubscriptionStatus, type DurationUnit } from '../../shared/subscription-time.js'

type Plan = { id: string; code: string; name: string; type: 'TRIAL' | 'PAID'; durationUnit: DurationUnit; durationCount: number; price: string; currencyCode: string; isActive: boolean }

const subscriptionSelect = `SELECT ss.*, sp."code" AS "planCode", sp."name" AS "planName", sp."type" AS "planType",
 sp."durationUnit", sp."durationCount", sp."price" AS "currentPlanPrice", s."accountStatus", s."name" AS "shopName"
 FROM "shop_subscriptions" ss JOIN "subscription_plans" sp ON sp."id"=ss."planId" JOIN "shops" s ON s."id"=ss."shopId"`

function serializeSubscription(row: Record<string, unknown> | undefined) {
  if (!row) return null
  const startsAt = new Date(String(row.startsAt)); const expiresAt = new Date(String(row.expiresAt))
  const effectiveStatus = effectiveSubscriptionStatus({ startsAt, expiresAt, status: String(row.status), planType: String(row.planType) })
  return { ...row, effectiveStatus, daysRemaining: Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)), access: row.accountStatus !== 'ACTIVE' ? 'BLOCKED' : ['ACTIVE', 'TRIAL'].includes(effectiveStatus) ? 'FULL' : effectiveStatus === 'EXPIRED' ? 'READ_ONLY' : 'RESTRICTED' }
}

async function getPlan(client: pg.PoolClient, planId: string, requireActive = true): Promise<Plan> {
  const result = await client.query('SELECT * FROM "subscription_plans" WHERE "id"=$1', [planId])
  const plan = result.rows[0] as Plan | undefined
  if (!plan || (requireActive && !plan.isActive)) throw notFound('Subscription plan not found or inactive')
  return plan
}

async function lockShop(client: pg.PoolClient, shopId: string) {
  const result = await client.query('SELECT "id" FROM "shops" WHERE "id"=$1 FOR UPDATE', [shopId])
  if (!result.rowCount) throw notFound('Shop not found')
}

async function idempotentResult(client: pg.PoolClient, shopId: string, key: string | undefined) {
  if (!key) return null
  const result = await client.query(`SELECT ${subscriptionSelect.slice(7)} WHERE ss."shopId"=$1 AND EXISTS
    (SELECT 1 FROM "subscription_events" se WHERE se."shopId"=$1 AND se."idempotencyKey"=$2)`, [shopId, key])
  return result.rows[0] ? serializeSubscription(result.rows[0]) : null
}

async function event(client: pg.PoolClient, input: { shopId: string; subscriptionId: string; actorId: string; type: string; previous?: Date | null; next?: Date | null; note?: string; idempotencyKey?: string; metadata?: unknown }) {
  await client.query(`INSERT INTO "subscription_events" ("shopId","subscriptionId","eventType","previousExpiresAt","newExpiresAt","performedByUserId","idempotencyKey","note","metadata")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [input.shopId, input.subscriptionId, input.type, input.previous, input.next, input.actorId, input.idempotencyKey, input.note, input.metadata ? JSON.stringify(input.metadata) : null])
}

export async function listPlans(includeInactive = false) {
  const result = await db.query(`SELECT * FROM "subscription_plans" ${includeInactive ? '' : 'WHERE "isActive"=TRUE'} ORDER BY "type" DESC,"durationUnit","durationCount"`)
  return result.rows
}

export async function createPlan(input: { code: string; name: string; type: string; durationUnit: string; durationCount: number; price: string; currencyCode: string }) {
  const result = await db.query(`INSERT INTO "subscription_plans" ("code","name","type","durationUnit","durationCount","price","currencyCode") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.code.toUpperCase(), input.name, input.type, input.durationUnit, input.durationCount, input.price, input.currencyCode.toUpperCase()])
  return result.rows[0]
}

export async function updatePlan(id: string, input: { name?: string; price?: string; isActive?: boolean }) {
  const result = await db.query(`UPDATE "subscription_plans" SET "name"=COALESCE($2,"name"),"price"=COALESCE($3,"price"),"isActive"=COALESCE($4,"isActive"),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *`, [id, input.name, input.price, input.isActive])
  if (!result.rowCount) throw notFound('Subscription plan not found')
  return result.rows[0]
}

async function readShopSubscription(shopId: string, client?: pg.PoolClient) {
  const result = await (client ?? db).query(`${subscriptionSelect} WHERE ss."shopId"=$1`, [shopId])
  return serializeSubscription(result.rows[0])
}

export async function getShopSubscription(shopId: string) { return readShopSubscription(shopId) }

export async function activate(input: { shopId: string; planId: string; actorId: string; startsAt?: Date; note?: string; trialOverride?: boolean; overrideReason?: string; idempotencyKey?: string }) {
  return withTransaction(async (client) => {
    await lockShop(client, input.shopId)
    const duplicate = await idempotentResult(client, input.shopId, input.idempotencyKey); if (duplicate) return duplicate
    const plan = await getPlan(client, input.planId)
    const current = await client.query('SELECT * FROM "shop_subscriptions" WHERE "shopId"=$1 FOR UPDATE', [input.shopId])
    if (current.rows[0] && effectiveSubscriptionStatus({ startsAt: current.rows[0].startsAt, expiresAt: current.rows[0].expiresAt, status: current.rows[0].status, planType: plan.type }, new Date()) !== 'EXPIRED' && current.rows[0].status !== 'CANCELLED') {
      throw new AppError(409, 'SUBSCRIPTION_CONFLICT', 'The shop already has a current subscription; renew or extend it instead')
    }
    if (plan.type === 'TRIAL') {
      const priorTrial = await client.query(`SELECT 1 FROM "subscription_events" WHERE "shopId"=$1 AND "eventType"='TRIAL_STARTED' LIMIT 1`, [input.shopId])
      if (priorTrial.rowCount && !(input.trialOverride && input.overrideReason?.trim())) throw new AppError(409, 'TRIAL_ALREADY_USED', 'This shop has already used its introductory trial')
    }
    const startsAt = input.startsAt ?? new Date(); const expiresAt = addCalendarDuration(startsAt, plan.durationUnit, plan.durationCount)
    const status = startsAt > new Date() ? 'PENDING' : 'ACTIVE'
    const subscription = current.rows[0]
      ? await client.query(`UPDATE "shop_subscriptions" SET "planId"=$2,"startsAt"=$3,"expiresAt"=$4,"status"=$5,"snapshotPlanCode"=$6,"snapshotPrice"=$7,"currencyCode"=$8,"updatedAt"=CURRENT_TIMESTAMP WHERE "shopId"=$1 RETURNING *`, [input.shopId, plan.id, startsAt, expiresAt, status, plan.code, plan.price, plan.currencyCode])
      : await client.query(`INSERT INTO "shop_subscriptions" ("shopId","planId","startsAt","expiresAt","status","snapshotPlanCode","snapshotPrice","currencyCode") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [input.shopId, plan.id, startsAt, expiresAt, status, plan.code, plan.price, plan.currencyCode])
    await event(client, { shopId: input.shopId, subscriptionId: subscription.rows[0].id, actorId: input.actorId, type: plan.type === 'TRIAL' ? 'TRIAL_STARTED' : 'ACTIVATED', next: expiresAt, note: input.note, idempotencyKey: input.idempotencyKey, metadata: input.trialOverride ? { trialOverride: true, reason: input.overrideReason } : undefined })
    return readShopSubscription(input.shopId, client)
  })
}

export async function renew(input: { shopId: string; planId: string; actorId: string; startsAt?: Date; note?: string; idempotencyKey?: string }) {
  return withTransaction(async (client) => {
    await lockShop(client, input.shopId)
    const duplicate = await idempotentResult(client, input.shopId, input.idempotencyKey); if (duplicate) return duplicate
    const plan = await getPlan(client, input.planId)
    if (plan.type === 'TRIAL') throw new AppError(400, 'VALIDATION_ERROR', 'Renewal requires a paid plan')
    const result = await client.query('SELECT * FROM "shop_subscriptions" WHERE "shopId"=$1 FOR UPDATE', [input.shopId])
    const current = result.rows[0]; if (!current) throw notFound('No subscription exists for this shop')
    const now = input.startsAt ?? new Date(); const previous = new Date(current.expiresAt)
    const base = current.status !== 'CANCELLED' && previous > now ? previous : now
    const expiresAt = addCalendarDuration(base, plan.durationUnit, plan.durationCount)
    const updated = await client.query(`UPDATE "shop_subscriptions" SET "planId"=$2,"startsAt"=$3,"expiresAt"=$4,"status"='ACTIVE',"snapshotPlanCode"=$5,"snapshotPrice"=$6,"currencyCode"=$7,"updatedAt"=CURRENT_TIMESTAMP WHERE "shopId"=$1 RETURNING *`, [input.shopId, plan.id, previous > now ? current.startsAt : now, expiresAt, plan.code, plan.price, plan.currencyCode])
    await event(client, { shopId: input.shopId, subscriptionId: updated.rows[0].id, actorId: input.actorId, type: 'RENEWED', previous, next: expiresAt, note: input.note, idempotencyKey: input.idempotencyKey, metadata: { planCode: plan.code } })
    return readShopSubscription(input.shopId, client)
  })
}

export async function extend(input: { shopId: string; unit: DurationUnit; count: number; actorId: string; note: string; idempotencyKey?: string }) {
  return withTransaction(async (client) => {
    await lockShop(client, input.shopId)
    const duplicate = await idempotentResult(client, input.shopId, input.idempotencyKey); if (duplicate) return duplicate
    const result = await client.query('SELECT * FROM "shop_subscriptions" WHERE "shopId"=$1 FOR UPDATE', [input.shopId])
    const current = result.rows[0]; if (!current) throw notFound('No subscription exists for this shop')
    if (current.status === 'CANCELLED') throw new AppError(409, 'SUBSCRIPTION_CONFLICT', 'A cancelled subscription must be renewed, not extended')
    const previous = new Date(current.expiresAt); const base = previous > new Date() ? previous : new Date()
    const expiresAt = addCalendarDuration(base, input.unit, input.count)
    await client.query(`UPDATE "shop_subscriptions" SET "expiresAt"=$2,"status"='ACTIVE',"updatedAt"=CURRENT_TIMESTAMP WHERE "shopId"=$1`, [input.shopId, expiresAt])
    await event(client, { shopId: input.shopId, subscriptionId: current.id, actorId: input.actorId, type: 'EXTENDED', previous, next: expiresAt, note: input.note, idempotencyKey: input.idempotencyKey, metadata: { unit: input.unit, count: input.count } })
    return readShopSubscription(input.shopId, client)
  })
}

export async function cancel(input: { shopId: string; actorId: string; note: string; idempotencyKey?: string }) {
  return withTransaction(async (client) => {
    await lockShop(client, input.shopId)
    const duplicate = await idempotentResult(client, input.shopId, input.idempotencyKey); if (duplicate) return duplicate
    const result = await client.query(`UPDATE "shop_subscriptions" SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP WHERE "shopId"=$1 AND "status"<>'CANCELLED' RETURNING *`, [input.shopId])
    const current = result.rows[0]; if (!current) throw notFound('Active subscription not found')
    await event(client, { shopId: input.shopId, subscriptionId: current.id, actorId: input.actorId, type: 'CANCELLED', previous: current.expiresAt, next: new Date(), note: input.note, idempotencyKey: input.idempotencyKey })
    return readShopSubscription(input.shopId, client)
  })
}

export async function history(shopId: string, page: number, limit: number) {
  const [events, count] = await Promise.all([
    db.query(`SELECT se.*,u."fullName" AS "performedByName" FROM "subscription_events" se JOIN "users" u ON u."id"=se."performedByUserId" WHERE se."shopId"=$1 ORDER BY se."createdAt" DESC LIMIT $2 OFFSET $3`, [shopId, limit, (page - 1) * limit]),
    db.query('SELECT COUNT(*)::int AS count FROM "subscription_events" WHERE "shopId"=$1', [shopId]),
  ])
  return { items: events.rows, pagination: { page, limit, total: count.rows[0].count, pages: Math.ceil(count.rows[0].count / limit) } }
}

export async function listSubscriptions(input: { status?: string; page: number; limit: number; expiringDays?: number }) {
  const values: unknown[] = []; const where: string[] = []
  if (input.expiringDays) { values.push(input.expiringDays); where.push(`ss."expiresAt">CURRENT_TIMESTAMP AND ss."expiresAt"<=CURRENT_TIMESTAMP+($${values.length} || ' days')::interval`) }
  const result = await db.query(`${subscriptionSelect} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ss."expiresAt" ASC LIMIT $${values.push(input.limit)} OFFSET $${values.push((input.page - 1) * input.limit)}`, values)
  const items = result.rows.map(serializeSubscription).filter((item) => !input.status || item?.effectiveStatus === input.status)
  return { items, pagination: { page: input.page, limit: input.limit } }
}
