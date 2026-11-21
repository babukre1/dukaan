import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireOwner, requireShopAccess } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { AppError } from '../../shared/app-error.js'
import { success } from '../../shared/response.js'
import * as service from './customer.service.js'

const router = Router()
const uuid = z.object({ id: z.string().uuid() })
const page = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) })
const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/).refine(v => Number(v) > 0)
const customer = z.object({ fullName: z.string().trim().min(1).max(150), phoneNumber: z.string().max(30).optional(), address: z.string().max(300).optional(), notes: z.string().max(1000).optional(), openingBalance: money.optional() })
const debt = z.object({ amount: money, description: z.string().max(500).optional() })
const payment = z.object({ amount: money, method: z.enum(['CASH','MOBILE_MONEY','OTHER']), reference: z.string().max(120).optional(), notes: z.string().max(500).optional(), receivedAt: z.string().datetime().optional() })
const key = (request: import('express').Request) => { const value = request.get('Idempotency-Key'); if (!value || value.length > 120) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required'); return value }

router.use(authenticate, requireOwner)
router.get('/debts/summary', requireShopAccess('read'), validate(z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }), 'query'), asyncHandler(async (req,res) => success(res, await service.debtSummary(req.auth!.shopId!, req.query.from as string, req.query.to as string))))
router.get('/customers', requireShopAccess('read'), validate(page.extend({ search: z.string().max(100).optional(), balance: z.enum(['all','debt','cleared']).default('all'), sort: z.enum(['name','balance','createdAt']).default('createdAt'), order: z.enum(['asc','desc']).default('desc') }), 'query'), asyncHandler(async (req,res) => success(res, await service.listCustomers(req.auth!.shopId!, req.query as never))))
router.post('/customers', requireShopAccess('write'), validate(customer), asyncHandler(async (req,res) => success(res, await service.createCustomer(req.auth!.shopId!, req.auth!.userId, req.body), 'Customer created', 201)))
router.get('/customers/:id', requireShopAccess('read'), validate(uuid,'params'), asyncHandler(async (req,res) => success(res, await service.getCustomer(req.auth!.shopId!, String(req.params.id)))))
router.patch('/customers/:id', requireShopAccess('write'), validate(uuid,'params'), validate(customer.omit({ openingBalance: true }).partial()), asyncHandler(async (req,res) => success(res, await service.updateCustomer(req.auth!.shopId!, String(req.params.id), req.body))))
router.delete('/customers/:id', requireShopAccess('write'), validate(uuid,'params'), asyncHandler(async (req,res) => success(res, await service.archiveCustomer(req.auth!.shopId!, String(req.params.id)), 'Customer archived')))
router.post('/customers/:id/debts/opening', requireShopAccess('write'), validate(uuid,'params'), validate(debt), asyncHandler(async (req,res) => success(res, await service.addDebt(req.auth!.shopId!, String(req.params.id), req.auth!.userId, { ...req.body, opening: true }, key(req)), 'Opening debt recorded', 201)))
router.post('/customers/:id/debts', requireShopAccess('write'), validate(uuid,'params'), validate(debt), asyncHandler(async (req,res) => success(res, await service.addDebt(req.auth!.shopId!, String(req.params.id), req.auth!.userId, req.body, key(req)), 'Debt recorded', 201)))
router.get('/customers/:id/debts', requireShopAccess('read'), validate(uuid,'params'), validate(page,'query'), asyncHandler(async (req,res) => success(res, await service.listDebtEntries(req.auth!.shopId!, String(req.params.id), Number(req.query.page), Number(req.query.limit)))))
router.get('/customers/:id/statement', requireShopAccess('read'), validate(uuid,'params'), validate(page,'query'), asyncHandler(async (req,res) => success(res, await service.statement(req.auth!.shopId!, String(req.params.id), Number(req.query.page), Number(req.query.limit)))))
router.post('/customers/:id/payments', requireShopAccess('write'), validate(uuid,'params'), validate(payment), asyncHandler(async (req,res) => success(res, await service.receivePayment(req.auth!.shopId!, String(req.params.id), req.auth!.userId, req.body, key(req)), 'Payment recorded', 201)))
router.post('/debts/:id/reverse', requireShopAccess('write'), validate(uuid,'params'), validate(z.object({ reason: z.string().trim().min(3).max(500) })), asyncHandler(async (req,res) => success(res, await service.reverseDebt(req.auth!.shopId!, String(req.params.id), req.auth!.userId, req.body.reason), 'Transaction reversed')))
router.post('/payments/:id/reverse', requireShopAccess('write'), validate(uuid,'params'), validate(z.object({ reason: z.string().trim().min(3).max(500) })), asyncHandler(async (req,res) => { const found = await import('../../config/database.js').then(({db}) => db.query('SELECT "id" FROM "debt_entries" WHERE "paymentId"=$1 AND "shopId"=$2', [req.params.id,req.auth!.shopId])); if(!found.rowCount) throw new AppError(404,'RESOURCE_NOT_FOUND','Payment not found'); return success(res, await service.reverseDebt(req.auth!.shopId!, found.rows[0].id, req.auth!.userId, req.body.reason), 'Payment reversed') }))

export const customerRouter = router
