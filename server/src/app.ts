import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { corsOrigins } from './config/env.js'
import { errorHandler, notFound } from './middleware/error-handler.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { shopRouter } from './modules/shops/shop.routes.js'
import { subscriptionRouter } from './modules/subscriptions/subscription.routes.js'
import { accessTestRouter } from './routes/access-test.route.js'
import { healthRouter } from './routes/health.route.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: (origin, callback) => !origin || corsOrigins.includes(origin) ? callback(null, true) : callback(new Error('Origin is not allowed')), credentials: true }))
app.use(pinoHttp())
app.use(express.json({limit:'1mb'}))
app.use('/api/v1/health',healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/admin', shopRouter)
app.use('/api/v1', subscriptionRouter)
app.use('/api/v1/shop/access-test', accessTestRouter)
app.use(notFound)
app.use(errorHandler)
