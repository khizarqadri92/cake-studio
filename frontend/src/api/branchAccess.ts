import { api } from "./client";

export type AccessLevel = "enable" | "disable" | "view_only";
export type BranchAccessMap = Record<string, Record<string, AccessLevel>>;

export const branchAccessApi = {
  get: (roleId: string, branchId: string) =>
    api
      .get<BranchAccessMap>("/access/branch-access", { params: { role_id: roleId, branch_id: branchId } })
      .then((r) => r.data),

  set: (roleId: string, branchId: string, entries: { section_key: string; field_key: string; access_level: AccessLevel }[]) =>
    api
      .put<BranchAccessMap>("/access/branch-access", { role_id: roleId, branch_id: branchId, entries })
      .then((r) => r.data),

  myAccess: (branchId: string) =>
    api.get<BranchAccessMap>(`/branches/${branchId}/my-access`).then((r) => r.data),
};
