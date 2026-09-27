import { create } from "zustand";

interface Staff {
  id: string;
  full_name: string;
  email: string;
  totp_enabled?: boolean;
  preferred_language?: string | null;
  theme_preference?: string | null;
  color_palette?: string | null;
  role_names?: string[];
}

interface AuthState {
  token: string | null;
  staff: Staff | null;
  permissions: Set<string>;
  setSession: (token: string, staff: Staff, permissions: string[]) => void;
  clearSession: () => void;
  hasPermission: (key: string) => boolean;
  setPreferredLanguage: (language: string | null) => void;
  setPreferredTheme: (theme: string | null) => void;
  setColorPalette: (palette: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  staff: null,
  permissions: new Set(),

  setSession: (token, staff, permissions) =>
    set({ token, staff, permissions: new Set(permissions) }),

  clearSession: () => set({ token: null, staff: null, permissions: new Set() }),

  // Central check used everywhere in the UI - pages, fields, buttons alike.
  hasPermission: (key: string) => get().permissions.has(key),

  setPreferredLanguage: (language) => {
    const staff = get().staff;
    if (staff) set({ staff: { ...staff, preferred_language: language } });
  },

  setPreferredTheme: (theme) => {
    const staff = get().staff;
    if (staff) set({ staff: { ...staff, theme_preference: theme } });
  },

  setColorPalette: (palette) => {
    const staff = get().staff;
    if (staff) set({ staff: { ...staff, color_palette: palette } });
  },
}));
