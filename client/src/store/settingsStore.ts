import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface SettingsState {
  theme: ThemeMode;
  accessibleDefault: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setAccessibleDefault: (enabled: boolean) => void;
  toggleAccessibleDefault: () => void;
}

function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      accessibleDefault: false,
      setTheme: (theme) => {
        applyThemeToDocument(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        applyThemeToDocument(next);
        set({ theme: next });
      },
      setAccessibleDefault: (enabled) => set({ accessibleDefault: enabled }),
      toggleAccessibleDefault: () => set((state) => ({ accessibleDefault: !state.accessibleDefault })),
    }),
    {
      name: 'inroute-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDocument(state.theme);
        }
      },
    },
  ),
);

// Apply saved theme immediately on startup
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('inroute-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.state?.theme) {
        applyThemeToDocument(parsed.state.theme);
      }
    }
  } catch {
    // Ignore storage parse error
  }
}
