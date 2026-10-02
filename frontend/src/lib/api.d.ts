import type { ApiError, ApiResponse } from './types';
export declare class ApiErrorClass extends Error implements ApiError {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown);
}
export declare function setAuthToken(token: string | null): void;
export declare function setOnUnauthorized(callback: () => void): void;
export declare function apiFetch<T>(path: string, options?: RequestInit & {
    skipAuth?: boolean;
}): Promise<T>;
export declare function apiFetchEnvelope<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>>;
