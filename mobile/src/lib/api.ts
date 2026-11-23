// A physical phone resolves `localhost` to the phone itself, not the computer
// running Metro. Use the deployed API by default in every environment. Local
// backend development can override this with EXPO_PUBLIC_API_URL in .env.local.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://dukaanapi.abubakr.so/api/v1'
let accessToken = ''

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...init.headers } })
  const payload = await response.json() as Envelope<T>
  if (!response.ok || !payload.success) throw new Error(payload.success ? 'Request failed' : payload.error.message)
  return payload.data
}

export type MobileSession = { accessToken: string; refreshToken: string; user: { id: string; fullName: string; phoneNumber: string; platformRole: string; mustChangePassword: boolean } }
export type CurrentUser = { id: string; fullName: string; phoneNumber: string; platformRole: string; mustChangePassword: boolean; shopId?: string; shopName?: string; shopPhoneNumber?: string; currencyCode?: string; accountStatus?: 'ACTIVE'|'SUSPENDED'|'INACTIVE' }
export type Subscription = { planName: string; planType: string; startsAt: string; expiresAt: string; effectiveStatus: 'PENDING'|'TRIAL'|'ACTIVE'|'EXPIRED'|'CANCELLED'; daysRemaining: number; access: 'FULL'|'READ_ONLY'|'RESTRICTED'|'BLOCKED' } | null
export type Pagination<T> = { items: T[]; pagination: { page:number;limit:number;total:number;pages:number } }
export type Customer = { id:string;fullName:string;phoneNumber?:string;address?:string;notes?:string;outstandingBalance:string;totalPaid?:string }
export type DebtEntry = { id:string;type:string;amount:string;description?:string;createdAt:string;isReversed?:boolean;method?:string;reference?:string }
export type DebtSummary = { totalOutstanding:string;totalCustomers:number;customersWithDebt:number;receivedToday:string;receivedInRange:string;recentTransactions:DebtEntry[] }
export type Product = { id:string;name:string;description?:string;categoryId?:string;categoryName?:string;unit:string;sellingPrice:string;costPrice?:string;minimumStock:string;quantity:string;version:number;stockStatus:'IN_STOCK'|'LOW_STOCK'|'OUT_OF_STOCK';isActive:boolean }
export type StockMovement = { id:string;type:string;quantityChange:string;quantityBefore:string;quantityAfter:string;reason?:string;note?:string;createdAt:string }
export type InventorySummary = { totalProducts:number;lowStock:number;outOfStock:number }
export type SaleItem = { id:string;productId:string;productNameSnapshot:string;unitSnapshot:string;quantity:string;unitPrice:string;lineSubtotal:string;returnedQuantity:string;returnedAmount:string }
export type SaleReturn = { id:string;returnNumber:number;totalAmount:string;debtReductionAmount:string;refundAmount:string;refundMethod?:string;reason?:string;createdAt:string;items:{saleItemId:string;quantity:string;lineRefundAmount:string;restock:boolean}[] }
export type Sale = { id:string;saleNumber:string;customerId?:string;customerName?:string;customerPhone?:string;shopName?:string;shopPhoneNumber?:string;currencyCode?:string;subtotal:string;discountAmount:string;totalAmount:string;paidAmount:string;initialUnpaidAmount:string;paymentStatus:'PAID'|'PARTIALLY_PAID'|'UNPAID';paymentMethod?:string;status:'COMPLETED'|'PARTIALLY_RETURNED'|'RETURNED'|'VOIDED';notes?:string;createdAt:string;items:SaleItem[];returns:SaleReturn[] }
export type SalesSummary = { totalSales:string;saleCount:number;paidSales:number;creditSales:number;partialSales:number;returnedSales:number;immediatePayments:string;refundTotal:string;creditSalesValue:string }
export const mutationKey=()=>`${Date.now()}-${Math.random().toString(36).slice(2)}`

export const mobileApi = {
  setAccessToken(token: string) { accessToken = token },
  login: (phoneNumber: string, password: string) => request<MobileSession>('/auth/login', { method: 'POST', body: JSON.stringify({ phoneNumber, password, clientType: 'MOBILE' }) }),
  refresh: (refreshToken: string) => request<MobileSession>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken: string) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => request<CurrentUser>('/auth/me'),
  subscription: () => request<Subscription>('/shop/subscription'),
  changePassword: (currentPassword: string, newPassword: string) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  customers: (query='') => request<Pagination<Customer>>(`/customers${query}`),
  customer: (id:string) => request<Customer>(`/customers/${id}`),
  createCustomer: (body:Record<string,unknown>) => request<Customer>('/customers',{method:'POST',body:JSON.stringify(body)}),
  updateCustomer: (id:string,body:Record<string,unknown>) => request<Customer>(`/customers/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  archiveCustomer: (id:string) => request(`/customers/${id}`,{method:'DELETE'}),
  debtEntries: (id:string,page=1) => request<Pagination<DebtEntry>>(`/customers/${id}/debts?page=${page}&limit=30`),
  statement: (id:string,page=1) => request<{customer:Customer;totalDebtAdded:string;totalRepayments:string;transactions:Pagination<DebtEntry>}>(`/customers/${id}/statement?page=${page}&limit=30`),
  addDebt: (id:string,body:Record<string,unknown>) => request(`/customers/${id}/debts`,{method:'POST',headers:{'Idempotency-Key':mutationKey()},body:JSON.stringify(body)}),
  receivePayment: (id:string,body:Record<string,unknown>) => request(`/customers/${id}/payments`,{method:'POST',headers:{'Idempotency-Key':mutationKey()},body:JSON.stringify(body)}),
  debtSummary: () => request<DebtSummary>('/debts/summary'),
  products: (query='') => request<Pagination<Product>>(`/products${query}`),
  product: (id:string) => request<Product>(`/products/${id}`),
  createProduct: (body:Record<string,unknown>) => request<Product>('/products',{method:'POST',body:JSON.stringify(body)}),
  updateProduct: (id:string,body:Record<string,unknown>) => request<Product>(`/products/${id}`,{method:'PATCH',body:JSON.stringify(body)}),
  archiveProduct: (id:string) => request(`/products/${id}`,{method:'DELETE'}),
  receiveStock: (id:string,body:Record<string,unknown>) => request(`/products/${id}/stock/receive`,{method:'POST',headers:{'Idempotency-Key':mutationKey()},body:JSON.stringify(body)}),
  adjustStock: (id:string,body:Record<string,unknown>) => request(`/products/${id}/stock/adjust`,{method:'POST',headers:{'Idempotency-Key':mutationKey()},body:JSON.stringify(body)}),
  stockMovements: (id:string,page=1) => request<Pagination<StockMovement>>(`/products/${id}/stock/movements?page=${page}&limit=30`),
  inventorySummary: () => request<InventorySummary>('/inventory/summary'),
  sales: (query='') => request<Pagination<Sale>>(`/sales${query}`),
  sale: (id:string) => request<Sale>(`/sales/${id}`),
  receipt: (id:string) => request<Sale>(`/sales/${id}/receipt`),
  createSale: (body:Record<string,unknown>,key:string) => request<Sale>('/sales',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)}),
  voidSale: (id:string,body:Record<string,unknown>,key:string) => request<Sale>(`/sales/${id}/void`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)}),
  returnSale: (id:string,body:Record<string,unknown>,key:string) => request<Sale>(`/sales/${id}/returns`,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)}),
  salesSummary: (query='') => request<SalesSummary>(`/sales/summary${query}`),
}
