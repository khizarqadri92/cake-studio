import { api } from "./client";

export interface BusinessHours {
  [day: string]: { open: string; close: string; closed: boolean };
}

export interface Organization {
  id: number;
  company_name: string;
  legal_name: string | null;
  registration_number: string | null;
  tax_number: string | null;
  business_type: string | null;
  industry: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  email_primary: string | null;
  email_secondary: string | null;
  website_url: string | null;
  business_hours: BusinessHours;
  timezone: string;
  default_language: string;
  default_currency: string;
  date_format: string;
  time_format: string;
  number_format: string;
}

export const organizationApi = {
  get: () => api.get<Organization>("/organization").then((r) => r.data),

  updateIdentity: (payload: Partial<Organization>) =>
    api.put<Organization>("/organization/identity", payload).then((r) => r.data),

  updateContact: (payload: Partial<Organization>) =>
    api.put<Organization>("/organization/contact", payload).then((r) => r.data),

  updateHours: (payload: { business_hours: BusinessHours; timezone: string }) =>
    api.put<Organization>("/organization/hours", payload).then((r) => r.data),

  updateLocale: (payload: Partial<Organization>) =>
    api.put<Organization>("/organization/locale", payload).then((r) => r.data),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<Organization>("/organization/logo", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  uploadFavicon: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<Organization>("/organization/favicon", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
