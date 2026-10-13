import { apiRequest } from './client';
import type { OwnerRequest, OwnerRequestInput, OwnerRequestStatus, OwnerRequestWithUser } from '../types/ownerRequest';

// A visitor asks to manage a building. All of these need a logged-in user.

export function sendOwnerRequest(input: OwnerRequestInput): Promise<OwnerRequest> {
  return apiRequest<OwnerRequest>('/api/owner-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// The newest request of this user, or null when he never sent one
export function getMyOwnerRequest(): Promise<OwnerRequest | null> {
  return apiRequest<OwnerRequest | null>('/api/owner-requests/mine');
}

// ---------- Only for the owners of the system (super) ----------

export function getOwnerRequests(): Promise<OwnerRequestWithUser[]> {
  return apiRequest<OwnerRequestWithUser[]>('/api/owner-requests');
}

export function setOwnerRequestStatus(requestId: number, status: OwnerRequestStatus): Promise<OwnerRequest> {
  return apiRequest<OwnerRequest>(`/api/owner-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
