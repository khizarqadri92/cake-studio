import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { customersApi, CustomerListItem, CustomerDetail } from "../../api/customers";
import { Can } from "../../components/Can";
import { Modal } from "../../components/Modal";
import { STATUS_TONE } from "../../components/OrderJourneyPanel";
import { useAuthStore } from "../../store/authStore";
import { notify } from "../../store/toastStore";
import { fmtAmount } from "../../lib/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", confirmed: "Confirmed", sent_to_baker: "With baker", in_production: "Baking", ready: "Ready",
  rider_assigned: "Rider assigned", out_for_delivery: "Out for delivery", delivered: "Delivered, cash pending",
  completed: "Completed", cancelled: "Cancelled",
};
const showDate = (s: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum";

type Form = { full_name: string; phone: string; email: string; address_line1: string; city: string; notes: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink/70 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function CustomersPage() {
  const canEdit = useAuthStore((s) => s.hasPermission)("customers.field.edit");
  const [rows, setRows] = useState<CustomerListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async (q = query) => {
    try {
      setRows(await customersApi.list(q.trim()));
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.response?.data?.detail ?? "Couldn't load customers.");
    } finally {
      setLoading(false);
    }
  };

  // Search as you type (a short pause so it doesn't ask on every key)
  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const open = async (id: string) => {
    setSaveError(null);
    try {
      const d = await customersApi.get(id);
      setDetail(d);
      setForm({
        full_name: d.full_name, phone: d.phone, email: d.email ?? "",
        address_line1: d.address_line1 ?? "", city: d.city ?? "", notes: d.notes ?? "",
      });
    } catch (err: any) {
      notify(`Couldn't open this customer: ${err?.response?.data?.detail ?? "it didn't load"}.`, "error");
    }
  };
  const close = () => { setDetail(null); setForm(null); };

  const save = async () => {
    if (!detail || !form) return;
    if (!form.full_name.trim() || !form.phone.trim()) { setSaveError("Name and phone are required."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await customersApi.update(detail.id, {
        full_name: form.full_name.trim(), phone: form.phone.trim(),
        email: form.email.trim() || null, address_line1: form.address_line1.trim() || null,
        city: form.city.trim() || null, notes: form.notes.trim() || null,
      });
      notify(`${saved.full_name}'s details saved.`);
      close();
      await load();
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? "Couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => ({
    customers: rows.length,
    withOrders: rows.filter((r) => r.orders > 0).length,
  }), [rows]);

  return (
    <Can permission="customers.page.view">
      <div className="p-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1>Customers</h1>
            <p className="text-[15px] text-muted mt-1.5">
              {loading ? "Loading…" : `${totals.customers} ${totals.customers === 1 ? "customer" : "customers"}${query ? " found" : ""}, ${totals.withOrders} with orders.`}
              {" "}New customers are added when taking an order.
            </p>
          </div>
          <label className="relative w-full sm:w-80">
            <span className="sr-only">Search customers</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className={`${inputClass} pl-9 h-11`}
              placeholder="Search name, phone or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {loadError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-xl px-4 py-3 mb-4">{loadError}</p>}

        <div className="bg-surface border border-hairline rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4">Name</th>
                <th className="px-4">Phone</th>
                <th className="px-4">City</th>
                <th className="px-4 text-right">Orders</th>
                <th className="px-4 text-right">Total spent</th>
                <th className="px-4">Last order</th>
                <th className="px-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer" onClick={() => open(c.id)}>
                  <td className="px-4 font-medium text-ink">{c.full_name}</td>
                  <td className="px-4 font-mono text-[13px]">{c.phone}</td>
                  <td className="px-4 text-muted">{c.city ?? "—"}</td>
                  <td className="px-4 text-right font-mono text-[13px]">{c.orders}</td>
                  <td className="px-4 text-right font-mono text-[13px]">{fmtAmount(c.total_spent)}</td>
                  <td className="px-4 text-muted whitespace-nowrap">{showDate(c.last_order)}</td>
                  <td className="px-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); open(c.id); }} className="text-xs text-plum underline font-semibold">
                      {canEdit ? "Edit" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              <Users size={28} className="mx-auto mb-2 text-hairline" />
              {query ? `No customers match "${query}".` : "No customers yet. They're added when an order is taken."}
            </div>
          )}
        </div>
      </div>

      {detail && form && (
        <Modal title={canEdit ? `Edit customer` : detail.full_name} onClose={close} wide>
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Orders", String(detail.orders)],
                ["Total spent", fmtAmount(detail.total_spent)],
                ["Customer since", showDate(detail.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-flour px-4 py-3">
                  <p className="text-xs text-muted">{k}</p>
                  <p className="font-display text-lg font-semibold text-ink">{v}</p>
                </div>
              ))}
            </div>

            <fieldset disabled={!canEdit} className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name *"><input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Phone *"><input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="City"><input className={inputClass} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Address"><input className={inputClass} value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notes (e.g. allergies, preferences)">
                  <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
            </fieldset>
            {canEdit && <p className="text-xs text-muted -mt-2">Changes apply to this customer's existing orders too (receipts show the new details).</p>}

            <div>
              <h3 className="text-sm font-semibold text-ink mb-2">Order history ({detail.order_history.length})</h3>
              {detail.order_history.length === 0 ? (
                <p className="text-sm text-muted rounded-xl bg-flour px-4 py-4 text-center">No orders yet.</p>
              ) : (
                <div className="rounded-xl border border-hairline overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="cs-plain w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="px-3 py-2">Order</th><th className="px-3">Date</th><th className="px-3">Status</th>
                        <th className="px-3 text-right">Total</th><th className="px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.order_history.map((o) => (
                        <tr key={o.id} className="border-t border-hairline/70">
                          <td className="px-3 py-2 font-mono text-[13px]">{o.order_number}</td>
                          <td className="px-3 whitespace-nowrap text-muted">{showDate(o.date)}</td>
                          <td className="px-3"><span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_TONE[o.status as keyof typeof STATUS_TONE] ?? ""}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
                          <td className="px-3 text-right font-mono text-[13px]">{fmtAmount(o.total)}</td>
                          <td className={`px-3 text-right font-mono text-[13px] ${o.balance > 0 ? "text-plum" : "text-muted"}`}>{fmtAmount(o.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {saveError && <p role="alert" className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{saveError}</p>}
            <div className="flex gap-2 pt-1 border-t border-hairline pt-4">
              {canEdit && (
                <button onClick={save} disabled={saving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {saving ? "Saving…" : "Save changes"}
                </button>
              )}
              <button onClick={close} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">{canEdit ? "Cancel" : "Close"}</button>
            </div>
          </div>
        </Modal>
      )}
    </Can>
  );
}
