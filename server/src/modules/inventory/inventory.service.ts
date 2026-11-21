import { createHash } from 'node:crypto'
import type pg from 'pg'
import { db, withTransaction } from '../../config/database.js'
import { AppError, notFound } from '../../shared/app-error.js'

type Client = pg.PoolClient
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pageResult = (items: unknown[], page: number, limit: number, total: number) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })

async function productForUpdate(client: Client, shopId: string, productId: string) {
  const result = await client.query(`SELECT p.*,ib."quantity",ib."version" FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" AND ib."shopId"=p."shopId" WHERE p."id"=$1 AND p."shopId"=$2 FOR UPDATE OF ib`, [productId, shopId])
  if (!result.rowCount) throw notFound('Product not found')
  return result.rows[0]
}
async function duplicateMovement(client: Client, shopId: string, key: string, payloadHash: string) {
  const found = await client.query('SELECT * FROM "stock_movements" WHERE "shopId"=$1 AND "idempotencyKey"=$2', [shopId, key])
  if (!found.rowCount) return null
  if (found.rows[0].payloadHash !== payloadHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'That idempotency key was already used with different data')
  return found.rows[0]
}

export async function listCategories(shopId: string, includeArchived = false) {
  const result = await db.query(`SELECT c.*,COUNT(p."id")::int AS "productCount" FROM "categories" c LEFT JOIN "products" p ON p."categoryId"=c."id" AND p."shopId"=c."shopId" WHERE c."shopId"=$1 ${includeArchived ? '' : 'AND c."archivedAt" IS NULL'} GROUP BY c."id" ORDER BY c."name"`, [shopId]); return result.rows
}
export async function createCategory(shopId: string, name: string) {
  const result = await db.query('INSERT INTO "categories" ("shopId","name") VALUES ($1,$2) RETURNING *', [shopId, name.trim()]); return result.rows[0]
}
export async function updateCategory(shopId: string, id: string, name: string) {
  const result = await db.query('UPDATE "categories" SET "name"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL RETURNING *', [id, shopId, name.trim()]); if(!result.rowCount) throw notFound('Category not found'); return result.rows[0]
}
export async function archiveCategory(shopId: string, id: string) {
  const result = await db.query('UPDATE "categories" SET "archivedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL RETURNING "id"', [id, shopId]); if(!result.rowCount) throw notFound('Category not found'); return result.rows[0]
}

type ProductInput = { categoryId?: string; name: string; description?: string; unit: string; sellingPrice: string; costPrice?: string; minimumStock: string; openingStock?: string }
export async function createProduct(shopId: string, userId: string, input: ProductInput) {
  return withTransaction(async (client) => {
    if (input.categoryId) { const category = await client.query('SELECT 1 FROM "categories" WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL', [input.categoryId, shopId]); if(!category.rowCount) throw new AppError(400,'INVALID_CATEGORY','Category does not belong to this shop') }
    const created = await client.query(`INSERT INTO "products" ("shopId","categoryId","name","description","unit","sellingPrice","costPrice","minimumStock") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [shopId,input.categoryId||null,input.name.trim(),input.description?.trim()||null,input.unit,input.sellingPrice,input.costPrice||null,input.minimumStock])
    const product = created.rows[0]; const quantity = input.openingStock ?? '0'
    await client.query('INSERT INTO "inventory_balances" ("productId","shopId","quantity") VALUES ($1,$2,$3)', [product.id,shopId,quantity])
    if (quantity !== '0' && Number(quantity) > 0) await client.query(`INSERT INTO "stock_movements" ("shopId","productId","type","quantityChange","quantityBefore","quantityAfter","unitCost","note","createdByUserId") VALUES ($1,$2,'OPENING_STOCK',$3,0,$3,$4,'Opening stock',$5)`, [shopId,product.id,quantity,input.costPrice||null,userId])
    return { ...product, quantity }
  })
}

export async function listProducts(shopId: string, input: { page:number;limit:number;search?:string;categoryId?:string;stock?:string;active?:string;sort:string;order:string }) {
  const values: unknown[]=[shopId]; const where=['p."shopId"=$1']
  if(input.search){values.push(`%${input.search.toLowerCase()}%`);where.push(`LOWER(p."name") LIKE $${values.length}`)}
  if(input.categoryId){values.push(input.categoryId);where.push(`p."categoryId"=$${values.length}`)}
  if(input.active!=='all'){values.push(input.active!=='false');where.push(`p."isActive"=$${values.length}`)}
  if(input.stock==='low')where.push('ib."quantity">0 AND ib."quantity"<=p."minimumStock" AND p."minimumStock">0')
  if(input.stock==='out')where.push('ib."quantity"=0')
  const sorts:Record<string,string>={name:'p."name"',createdAt:'p."createdAt"'};const sort=sorts[input.sort]??sorts.createdAt;const order=input.order==='asc'?'ASC':'DESC'
  const clause=`FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" LEFT JOIN "categories" c ON c."id"=p."categoryId" WHERE ${where.join(' AND ')}`;const countValues=[...values]
  values.push(input.limit,(input.page-1)*input.limit)
  const [rows,count]=await Promise.all([db.query(`SELECT p.*,ib."quantity",ib."version",c."name" AS "categoryName",CASE WHEN ib."quantity"=0 THEN 'OUT_OF_STOCK' WHEN p."minimumStock">0 AND ib."quantity"<=p."minimumStock" THEN 'LOW_STOCK' ELSE 'IN_STOCK' END AS "stockStatus" ${clause} ORDER BY ${sort} ${order},p."id" LIMIT $${values.length-1} OFFSET $${values.length}`,values),db.query(`SELECT COUNT(*)::int AS count ${clause}`,countValues)])
  return pageResult(rows.rows,input.page,input.limit,count.rows[0].count)
}
export async function getProduct(shopId:string,id:string){const result=await db.query(`SELECT p.*,ib."quantity",ib."version",c."name" AS "categoryName",CASE WHEN ib."quantity"=0 THEN 'OUT_OF_STOCK' WHEN p."minimumStock">0 AND ib."quantity"<=p."minimumStock" THEN 'LOW_STOCK' ELSE 'IN_STOCK' END AS "stockStatus" FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" LEFT JOIN "categories" c ON c."id"=p."categoryId" WHERE p."id"=$1 AND p."shopId"=$2`,[id,shopId]);if(!result.rowCount)throw notFound('Product not found');return result.rows[0]}
export async function updateProduct(shopId:string,id:string,input:Partial<ProductInput>){if(input.categoryId){const c=await db.query('SELECT 1 FROM "categories" WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL',[input.categoryId,shopId]);if(!c.rowCount)throw new AppError(400,'INVALID_CATEGORY','Category does not belong to this shop')}const result=await db.query(`UPDATE "products" SET "categoryId"=CASE WHEN $3::boolean THEN $4 ELSE "categoryId" END,"name"=COALESCE($5,"name"),"description"=CASE WHEN $6::boolean THEN $7 ELSE "description" END,"unit"=COALESCE($8,"unit"),"sellingPrice"=COALESCE($9,"sellingPrice"),"costPrice"=CASE WHEN $10::boolean THEN $11 ELSE "costPrice" END,"minimumStock"=COALESCE($12,"minimumStock"),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 RETURNING *`,[id,shopId,input.categoryId!==undefined,input.categoryId||null,input.name?.trim()||null,input.description!==undefined,input.description?.trim()||null,input.unit||null,input.sellingPrice||null,input.costPrice!==undefined,input.costPrice||null,input.minimumStock||null]);if(!result.rowCount)throw notFound('Product not found');return result.rows[0]}
export async function archiveProduct(shopId:string,id:string){const result=await db.query('UPDATE "products" SET "isActive"=FALSE,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "isActive"=TRUE RETURNING "id"',[id,shopId]);if(!result.rowCount)throw notFound('Product not found');return result.rows[0]}

export async function receiveStock(shopId:string,productId:string,userId:string,input:{quantity:string;unitCost?:string;note?:string},key:string){const payloadHash=hash({productId,...input});return withTransaction(async client=>{const duplicate=await duplicateMovement(client,shopId,key,payloadHash);if(duplicate)return duplicate;const product=await productForUpdate(client,shopId,productId);if(!product.isActive)throw new AppError(409,'PRODUCT_ARCHIVED','Archived products cannot receive stock');const updated=await client.query('UPDATE "inventory_balances" SET "quantity"="quantity"+$3,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "productId"=$1 AND "shopId"=$2 RETURNING "quantity","version"',[productId,shopId,input.quantity]);const movement=await client.query(`INSERT INTO "stock_movements" ("shopId","productId","type","quantityChange","quantityBefore","quantityAfter","unitCost","note","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,'STOCK_IN',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[shopId,productId,input.quantity,product.quantity,updated.rows[0].quantity,input.unitCost||null,input.note?.trim()||null,key,payloadHash,userId]);return movement.rows[0]})}
export async function adjustStock(shopId:string,productId:string,userId:string,input:{actualQuantity:string;expectedQuantity:string;reason:string;note?:string},key:string){const payloadHash=hash({productId,...input});return withTransaction(async client=>{const duplicate=await duplicateMovement(client,shopId,key,payloadHash);if(duplicate)return duplicate;const product=await productForUpdate(client,shopId,productId);if(String(product.quantity)!==String(input.expectedQuantity))throw new AppError(409,'STOCK_CHANGED','Stock changed since this form was opened',{currentQuantity:product.quantity});const updated=await client.query('UPDATE "inventory_balances" SET "quantity"=$3,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "productId"=$1 AND "shopId"=$2 AND "quantity"=$4 RETURNING "quantity","version"',[productId,shopId,input.actualQuantity,input.expectedQuantity]);if(!updated.rowCount)throw new AppError(409,'STOCK_CHANGED','Stock changed; refresh and try again');const movement=await client.query(`INSERT INTO "stock_movements" ("shopId","productId","type","quantityChange","quantityBefore","quantityAfter","reason","note","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,'ADJUSTMENT',$3::numeric-$4::numeric,$4,$3,$5,$6,$7,$8,$9) RETURNING *`,[shopId,productId,input.actualQuantity,input.expectedQuantity,input.reason,input.note?.trim()||null,key,payloadHash,userId]);return movement.rows[0]})}
export async function movements(shopId:string,productId:string,page:number,limit:number){await getProduct(shopId,productId);const[rows,count]=await Promise.all([db.query('SELECT * FROM "stock_movements" WHERE "shopId"=$1 AND "productId"=$2 ORDER BY "createdAt" DESC,"id" DESC LIMIT $3 OFFSET $4',[shopId,productId,limit,(page-1)*limit]),db.query('SELECT COUNT(*)::int AS count FROM "stock_movements" WHERE "shopId"=$1 AND "productId"=$2',[shopId,productId])]);return pageResult(rows.rows,page,limit,count.rows[0].count)}
export async function inventorySummary(shopId:string){const result=await db.query(`SELECT COUNT(*) FILTER (WHERE p."isActive")::int AS "totalProducts",COUNT(*) FILTER (WHERE p."isActive" AND ib."quantity"=0)::int AS "outOfStock",COUNT(*) FILTER (WHERE p."isActive" AND ib."quantity">0 AND p."minimumStock">0 AND ib."quantity"<=p."minimumStock")::int AS "lowStock" FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" WHERE p."shopId"=$1`,[shopId]);return result.rows[0]}
export async function reconciliation(shopId:string){const result=await db.query(`SELECT p."id",p."name",ib."quantity" AS "cachedQuantity",COALESCE(SUM(sm."quantityChange"),0)::numeric(18,3) AS "ledgerQuantity" FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" LEFT JOIN "stock_movements" sm ON sm."productId"=p."id" AND sm."shopId"=p."shopId" WHERE p."shopId"=$1 GROUP BY p."id",ib."quantity" HAVING ib."quantity"<>COALESCE(SUM(sm."quantityChange"),0)`,[shopId]);return result.rows}
