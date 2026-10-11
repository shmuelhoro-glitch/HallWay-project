export type UserRole = 'visitor' | 'admin' | 'super';

export interface UserBuilding {
  id: string;
  name: string;
  city: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  buildings: UserBuilding[];
}

export interface LoginResponse {
  token: string;
  user: User;
}
