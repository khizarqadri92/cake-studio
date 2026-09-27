import { api } from "./client";

export interface Customer {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  notes: string | null;
}

export const customersApi = {
  search: (q: string) => api.get<Customer[]>("/customers/search", { params: { q } }).then((r) => r.data),
  create: (payload: Omit<Customer, "id">) => api.post<Customer>("/customers", payload).then((r) => r.data),
  update: (id: string, payload: Omit<Customer, "id">) =>
    api.put<Customer>(`/customers/${id}`, payload).then((r) => r.data),
};
