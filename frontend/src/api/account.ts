import { api } from "./client";

export const accountApi = {
  setLanguage: (language: string | null) =>
    api.put<{ preferred_language: string | null }>("/auth/me/language", { language }).then((r) => r.data),
  setTheme: (theme: string | null) =>
    api.put<{ theme_preference: string | null }>("/auth/me/theme", { theme }).then((r) => r.data),
  setPalette: (palette: string | null) =>
    api.put<{ color_palette: string | null }>("/auth/me/palette", { palette }).then((r) => r.data),
};
