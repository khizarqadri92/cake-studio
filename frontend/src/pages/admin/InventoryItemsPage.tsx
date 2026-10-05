import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { inventoryApi, suppliersApi, unitsApi, purchasesApi, InventoryItem, InventoryItemPayload, Supplier, Unit, StockMovement, Purchase, PurchaseLine } from "../../api/inventory";
import { Can } from "../../components/Can";
import { notify } from "../../store/toastStore";
import { fmtAmount, fmtQty } from "../../lib/format";
import { Modal } from "../../components/Modal";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

const REASONS = [
  { value: "purchase", label: "Purchase (stock in)" },
  { value: "wastage", label: "Wastage (stock out)" },
  { value: "adjustment", label: "Adjustment (correction)" },
];

const REASON_LABELS: Record<string, string> = {
  purchase: "Purchase",
  wastage: "Wastage",
  adjustment: "Adjustment",
  production_use: "Used in production",
  purchase_edit: "Purchase edited",
};

const TABS = [
  { key: "items", label: "Ingredients" },
  { key: "purchases", label: "Purchases" },
  { key: "suppliers", label: "Suppliers" },
  { key: "units", label: "Units" },
  { key: "history", label: "Stock history" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function emptyItem(): InventoryItemPayload {
  return { name: "", unit_id: null, reorder_threshold: 0, supplier_id: null };
}

function emptySupplier() {
  return { name: "", contact_phone: "" };
}

const MEASURES: { value: "weight" | "volume" | "count"; label: string; base: string }[] = [
  { value: "weight", label: "Weight", base: "grams" },
  { value: "volume", label: "Volume", base: "millilitres" },
  { value: "count", label: "Count", base: "pieces" },
];

function emptyUnit(): { name: string; abbreviation: string; measure: Unit["measure"]; factor: number; is_active: boolean; sort_order: number } {
  return { name: "", abbreviation: "", measure: null, factor: 1, is_active: true, sort_order: 0 };
}

function emptyPurchaseLine(): PurchaseLine {
  return { inventory_item_id: "", quantity: 0, unit_price: 0, unit_id: null };
}

export function InventoryItemsPage() {
  const [tab, setTab] = useState<TabKey>("items");

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [purchasesLoaded, setPurchasesLoaded] = useState(false);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Ingredient add/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryItemPayload>(emptyItem());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adjust stock (single item, no price - wastage/correction)
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustReason, setAdjustReason] = useState("wastage");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Suppliers
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState(emptySupplier());
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Units
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState(emptyUnit());
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  // Record purchase (multi-line, with prices)
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseInvoice, setPurchaseInvoice] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([emptyPurchaseLine()]);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const load = async () => {
    const [i, s, u] = await Promise.all([inventoryApi.list(), suppliersApi.list(), unitsApi.list()]);
    setItems(i);
    setSuppliers(s);
    setUnits(u);
  };

  useEffect(() => {
    load();
  }, []);

  // Fetch straight away (used after saving). A "needs reloading" flag alone
  // isn't enough: the code that runs right after a save still sees the old
  // flag, so the list on screen used to stay stale until you changed tabs.
  const reloadPurchases = async () => {
    const rows = await purchasesApi.list();
    setPurchases(rows);
    setPurchasesLoaded(true);
  };
  const reloadHistory = async () => {
    const rows = await inventoryApi.movements();
    setMovements(rows);
    setHistoryLoaded(true);
  };

  const switchTab = (next: TabKey) => {
    setTab(next);
    if (next === "history" && !historyLoaded) reloadHistory();
    if (next === "purchases" && !purchasesLoaded) reloadPurchases();
  };

  // --- Ingredients ---
  const openAdd = () => {
    setEditing(null);
    setForm(emptyItem());
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({ name: item.name, unit_id: item.unit_id, reorder_threshold: item.reorder_threshold, supplier_id: item.supplier_id });
    setError(null);
    setModalOpen(true);
  };

  const set = (patch: Partial<InventoryItemPayload>) => setForm({ ...form, ...patch });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing) await inventoryApi.update(editing.id, form);
      else await inventoryApi.create(form);
      notify(editing ? `${form.name} saved.` : `${form.name} added. Use "Record purchase" to bring in stock.`);
      setModalOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: InventoryItem) => {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    try {
      await inventoryApi.remove(item.id);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't delete this item.");
    }
  };

  // --- Adjust stock (wastage / manual correction - no price) ---
  const openAdjust = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustReason("wastage");
    setAdjustQty("");
    setAdjustError(null);
  };

  const doAdjust = async () => {
    if (!adjustingItem) return;
    const magnitude = Number(adjustQty);
    if (!adjustQty || magnitude === 0) {
      setAdjustError("Enter a non-zero quantity.");
      return;
    }
    const qty_delta = adjustReason === "wastage" ? -Math.abs(magnitude) : magnitude;
    setAdjustSaving(true);
    setAdjustError(null);
    try {
      await inventoryApi.recordMovement({ inventory_item_id: adjustingItem.id, qty_delta, reason: adjustReason });
      setAdjustingItem(null);
      await Promise.all([load(), historyLoaded ? reloadHistory() : Promise.resolve()]);
    } catch (err: any) {
      setAdjustError(err?.response?.data?.detail ?? "Couldn't record this movement.");
    } finally {
      setAdjustSaving(false);
    }
  };

  // --- Suppliers ---
  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm(emptySupplier());
    setSupplierError(null);
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({ name: supplier.name, contact_phone: supplier.contact_phone ?? "" });
    setSupplierError(null);
    setSupplierModalOpen(true);
  };

  const saveSupplier = async () => {
    setSupplierSaving(true);
    setSupplierError(null);
    try {
      const payload = { name: supplierForm.name, contact_phone: supplierForm.contact_phone || null };
      if (editingSupplier) await suppliersApi.update(editingSupplier.id, payload);
      else await suppliersApi.create(payload);
      setSupplierModalOpen(false);
      await load();
    } catch (err: any) {
      setSupplierError(err?.response?.data?.detail ?? "Couldn't save this supplier.");
    } finally {
      setSupplierSaving(false);
    }
  };

  const removeSupplier = async (supplier: Supplier) => {
    if (!confirm(`Delete "${supplier.name}"?`)) return;
    try {
      await suppliersApi.remove(supplier.id);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't delete this supplier - it may still be linked to ingredients or purchases.");
    }
  };

  // --- Units ---
  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitForm(emptyUnit());
    setUnitError(null);
    setUnitModalOpen(true);
  };

  const openEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitForm({
      name: unit.name, abbreviation: unit.abbreviation, measure: unit.measure, factor: unit.factor,
      is_active: unit.is_active, sort_order: unit.sort_order,
    });
    setUnitError(null);
    setUnitModalOpen(true);
  };

  const saveUnit = async () => {
    if (unitForm.measure && !(unitForm.factor > 0)) {
      setUnitError("Enter how big this unit is (a number greater than zero).");
      return;
    }
    setUnitSaving(true);
    setUnitError(null);
    try {
      if (editingUnit) await unitsApi.update(editingUnit.id, unitForm);
      else await unitsApi.create(unitForm);
      setUnitModalOpen(false);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      // Validation errors arrive as a list of {msg} objects rather than a string.
      setUnitError(
        Array.isArray(detail) ? detail.map((d: any) => String(d?.msg ?? d).replace(/^Value error, /, "")).join("; ")
          : detail ?? "Couldn't save this unit."
      );
    } finally {
      setUnitSaving(false);
    }
  };

  const removeUnit = async (unit: Unit) => {
    if (!confirm(`Delete "${unit.name}"?`)) return;
    try {
      await unitsApi.remove(unit.id);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't delete this unit - it may still be used by an ingredient.");
    }
  };

  // --- Record purchase ---
  const openPurchaseModal = () => {
    setEditingPurchaseId(null);
    setPurchaseSupplierId("");
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setPurchaseInvoice("");
    setPurchaseNotes("");
    setPurchaseLines([emptyPurchaseLine()]);
    setPurchaseError(null);
    setPurchaseModalOpen(true);
  };

  // Edit: reopen the form exactly as the purchase was typed (e.g. 500 g at 0.40 per g).
  const openEditPurchase = async (p: Purchase) => {
    let unitList = units;
    if (unitList.length === 0) {
      try { unitList = await unitsApi.list(); setUnits(unitList); } catch { unitList = []; }
    }
    setEditingPurchaseId(p.id);
    setPurchaseSupplierId(p.supplier_id ?? "");
    setPurchaseDate(p.purchase_date);
    setPurchaseInvoice(p.invoice_number ?? "");
    setPurchaseNotes(p.notes ?? "");
    setPurchaseLines(p.items.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: l.entered_quantity ?? l.quantity,
      unit_price: l.entered_unit_price ?? l.unit_price,
      unit_id: (l.entered_unit && unitList.find((u) => u.abbreviation === l.entered_unit)?.id) || null,
    })));
    setPurchaseError(null);
    setPurchaseModalOpen(true);
  };

  const addPurchaseLine = () => setPurchaseLines([...purchaseLines, emptyPurchaseLine()]);
  const removePurchaseLine = (index: number) => setPurchaseLines(purchaseLines.filter((_, i) => i !== index));
  const updatePurchaseLine = (index: number, patch: Partial<PurchaseLine>) =>
    setPurchaseLines(purchaseLines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const purchaseTotal = purchaseLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const doRecordPurchase = async () => {
    const usable = purchaseLines.filter((l) => l.inventory_item_id && Number(l.quantity) > 0);
    if (usable.length === 0) {
      setPurchaseError("Add at least one ingredient with a quantity.");
      return;
    }
    setPurchaseSaving(true);
    setPurchaseError(null);
    try {
      const payload = {
        supplier_id: purchaseSupplierId || null,
        invoice_number: purchaseInvoice || null,
        purchase_date: purchaseDate || null,
        notes: purchaseNotes || null,
        items: usable.map((l) => ({
          inventory_item_id: l.inventory_item_id, quantity: Number(l.quantity),
          unit_price: Number(l.unit_price), unit_id: l.unit_id ?? null,
        })),
      };
      if (editingPurchaseId) {
        await purchasesApi.update(editingPurchaseId, payload);
        notify("Purchase updated. Stock has been corrected to match.");
      } else {
        await purchasesApi.create(payload);
        notify("Purchase recorded. Stock has been added.");
      }
      setEditingPurchaseId(null);
      setPurchaseModalOpen(false);
      // Refresh what's on screen now: stock levels, the purchase list, and
      // the stock history if it has been opened.
      await Promise.all([load(), reloadPurchases(), historyLoaded ? reloadHistory() : Promise.resolve()]);
    } catch (err: any) {
      setPurchaseError(err?.response?.data?.detail ?? (editingPurchaseId ? "Couldn't save the changes to this purchase." : "Couldn't record this purchase."));
    } finally {
      setPurchaseSaving(false);
    }
  };

  return (
    <Can permission="inventory.page.view">
      <div className="p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-medium">Inventory</h1>
        </div>

        <div className="flex gap-1 border-b border-hairline mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.key ? "border-plum text-plum font-medium" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* --- Ingredients tab --- */}
        {tab === "items" && (
          <>
            <div className="flex justify-end mb-3">
              <Can permission="inventory.button.create">
                <button onClick={openAdd} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
                  <Plus size={15} /> Add ingredient
                </button>
              </Can>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-hairline border-b">Name</th>
                  <th className="text-left p-2 border-hairline border-b">Unit</th>
                  <th className="text-left p-2 border-hairline border-b">On hand</th>
                  <th className="text-left p-2 border-hairline border-b">Reorder at</th>
                  <th className="text-left p-2 border-hairline border-b">Supplier</th>
                  <th className="text-left p-2 border-hairline border-b">Status</th>
                  <th className="text-left p-2 border-hairline border-b"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const low = item.is_low_stock;
                  return (
                    <tr key={item.id} className={!item.is_active ? "opacity-50" : ""}>
                      <td className="p-2 border-hairline border-b">{item.name}</td>
                      <td className="p-2 border-hairline border-b">{item.unit_name ?? "—"}</td>
                      <td className={`p-2 border-hairline border-b ${low ? "text-plum font-medium" : ""}`}>
                        {fmtQty(item.qty_on_hand)}
                        {low && <span className="ml-1.5 text-xs bg-plum/10 text-plum px-1.5 py-0.5 rounded-full">Low</span>}
                      </td>
                      <td className="p-2 border-hairline border-b text-muted">{fmtQty(item.reorder_threshold)}</td>
                      <td className="p-2 border-hairline border-b text-muted">{item.supplier_name ?? "—"}</td>
                      <td className="p-2 border-hairline border-b">
                        {item.is_active ? <span className="text-sage text-xs">Active</span> : <span className="text-muted text-xs">Inactive</span>}
                      </td>
                      <td className="p-2 border-hairline border-b">
                        <div className="flex gap-2">
                          <Can permission="inventory.button.adjust_stock">
                            <button onClick={() => openAdjust(item)} className="text-xs bg-plum text-cream px-2 py-1 rounded">Adjust</button>
                          </Can>
                          <Can permission="inventory.field.edit">
                            <button onClick={() => openEdit(item)} className="text-xs text-plum underline">Edit</button>
                          </Can>
                          <Can permission="inventory.button.delete">
                            <button onClick={() => remove(item)} className="text-xs text-muted underline">Delete</button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-sm text-muted">No ingredients yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* --- Purchases tab --- */}
        {tab === "purchases" && (
          <>
            <div className="flex justify-end mb-3">
              <Can permission="inventory.button.adjust_stock">
                <button onClick={openPurchaseModal} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
                  <Plus size={15} /> Record purchase
                </button>
              </Can>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-hairline border-b">Date</th>
                  <th className="text-left p-2 border-hairline border-b">Supplier</th>
                  <th className="text-left p-2 border-hairline border-b">Invoice #</th>
                  <th className="text-left p-2 border-hairline border-b">Total</th>
                  <th className="text-left p-2 border-hairline border-b">Recorded by</th>
                  <th className="text-left p-2 border-hairline border-b"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <>
                    <tr key={p.id} className="cursor-pointer hover:bg-flour/50" onClick={() => setExpandedPurchaseId(expandedPurchaseId === p.id ? null : p.id)}>
                      <td className="p-2 border-hairline border-b font-mono text-xs">{p.purchase_date}</td>
                      <td className="p-2 border-hairline border-b">{p.supplier_name ?? "—"}</td>
                      <td className="p-2 border-hairline border-b text-muted">{p.invoice_number ?? "—"}</td>
                      <td className="p-2 border-hairline border-b font-medium">{fmtAmount(p.total_amount)}</td>
                      <td className="p-2 border-hairline border-b text-muted text-xs">{p.created_by_name ?? "—"}</td>
                      <td className="p-2 border-hairline border-b text-xs whitespace-nowrap">
                        <span className="text-plum underline">{expandedPurchaseId === p.id ? "Hide items" : "View items"}</span>
                        <Can permission="inventory.button.edit_purchase">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditPurchase(p); }}
                            className="ml-3 text-plum underline font-semibold"
                          >
                            Edit
                          </button>
                        </Can>
                      </td>
                    </tr>
                    {expandedPurchaseId === p.id && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={6} className="p-3 border-hairline border-b bg-flour/40">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted">
                                <th className="text-left pb-1">Ingredient</th>
                                <th className="text-left pb-1">Quantity</th>
                                <th className="text-left pb-1">Unit price</th>
                                <th className="text-left pb-1">Line total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.items.map((line, i) => (
                                <tr key={i}>
                                  <td className="py-0.5">{line.inventory_item_name}</td>
                                  <td className="py-0.5">
                                    {line.entered_unit && line.entered_unit !== line.unit ? (
                                      <>
                                        {fmtQty(line.entered_quantity)} {line.entered_unit}{" "}
                                        <span className="text-muted">(= {fmtQty(line.quantity)} {line.unit})</span>
                                      </>
                                    ) : (
                                      <>{fmtQty(line.quantity)} {line.unit}</>
                                    )}
                                  </td>
                                  <td className="py-0.5">
                                    {line.entered_unit_price != null && line.entered_unit ? (
                                      <>{fmtAmount(line.entered_unit_price)} / {line.entered_unit}</>
                                    ) : (
                                      <>{fmtAmount(line.unit_price)}{line.unit ? ` / ${line.unit}` : ""}</>
                                    )}
                                  </td>
                                  <td className="py-0.5">{fmtAmount(line.line_total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {p.notes && <p className="text-xs text-muted mt-2">Notes: {p.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {purchases.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-sm text-muted">No purchases recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* --- Suppliers tab --- */}
        {tab === "suppliers" && (
          <>
            <div className="flex justify-end mb-3">
              <Can permission="inventory.button.create">
                <button onClick={openAddSupplier} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
                  <Plus size={15} /> Add supplier
                </button>
              </Can>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-hairline border-b">Name</th>
                  <th className="text-left p-2 border-hairline border-b">Phone</th>
                  <th className="text-left p-2 border-hairline border-b"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="p-2 border-hairline border-b">{s.name}</td>
                    <td className="p-2 border-hairline border-b text-muted">{s.contact_phone ?? "—"}</td>
                    <td className="p-2 border-hairline border-b">
                      <div className="flex gap-2">
                        <Can permission="inventory.field.edit">
                          <button onClick={() => openEditSupplier(s)} className="text-xs text-plum underline">Edit</button>
                        </Can>
                        <Can permission="inventory.button.delete">
                          <button onClick={() => removeSupplier(s)} className="text-xs text-muted underline">Delete</button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-sm text-muted">No suppliers yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* --- Units tab --- */}
        {tab === "units" && (
          <>
            <p className="text-xs text-muted mb-3">
              Define the measurement units ingredients are tracked in - kilograms, grams, litres, pieces, etc.
            </p>
            <div className="flex justify-end mb-3">
              <Can permission="inventory.button.create">
                <button onClick={openAddUnit} className="flex items-center gap-1.5 bg-plum text-cream px-3 py-1.5 rounded-lg text-sm">
                  <Plus size={15} /> Add unit
                </button>
              </Can>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2 border-hairline border-b">Name</th>
                  <th className="text-left p-2 border-hairline border-b">Abbreviation</th>
                  <th className="text-left p-2 border-hairline border-b">Measures</th>
                  <th className="text-left p-2 border-hairline border-b">Status</th>
                  <th className="text-left p-2 border-hairline border-b"></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                    <td className="p-2 border-hairline border-b">{u.name}</td>
                    <td className="p-2 border-hairline border-b font-mono text-xs">{u.abbreviation}</td>
                    <td className="p-2 border-hairline border-b text-xs">
                      {u.measure ? (
                        <span className="text-ink/70">
                          {MEASURES.find((m) => m.value === u.measure)?.label} · 1 {u.abbreviation} = {u.factor}{" "}
                          {MEASURES.find((m) => m.value === u.measure)?.base}
                        </span>
                      ) : (
                        <span className="text-muted">Not set — no conversion</span>
                      )}
                    </td>
                    <td className="p-2 border-hairline border-b">
                      {u.is_active ? <span className="text-sage text-xs">Active</span> : <span className="text-muted text-xs">Inactive</span>}
                    </td>
                    <td className="p-2 border-hairline border-b">
                      <div className="flex gap-2">
                        <Can permission="inventory.field.edit">
                          <button onClick={() => openEditUnit(u)} className="text-xs text-plum underline">Edit</button>
                        </Can>
                        <Can permission="inventory.button.delete">
                          <button onClick={() => removeUnit(u)} className="text-xs text-muted underline">Delete</button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-sm text-muted">No units set up yet.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* --- History tab --- */}
        {tab === "history" && (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left p-2 border-hairline border-b">Date</th>
                <th className="text-left p-2 border-hairline border-b">Ingredient</th>
                <th className="text-left p-2 border-hairline border-b">Change</th>
                <th className="text-left p-2 border-hairline border-b">Reason</th>
                <th className="text-left p-2 border-hairline border-b">Unit price</th>
                <th className="text-left p-2 border-hairline border-b">Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="p-2 border-hairline border-b font-mono text-xs">{m.processing_date}</td>
                  <td className="p-2 border-hairline border-b">{m.inventory_item_name}</td>
                  <td className={`p-2 border-hairline border-b font-medium ${m.qty_delta < 0 ? "text-plum" : "text-sage"}`}>
                    {m.qty_delta > 0 ? "+" : ""}{fmtQty(m.qty_delta)}
                  </td>
                  <td className="p-2 border-hairline border-b text-muted">{REASON_LABELS[m.reason] ?? m.reason}</td>
                  <td className="p-2 border-hairline border-b text-muted">{m.unit_price ?? "—"}</td>
                  <td className="p-2 border-hairline border-b text-muted text-xs">{m.created_by_name ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-sm text-muted">No stock movements yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Ingredient add/edit modal --- */}
      {modalOpen && (
        <Modal title={editing ? "Edit ingredient" : "Add ingredient"} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{error}</p>}

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
              <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Unit</label>
                <select className={inputClass} value={form.unit_id ?? ""} onChange={(e) => set({ unit_id: e.target.value || null })}>
                  <option value="">Select a unit…</option>
                  {units.filter((u) => u.is_active).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Reorder threshold</label>
                <input type="number" step="any" className={inputClass} value={form.reorder_threshold} onChange={(e) => set({ reorder_threshold: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Supplier</label>
              <select className={inputClass} value={form.supplier_id ?? ""} onChange={(e) => set({ supplier_id: e.target.value || null })}>
                <option value="">No supplier assigned</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {!editing && (
              <p className="text-xs text-muted">
                New ingredients start at 0 in stock — use "Record purchase" afterward to bring in the first batch.
              </p>
            )}

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

      {/* --- Adjust stock modal (wastage / correction, no price) --- */}
      {adjustingItem && (
        <Modal title={`Adjust stock — ${adjustingItem.name}`} onClose={() => setAdjustingItem(null)}>
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Currently {fmtQty(adjustingItem.qty_on_hand)} {adjustingItem.unit_name} on hand. To bring in a new purchase with a price, use "Record purchase" instead.
            </p>

            {adjustError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{adjustError}</p>}

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Reason</label>
              <select className={inputClass} value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                {REASONS.filter((r) => r.value !== "purchase").map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                Quantity {adjustReason === "adjustment" ? "(use a negative number to correct downward)" : ""}
              </label>
              <input type="number" step="any" autoFocus className={inputClass} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button onClick={doAdjust} disabled={adjustSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {adjustSaving ? "Saving…" : "Record movement"}
              </button>
              <button onClick={() => setAdjustingItem(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Supplier add/edit modal --- */}
      {supplierModalOpen && (
        <Modal title={editingSupplier ? "Edit supplier" : "Add supplier"} onClose={() => setSupplierModalOpen(false)}>
          <div className="space-y-4">
            {supplierError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{supplierError}</p>}
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
              <input className={inputClass} value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Contact phone</label>
              <input className={inputClass} value={supplierForm.contact_phone} onChange={(e) => setSupplierForm({ ...supplierForm, contact_phone: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button onClick={saveSupplier} disabled={supplierSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {supplierSaving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setSupplierModalOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Unit add/edit modal --- */}
      {unitModalOpen && (
        <Modal title={editingUnit ? "Edit unit" : "Add unit"} onClose={() => setUnitModalOpen(false)}>
          <div className="space-y-4">
            {unitError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{unitError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Name</label>
                <input className={inputClass} placeholder="Kilogram" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Abbreviation</label>
                <input className={inputClass} placeholder="kg" value={unitForm.abbreviation} onChange={(e) => setUnitForm({ ...unitForm, abbreviation: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Measures</label>
                <select
                  className={inputClass}
                  value={unitForm.measure ?? ""}
                  onChange={(e) => setUnitForm({ ...unitForm, measure: (e.target.value || null) as Unit["measure"] })}
                >
                  <option value="">Not set (no conversion)</option>
                  {MEASURES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              {unitForm.measure && (
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    1 {unitForm.abbreviation || "unit"} = how many {MEASURES.find((m) => m.value === unitForm.measure)?.base}?
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className={inputClass}
                    value={unitForm.factor}
                    onChange={(e) => setUnitForm({ ...unitForm, factor: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted">
              Units with the same "Measures" can be converted into each other — e.g. an ingredient stocked in kg can be used in g.
              Examples: g = 1, kg = 1000 (weight); ml = 1, l = 1000 (volume); pcs = 1, dozen = 12 (count).
            </p>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={unitForm.is_active} onChange={(e) => setUnitForm({ ...unitForm, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button onClick={saveUnit} disabled={unitSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {unitSaving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setUnitModalOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* --- Record purchase modal (multi-line, with prices) --- */}
      {purchaseModalOpen && (
        <Modal title={editingPurchaseId ? "Edit purchase" : "Record purchase"} onClose={() => { setPurchaseModalOpen(false); setEditingPurchaseId(null); }} wide>
          <div className="space-y-4">
            {purchaseError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{purchaseError}</p>}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Supplier</label>
                <select className={inputClass} value={purchaseSupplierId} onChange={(e) => setPurchaseSupplierId(e.target.value)}>
                  <option value="">No supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Purchase date</label>
                <input type="date" className={inputClass} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1">Invoice number</label>
                <input className={inputClass} value={purchaseInvoice} onChange={(e) => setPurchaseInvoice(e.target.value)} />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-ink/70 mb-2">Items purchased</p>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[11px] text-muted mb-1 px-0.5">
                <span>Ingredient</span><span>Qty</span><span>Unit</span><span>Price / unit</span><span className="text-right pr-1">Total</span><span className="w-3" />
              </div>
              <div className="space-y-2">
                {purchaseLines.map((line, i) => (
                  <div key={i}>
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                    <select
                      className={inputClass}
                      value={line.inventory_item_id}
                      onChange={(e) => {
                        const picked = items.find((it) => it.id === e.target.value);
                        // New ingredient -> start on its own stock unit
                        updatePurchaseLine(i, { inventory_item_id: e.target.value, unit_id: picked?.unit_options?.[0]?.unit_id ?? null });
                      }}
                    >
                      <option value="">Select ingredient…</option>
                      {items.filter((it) => it.is_active).map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                    <input type="number" step="any" placeholder="Qty" className={inputClass} value={line.quantity || ""} onChange={(e) => updatePurchaseLine(i, { quantity: Number(e.target.value) })} />
                    {(() => {
                      const item = items.find((it) => it.id === line.inventory_item_id);
                      const options = item?.unit_options ?? [];
                      return (
                        <select
                          className={inputClass}
                          title={options.length === 1 ? "This ingredient's unit has no related units set up" : "Unit"}
                          value={line.unit_id ?? ""}
                          disabled={!item}
                          onChange={(e) => updatePurchaseLine(i, { unit_id: e.target.value || null })}
                        >
                          {!item && <option value="">Unit</option>}
                          {options.map((u) => <option key={u.unit_id ?? "own"} value={u.unit_id ?? ""}>{u.abbreviation || "unit"}</option>)}
                        </select>
                      );
                    })()}
                    <input
                      type="number"
                      step="any"
                      placeholder={(() => {
                        const item = items.find((it) => it.id === line.inventory_item_id);
                        const abbr = item?.unit_options?.find((u) => u.unit_id === (line.unit_id ?? null))?.abbreviation;
                        return abbr ? `Price per ${abbr}` : "Unit price";
                      })()}
                      className={inputClass}
                      value={line.unit_price || ""}
                      onChange={(e) => updatePurchaseLine(i, { unit_price: Number(e.target.value) })}
                    />
                    <span className="text-sm text-muted text-right pr-1">
                      {fmtAmount((Number(line.quantity) || 0) * (Number(line.unit_price) || 0))}
                    </span>
                    {purchaseLines.length > 1 ? (
                      <button onClick={() => removePurchaseLine(i)} className="text-xs text-plum">✕</button>
                    ) : <span />}
                  </div>
                  {(() => {
                    // e.g. "500 g = 0.5 kg will be added to Flour's stock"
                    const item = items.find((it) => it.id === line.inventory_item_id);
                    const opt = item?.unit_options?.find((u) => u.unit_id === (line.unit_id ?? null));
                    const qty = Number(line.quantity);
                    if (!item || !opt || !qty || opt.to_item_unit === 1) return null;
                    return (
                      <p className="text-xs text-muted mt-1">
                        {qty} {opt.abbreviation} = <span className="text-ink/80">{fmtQty(qty * opt.to_item_unit)} {item.unit_name}</span>{" "}
                        {editingPurchaseId ? `of ${item.name} in this purchase (stock changes only by the difference)` : `will be added to ${item.name}'s stock`}
                      </p>
                    );
                  })()}
                  </div>
                ))}
              </div>
              <button onClick={addPurchaseLine} className="text-xs text-plum underline mt-2">+ Add another item</button>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Notes</label>
              <textarea className={inputClass} rows={2} value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between border-t border-hairline pt-3">
              <span className="text-sm font-medium">Total: {fmtAmount(purchaseTotal)}</span>
              <div className="flex gap-2">
                <button onClick={doRecordPurchase} disabled={purchaseSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                  {purchaseSaving ? "Saving…" : editingPurchaseId ? "Save changes" : "Record purchase"}
                </button>
                <button onClick={() => setPurchaseModalOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Can>
  );
}
