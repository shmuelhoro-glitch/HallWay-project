import { apiRequest } from './client';

export interface SimulateAlertRequest {
  buildingId: string;
  title?: string;
  countdown?: number;
}

export function simulateAlert(request: SimulateAlertRequest) {
  return apiRequest<{ success: boolean; message: string }>('/api/alerts/simulate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function stopAlert(buildingId: string) {
  return apiRequest<{ success: boolean; message: string }>('/api/alerts/stop', {
    method: 'POST',
    body: JSON.stringify({ buildingId }),
  });
}
