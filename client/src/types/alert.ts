// Payload of the alert:start event
export interface AlertPayload {
  title: string; // threat type, for example "Rockets and missiles"
  category: string;
  countdown: number; // seconds to reach a protected space in this area
}
