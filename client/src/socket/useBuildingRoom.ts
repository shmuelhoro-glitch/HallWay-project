import { useEffect, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from './socket';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import type { AlertPayload } from '../types/alert';

// Connects to the building room: chat messages and red alerts arrive here
export function useBuildingRoom(buildingId: string): Socket {
  const token = useAuthStore((state) => state.token);
  const startAlert = useAlertStore((state) => state.startAlert);
  const endAlert = useAlertStore((state) => state.endAlert);

  // A new socket only when the token changes (login / logout)
  const socket = useMemo(() => createSocket(token), [token]);

  useEffect(() => {
    // On every connect (including reconnect) we join the room again
    function handleConnect() {
      socket.emit('chat:join', { buildingId });
    }

    function handleAlertStart(payload: AlertPayload) {
      startAlert(payload);
    }

    function handleAlertEnd() {
      endAlert();
    }

    socket.on('connect', handleConnect);
    socket.on('alert:start', handleAlertStart);
    socket.on('alert:end', handleAlertEnd);
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('alert:start', handleAlertStart);
      socket.off('alert:end', handleAlertEnd);
      socket.disconnect();
    };
  }, [socket, buildingId, startAlert, endAlert]);

  return socket;
}
