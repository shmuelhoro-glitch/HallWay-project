import { useNavigate } from 'react-router-dom';
import { CloseIcon, StarIcon } from '../ui/Icons';
import './LoginPromptModal.css';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

function LoginPromptModal({ isOpen, onClose, title = 'רוצים לשמור למועדפים?' }: LoginPromptModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="login-prompt-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="prompt-title">
      <div className="login-prompt-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn icon-btn-plain login-prompt-close" onClick={onClose} aria-label="סגירה">
          <CloseIcon size={20} />
        </button>

        <div className="login-prompt-icon">
          <StarIcon size={32} filled />
        </div>

        <h2 id="prompt-title" className="login-prompt-title">{title}</h2>
        <p className="login-prompt-text">
          התחברו לחשבון שלכם כדי לשמור מבנים וחנויות, ולגשת אליהם בקלות מכל מקום ומכשיר.
        </p>

        <div className="login-prompt-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              navigate('/login');
            }}
          >
            התחברות למערכת
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              onClose();
              navigate('/register');
            }}
          >
            הרשמה לחשבון חדש
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPromptModal;
