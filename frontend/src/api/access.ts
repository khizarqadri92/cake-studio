import { api } from "./client";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permission_keys: string[];
}

export interface PermissionDef {
  id: string;
  key: string;
  description: string | null;
}

export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  role_names: string[];
  employee_code: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  gender: string | null;
  national_id: string | null;
  employment_type: string | null;
  basic_salary: number | null;
  address_line1: string | null;
  city: string | null;
  country: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  branch_id: string | null;
  branch_name: string | null;
}

export interface StaffCreatePayload {
  full_name: string;
  email: string;
  password: string;
  role_ids: string[];
  phone?: string;
  job_title?: string;
  department?: string;
  date_of_joining?: string;
  date_of_birth?: string;
  gender?: string;
  national_id?: string;
  employment_type?: string;
  basic_salary?: number;
  address_line1?: string;
  city?: string;
  country?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  branch_id?: string;
}

export const accessApi = {
  listRoles: () => api.get<Role[]>("/access/roles").then((r) => r.data),
  createRole: (name: string, description?: string) =>
    api.post<Role>("/access/roles", { name, description }).then((r) => r.data),
  updateRole: (roleId: string, name: string, description?: string) =>
    api.put<Role>(`/access/roles/${roleId}`, { name, description }).then((r) => r.data),
  deleteRole: (roleId: string) => api.delete(`/access/roles/${roleId}`).then((r) => r.data),
  setRolePermissions: (roleId: string, permission_keys: string[]) =>
    api.put<Role>(`/access/roles/${roleId}/permissions`, { permission_keys }).then((r) => r.data),
  listPermissions: () => api.get<PermissionDef[]>("/access/permissions").then((r) => r.data),
};

export const staffApi = {
  list: () => api.get<StaffMember[]>("/staff").then((r) => r.data),
  create: (payload: StaffCreatePayload) =>
    api.post<StaffMember>("/staff", payload).then((r) => r.data),
  updateProfile: (staffId: string, payload: Omit<StaffCreatePayload, "email" | "password" | "role_ids">) =>
    api.put<StaffMember>(`/staff/${staffId}/profile`, payload).then((r) => r.data),
  setRoles: (staffId: string, role_ids: string[]) =>
    api.put<StaffMember>(`/staff/${staffId}/roles`, { role_ids }).then((r) => r.data),
  setStatus: (staffId: string, is_active: boolean) =>
    api.put<StaffMember>(`/staff/${staffId}/status`, { is_active }).then((r) => r.data),
};
