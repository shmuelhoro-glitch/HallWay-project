import { apiRequest } from './client';
import type { ChatMessage } from '../types/chat';

// Sending a message is not here. It goes through Socket.IO (chat:send)
export function getMessages(buildingId: string, limit = 50): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/api/buildings/${buildingId}/chat/messages?limit=${limit}`);
}

// ---------- For the managers of the building ----------

// Everyone who has the chat open gets chat:deleted, and the message disappears for them too
export function deleteMessage(buildingId: string, messageId: string): Promise<void> {
  return apiRequest<void>(`/api/buildings/${buildingId}/chat/messages/${messageId}`, { method: 'DELETE' });
}

// The user can still read the chat of this building, but not write in it
export function banUser(buildingId: string, userId: string): Promise<unknown> {
  return apiRequest<unknown>(`/api/buildings/${buildingId}/chat/bans`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}
