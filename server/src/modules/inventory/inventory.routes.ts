import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireOwner, requireShopAccess } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import { asyncHandler } from '../../shared/async-handler.js'
import { AppError } from '../../shared/app-error.js'
import { success } from '../../shared/response.js'
import * as service from './inventory.service.js'

const router=Router();const uuid=z.object({id:z.string().uuid()});const page=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(20)})
const money=z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);const quantity=z.string().regex(/^\d{1,15}(\.\d{1,3})?$/);const positiveQuantity=quantity.refine(v=>Number(v)>0)
const units=['PIECE','KILOGRAM','GRAM','LITER','BOTTLE','BAG','CARTON','BOX'] as const
const product=z.object({categoryId:z.string().uuid().optional(),name:z.string().trim().min(1).max(200),description:z.string().max(500).optional(),unit:z.enum(units),sellingPrice:money,costPrice:money.optional(),minimumStock:quantity.default('0'),openingStock:quantity.optional()})
const key=(req:import('express').Request)=>{const value=req.get('Idempotency-Key');if(!value||value.length>120)throw new AppError(400,'IDEMPOTENCY_KEY_REQUIRED','A valid Idempotency-Key header is required');return value}
router.use(authenticate,requireOwner)
router.get('/categories',requireShopAccess('read'),asyncHandler(async(req,res)=>success(res,await service.listCategories(req.auth!.shopId!,req.query.archived==='true'))))
router.post('/categories',requireShopAccess('write'),validate(z.object({name:z.string().trim().min(1).max(100)})),asyncHandler(async(req,res)=>success(res,await service.createCategory(req.auth!.shopId!,req.body.name),'Category created',201)))
router.patch('/categories/:id',requireShopAccess('write'),validate(uuid,'params'),validate(z.object({name:z.string().trim().min(1).max(100)})),asyncHandler(async(req,res)=>success(res,await service.updateCategory(req.auth!.shopId!,String(req.params.id),req.body.name))))
router.delete('/categories/:id',requireShopAccess('write'),validate(uuid,'params'),asyncHandler(async(req,res)=>success(res,await service.archiveCategory(req.auth!.shopId!,String(req.params.id)),'Category archived')))
router.get('/inventory/summary',requireShopAccess('read'),asyncHandler(async(req,res)=>success(res,await service.inventorySummary(req.auth!.shopId!))))
router.get('/inventory/low-stock',requireShopAccess('read'),validate(page,'query'),asyncHandler(async(req,res)=>success(res,await service.listProducts(req.auth!.shopId!,{page:Number(req.query.page),limit:Number(req.query.limit),stock:'low',active:'true',sort:'name',order:'asc'}))))
router.get('/products',requireShopAccess('read'),validate(page.extend({search:z.string().max(100).optional(),categoryId:z.string().uuid().optional(),stock:z.enum(['all','low','out']).default('all'),active:z.enum(['true','false','all']).default('true'),sort:z.enum(['name','createdAt']).default('createdAt'),order:z.enum(['asc','desc']).default('desc')}),'query'),asyncHandler(async(req,res)=>success(res,await service.listProducts(req.auth!.shopId!,req.query as never))))
router.post('/products',requireShopAccess('write'),validate(product),asyncHandler(async(req,res)=>success(res,await service.createProduct(req.auth!.shopId!,req.auth!.userId,req.body),'Product created',201)))
router.get('/products/:id',requireShopAccess('read'),validate(uuid,'params'),asyncHandler(async(req,res)=>success(res,await service.getProduct(req.auth!.shopId!,String(req.params.id)))))
router.patch('/products/:id',requireShopAccess('write'),validate(uuid,'params'),validate(product.omit({openingStock:true}).partial()),asyncHandler(async(req,res)=>success(res,await service.updateProduct(req.auth!.shopId!,String(req.params.id),req.body))))
router.delete('/products/:id',requireShopAccess('write'),validate(uuid,'params'),asyncHandler(async(req,res)=>success(res,await service.archiveProduct(req.auth!.shopId!,String(req.params.id)),'Product archived')))
router.get('/products/:id/stock',requireShopAccess('read'),validate(uuid,'params'),asyncHandler(async(req,res)=>success(res,await service.getProduct(req.auth!.shopId!,String(req.params.id)))))
router.post('/products/:id/stock/receive',requireShopAccess('write'),validate(uuid,'params'),validate(z.object({quantity:positiveQuantity,unitCost:money.optional(),note:z.string().max(500).optional()})),asyncHandler(async(req,res)=>success(res,await service.receiveStock(req.auth!.shopId!,String(req.params.id),req.auth!.userId,req.body,key(req)),'Stock received',201)))
router.post('/products/:id/stock/adjust',requireShopAccess('write'),validate(uuid,'params'),validate(z.object({actualQuantity:quantity,expectedQuantity:quantity,reason:z.enum(['DAMAGED','EXPIRED','LOST','PHYSICAL_COUNT','OTHER']),note:z.string().max(500).optional()})),asyncHandler(async(req,res)=>success(res,await service.adjustStock(req.auth!.shopId!,String(req.params.id),req.auth!.userId,req.body,key(req)),'Stock adjusted',201)))
router.get('/products/:id/stock/movements',requireShopAccess('read'),validate(uuid,'params'),validate(page,'query'),asyncHandler(async(req,res)=>success(res,await service.movements(req.auth!.shopId!,String(req.params.id),Number(req.query.page),Number(req.query.limit)))))
export const inventoryRouter=router
