import type { UserRole } from './auth';
import type { BuildingType } from './building';

// new - waiting for the owners of the system. handled - they answered it.
export type OwnerRequestStatus = 'new' | 'handled';

// What a visitor fills in to ask for a manager account
export interface OwnerRequestInput {
  full_name: string;
  phone: string; // empty = no phone
  building_name: string;
  building_type: BuildingType;
  city: string;
  message: string; // empty = no message
}

// A request as it is saved (a row of the owner_requests table)
export interface OwnerRequest {
  id: number;
  user_id: string;
  full_name: string;
  phone?: string | null;
  building_name: string;
  building_type: BuildingType;
  city: string;
  message?: string | null;
  status: OwnerRequestStatus;
  created_at: string;
}

// In the list of the owners: the request with the user who sent it (null if he was deleted)
export interface OwnerRequestWithUser extends OwnerRequest {
  user: { id: string; username: string; email: string; role: UserRole } | null;
}
