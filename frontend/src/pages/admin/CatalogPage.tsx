import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { createCatalogApi, CatalogItem } from "../../api/catalog";
import { CATALOG_CONFIGS } from "../../config/catalogConfigs";
import { Can } from "../../components/Can";
import { fmtAmount } from "../../lib/format";
import { Modal } from "../../components/Modal";
import { mediaUrl } from "../../api/client";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

function emptyItem(): Partial<CatalogItem> {
  return {
    name: "",
    description: "",
    price_modifier: 0,
    price: 0,
    max_qty: 1,
    servings: undefined,
    image_url: null,
    is_active: true,
    sort_order: 0,
  };
}

export function CatalogPage() {
  const { catalogKey } = useParams<{ catalogKey: string }>();
  const config = catalogKey ? CATALOG_CONFIGS[catalogKey] : undefined;

  if (!config) {
    return <div className="p-6 text-sm text-plum">Unknown catalog: {catalogKey}</div>;
  }

  return <CatalogPageInner key={config.key} config={config} />;
}

function CatalogPageInner({ config }: { config: (typeof CATALOG_CONFIGS)[string] }) {
  const api = createCatalogApi(config.apiBase);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<Partial<CatalogItem>>(emptyItem());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.list().then(setItems);

  useEffect(() => {
    load();
  }, [config.key]);

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyItem());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setForm({ ...item });
    setError(null);
    setModalOpen(true);
  };

  const set = (patch: Partial<CatalogItem>) => setForm({ ...form, ...patch });

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    setError(null);
    try {
      if (editingItem) {
        await api.update(editingItem.id, form);
      } else {
        await api.create(form);
      }
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: CatalogItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.remove(item.id);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't delete.");
    }
  };

  const isAddon = config.fieldSet === "addon";
  const isSize = config.fieldSet === "size";
  const isTheme = config.fieldSet === "theme";
  const priceValue = isAddon ? form.price : form.price_modifier;
  const setPriceValue = (v: number) => (isAddon ? set({ price: v }) : set({ price_modifier: v }));

  return (
    <Can permission={`${config.permissionPrefix}.page.view`}>
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium">{config.title}</h1>
          <Can permission={`${config.permissionPrefix}.button.create`}>
            <button onClick={openAdd} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
              <Plus size={15} /> Add
            </button>
          </Can>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {config.fieldSet !== "size" && <th className="text-left p-2 border-hairline border-b w-14"></th>}
              <th className="text-left p-2 border-hairline border-b">Name</th>
              {!isTheme && <th className="text-left p-2 border-hairline border-b">{isAddon ? "Price" : "Price modifier"}</th>}
              {isAddon && <th className="text-left p-2 border-hairline border-b">Max qty</th>}
              {isSize && <th className="text-left p-2 border-hairline border-b">Servings</th>}
              <th className="text-left p-2 border-hairline border-b">Status</th>
              <th className="text-left p-2 border-hairline border-b"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {config.fieldSet !== "size" && (
                  <td className="p-2 border-hairline border-b">
                    {item.image_url ? (
                      <img src={mediaUrl(item.image_url)} alt="" className="w-9 h-9 object-cover rounded-md border border-hairline" />
                    ) : (
                      <div className="w-9 h-9 rounded-md bg-flour border border-hairline" />
                    )}
                  </td>
                )}
                <td className="p-2 border-hairline border-b">
                  <div>{item.name}</div>
                  {item.description && <div className="text-xs text-muted">{item.description}</div>}
                </td>
                {!isTheme && <td className="p-2 border-hairline border-b">{fmtAmount(isAddon ? item.price : item.price_modifier)}</td>}
                {isAddon && <td className="p-2 border-hairline border-b">{item.max_qty}</td>}
                {isSize && <td className="p-2 border-hairline border-b">{item.servings ?? "—"}</td>}
                <td className="p-2 border-hairline border-b">
                  {item.is_active ? (
                    <span className="text-sage text-xs">Active</span>
                  ) : (
                    <span className="text-muted text-xs">Inactive</span>
                  )}
                </td>
                <td className="p-2 border-hairline border-b">
                  <div className="flex gap-2">
                    <Can permission={`${config.permissionPrefix}.field.edit`}>
                      <button onClick={() => openEdit(item)} className="text-xs text-plum underline">Edit</button>
                    </Can>
                    <Can permission={`${config.permissionPrefix}.button.delete`}>
                      <button onClick={() => remove(item)} className="text-xs text-muted underline">Delete</button>
                    </Can>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-sm text-muted">No items yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <Modal title={editingItem ? `Edit — ${editingItem.name}` : `Add ${config.title.replace(/s$/, "")}`} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
              <input className={inputClass} value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} />
            </div>

            {!isSize && (
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Description</label>
                <input className={inputClass} value={form.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
              </div>
            )}

            {!isTheme && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">{isAddon ? "Price" : "Price modifier"}</label>
                  <input type="number" className={inputClass} value={priceValue ?? 0} onChange={(e) => setPriceValue(Number(e.target.value))} />
                </div>
                {isAddon && (
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1">Max quantity per order</label>
                    <input type="number" min={1} className={inputClass} value={form.max_qty ?? 1} onChange={(e) => set({ max_qty: Number(e.target.value) })} />
                  </div>
                )}
                {isSize && (
                  <div>
                    <label className="block text-xs font-medium text-ink/70 mb-1">Servings</label>
                    <input type="number" className={inputClass} value={form.servings ?? ""} onChange={(e) => set({ servings: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Sort order</label>
                <input type="number" className={inputClass} value={form.sort_order ?? 0} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
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
