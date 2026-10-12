import { apiRequest } from './client';
import type { LoginResponse } from '../types/auth';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// role: 'visitor' for a regular user, 'admin' for someone who manages a building
export function register(
  username: string,
  email: string,
  password: string,
  role: 'visitor' | 'admin',
): Promise<unknown> {
  return apiRequest<unknown>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, role }),
  });
}
