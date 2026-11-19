import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireAdmin, requireOwner } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { success } from '../../shared/response.js'
import { activate, cancel, createPlan, extend, getShopSubscription, history, listPlans, listSubscriptions, renew, updatePlan } from './subscription.service.js'

const router = Router()
const uuidParams = z.object({ shopId: z.string().uuid() })
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
const mutationBase = z.object({ idempotencyKey: z.string().min(8).max(120).optional(), note: z.string().max(500).optional() })
const planSchema = z.object({ code: z.string().regex(/^[A-Z0-9_]+$/).max(40), name: z.string().min(2).max(100), type: z.enum(['TRIAL', 'PAID']), durationUnit: z.enum(['DAY', 'MONTH', 'YEAR']), durationCount: z.number().int().positive().max(120), price: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/), currencyCode: z.string().length(3) })
const activateSchema = mutationBase.extend({ planId: z.string().uuid(), startsAt: z.coerce.date().optional(), trialOverride: z.boolean().default(false), overrideReason: z.string().max(500).optional() })
const renewSchema = mutationBase.extend({ planId: z.string().uuid(), startsAt: z.coerce.date().optional() })
const extendSchema = mutationBase.extend({ unit: z.enum(['DAY', 'MONTH', 'YEAR']), count: z.number().int().positive().max(120), note: z.string().min(3).max(500) })
const cancelSchema = mutationBase.extend({ note: z.string().min(3).max(500) })

router.use(authenticate)
router.get('/shop/subscription', requireOwner, asyncHandler(async (request, response) => success(response, await getShopSubscription(request.auth!.shopId!))))

router.use('/admin', requireAdmin)
router.get('/admin/subscription-plans', asyncHandler(async (_request, response) => success(response, await listPlans(true))))
router.post('/admin/subscription-plans', validate(planSchema), asyncHandler(async (request, response) => success(response, await createPlan(request.body), 'Plan created', 201)))
router.patch('/admin/subscription-plans/:id', validate(z.object({ id: z.string().uuid() }), 'params'), validate(z.object({ name: z.string().min(2).max(100).optional(), price: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).optional(), isActive: z.boolean().optional() })), asyncHandler(async (request, response) => success(response, await updatePlan(String(request.params.id), request.body))))
router.get('/admin/subscriptions', validate(pageQuery.extend({ status: z.enum(['PENDING', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional() }), 'query'), asyncHandler(async (request, response) => success(response, await listSubscriptions(request.query as never))))
router.get('/admin/subscriptions/expiring', validate(pageQuery.extend({ days: z.coerce.number().int().min(1).max(90).default(30) }), 'query'), asyncHandler(async (request, response) => success(response, await listSubscriptions({ page: Number(request.query.page), limit: Number(request.query.limit), expiringDays: Number(request.query.days) }))))
router.get('/admin/shops/:shopId/subscription', validate(uuidParams, 'params'), asyncHandler(async (request, response) => success(response, await getShopSubscription(String(request.params.shopId)))))
router.post('/admin/shops/:shopId/subscription/activate', validate(uuidParams, 'params'), validate(activateSchema), asyncHandler(async (request, response) => success(response, await activate({ shopId: String(request.params.shopId), actorId: request.auth!.userId, ...request.body }), 'Subscription activated')))
router.post('/admin/shops/:shopId/subscription/renew', validate(uuidParams, 'params'), validate(renewSchema), asyncHandler(async (request, response) => success(response, await renew({ shopId: String(request.params.shopId), actorId: request.auth!.userId, ...request.body }), 'Subscription renewed')))
router.post('/admin/shops/:shopId/subscription/extend', validate(uuidParams, 'params'), validate(extendSchema), asyncHandler(async (request, response) => success(response, await extend({ shopId: String(request.params.shopId), actorId: request.auth!.userId, ...request.body }), 'Subscription extended')))
router.post('/admin/shops/:shopId/subscription/cancel', validate(uuidParams, 'params'), validate(cancelSchema), asyncHandler(async (request, response) => success(response, await cancel({ shopId: String(request.params.shopId), actorId: request.auth!.userId, ...request.body }), 'Subscription cancelled')))
router.get('/admin/shops/:shopId/subscription/history', validate(uuidParams, 'params'), validate(pageQuery, 'query'), asyncHandler(async (request, response) => success(response, await history(String(request.params.shopId), Number(request.query.page), Number(request.query.limit)))))

export const subscriptionRouter = router
