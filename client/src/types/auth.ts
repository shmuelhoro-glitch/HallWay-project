export type UserRole = 'visitor' | 'admin' | 'super';

export interface UserBuilding {
  id: string;
  name: string;
  city: string;
}

export interface FavoritePlace {
  id: string;
  buildingId: string;
  name: string;
  category: string;
  floor: number;
}

export interface UserFavorites {
  buildings: string[]; // building ids
  places: FavoritePlace[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  buildings: UserBuilding[];
  favorites?: UserFavorites;
}

export interface LoginResponse {
  token: string;
  user: User;
}
