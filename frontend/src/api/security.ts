import { api } from "./client";

export interface AccessPolicy {
  default_role_id: string | null;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_number: boolean;
  password_require_symbol: boolean;
  password_expiry_days: number;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  session_timeout_minutes: number;
  two_factor_required: boolean;
  ip_allowlist: string | null;
}

export interface LoginHistoryEntry {
  id: string;
  attempted_email: string;
  staff_id: string | null;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_staff_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export const accessPolicyApi = {
  get: () => api.get<AccessPolicy>("/access-policy").then((r) => r.data),
  update: (payload: AccessPolicy) => api.put<AccessPolicy>("/access-policy", payload).then((r) => r.data),
};

export const securityLogsApi = {
  loginHistory: (limit = 100) =>
    api.get<LoginHistoryEntry[]>("/login-history", { params: { limit } }).then((r) => r.data),
  auditTrail: (limit = 100) =>
    api.get<AuditLogEntry[]>("/audit-trail", { params: { limit } }).then((r) => r.data),
};

export const securityApi = {
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change-password", { current_password, new_password }).then((r) => r.data),
  setupTwoFactor: () =>
    api.post<{ secret: string; provisioning_uri: string }>("/auth/2fa/setup").then((r) => r.data),
  verifyTwoFactor: (code: string) => api.post("/auth/2fa/verify", { code }).then((r) => r.data),
  disableTwoFactor: () => api.post("/auth/2fa/disable").then((r) => r.data),
};
