import { Router, type Request } from 'express'
import { z } from 'zod'
import { authenticate, requireOwner, requireShopAccess } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { AppError } from '../../shared/app-error.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { success } from '../../shared/response.js'
import * as service from './sale.service.js'

const router = Router()
const id = z.object({ id: z.string().uuid() })
const page = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)
const positiveQuantity = z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).refine(value => Number(value) > 0)
const paymentMethods = ['CASH', 'MOBILE_MONEY', 'OTHER'] as const
const key = (request: Request) => {
  const value = request.get('Idempotency-Key')
  if (!value || value.length > 120) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required')
  return value
}

const createSale = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: positiveQuantity })).min(1, 'A sale requires at least one product').max(100),
  discountAmount: money.default('0'),
  paidAmount: money.default('0'),
  paymentMethod: z.enum(paymentMethods).optional(),
  notes: z.string().trim().max(500).optional(),
})
const createReturn = z.object({
  items: z.array(z.object({ saleItemId: z.string().uuid(), quantity: positiveQuantity, restock: z.boolean().default(true) })).min(1).max(100),
  debtReductionAmount: money.default('0'),
  refundMethod: z.enum(paymentMethods).optional(),
  reason: z.string().trim().min(3).max(500).optional(),
})

router.use(authenticate, requireOwner)
router.post('/sales', requireShopAccess('write'), validate(createSale), asyncHandler(async (req, res) => success(res, await service.createSale(req.auth!.shopId!, req.auth!.userId, req.body, key(req)), 'Sale created', 201)))
router.get('/sales', requireShopAccess('read'), validate(page.extend({ search: z.string().max(100).optional(), paymentStatus: z.enum(['ALL', 'PAID', 'PARTIALLY_PAID', 'UNPAID']).default('ALL'), from: z.string().datetime().optional(), to: z.string().datetime().optional() }), 'query'), asyncHandler(async (req, res) => success(res, await service.listSales(req.auth!.shopId!, req.query as never))))
router.get('/sales/summary', requireShopAccess('read'), validate(z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }), 'query'), asyncHandler(async (req, res) => success(res, await service.salesSummary(req.auth!.shopId!, req.query.from as string | undefined, req.query.to as string | undefined))))
router.get('/sales/:id', requireShopAccess('read'), validate(id, 'params'), asyncHandler(async (req, res) => success(res, await service.getSale(req.auth!.shopId!, String(req.params.id)))))
router.get('/sales/:id/receipt', requireShopAccess('read'), validate(id, 'params'), asyncHandler(async (req, res) => success(res, await service.getReceipt(req.auth!.shopId!, String(req.params.id)))))
router.post('/sales/:id/void', requireShopAccess('write'), validate(id, 'params'), validate(z.object({ reason: z.string().trim().min(3).max(500), refundIssued: z.boolean().optional() })), asyncHandler(async (req, res) => success(res, await service.voidSale(req.auth!.shopId!, String(req.params.id), req.auth!.userId, req.body, key(req)), 'Sale voided')))
router.post('/sales/:id/returns', requireShopAccess('write'), validate(id, 'params'), validate(createReturn), asyncHandler(async (req, res) => success(res, await service.createReturn(req.auth!.shopId!, String(req.params.id), req.auth!.userId, req.body, key(req)), 'Return recorded', 201)))
router.get('/sales/:id/returns', requireShopAccess('read'), validate(id, 'params'), asyncHandler(async (req, res) => success(res, await service.listReturns(req.auth!.shopId!, String(req.params.id)))))

export const saleRouter = router
