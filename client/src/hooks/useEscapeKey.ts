import { useEffect, useRef } from 'react';

// Esc closes the dialog that is open (chat, share, QR scanner), like the close button does
export function useEscapeKey(onEscape: () => void, isActive = true) {
  // Always call the newest onEscape, without setting the listener up again on every render
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!isActive) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onEscapeRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);
}
