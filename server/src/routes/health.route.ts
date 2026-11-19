import { Router } from 'express'
import { verifyDatabaseConnection } from '../config/database.js'
import { asyncHandler } from '../shared/async-handler.js'
export const healthRouter=Router()
healthRouter.get('/',asyncHandler(async (_request,response)=>{await verifyDatabaseConnection();response.json({success:true,data:{service:'dukaanflow-api',status:'healthy',database:'connected',timestamp:new Date().toISOString()}})}))
