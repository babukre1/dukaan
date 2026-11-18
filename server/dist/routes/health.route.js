import { Router } from 'express';
export const healthRouter = Router();
healthRouter.get('/', (_request, response) => { response.json({ success: true, data: { service: 'dukaanflow-api', status: 'healthy', timestamp: new Date().toISOString() } }); });
//# sourceMappingURL=health.route.js.map