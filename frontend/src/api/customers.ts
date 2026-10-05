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

export interface CustomerListItem extends Customer {
  created_at: string;
  orders: number;          // confirmed onward (drafts and cancelled aren't sales)
  total_spent: number;
  last_order: string | null;
}

export interface CustomerDetail extends CustomerListItem {
  order_history: { id: string; order_number: string; date: string | null; due: string; status: string; total: number; balance: number }[];
}

export const customersApi = {
  list: (q = "") => api.get<CustomerListItem[]>("/customers", { params: { q } }).then((r) => r.data),
  get: (id: string) => api.get<CustomerDetail>(`/customers/${id}`).then((r) => r.data),
  search: (q: string) => api.get<Customer[]>("/customers/search", { params: { q } }).then((r) => r.data),
  create: (payload: Omit<Customer, "id">) => api.post<Customer>("/customers", payload).then((r) => r.data),
  update: (id: string, payload: Omit<Customer, "id">) =>
    api.put<Customer>(`/customers/${id}`, payload).then((r) => r.data),
};
