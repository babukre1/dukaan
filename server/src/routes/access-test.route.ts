import { Router } from 'express'
import { authenticate, requireOwner, requireShopAccess } from '../middleware/auth.js'
import { success } from '../shared/response.js'

export const accessTestRouter = Router()
accessTestRouter.get('/read', authenticate, requireOwner, requireShopAccess('read'), (request, response) => success(response, { shopId: request.auth!.shopId, access: 'read' }))
accessTestRouter.post('/write', authenticate, requireOwner, requireShopAccess('write'), (request, response) => success(response, { shopId: request.auth!.shopId, access: 'write' }))
