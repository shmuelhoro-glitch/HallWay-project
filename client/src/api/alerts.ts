import { apiRequest } from './client';
import type { AlertPayload } from '../types/alert';

export interface SimulateAlertRequest {
  buildingId: string;
  title?: string;
  countdown?: number;
}

// Only for the owners of the system (super): a drill reaches every visitor in the building
export function simulateAlert(request: SimulateAlertRequest) {
  return apiRequest<{ success: boolean; message: string }>('/api/alerts/simulate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

// The alert that is active in the building right now, with the seconds that are left
export function getActiveAlert(buildingId: string) {
  return apiRequest<{ active: boolean; alert: AlertPayload | null }>(`/api/alerts/active/${buildingId}`);
}

export function stopAlert(buildingId: string) {
  return apiRequest<{ success: boolean; message: string }>('/api/alerts/stop', {
    method: 'POST',
    body: JSON.stringify({ buildingId }),
  });
}
