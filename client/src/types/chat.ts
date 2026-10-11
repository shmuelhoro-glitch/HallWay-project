// Messages come from MongoDB, so the id field is _id
export interface ChatMessage {
  _id: string;
  buildingId: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

// Payload of the chat:error event (sent only to the sender)
export interface ChatErrorPayload {
  code: string;
  message: string;
}
