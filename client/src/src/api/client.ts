import { useAuthStore } from '../store/authStore';

export const API_URL: string = import.meta.env.VITE_API_URL;

// The server sends errors as { error: { code, message } } (our errorHandler)
export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string[]>; // for VALIDATION_ERROR: which field failed and why

  constructor(status: number, code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
  };
}

// Every request to the server goes through here
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const body = data as ErrorBody | null;
    const code = body?.error?.code ?? 'UNKNOWN_ERROR';
    const message = body?.error?.message ?? 'Something went wrong';

    // The saved token expired (after 24 hours) - log out, so the user is asked to log in again
    if (code === 'INVALID_TOKEN') {
      useAuthStore.getState().logout();
    }
    throw new ApiError(response.status, code, message, body?.error?.fields);
  }

  return data as T;
}
