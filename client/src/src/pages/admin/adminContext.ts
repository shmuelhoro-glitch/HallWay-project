import { useOutletContext } from 'react-router-dom';
import type { BuildingDetails } from '../../types/building';

// AdminLayout loads the building once and gives it to the tab inside it (Floors, Places...)
// through <Outlet context={...} />. A tab reads it with useAdminBuilding().
export interface AdminContext {
  building: BuildingDetails;
  reloadBuilding: () => void; // after a floor was uploaded, to get the new floors list
}

export function useAdminBuilding(): AdminContext {
  return useOutletContext<AdminContext>();
}
