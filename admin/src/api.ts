const API_URL = import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD
    ? "https://dukaanapi.abubakr.so/api/v1"
    : "http://localhost:4000/api/v1");
let accessToken = "";

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json()) as Envelope<T>;
  if (response.status === 401 && retry && path !== "/auth/refresh") {
    try {
      await api.refresh();
      return request<T>(path, init, false);
    } catch {
      accessToken = "";
    }
  }
  if (!response.ok || !payload.success)
    throw new Error(payload.success ? "Request failed" : payload.error.message);
  return payload.data;
}

export const api = {
  async login(phoneNumber: string, password: string) {
    const session = await request<Session>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ phoneNumber, password, clientType: "WEB" }),
      },
      false,
    );
    accessToken = session.accessToken;
    return session;
  },
  async refresh() {
    const session = await request<Session>(
      "/auth/refresh",
      { method: "POST", body: "{}" },
      false,
    );
    accessToken = session.accessToken;
    return session;
  },
  me: () => request<Record<string, unknown>>("/auth/me"),
  async logout() {
    try {
      await request("/auth/logout", { method: "POST", body: "{}" }, false);
    } finally {
      accessToken = "";
    }
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  dashboard: () => request<Record<string, number>>("/admin/dashboard"),
  shops: (search = "") =>
    request<{ items: ApiShop[]; pagination: { total: number } }>(
      `/admin/shops?limit=50&search=${encodeURIComponent(search)}`,
    ),
  shop: (id: string) => request<ApiShop>(`/admin/shops/${id}`),
  createShop: (body: Record<string, unknown>) =>
    request<ApiShop>("/admin/shops", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  setShopStatus: (id: string, status: string) =>
    request<ApiShop>(`/admin/shops/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  owners: () => request<{ items: ApiOwner[] }>("/admin/owners?limit=50"),
  plans: () => request<ApiPlan[]>("/admin/subscription-plans"),
  subscription: (shopId: string) =>
    request<ApiSubscription | null>(`/admin/shops/${shopId}/subscription`),
  subscriptionHistory: (shopId: string) =>
    request<{ items: ApiSubscriptionEvent[] }>(
      `/admin/shops/${shopId}/subscription/history?limit=20`,
    ),
  renew: (shopId: string, planId: string, note?: string) =>
    request(`/admin/shops/${shopId}/subscription/renew`, {
      method: "POST",
      body: JSON.stringify({
        planId,
        note,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
  activate: (shopId: string, planId: string, note?: string) =>
    request(`/admin/shops/${shopId}/subscription/activate`, {
      method: "POST",
      body: JSON.stringify({
        planId,
        note,
        idempotencyKey: crypto.randomUUID(),
      }),
    }),
};

export type Session = {
  accessToken: string;
  user: { fullName: string; platformRole: string; mustChangePassword: boolean };
};
export type ApiShop = {
  id: string;
  name: string;
  phoneNumber: string;
  accountStatus: string;
  ownerName: string;
  ownerPhoneNumber: string;
  subscriptionStatus: string | null;
  planName?: string;
  expiresAt?: string;
  createdAt: string;
};
export type ApiOwner = {
  id: string;
  fullName: string;
  phoneNumber: string;
  isActive: boolean;
  shopCount: number;
};
export type ApiPlan = {
  id: string;
  code: string;
  name: string;
  type: string;
  durationUnit: string;
  durationCount: number;
  price: string;
  currencyCode: string;
  isActive: boolean;
};
export type ApiSubscription = {
  id: string;
  planId: string;
  planName: string;
  effectiveStatus: string;
  startsAt: string;
  expiresAt: string;
  daysRemaining: number;
  access: string;
};
export type ApiSubscriptionEvent = {
  id: string;
  eventType: string;
  previousExpiresAt?: string;
  newExpiresAt?: string;
  performedByName: string;
  note?: string;
  createdAt: string;
};
