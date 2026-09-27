import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { branchesApi, Branch } from "../../api/branches";
import { staffApi, StaffMember } from "../../api/access";
import { Can } from "../../components/Can";
import { BusinessHoursEditor } from "../../components/BusinessHoursEditor";

const TIMEZONES = ["Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];
const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AED", "INR"];

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

const emptyForm = {
  name: "",
  code: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  country: "",
  postal_code: "",
  phone: "",
  email: "",
  manager_staff_id: "",
  timezone: "Asia/Karachi",
  currency: "PKR",
};

export function BranchesPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForms, setEditForms] = useState<Record<string, Partial<Branch>>>({});
  const [savingDetails, setSavingDetails] = useState<string | null>(null);
  const [savingHours, setSavingHours] = useState<string | null>(null);

  const load = async () => {
    const [b, s] = await Promise.all([branchesApi.list(), staffApi.list()]);
    setBranches(b);
    setStaff(s);
    const forms: Record<string, Partial<Branch>> = {};
    b.forEach((branch) => (forms[branch.id] = { ...branch }));
    setEditForms(forms);
  };

  useEffect(() => {
    load();
  }, []);

  const createBranch = async () => {
    if (!form.name || !form.code) return;
    setCreating(true);
    try {
      await branchesApi.create({
        ...form,
        manager_staff_id: form.manager_staff_id || undefined,
      } as any);
      setForm(emptyForm);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (branch: Branch) => {
    await branchesApi.setActive(branch.id, !branch.is_active);
    await load();
  };

  const makeDefault = async (branch: Branch) => {
    await branchesApi.setDefault(branch.id);
    await load();
  };

  const updateEditForm = (branchId: string, patch: Partial<Branch>) => {
    setEditForms((prev) => ({ ...prev, [branchId]: { ...prev[branchId], ...patch } }));
  };

  const saveDetails = async (branch: Branch) => {
    setSavingDetails(branch.id);
    try {
      const f = editForms[branch.id];
      await branchesApi.updateDetails(branch.id, {
        name: f.name,
        code: f.code,
        address_line1: f.address_line1,
        address_line2: f.address_line2,
        city: f.city,
        state: f.state,
        country: f.country,
        postal_code: f.postal_code,
        phone: f.phone,
        email: f.email,
        manager_staff_id: f.manager_staff_id || null,
      } as any);
      await load();
    } finally {
      setSavingDetails(null);
    }
  };

  const saveHours = async (branch: Branch) => {
    setSavingHours(branch.id);
    try {
      const f = editForms[branch.id];
      await branchesApi.updateHours(branch.id, {
        business_hours: f.business_hours ?? branch.business_hours,
        timezone: f.timezone ?? branch.timezone,
        currency: f.currency ?? branch.currency,
      });
      await load();
    } finally {
      setSavingHours(null);
    }
  };

  const managerName = (id: string | null) => staff.find((s) => s.id === id)?.full_name ?? "Unassigned";

  return (
    <Can permission="branches.page.view">
      <div className="p-6 max-w-4xl">
        <h1 className="text-lg font-medium text-ink mb-6">{t("branches.title")}</h1>

        <div className="space-y-3 mb-8">
          {branches.map((branch) => {
            const f = editForms[branch.id] ?? branch;
            return (
              <div key={branch.id} className="bg-surface border border-hairline rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === branch.id ? null : branch.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm text-ink">{branch.name}</span>
                    <span className="font-mono text-xs text-muted">{branch.code}</span>
                    {branch.is_default && (
                      <span className="text-xs bg-honey/20 text-honey px-2 py-0.5 rounded-full">Default</span>
                    )}
                    {!branch.is_active && (
                      <span className="text-xs bg-ink/10 text-muted px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                  <span className="text-xs text-muted">{branch.city ?? "—"} · {managerName(branch.manager_staff_id)}</span>
                </div>

                {expandedId === branch.id && (
                  <div className="border-t border-hairline px-4 py-4 space-y-6">
                    {/* Address, contact, manager */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-ink mb-2">Address and contact</h3>
                      <Can permission="branches.field.details.edit" fallbackDisabled>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <input placeholder="Address line 1" value={f.address_line1 ?? ""} onChange={(e) => updateEditForm(branch.id, { address_line1: e.target.value })} className={inputClass} />
                          <input placeholder="Address line 2" value={f.address_line2 ?? ""} onChange={(e) => updateEditForm(branch.id, { address_line2: e.target.value })} className={inputClass} />
                          <input placeholder="City" value={f.city ?? ""} onChange={(e) => updateEditForm(branch.id, { city: e.target.value })} className={inputClass} />
                          <input placeholder="State" value={f.state ?? ""} onChange={(e) => updateEditForm(branch.id, { state: e.target.value })} className={inputClass} />
                          <input placeholder="Country" value={f.country ?? ""} onChange={(e) => updateEditForm(branch.id, { country: e.target.value })} className={inputClass} />
                          <input placeholder="Postal code" value={f.postal_code ?? ""} onChange={(e) => updateEditForm(branch.id, { postal_code: e.target.value })} className={inputClass} />
                          <input placeholder="Phone" value={f.phone ?? ""} onChange={(e) => updateEditForm(branch.id, { phone: e.target.value })} className={inputClass} />
                          <input placeholder="Email" value={f.email ?? ""} onChange={(e) => updateEditForm(branch.id, { email: e.target.value })} className={inputClass} />
                          <select
                            value={f.manager_staff_id ?? ""}
                            onChange={(e) => updateEditForm(branch.id, { manager_staff_id: e.target.value || null })}
                            className={inputClass}
                          >
                            <option value="">No manager assigned</option>
                            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                          </select>
                        </div>
                      </Can>
                      <Can permission="branches.field.details.edit">
                        <button
                          onClick={() => saveDetails(branch)}
                          disabled={savingDetails === branch.id}
                          className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {savingDetails === branch.id ? "Saving…" : "Save address and contact"}
                        </button>
                      </Can>
                    </div>

                    {/* Hours, timezone, currency */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-ink mb-2">Hours, time zone, currency</h3>
                      <Can permission="branches.field.hours.edit" fallbackDisabled>
                        <div className="grid grid-cols-2 gap-2 mb-3 max-w-md">
                          <select value={f.timezone ?? branch.timezone} onChange={(e) => updateEditForm(branch.id, { timezone: e.target.value })} className={inputClass}>
                            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                          <select value={f.currency ?? branch.currency} onChange={(e) => updateEditForm(branch.id, { currency: e.target.value })} className={inputClass}>
                            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <BusinessHoursEditor
                          value={f.business_hours ?? branch.business_hours}
                          onChange={(business_hours) => updateEditForm(branch.id, { business_hours })}
                        />
                      </Can>
                      <Can permission="branches.field.hours.edit">
                        <button
                          onClick={() => saveHours(branch)}
                          disabled={savingHours === branch.id}
                          className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg mt-3 disabled:opacity-50"
                        >
                          {savingHours === branch.id ? "Saving…" : "Save hours and time zone"}
                        </button>
                      </Can>
                    </div>

                    {/* Status */}
                    <div>
                      <h3 className="text-[13px] font-semibold text-ink mb-2">Status</h3>
                      <div className="flex gap-2">
                        <Can permission="branches.field.status.edit">
                          <button
                            onClick={() => toggleActive(branch)}
                            className="border border-hairline text-sm px-3 py-1.5 rounded-lg text-ink/70"
                          >
                            {branch.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </Can>
                        <Can permission="branches.field.status.edit">
                          {!branch.is_default && (
                            <button
                              onClick={() => makeDefault(branch)}
                              className="border border-hairline text-sm px-3 py-1.5 rounded-lg text-ink/70"
                            >
                              Set as default
                            </button>
                          )}
                        </Can>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Can permission="branches.button.create">
          <div className="bg-surface p-4 rounded-lg border border-hairline">
            <h2 className="text-sm font-medium text-ink mb-3">Add branch</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <input placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              <input placeholder="Branch code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
              <input placeholder="Address line 1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} className={inputClass} />
              <input placeholder="Address line 2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} className={inputClass} />
              <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} />
              <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputClass} />
              <input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={inputClass} />
              <input placeholder="Postal code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={inputClass} />
              <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
              <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
              <select value={form.manager_staff_id} onChange={(e) => setForm({ ...form, manager_staff_id: e.target.value })} className={inputClass}>
                <option value="">No manager assigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={inputClass}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={createBranch}
              disabled={creating}
              className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create branch"}
            </button>
          </div>
        </Can>
      </div>
    </Can>
  );
}
