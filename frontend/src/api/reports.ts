import { api } from "./client";

export type ReportKey =
  | "orders" | "ingredients-used" | "purchases" | "profit" | "best-sellers"
  | "outstanding" | "stock" | "staff" | "customers";

/** Fetch one report. `outstanding` is a snapshot and ignores the period. */
export function fetchReport<T = any>(key: ReportKey, start: string, end: string, basis: "taken" | "completed" = "taken"): Promise<T> {
  const params = key === "outstanding" ? {} : key === "orders" || key === "profit" ? { start, end, basis } : { start, end };
  return api.get<T>(`/reports/${key}`, { params }).then((r) => r.data);
}
