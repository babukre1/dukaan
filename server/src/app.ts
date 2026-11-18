import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/error-handler.js'
import { healthRouter } from './routes/health.route.js'
export const app=express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({origin:env.CORS_ORIGIN,credentials:true}))
app.use(pinoHttp())
app.use(express.json({limit:'1mb'}))
app.use('/api/v1/health',healthRouter)
app.use(notFound)
app.use(errorHandler)
