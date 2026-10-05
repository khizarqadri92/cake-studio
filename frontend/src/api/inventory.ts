import { api } from "./client";

export interface Supplier {
  id: string;
  name: string;
  contact_phone: string | null;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  measure: "weight" | "volume" | "count" | null;
  factor: number;
  is_active: boolean;
  sort_order: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit_id: string | null;
  unit_name: string | null;
  qty_on_hand: number;
  reorder_threshold: number;
  supplier_id: string | null;
  supplier_name: string | null;
  is_active: boolean;
  is_low_stock: boolean;
  unit_options: { unit_id: string | null; abbreviation: string; to_item_unit: number }[];
}

export interface InventoryItemPayload {
  name: string;
  unit_id: string | null;
  reorder_threshold: number;
  supplier_id: string | null;
}

export interface StockMovement {
  id: string;
  inventory_item_id: string;
  inventory_item_name: string;
  qty_delta: number;
  reason: string;
  unit_price: number | null;
  processing_date: string;
  created_by_staff_id: string;
  created_by_name: string | null;
}

export interface PurchaseLine {
  inventory_item_id: string;
  inventory_item_name?: string;
  quantity: number;          // as entered on the form / in stock unit on saved purchases
  unit_price: number;
  unit_id?: string | null;   // unit the quantity is entered in (form only)
  line_total?: number;
  unit?: string;             // stock unit (saved purchases)
  entered_quantity?: number | null;
  entered_unit?: string | null;
  entered_unit_price?: number | null;
}

export interface Purchase {
  id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  invoice_number: string | null;
  purchase_date: string;
  notes: string | null;
  total_amount: number;
  created_by_name: string | null;
  created_at: string;
  items: PurchaseLine[];
}

export const suppliersApi = {
  list: () => api.get<Supplier[]>("/inventory/suppliers").then((r) => r.data),
  create: (payload: { name: string; contact_phone: string | null }) =>
    api.post<Supplier>("/inventory/suppliers", payload).then((r) => r.data),
  update: (id: string, payload: { name: string; contact_phone: string | null }) =>
    api.put<Supplier>(`/inventory/suppliers/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/inventory/suppliers/${id}`).then((r) => r.data),
};

export const unitsApi = {
  list: () => api.get<Unit[]>("/inventory/units").then((r) => r.data),
  create: (payload: { name: string; abbreviation: string; is_active: boolean; sort_order: number }) =>
    api.post<Unit>("/inventory/units", payload).then((r) => r.data),
  update: (id: string, payload: { name: string; abbreviation: string; is_active: boolean; sort_order: number }) =>
    api.put<Unit>(`/inventory/units/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/inventory/units/${id}`).then((r) => r.data),
};

export const purchasesApi = {
  list: () => api.get<Purchase[]>("/inventory/purchases").then((r) => r.data),
  create: (payload: {
    supplier_id: string | null;
    invoice_number: string | null;
    purchase_date: string | null;
    notes: string | null;
    items: { inventory_item_id: string; quantity: number; unit_price: number }[];
  }) => api.post<Purchase>("/inventory/purchases", payload).then((r) => r.data),
  /** Correct a recorded purchase; stock is adjusted by the difference. */
  update: (id: string, payload: {
    supplier_id: string | null;
    invoice_number: string | null;
    purchase_date: string | null;
    notes: string | null;
    items: { inventory_item_id: string; quantity: number; unit_price: number; unit_id?: string | null }[];
  }) => api.put<Purchase>(`/inventory/purchases/${id}`, payload).then((r) => r.data),
};

export const inventoryApi = {
  list: () => api.get<InventoryItem[]>("/inventory/items").then((r) => r.data),
  create: (payload: InventoryItemPayload) => api.post<InventoryItem>("/inventory/items", payload).then((r) => r.data),
  update: (id: string, payload: InventoryItemPayload) =>
    api.put<InventoryItem>(`/inventory/items/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/inventory/items/${id}`).then((r) => r.data),
  movements: () => api.get<StockMovement[]>("/inventory/movements").then((r) => r.data),
  recordMovement: (payload: { inventory_item_id: string; qty_delta: number; reason: string; notes?: string }) =>
    api
      .post<InventoryItem>(`/inventory/items/${payload.inventory_item_id}/adjust`, {
        qty_delta: payload.qty_delta,
        reason: payload.reason,
        notes: payload.notes ?? null,
      })
      .then((r) => r.data),
};
