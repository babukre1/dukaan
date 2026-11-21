import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireAdmin } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { success } from '../../shared/response.js'
import { createShop, dashboard, getShop, listOwners, listShops, resetOwnerPassword, setOwnerStatus, setShopStatus, updateShop } from './shop.service.js'

const router = Router()
const idParams = z.object({ id: z.string().uuid() })
const pagination = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
const createSchema = z.object({ name: z.string().min(2).max(160), phoneNumber: z.string().min(8).max(30), currencyCode: z.string().length(3).default('USD'), ownerFullName: z.string().min(2).max(120), ownerPhoneNumber: z.string().min(8).max(30), temporaryPassword: z.string().min(8).max(200).optional(), reuseOwnerAccount: z.boolean().default(false) })

router.use(authenticate, requireAdmin)
router.get('/dashboard', asyncHandler(async (_request, response) => success(response, await dashboard())))
router.get('/shops', validate(pagination.extend({ search: z.string().max(100).optional(), accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(), subscriptionStatus: z.enum(['PENDING', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED']).optional(), sort: z.enum(['name', 'createdAt', 'expiresAt']).default('createdAt'), order: z.enum(['asc', 'desc']).default('desc') }), 'query'), asyncHandler(async (request, response) => success(response, await listShops(request.query as never))))
router.post('/shops', validate(createSchema), asyncHandler(async (request, response) => success(response, await createShop(request.body, request.auth!.userId), 'Shop created', 201)))
router.get('/shops/:id', validate(idParams, 'params'), asyncHandler(async (request, response) => success(response, await getShop(String(request.params.id)))))
router.patch('/shops/:id', validate(idParams, 'params'), validate(z.object({ name: z.string().min(2).max(160).optional(), phoneNumber: z.string().min(8).max(30).optional(), currencyCode: z.string().length(3).optional() })), asyncHandler(async (request, response) => success(response, await updateShop(String(request.params.id), request.body, request.auth!.userId))))
router.post('/shops/:id/status', validate(idParams, 'params'), validate(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']), reason: z.string().max(500).optional() })), asyncHandler(async (request, response) => success(response, await setShopStatus(String(request.params.id), request.body.status, request.auth!.userId, request.body.reason), 'Shop status updated')))
router.get('/owners', validate(pagination.extend({ search: z.string().max(100).optional(), isActive: z.enum(['true', 'false']).transform((value) => value === 'true').optional() }), 'query'), asyncHandler(async (request, response) => success(response, await listOwners(request.query as never))))
router.post('/owners/:id/status', validate(idParams, 'params'), validate(z.object({ isActive: z.boolean() })), asyncHandler(async (request, response) => success(response, await setOwnerStatus(String(request.params.id), request.body.isActive, request.auth!.userId))))
router.post('/owners/:id/reset-password', validate(idParams, 'params'), validate(z.object({ temporaryPassword: z.string().min(8).max(200) })), asyncHandler(async (request, response) => { await resetOwnerPassword(String(request.params.id), request.body.temporaryPassword, request.auth!.userId); return success(response, null, 'Temporary password issued') }))

export const shopRouter = router
