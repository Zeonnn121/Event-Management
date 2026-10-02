import type { ApiError, ApiResponse } from './types';

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
  if (!skipAuth && authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  try {
    const response = await fetch(url, { ...fetchOptions, headers });

    if (response.status === 401 && !skipAuth) {
      onUnauthorized?.();
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
