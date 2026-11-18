import { app } from './app.js'
import { env } from './config/env.js'
const server=app.listen(env.PORT,()=>{console.log(`DukaanFlow API listening on http://localhost:${env.PORT}`)})
const shutdown=(signal:string)=>{console.log(`${signal} received; closing HTTP server`);server.close(()=>process.exit(0))}
process.on('SIGTERM',()=>shutdown('SIGTERM'))
process.on('SIGINT',()=>shutdown('SIGINT'))
