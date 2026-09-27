import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2, Plus, Check } from "lucide-react";
import { accessApi, Role, PermissionDef } from "../../api/access";
import { Can } from "../../components/Can";
import { BranchAccessTree } from "../../components/BranchAccessTree";

const PAGE_LABELS: Record<string, string> = {
  system: "System setup",
  organization: "Organization",
  branches: "Branches",
  permissions: "Roles and permissions",
  staff: "Staff",
  access_policy: "Access policy",
  login_history: "Login history",
  audit_trail: "Audit trail",
};

function pageKeyOf(permissionKey: string) {
  return permissionKey.split(".")[0];
}

function pageLabelOf(pageKey: string) {
  return PAGE_LABELS[pageKey] ?? pageKey.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function RolesPermissionsPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [pendingByRole, setPendingByRole] = useState<Record<string, Set<string>>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedPageKey, setSelectedPageKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = async (keepSelection = true) => {
    const [r, p] = await Promise.all([accessApi.listRoles(), accessApi.listPermissions()]);
    setRoles(r);
    setPermissions(p);
    const initial: Record<string, Set<string>> = {};
    r.forEach((role) => (initial[role.id] = new Set(role.permission_keys)));
    setPendingByRole(initial);

    if (!keepSelection || !r.find((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(r[0]?.id ?? "");
    }
    if (!selectedPageKey && p.length) {
      setSelectedPageKey(pageKeyOf(p[0].key));
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const pageOrder: string[] = [];
  const grouped: Record<string, PermissionDef[]> = {};
  permissions.forEach((perm) => {
    const key = pageKeyOf(perm.key);
    if (!grouped[key]) {
      grouped[key] = [];
      pageOrder.push(key);
    }
    grouped[key].push(perm);
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const rolePending = pendingByRole[selectedRoleId] ?? new Set<string>();
  const checkedCountFor = (pageKey: string) =>
    grouped[pageKey]?.filter((p) => rolePending.has(p.key)).length ?? 0;

  const togglePermission = (key: string) => {
    setPendingByRole((prev) => {
      const next = new Set(prev[selectedRoleId]);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, [selectedRoleId]: next };
    });
    setSaved(false);
  };

  const hasUnsavedChanges = () => {
    if (!selectedRole) return false;
    const original = new Set(selectedRole.permission_keys);
    const current = rolePending;
    if (original.size !== current.size) return true;
    for (const key of current) if (!original.has(key)) return true;
    return false;
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await accessApi.setRolePermissions(selectedRoleId, Array.from(rolePending));
      await load();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const startRename = () => {
    if (!selectedRole) return;
    setRenameValue(selectedRole.name);
    setRenaming(true);
  };

  const saveRename = async () => {
    if (selectedRole && renameValue.trim() && renameValue.trim() !== selectedRole.name) {
      await accessApi.updateRole(selectedRole.id, renameValue.trim(), selectedRole.description ?? undefined);
      await load();
    }
    setRenaming(false);
  };

  const removeRole = async () => {
    if (!selectedRole) return;
    setDeleteError(null);
    if (!confirm(`Delete the "${selectedRole.name}" role? This can't be undone.`)) return;
    try {
      await accessApi.deleteRole(selectedRole.id);
      await load(false);
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail ?? `Couldn't delete "${selectedRole.name}".`);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    await accessApi.createRole(newRoleName.trim());
    setNewRoleName("");
    setAddingRole(false);
    await load(false);
  };

  return (
    <Can permission="permissions.page.view">
      <div className="p-6 max-w-4xl">
        <h1 className="text-lg font-medium mb-6">{t("roles.title")}</h1>

        {/* Role selector */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs text-muted mr-1">Editing role</span>

          {renaming ? (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => e.key === "Enter" && saveRename()}
              className="border border-hairline rounded-lg px-3 py-1.5 text-sm"
            />
          ) : (
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="border border-hairline rounded-lg px-3 py-1.5 text-sm bg-surface min-w-[180px]"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          <Can permission="permissions.role.edit">
            <button onClick={startRename} title="Rename role" className="text-muted hover:text-plum p-1.5">
              <Pencil size={15} />
            </button>
          </Can>
          <Can permission="permissions.role.delete">
            <button onClick={removeRole} title="Delete role" className="text-muted hover:text-plum p-1.5">
              <Trash2 size={15} />
            </button>
          </Can>

          <div className="flex-1" />

          <Can permission="permissions.role.create">
            {addingRole ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createRole()}
                  placeholder="Role name"
                  className="border border-hairline rounded-lg px-3 py-1.5 text-sm"
                />
                <button onClick={createRole} className="bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingRole(true)}
                className="flex items-center gap-1 text-sm text-plum border border-plum/30 rounded-lg px-3 py-1.5 hover:bg-plum/5"
              >
                <Plus size={14} /> New role
              </button>
            )}
          </Can>
        </div>

        {deleteError && (
          <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2 mb-4">
            {deleteError}
          </p>
        )}

        {/* Master-detail: pages on the left, permissions on the right */}
        <div className="flex border border-hairline rounded-lg overflow-hidden bg-surface" style={{ minHeight: 420 }}>
          <div className="w-56 border-r border-hairline bg-flour/50 shrink-0">
            {pageOrder.map((pageKey) => {
              const total = grouped[pageKey].length;
              const checked = checkedCountFor(pageKey);
              const isSelected = pageKey === selectedPageKey;
              return (
                <button
                  key={pageKey}
                  onClick={() => setSelectedPageKey(pageKey)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between border-l-2 transition-colors ${
                    isSelected
                      ? "bg-surface border-plum text-ink font-medium"
                      : "border-transparent text-muted hover:bg-surface/60"
                  }`}
                >
                  <span>{pageLabelOf(pageKey)}</span>
                  <span className={`text-xs font-mono ${checked > 0 ? "text-plum" : "text-ink/30"}`}>
                    {checked}/{total}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 p-5">
            {selectedPageKey && grouped[selectedPageKey] ? (
              <>
                <h2 className="text-sm font-medium text-ink mb-4">{pageLabelOf(selectedPageKey)}</h2>
                <div className="space-y-3">
                  {grouped[selectedPageKey].map((perm) => (
                    <label key={perm.id} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rolePending.has(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm text-ink">{perm.description ?? perm.key}</p>
                        <p className="text-xs text-ink/35 font-mono">{perm.key}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedPageKey === "branches" && selectedRoleId && (
                  <BranchAccessTree roleId={selectedRoleId} />
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Select a page on the left to view its permissions.</p>
            )}
          </div>
        </div>

        <Can permission="permissions.role.assign_permission">
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={save}
              disabled={saving || !hasUnsavedChanges()}
              className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-40"
            >
              {saving ? "Saving..." : `Save ${selectedRole?.name ?? ""}`}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm text-sage">
                <Check size={15} /> Saved
              </span>
            )}
            {!saved && hasUnsavedChanges() && (
              <span className="text-xs text-honey">Unsaved changes</span>
            )}
          </div>
        </Can>
      </div>
    </Can>
  );
}
