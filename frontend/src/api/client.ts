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

/** "date_of_joining" -> "Date of joining" */
const fieldLabel = (loc: unknown[]): string => {
  const name = String([...loc].reverse().find((p) => typeof p === "string" && p !== "body") ?? "");
  return name ? name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "";
};

/**
 * Screens show `err.response.data.detail` as text. When the server rejects a
 * field it sends a LIST OF OBJECTS there instead, and React can't draw an
 * object - the whole screen went blank. Turn any detail into readable text
 * here, once, for every screen.
 */
export function describeErrorDetail(detail: unknown): string | undefined {
  if (detail == null) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => {
      if (typeof d === "string") return d;
      if (d && typeof d === "object" && "msg" in d) {
        const label = Array.isArray((d as any).loc) ? fieldLabel((d as any).loc) : "";
        const msg = String((d as any).msg).replace(/^Value error, /, "");
        return label ? `${label}: ${msg}` : msg;
      }
      return JSON.stringify(d);
    });
    return parts.join("; ");
  }
  if (typeof detail === "object" && "msg" in (detail as any)) return String((detail as any).msg);
  return JSON.stringify(detail);
}

/**
 * Why a request failed, in words - including PDF downloads, whose error
 * replies arrive as a file (Blob) rather than text.
 */
export async function failureReason(err: any): Promise<string> {
  const data = err?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      try { return describeErrorDetail(JSON.parse(text).detail) ?? text; } catch { return text || `error ${err.response.status}`; }
    } catch { /* fall through */ }
  }
  if (data?.detail) return String(data.detail);
  if (err?.response?.status) return `the server replied with error ${err.response.status}`;
  return err?.message ?? "unknown error";
}

api.interceptors.response.use(undefined, (error) => {
  const data = error?.response?.data;
  if (data && typeof data === "object" && "detail" in data && typeof data.detail !== "string") {
    data.detail_raw = data.detail;
    data.detail = describeErrorDetail(data.detail);
  }
  return Promise.reject(error);
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
