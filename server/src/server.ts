import { app } from './app.js'
import { db, verifyDatabaseConnection } from './config/database.js'
import { env } from './config/env.js'

await verifyDatabaseConnection()
const server=app.listen(env.PORT,()=>{console.log(`DukaanFlow API listening on http://localhost:${env.PORT}`)})
const shutdown=(signal:string)=>{console.log(`${signal} received; closing HTTP server`);server.close(async()=>{await db.end();process.exit(0)})}
process.on('SIGTERM',()=>shutdown('SIGTERM'))
process.on('SIGINT',()=>shutdown('SIGINT'))
