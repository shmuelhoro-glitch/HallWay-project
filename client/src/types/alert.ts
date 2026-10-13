// Payload of the alert:start event
export interface AlertPayload {
  title: string; // threat type, for example "Rockets and missiles"
  category: string;
  countdown: number; // seconds to reach a protected space in this area
  isSimulation?: boolean; // a drill that we started, not an alert of the Home Front Command
}
