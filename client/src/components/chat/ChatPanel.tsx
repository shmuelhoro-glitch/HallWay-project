import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { getMessages } from '../../api/chat';
import { useAuthStore } from '../../store/authStore';
import type { ChatErrorPayload, ChatMessage } from '../../types/chat';
import { CloseIcon, SendIcon } from '../ui/Icons';
import './ChatPanel.css';

interface ChatPanelProps {
  buildingId: string;
  buildingName: string;
  socket: Socket;
  onClose: () => void;
}

const MAX_MESSAGE_LENGTH = 500;

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatPanel({ buildingId, buildingName, socket, onClose }: ChatPanelProps) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 1. The last messages from the server (REST)
  useEffect(() => {
    getMessages(buildingId, 50)
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(sorted);
      })
      .catch(() => setError('Could not load messages.'));
  }, [buildingId]);

  // 2. New messages and errors in real time (Socket.IO)
  useEffect(() => {
    function handleMessage(message: ChatMessage) {
      setMessages((current) => [...current, message]);
    }

    function handleError(payload: ChatErrorPayload) {
      setError(payload.message);
    }

    socket.on('chat:message', handleMessage);
    socket.on('chat:error', handleError);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:error', handleError);
    };
  }, [socket]);

  // Scroll down to the newest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === '') return;

    socket.emit('chat:send', { buildingId, text: trimmed });
    setText('');
    setError(null);
  }

  function handleLogin() {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  }

  return (
    <div className="overlay" onClick={onClose}>
      {/* stopPropagation: a click inside the panel must not close it */}
      <div className="dialog chat-panel" role="dialog" aria-label="Building chat" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">Chat</h2>
            <p className="sheet-text">Everyone in {buildingName}</p>
          </div>
          <button type="button" className="icon-btn icon-btn-plain" aria-label="Close chat" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <p className="list-empty">No messages yet. Say hello!</p>}

          {messages.map((message) => {
            const isMine = user !== null && message.userId === user.id;
            return (
              <div key={message._id} className={isMine ? 'chat-message is-mine' : 'chat-message'}>
                <div className="chat-message-meta">
                  <span className="chat-message-name">{isMine ? 'You' : message.username}</span>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                {/* Plain text only. Never dangerouslySetInnerHTML */}
                <div className="chat-message-text">{message.text}</div>
              </div>
            );
          })}
        </div>

        {error && <p className="message-error">{error}</p>}

        {user ? (
          <form className="chat-form" onSubmit={handleSend}>
            <label className="sr-only" htmlFor="chat-input">
              Message
            </label>
            <input
              id="chat-input"
              className="chat-input"
              placeholder="Write a message"
              autoComplete="off"
              maxLength={MAX_MESSAGE_LENGTH}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" className="chat-send" aria-label="Send" disabled={text.trim() === ''}>
              <SendIcon />
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-dark chat-login" onClick={handleLogin}>
            Log in to write
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
