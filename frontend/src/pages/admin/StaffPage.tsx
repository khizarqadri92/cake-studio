import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { accessApi, Role, staffApi, StaffMember, StaffCreatePayload } from "../../api/access";
import { branchesApi, Branch } from "../../api/branches";
import { Can } from "../../components/Can";
import { notify } from "../../store/toastStore";
import { Modal } from "../../components/Modal";
import { useAuthStore } from "../../store/authStore";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

type ProfileFields = Omit<StaffCreatePayload, "email" | "password" | "role_ids">;

const emptyForm: StaffCreatePayload = {
  full_name: "",
  email: "",
  password: "",
  role_ids: [],
  phone: "",
  job_title: "",
  department: "",
  date_of_joining: "",
  date_of_birth: "",
  gender: "",
  national_id: "",
  employment_type: "",
  basic_salary: undefined,
  address_line1: "",
  city: "",
  country: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  branch_id: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // Wrapping the box in its <label> ties them together: screen readers read the
  // label, and clicking it puts the cursor in the box.
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink/70 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Shared between the "Add staff" modal and the "Edit staff" modal.
function ProfileFieldsForm({
  form,
  set,
  branches,
}: {
  form: ProfileFields;
  set: (patch: Partial<ProfileFields>) => void;
  branches: Branch[];
}) {
  return (
    <>
      <div>
        <h3 className="text-[13px] font-semibold text-ink mb-2">Personal details</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone number">
            <input className={inputClass} value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Date of birth">
            <input className={inputClass} type="date" value={form.date_of_birth ?? ""} onChange={(e) => set({ date_of_birth: e.target.value })} />
          </Field>
          <Field label="Gender">
            <select className={inputClass} value={form.gender ?? ""} onChange={(e) => set({ gender: e.target.value })}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="National ID / CNIC">
            <input className={inputClass} value={form.national_id ?? ""} onChange={(e) => set({ national_id: e.target.value })} />
          </Field>
          <Field label="Address line 1">
            <input className={inputClass} value={form.address_line1 ?? ""} onChange={(e) => set({ address_line1: e.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country ?? ""} onChange={(e) => set({ country: e.target.value })} />
          </Field>
          <Field label="Emergency contact name">
            <input className={inputClass} value={form.emergency_contact_name ?? ""} onChange={(e) => set({ emergency_contact_name: e.target.value })} />
          </Field>
          <Field label="Emergency contact phone">
            <input className={inputClass} value={form.emergency_contact_phone ?? ""} onChange={(e) => set({ emergency_contact_phone: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <h3 className="text-[13px] font-semibold text-ink mb-2">Employment</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Job title">
            <input className={inputClass} value={form.job_title ?? ""} onChange={(e) => set({ job_title: e.target.value })} />
          </Field>
          <Field label="Department">
            <input className={inputClass} value={form.department ?? ""} onChange={(e) => set({ department: e.target.value })} />
          </Field>
          <Field label="Employment type">
            <select className={inputClass} value={form.employment_type ?? ""} onChange={(e) => set({ employment_type: e.target.value })}>
              <option value="">—</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
            </select>
          </Field>
          <Field label="Date of joining">
            <input className={inputClass} type="date" value={form.date_of_joining ?? ""} onChange={(e) => set({ date_of_joining: e.target.value })} />
          </Field>
          <Field label="Basic salary">
            <input className={inputClass} type="number" value={form.basic_salary ?? ""} onChange={(e) => set({ basic_salary: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Branch">
            <select className={inputClass} value={form.branch_id ?? ""} onChange={(e) => set({ branch_id: e.target.value })}>
              <option value="">All branches (not restricted)</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-muted mt-1">
          Assigning a branch restricts this staff member to that branch only, overriding what their role would otherwise allow elsewhere.
        </p>
      </div>
    </>
  );
}

function RoleDropdown({
  roles,
  value,
  onChange,
}: {
  roles: Role[];
  value: string;
  onChange: (roleId: string) => void;
}) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink mb-2">Role</h3>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select a role —</option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>{role.name}</option>
        ))}
      </select>
    </div>
  );
}

export function StaffPage() {
  const { t } = useTranslation();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<StaffCreatePayload>(emptyForm);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState<ProfileFields>(emptyForm);
  const [editRoleId, setEditRoleId] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = async () => {
    const [s, r, b] = await Promise.all([staffApi.list(), accessApi.listRoles(), branchesApi.list()]);
    setStaff(s);
    setRoles(r);
    setBranches(b);
  };

  useEffect(() => {
    load();
  }, []);

  const set = (patch: Partial<StaffCreatePayload>) => setForm({ ...form, ...patch });

  const openAdd = () => {
    setForm(emptyForm);
    setSelectedRoleId("");
    setError(null);
    setAddOpen(true);
  };

  const createStaff = async () => {
    if (!form.full_name || !form.email || !form.password) return;
    setCreating(true);
    setError(null);
    try {
      // Leave out fields that weren't filled in (an empty date isn't a date).
      const filled = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined));
      const payload = {
        ...filled,
        role_ids: selectedRoleId ? [selectedRoleId] : [],
        branch_id: form.branch_id || undefined,
        basic_salary: form.basic_salary || undefined,
      } as StaffCreatePayload;
      await staffApi.create(payload);
      setAddOpen(false);
      notify(`Staff account created for ${form.full_name}. They can sign in with ${form.email}.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Couldn't create staff account.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    await staffApi.setStatus(member.id, !member.is_active);
    await load();
  };

  const openEdit = (s: StaffMember) => {
    setEditError(null);
    setEditingStaff(s);
    setEditForm({
      full_name: s.full_name,
      phone: s.phone ?? "",
      job_title: s.job_title ?? "",
      department: s.department ?? "",
      date_of_joining: s.date_of_joining ?? "",
      date_of_birth: s.date_of_birth ?? "",
      gender: s.gender ?? "",
      national_id: s.national_id ?? "",
      employment_type: s.employment_type ?? "",
      basic_salary: s.basic_salary ?? undefined,
      address_line1: s.address_line1 ?? "",
      city: s.city ?? "",
      country: s.country ?? "",
      emergency_contact_name: s.emergency_contact_name ?? "",
      emergency_contact_phone: s.emergency_contact_phone ?? "",
      branch_id: s.branch_id ?? "",
    });
    setEditRoleId(roles.find((r) => s.role_names.includes(r.name))?.id ?? "");
  };

  const saveEdit = async () => {
    if (!editingStaff) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await staffApi.updateProfile(editingStaff.id, {
        ...editForm,
        branch_id: editForm.branch_id || undefined,
        basic_salary: editForm.basic_salary || undefined,
      });
      if (hasPermission("staff.field.role.edit")) {
        await staffApi.setRoles(editingStaff.id, editRoleId ? [editRoleId] : []);
      }
      notify(`Changes to ${editForm.full_name || editingStaff.full_name} saved.`);
      setEditingStaff(null);
      await load();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail ?? "Couldn't save the changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <Can permission="staff.page.view">
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium">{t("staff.title")}</h1>
          <Can permission="staff.button.create">
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm"
            >
              <Plus size={15} />
              {t("staff.addStaff")}
            </button>
          </Can>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-hairline border-b">Code</th>
              <th className="text-left p-2 border-hairline border-b">{t("staff.name")}</th>
              <th className="text-left p-2 border-hairline border-b">{t("staff.email")}</th>
              <th className="text-left p-2 border-hairline border-b">Branch</th>
              <th className="text-left p-2 border-hairline border-b">{t("staff.roles")}</th>
              <th className="text-left p-2 border-hairline border-b">{t("staff.status")}</th>
              <th className="text-left p-2 border-hairline border-b"></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="p-2 border-hairline border-b font-mono text-xs text-muted">{s.employee_code ?? "—"}</td>
                <td className="p-2 border-hairline border-b">{s.full_name}</td>
                <td className="p-2 border-hairline border-b">{s.email}</td>
                <td className="p-2 border-hairline border-b">{s.branch_name ?? "—"}</td>
                <td className="p-2 border-hairline border-b">{s.role_names.join(", ") || "—"}</td>
                <td className="p-2 border-hairline border-b">
                  {s.is_active ? (
                    <span className="text-sage text-xs">{t("common.active")}</span>
                  ) : (
                    <span className="text-muted text-xs">{t("common.inactive")}</span>
                  )}
                </td>
                <td className="p-2 border-hairline border-b">
                  <div className="flex gap-2">
                    <Can permission="staff.field.profile.edit">
                      <button onClick={() => openEdit(s)} className="text-xs text-plum underline">
                        {t("common.edit")}
                      </button>
                    </Can>
                    <Can permission="staff.field.status.edit">
                      <button onClick={() => toggleStatus(s)} className="text-xs text-muted underline">
                        {s.is_active ? t("common.disable") : t("common.enable")}
                      </button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <Modal title={t("staff.addStaff")} onClose={() => setAddOpen(false)} wide>
          <div className="space-y-6">
            <p className="text-xs text-muted">
              Employee code is generated automatically based on the format set in System setup.
            </p>

            {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-2">Account</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("staff.fullName")}>
                  <input className={inputClass} value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} />
                </Field>
                <Field label={t("staff.email")}>
                  <input className={inputClass} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
                </Field>
                <Field label={t("staff.temporaryPassword")}>
                  <input className={inputClass} type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
                </Field>
              </div>
            </div>

            <ProfileFieldsForm form={form} set={set} branches={branches} />
            <RoleDropdown roles={roles} value={selectedRoleId} onChange={setSelectedRoleId} />

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={createStaff}
                disabled={creating}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? t("common.saving") : t("staff.createAccount")}
              </button>
              <button onClick={() => setAddOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingStaff && (
        <Modal title={`${t("common.edit")} — ${editingStaff.full_name}`} onClose={() => setEditingStaff(null)} wide>
          <div className="space-y-6">
            <Field label={t("staff.fullName")}>
              <input className={inputClass} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </Field>

            <ProfileFieldsForm form={editForm} set={(patch) => setEditForm({ ...editForm, ...patch })} branches={branches} />

            <Can permission="staff.field.role.edit">
              <RoleDropdown roles={roles} value={editRoleId} onChange={setEditRoleId} />
            </Can>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              {editError && <p role="alert" className="w-full text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{editError}</p>}
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {savingEdit ? t("common.saving") : t("common.save")}
              </button>
              <button onClick={() => setEditingStaff(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Can>
  );
}
