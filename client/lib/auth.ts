import { API_BASE_URL } from "./constants";


export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface TenantData {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    tenant: TenantData;
    token: string;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}


async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errBody = json as { message?: string; errors?: Record<string, string[]> };
    throw new Error(errBody.message ?? `Request failed with status ${res.status}`);
  }
  return json as T;
}


export async function registerTenant(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function loginTenant(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<AuthResponse>(res);
}
