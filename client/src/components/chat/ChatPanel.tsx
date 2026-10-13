import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { banUser, deleteMessage, getMessages } from '../../api/chat';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useAuthStore } from '../../store/authStore';
import type { ChatErrorPayload, ChatMessage } from '../../types/chat';
import { getErrorMessage, getMessageForCode } from '../../utils/errorMessage';
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
  return new Date(isoDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function ChatPanel({ buildingId, buildingName, socket, onClose }: ChatPanelProps) {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // A manager gets "delete" and "block" next to every message
  const isManager = user !== null && (user.role === 'admin' || user.role === 'super');

  useEscapeKey(onClose);

  // 1. The last messages from the server (REST)
  useEffect(() => {
    getMessages(buildingId, 50)
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(sorted);
      })
      .catch(() => setError('לא הצלחנו לטעון את ההודעות.'));
  }, [buildingId]);

  // 2. New messages and errors in real time (Socket.IO)
  useEffect(() => {
    function handleMessage(message: ChatMessage) {
      setMessages((current) => [...current, message]);
    }

    function handleError(payload: ChatErrorPayload) {
      // The server sends English. The user gets the Hebrew message of the code.
      setError(getMessageForCode(payload.code) ?? 'לא הצלחנו לשלוח את ההודעה. נסו שוב.');
    }

    // A manager deleted a message: it disappears here too
    function handleDeleted(payload: { messageId: string }) {
      setMessages((current) => current.filter((message) => message._id !== payload.messageId));
    }

    socket.on('chat:message', handleMessage);
    socket.on('chat:error', handleError);
    socket.on('chat:deleted', handleDeleted);

    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:error', handleError);
      socket.off('chat:deleted', handleDeleted);
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

  // ---------- For a manager of the building (the server checks that he really is one) ----------

  async function handleDelete(message: ChatMessage) {
    try {
      await deleteMessage(buildingId, message._id);
      setMessages((current) => current.filter((item) => item._id !== message._id));
      setError(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'לא הצלחנו למחוק את ההודעה. נסו שוב.'));
    }
  }

  async function handleBan(message: ChatMessage) {
    if (!window.confirm(`לחסום את ${message.username} מכתיבה בצ׳אט של המבנה? קריאה תישאר פתוחה.`)) return;

    try {
      await banUser(buildingId, message.userId);
      setError(null);
    } catch (banError) {
      setError(getErrorMessage(banError, 'לא הצלחנו לחסום את המשתמש. נסו שוב.'));
    }
  }

  function handleLogin() {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  }

  return (
    <div className="overlay" onClick={onClose}>
      {/* stopPropagation: a click inside the panel must not close it */}
      <div className="dialog chat-panel" role="dialog" aria-label="הצ׳אט של המבנה" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">צ׳אט</h2>
            <p className="sheet-text">שיחה פתוחה לכולם · {buildingName}</p>
          </div>
          <button type="button" className="icon-btn icon-btn-plain" aria-label="סגירת הצ׳אט" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="chat-messages" ref={listRef}>
          {messages.length === 0 && <p className="list-empty">עדיין אין הודעות. אפשר לפתוח בשלום!</p>}

          {messages.map((message) => {
            const isMine = user !== null && message.userId === user.id;
            return (
              <div key={message._id} className={isMine ? 'chat-message is-mine' : 'chat-message'}>
                <div className="chat-message-meta">
                  <span className="chat-message-name">{isMine ? 'אני' : message.username}</span>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                {/* Plain text only. Never dangerouslySetInnerHTML */}
                {/* dir="auto": a message in English is written left-to-right, one in Hebrew right-to-left */}
                <div className="chat-message-text" dir="auto">
                  {message.text}
                </div>

                {isManager && (
                  <div className="chat-message-actions">
                    <button type="button" className="text-btn" onClick={() => handleDelete(message)}>
                      מחיקה
                    </button>
                    {!isMine && (
                      <button type="button" className="text-btn" onClick={() => handleBan(message)}>
                        חסימת הכותב
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="message-error" role="alert">{error}</p>}

        {user ? (
          <form className="chat-form" onSubmit={handleSend}>
            <label className="sr-only" htmlFor="chat-input">
              הודעה
            </label>
            <input
              id="chat-input"
              className="chat-input"
              dir="auto"
              placeholder="כתיבת הודעה"
              autoComplete="off"
              maxLength={MAX_MESSAGE_LENGTH}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" className="chat-send" aria-label="שליחה" disabled={text.trim() === ''}>
              <SendIcon />
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-dark chat-login" onClick={handleLogin}>
            התחברו כדי לכתוב
          </button>
        )}
      </div>
    </div>
  );
}

export default ChatPanel;
