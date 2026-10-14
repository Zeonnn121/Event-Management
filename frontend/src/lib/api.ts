import type { ApiError, ApiResponse } from './types';
import { useAuth } from '../stores/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export class ApiErrorClass extends Error implements ApiError {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options || {};
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(fetchOptions.headers || {});

  // Prefer the persisted session store over the module-level copy: after a full
  // page reload `authToken` is still null until App's effect runs, but the store
  // is already rehydrated from localStorage. Without this the first request
  // after a reload goes out unauthenticated and comes back 401.
  const token = useAuth.getState().token ?? authToken;
  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const sentToken = headers.has('Authorization');

  try {
    const response = await fetch(url, { ...fetchOptions, headers });

    if (response.status === 401 && !skipAuth) {
      // Only treat a 401 as an expired session if this request actually carried
      // a token; otherwise it is just an unauthenticated call, not a logout.
      if (sentToken) onUnauthorized?.();
      throw new ApiErrorClass(401, 'Unauthorized');
    }

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (response.ok) {
      data = null;
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorData = data as Record<string, unknown> | null;
      const message =
        (errorData?.error as Record<string, unknown>)?.message?.toString() ||
        data?.toString() ||
        `HTTP ${response.status}`;
      const details = (errorData?.error as Record<string, unknown>)?.details;
      throw new ApiErrorClass(response.status, message, details);
    }

    const envelope = data as ApiResponse<T> | null;
    return (envelope?.data ?? data) as T;
  } catch (err) {
    if (err instanceof ApiErrorClass) throw err;
    throw new ApiErrorClass(0, err instanceof Error ? err.message : 'Network error');
  }
}

export function apiFetchEnvelope<T>(path: string, options?: RequestInit) {
  return apiFetch<ApiResponse<T>>(path, options);
}
