import { api } from "./client";
import { BusinessHours } from "./organization";

export interface Branch {
  id: string;
  name: string;
  code: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  manager_staff_id: string | null;
  business_hours: BusinessHours;
  timezone: string;
  currency: string;
  is_active: boolean;
  is_default: boolean;
}

export const branchesApi = {
  list: () => api.get<Branch[]>("/branches").then((r) => r.data),

  create: (payload: {
    name: string;
    code: string;
    address_line1?: string;
    city?: string;
    country?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    currency?: string;
  }) => api.post<Branch>("/branches", payload).then((r) => r.data),

  updateDetails: (id: string, payload: Partial<Branch>) =>
    api.put<Branch>(`/branches/${id}/details`, payload).then((r) => r.data),

  updateHours: (id: string, payload: { business_hours: BusinessHours; timezone: string; currency: string }) =>
    api.put<Branch>(`/branches/${id}/hours`, payload).then((r) => r.data),

  setActive: (id: string, is_active: boolean) =>
    api.put<Branch>(`/branches/${id}/status`, { is_active }).then((r) => r.data),

  setDefault: (id: string) => api.put<Branch>(`/branches/${id}/default`, {}).then((r) => r.data),
};
