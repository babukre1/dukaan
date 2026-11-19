const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__
  ? 'http://localhost:4000/api/v1'
  : 'https://dukaanapi.abubakr.so/api/v1')
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

export const mobileApi = {
  setAccessToken(token: string) { accessToken = token },
  login: (phoneNumber: string, password: string) => request<MobileSession>('/auth/login', { method: 'POST', body: JSON.stringify({ phoneNumber, password, clientType: 'MOBILE' }) }),
  refresh: (refreshToken: string) => request<MobileSession>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  logout: (refreshToken: string) => request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  me: () => request<CurrentUser>('/auth/me'),
  subscription: () => request<Subscription>('/shop/subscription'),
  changePassword: (currentPassword: string, newPassword: string) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
}
