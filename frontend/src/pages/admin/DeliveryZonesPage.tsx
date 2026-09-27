import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { deliveryZonesApi, DeliveryZone } from "../../api/delivery";
import { Can } from "../../components/Can";
import { fmtAmount } from "../../lib/format";
import { Modal } from "../../components/Modal";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

function emptyZone(): Partial<DeliveryZone> {
  return { name: "", distance_from_km: 0, distance_to_km: 5, price: 0, is_active: true, sort_order: 0 };
}

export function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState<Partial<DeliveryZone>>(emptyZone());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => deliveryZonesApi.list().then(setZones);

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyZone());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (zone: DeliveryZone) => {
    setEditing(zone);
    setForm({ ...zone });
    setError(null);
    setModalOpen(true);
  };

  const set = (patch: Partial<DeliveryZone>) => setForm({ ...form, ...patch });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing) await deliveryZonesApi.update(editing.id, form);
      else await deliveryZonesApi.create(form);
      setModalOpen(false);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(", ") : detail ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (zone: DeliveryZone) => {
    if (!confirm(`Delete this delivery zone (${zone.distance_from_km}-${zone.distance_to_km} km)?`)) return;
    try {
      await deliveryZonesApi.remove(zone.id);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't delete.");
    }
  };

  return (
    <Can permission="delivery_zones.page.view">
      <div className="p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-medium">Delivery zones</h1>
          <Can permission="delivery_zones.button.create">
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
              <Plus size={15} /> Add zone
            </button>
          </Can>
        </div>
        <p className="text-xs text-muted mb-6">
          Set a delivery price for each distance range. Ranges can't overlap.
        </p>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-hairline border-b">Label</th>
              <th className="text-left p-2 border-hairline border-b">Distance</th>
              <th className="text-left p-2 border-hairline border-b">Price</th>
              <th className="text-left p-2 border-hairline border-b">Status</th>
              <th className="text-left p-2 border-hairline border-b"></th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id}>
                <td className="p-2 border-hairline border-b">{zone.name ?? "—"}</td>
                <td className="p-2 border-hairline border-b font-mono text-xs">
                  {zone.distance_from_km} – {zone.distance_to_km} km
                </td>
                <td className="p-2 border-hairline border-b">{fmtAmount(zone.price)}</td>
                <td className="p-2 border-hairline border-b">
                  {zone.is_active ? (
                    <span className="text-sage text-xs">Active</span>
                  ) : (
                    <span className="text-muted text-xs">Inactive</span>
                  )}
                </td>
                <td className="p-2 border-hairline border-b">
                  <div className="flex gap-2">
                    <Can permission="delivery_zones.field.edit">
                      <button onClick={() => openEdit(zone)} className="text-xs text-plum underline">Edit</button>
                    </Can>
                    <Can permission="delivery_zones.button.delete">
                      <button onClick={() => remove(zone)} className="text-xs text-muted underline">Delete</button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
            {zones.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-sm text-muted">No delivery zones yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editing ? "Edit delivery zone" : "Add delivery zone"} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Label (optional)</label>
              <input className={inputClass} placeholder="e.g. Zone A - Nearby" value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Distance from (km)</label>
                <input type="number" step="0.1" className={inputClass} value={form.distance_from_km ?? 0} onChange={(e) => set({ distance_from_km: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Distance to (km)</label>
                <input type="number" step="0.1" className={inputClass} value={form.distance_to_km ?? 0} onChange={(e) => set({ distance_to_km: Number(e.target.value) })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Delivery price</label>
                <input type="number" className={inputClass} value={form.price ?? 0} onChange={(e) => set({ price: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-1.5 text-sm mt-6">
                <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => set({ is_active: e.target.checked })} />
                Active
              </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button onClick={save} disabled={saving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setModalOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Can>
  );
}
