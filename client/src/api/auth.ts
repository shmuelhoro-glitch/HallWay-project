import { apiRequest } from './client';
import type { LoginResponse, UserFavorites } from '../types/auth';

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Everyone signs up as a visitor. Building managers are added by the owners of the system.
export function register(username: string, email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
}

export function getFavorites(): Promise<{ favorites: UserFavorites }> {
  return apiRequest<{ favorites: UserFavorites }>('/api/auth/favorites');
}

export function updateFavorites(favorites: UserFavorites): Promise<{ success: boolean; favorites: UserFavorites }> {
  return apiRequest<{ success: boolean; favorites: UserFavorites }>('/api/auth/favorites', {
    method: 'PUT',
    body: JSON.stringify({ favorites }),
  });
}
