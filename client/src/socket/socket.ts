import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../api/client';

// Guests connect without a token (read only). Logged-in users send their token.
// autoConnect: false - the hook decides when to connect and disconnect.
export function createSocket(token: string | null): Socket {
  return io(API_URL, {
    auth: token ? { token } : {},
    autoConnect: false,
  });
}
