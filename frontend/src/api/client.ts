import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { applyLanguage } from "../i18n";
import { applyTheme, applyPalette } from "../theme";

// Development: the Vite dev server (5173) talks to uvicorn on 8000.
// Production build: the backend serves this app itself, so the API is on the
// same address the page was opened from - which is what lets tablets and
// phones on the shop Wi-Fi use it (for them "localhost" would be themselves).
const API_BASE: string = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000/api/v1" : "/api/v1");

export const api = axios.create({
  baseURL: API_BASE,
});

// The backend returns uploaded file paths (logo, favicon, etc.) as
// relative paths like "/static/uploads/logos/xxx.png" - relative to the
// backend's own origin, not the frontend's. Since they're served on
// different ports/domains in dev (and often in production too), a plain
// relative path resolves against the wrong origin and 404s. This strips
// "/api/v1" off the API base URL to get the backend's origin, then joins
// it with whatever relative path the API returned.
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(email: string, password: string, totpCode?: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  if (totpCode) form.append("totp_code", totpCode);

  const { data } = await axios.post(
    `${api.defaults.baseURL}/auth/login`,
    form,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  useAuthStore.getState().setSession(data.access_token, data.staff, data.permissions);

  // This staff member's own choices override the organization/system
  // defaults, but only for them.
  if (data.staff.preferred_language) {
    applyLanguage(data.staff.preferred_language);
  }
  applyTheme(data.staff.theme_preference ?? "system");
  applyPalette(data.staff.color_palette);

  return data;
}
