import type {
  MenuItem,
  NotificationRecord,
  RestaurantListingPayload,
  RestaurantSummary,
  SubmissionRecord,
  UserRecord,
} from "./types";

const API_BASE_URL =
  (typeof window !== "undefined" && window.localStorage.getItem("macrofinder_api_base")) ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:5003" : "/api");

type AuthEnvelope = {
  message?: string;
  user: UserRecord & {
    saved_keys?: string[];
    compare_keys?: string[];
    owned_restaurant_ids?: string[];
  };
};

type AdminUserRecord = UserRecord & {
  owned_restaurant_ids: string[];
};

export type SubmissionAssetKind =
  | "nutrition_pdf"
  | "restaurant_image"
  | "item_image"
  | "menu_sheet";

type UploadedAsset = {
  kind: SubmissionAssetKind;
  file_name: string;
  stored_name: string;
  relative_path: string;
  file_url: string;
  uploaded_at: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export function apiBaseUrl() {
  return API_BASE_URL;
}

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}) {
  const response = await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<AuthEnvelope>(response);
}

export async function login(input: { email: string; password: string }) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<AuthEnvelope>(response);
}

export async function logout() {
  const response = await apiFetch("/auth/logout", { method: "POST" });
  return readJson<{ message: string }>(response);
}

export async function fetchSession() {
  const response = await apiFetch("/auth/me");
  return readJson<AuthEnvelope>(response);
}

export async function fetchNotifications() {
  const response = await apiFetch("/auth/notifications");
  return readJson<{ notifications: NotificationRecord[] }>(response);
}

export async function updateProfile(input: { name?: string; email?: string }) {
  const response = await apiFetch("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return readJson<AuthEnvelope>(response);
}

export async function updatePassword(input: {
  current_password: string;
  new_password: string;
}) {
  const response = await apiFetch("/auth/password", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string }>(response);
}

export async function savePreferences(input: {
  saved_keys: string[];
  compare_keys: string[];
}) {
  const response = await apiFetch("/auth/preferences", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string }>(response);
}

export async function requestPasswordReset(input: { email: string }) {
  const response = await apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; reset_token?: string }>(response);
}

export async function resetPassword(input: { token: string; new_password: string }) {
  const response = await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string }>(response);
}

export async function fetchRestaurants() {
  const response = await fetch(`${API_BASE_URL}/restaurants`);
  return readJson<RestaurantSummary[]>(response);
}

export async function fetchItems(params?: {
  restaurantId?: string;
  query?: string;
  category?: string;
  pricedOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.restaurantId) search.set("restaurant_id", params.restaurantId);
  if (params?.query) search.set("q", params.query);
  if (params?.category) search.set("category", params.category);
  if (params?.pricedOnly) search.set("priced_only", "true");
  if (params?.limit) search.set("limit", String(params.limit));
  else search.set("limit", "5000");
  if (typeof params?.offset === "number") search.set("offset", String(params.offset));

  const response = await fetch(`${API_BASE_URL}/items?${search.toString()}`);
  return readJson<{
    items: MenuItem[];
    total: number;
    limit: number;
    offset: number;
  }>(response);
}

export async function fetchItemByKey(uniqueKey: string) {
  const response = await fetch(
    `${API_BASE_URL}/items/by-key/${encodeURIComponent(uniqueKey)}`,
  );
  return readJson<MenuItem>(response);
}

export async function createRestaurant(input: {
  restaurant_id: string;
  restaurant_name: string;
  description?: string;
}) {
  const response = await apiFetch("/admin/restaurants", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; restaurant: RestaurantSummary }>(response);
}

export async function createItem(input: Partial<MenuItem>) {
  const response = await apiFetch("/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string }>(response);
}

export async function requestRestaurantAccess(input: {
  restaurant_id: string;
  note?: string;
}) {
  const response = await apiFetch("/owner/restaurant-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; submission: SubmissionRecord }>(response);
}

export async function uploadSubmissionAsset(file: File, kind: SubmissionAssetKind) {
  const formData = new FormData();
  formData.append("kind", kind);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/uploads`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return readJson<{ message: string; asset: UploadedAsset }>(response);
}

export async function createRestaurantSubmission(
  input: RestaurantListingPayload & { note?: string },
) {
  const response = await apiFetch("/owner/restaurant-submissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; submission: SubmissionRecord }>(response);
}

export async function createItemSubmission(input: Partial<MenuItem> & { note?: string }) {
  const response = await apiFetch("/owner/item-submissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; submission: SubmissionRecord }>(response);
}

export async function fetchOwnerSubmissions() {
  const response = await apiFetch("/owner/submissions");
  return readJson<{ submissions: SubmissionRecord[] }>(response);
}

export async function fetchAdminUsers() {
  const response = await apiFetch("/admin/users");
  return readJson<{ users: AdminUserRecord[] }>(response);
}

export async function fetchAdminSubmissions(status = "") {
  const search = new URLSearchParams();
  if (status) search.set("status", status);
  const response = await apiFetch(`/admin/submissions?${search.toString()}`);
  return readJson<{ submissions: SubmissionRecord[] }>(response);
}

export async function updateUserRole(
  email: string,
  input: {
    role: "user" | "restaurant_owner" | "admin";
    owned_restaurant_ids: string[];
  },
) {
  const response = await apiFetch(`/admin/users/${encodeURIComponent(email)}/role`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; user: AdminUserRecord }>(response);
}

export async function reviewSubmission(
  submissionId: string,
  input: { decision: "approved" | "rejected"; admin_note?: string },
) {
  const response = await apiFetch(`/admin/submissions/${submissionId}/review`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson<{ message: string; submission: SubmissionRecord }>(response);
}
