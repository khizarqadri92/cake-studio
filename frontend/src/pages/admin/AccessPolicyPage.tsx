import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { accessPolicyApi, AccessPolicy } from "../../api/security";
import { accessApi, Role } from "../../api/access";
import { Can } from "../../components/Can";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

export function AccessPolicyPage() {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<AccessPolicy | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([accessPolicyApi.get(), accessApi.listRoles()]).then(([p, r]) => {
      setPolicy(p);
      setRoles(r);
    });
  }, []);

  if (!policy) return <div className="p-6 text-sm text-muted">Loading…</div>;

  const set = (patch: Partial<AccessPolicy>) => setPolicy({ ...policy, ...patch });

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await accessPolicyApi.update(policy);
      setPolicy(updated);
      setMessage("Saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Can permission="access_policy.page.view">
      <div className="p-6 max-w-2xl space-y-10">
        <h1 className="text-lg font-medium text-ink">{t("accessPolicy.title")}</h1>

        <Can permission="access_policy.field.edit" fallbackDisabled>
          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Default role for new staff</h2>
            <select
              className={`${inputClass} max-w-xs`}
              value={policy.default_role_id ?? ""}
              onChange={(e) => set({ default_role_id: e.target.value || null })}
            >
              <option value="">None — must be chosen manually</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Password policy</h2>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <label className="text-xs text-ink/70">
                Minimum length
                <input type="number" min={4} className={`${inputClass} mt-1`} value={policy.password_min_length} onChange={(e) => set({ password_min_length: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-ink/70">
                Password expiry (days, 0 = never)
                <input type="number" min={0} className={`${inputClass} mt-1`} value={policy.password_expiry_days} onChange={(e) => set({ password_expiry_days: Number(e.target.value) })} />
              </label>
            </div>
            <div className="flex gap-4 mt-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={policy.password_require_uppercase} onChange={(e) => set({ password_require_uppercase: e.target.checked })} />
                Require uppercase letter
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={policy.password_require_number} onChange={(e) => set({ password_require_number: e.target.checked })} />
                Require number
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={policy.password_require_symbol} onChange={(e) => set({ password_require_symbol: e.target.checked })} />
                Require symbol
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Login attempts and lockout</h2>
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <label className="text-xs text-ink/70">
                Max failed attempts before lockout
                <input type="number" min={1} className={`${inputClass} mt-1`} value={policy.max_login_attempts} onChange={(e) => set({ max_login_attempts: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-ink/70">
                Lockout duration (minutes)
                <input type="number" min={1} className={`${inputClass} mt-1`} value={policy.lockout_duration_minutes} onChange={(e) => set({ lockout_duration_minutes: Number(e.target.value) })} />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Session</h2>
            <label className="text-xs text-ink/70 block max-w-xs">
              Session timeout (minutes)
              <input type="number" min={5} className={`${inputClass} mt-1`} value={policy.session_timeout_minutes} onChange={(e) => set({ session_timeout_minutes: Number(e.target.value) })} />
            </label>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">Two-factor authentication</h2>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={policy.two_factor_required} onChange={(e) => set({ two_factor_required: e.target.checked })} />
              Prompt all staff to enable two-factor authentication
            </label>
          </section>

          <section>
            <h2 className="text-sm font-medium text-ink mb-3">IP restrictions</h2>
            <p className="text-xs text-muted mb-2">Comma-separated IP addresses or CIDR ranges. Leave blank to allow access from anywhere.</p>
            <input
              className={inputClass}
              placeholder="e.g. 203.0.113.4, 192.168.1.0/24"
              value={policy.ip_allowlist ?? ""}
              onChange={(e) => set({ ip_allowlist: e.target.value })}
            />
          </section>
        </Can>

        <Can permission="access_policy.field.edit">
          <div>
            {message && <p className="text-sm text-sage mb-2">{message}</p>}
            <button onClick={save} disabled={saving} className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? "Saving…" : "Save access policy"}
            </button>
          </div>
        </Can>
      </div>
    </Can>
  );
}
