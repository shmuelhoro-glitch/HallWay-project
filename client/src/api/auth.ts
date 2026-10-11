import { apiRequest } from './client';
import type { LoginResponse } from '../types/auth';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// role is not sent, so the server uses the default: visitor
export function register(username: string, email: string, password: string): Promise<unknown> {
  return apiRequest<unknown>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}
