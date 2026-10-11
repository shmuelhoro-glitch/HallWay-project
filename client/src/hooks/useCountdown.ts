import { useEffect, useState } from 'react';

// Seconds left from `seconds`, counted from the moment `startedAt`
export function useCountdown(startedAt: number | null, seconds: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  if (startedAt === null) {
    return 0;
  }

  const secondsPassed = Math.floor((now - startedAt) / 1000);
  return Math.max(seconds - secondsPassed, 0);
}
