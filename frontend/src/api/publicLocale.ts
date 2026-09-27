import { api } from "./client";

export const publicApi = {
  getLocale: () => api.get<{ default_language: string }>("/public/locale").then((r) => r.data),
  getBranding: () =>
    api.get<{ company_name: string; logo_url: string | null }>("/public/branding").then((r) => r.data),
};
