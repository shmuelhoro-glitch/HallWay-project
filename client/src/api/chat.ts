import { apiRequest } from './client';
import type { ChatMessage } from '../types/chat';

// Sending a message is not here. It goes through Socket.IO (chat:send)
export function getMessages(buildingId: string, limit = 50): Promise<ChatMessage[]> {
  return apiRequest<ChatMessage[]>(`/api/buildings/${buildingId}/chat/messages?limit=${limit}`);
}
