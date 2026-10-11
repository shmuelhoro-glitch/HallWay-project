import { create } from 'zustand';
import type { AlertPayload } from '../types/alert';

// none: no alert | active: alert:start arrived | ended: alert:end arrived
export type AlertStatus = 'none' | 'active' | 'ended';

interface AlertState {
  status: AlertStatus;
  alert: AlertPayload | null;
  receivedAt: number | null;
  isMinimized: boolean;
  startAlert: (alert: AlertPayload) => void;
  endAlert: () => void;
  minimize: () => void;
  restore: () => void;
  clearAlert: () => void;
}

export const useAlertStore = create<AlertState>()((set) => ({
  status: 'none',
  alert: null,
  receivedAt: null,
  isMinimized: false,

  startAlert: (alert) =>
    set({ status: 'active', alert, receivedAt: Date.now(), isMinimized: false }),

  // An end without a start (for example, we joined late) is ignored
  endAlert: () =>
    set((state) => (state.status === 'none' ? state : { status: 'ended', isMinimized: false })),

  minimize: () => set({ isMinimized: true }),
  restore: () => set({ isMinimized: false }),

  clearAlert: () => set({ status: 'none', alert: null, receivedAt: null, isMinimized: false }),
}));
