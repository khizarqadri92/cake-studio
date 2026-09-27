import { api } from "./client";

export type OrderStatus = "draft" | "confirmed" | "sent_to_baker" | "in_production" | "ready" | "rider_assigned" | "out_for_delivery" | "delivered" | "completed" | "cancelled";
export type FulfillmentType = "pickup" | "delivery";

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  delivery_date: string;
  total: number;
  baker_staff_id: string | null;
  baker_name: string | null;
  baker_accepted_at: string | null;
  decline_reason: string | null;
  rider_staff_id: string | null;
  rider_name: string | null;
  created_at: string;
}

export interface OrderItemAddonPayload {
  addon_id: string;
  quantity: number;
}

export interface OrderItemPayload {
  cake_flavor_id: string | null;
  cake_filling_id: string | null;
  cake_frosting_id: string | null;
  cake_shape_id: string | null;
  cake_size_id: string | null;
  theme_id: string | null;
  cake_box_id: string | null;
  cake_tier_id: string | null;
  cake_color_id: string | null;
  custom_message: string | null;
  special_instructions: string | null;
  is_customer_design: boolean;
  reference_image_url: string | null;
  quantity: number;
  addons: OrderItemAddonPayload[];
}

export interface OrderPayload {
  customer_id?: string;
  new_customer?: {
    full_name: string;
    phone: string;
    email?: string | null;
    address_line1?: string | null;
    city?: string | null;
    notes?: string | null;
  };
  branch_id?: string | null;
  fulfillment_type: FulfillmentType;
  delivery_zone_id?: string | null;
  delivery_address?: string | null;
  delivery_date: string;
  delivery_time?: string | null;
  discount: number;
  advance_paid: number;
  notes?: string | null;
  item: OrderItemPayload;
}

export interface OrderItemDetail extends OrderItemPayload {
  cake_flavor_name: string | null;
  cake_filling_name: string | null;
  cake_frosting_name: string | null;
  cake_shape_name: string | null;
  cake_size_name: string | null;
  theme_name: string | null;
  cake_box_name: string | null;
  cake_tier_name: string | null;
  cake_color_name: string | null;
  unit_price: number;
  line_total: number;
  addons: { addon_id: string; name: string | null; quantity: number; unit_price: number }[];
}

export interface OrderDetail {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  branch_id: string | null;
  status: OrderStatus;
  fulfillment_type: FulfillmentType;
  delivery_zone_id: string | null;
  delivery_address: string | null;
  delivery_date: string;
  delivery_time: string | null;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  advance_paid: number;
  notes: string | null;
  baker_staff_id: string | null;
  baker_name: string | null;
  baker_accepted_at: string | null;
  decline_reason: string | null;
  declined_at: string | null;
  declined_by_name: string | null;
  confirmed_at: string | null;
  sent_to_baker_at: string | null;
  business_date?: string | null;
  latest_print?: PrintJob | null;
  production_started_at: string | null;
  ready_at: string | null;
  rider_staff_id: string | null;
  rider_name: string | null;
  assigned_rider_at: string | null;
  delivery_started_at: string | null;
  delivered_at: string | null;
  rider_amount_collected: number | null;
  amount_received: number | null;
  handover_at: string | null;
  created_at: string;
  item: OrderItemDetail | null;
}

export interface PrintJob {
  id: string;
  reason: "confirmation" | "reprint" | "test";
  mode: "network" | "browser" | "unknown";
  status: "sent" | "failed" | "browser";
  error: string | null;
  printer: string | null;
  created_at: string;
}

export interface ReceiptResponse {
  receipt: {
    company: string; order_number: string; is_draft: boolean; customer_name: string; customer_phone: string;
    due: string; fulfillment: string; total: string; balance_due: string; currency: string;
  } & Record<string, unknown>;
  ticket_lines: [string, string][];
  ticket_width: number;
  whatsapp_phone: string | null;
  share_text: string;
  printer_mode: "browser" | "network" | "off";
}

export interface Baker {
  id: string;
  full_name: string;
  branch_id: string | null;
}

export interface Rider {
  id: string;
  full_name: string;
  branch_id: string | null;
}

export interface UnitOption {
  unit_id: string | null;
  abbreviation: string;
  to_item_unit: number; // 1 of this unit = this many of the ingredient's own stock unit
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  unit_options: UnitOption[];
  qty_on_hand: number;
  reorder_threshold: number;
}

export interface IngredientUsage {
  inventory_item_id: string;
  inventory_item_name: string;
  quantity_used: number;
  unit: string;
  entered_quantity: number | null;
  entered_unit: string | null;
  recorded_by?: string | null;
  recorded_at?: string | null;
  processing_date?: string | null;
  cost?: number | null;
}

export const ordersApi = {
  list: () => api.get<OrderListItem[]>("/orders").then((r) => r.data),
  get: (id: string) => api.get<OrderDetail>(`/orders/${id}`).then((r) => r.data),
  create: (payload: OrderPayload) => api.post<OrderDetail>("/orders", payload).then((r) => r.data),
  update: (id: string, payload: OrderPayload) => api.put<OrderDetail>(`/orders/${id}`, payload).then((r) => r.data),
  receipt: (id: string) => api.get<ReceiptResponse>(`/orders/${id}/receipt`).then((r) => r.data),
  kitchenTicket: (id: string) =>
    api.get<{ order_number: string; ticket_lines: [string, string][]; ticket_width: number; reference_image_url: string | null }>(`/orders/${id}/kitchen-ticket`).then((r) => r.data),
  kitchenTicketPdf: (id: string) => api.get<Blob>(`/orders/${id}/kitchen-ticket.pdf`, { responseType: "blob" }).then((r) => r.data),
  receiptPdf: (id: string) => api.get<Blob>(`/orders/${id}/receipt.pdf`, { responseType: "blob" }).then((r) => r.data),
  printTicket: (id: string) => api.post<PrintJob>(`/orders/${id}/print`).then((r) => r.data),
  confirm: (id: string) => api.put<OrderDetail>(`/orders/${id}/confirm`).then((r) => r.data),
  sendToBaker: (id: string, bakerStaffId: string) =>
    api.put<OrderDetail>(`/orders/${id}/send-to-baker`, { baker_staff_id: bakerStaffId }).then((r) => r.data),
  cancel: (id: string) => api.put<OrderDetail>(`/orders/${id}/cancel`).then((r) => r.data),
  availableBakers: () => api.get<Baker[]>("/orders/staff/available-bakers").then((r) => r.data),
  availableRiders: () => api.get<Rider[]>("/orders/staff/available-riders").then((r) => r.data),
  inventoryItems: () => api.get<InventoryItem[]>("/inventory/items/for-baking").then((r) => r.data),
  ingredientUsage: (id: string) => api.get<IngredientUsage[]>(`/orders/${id}/ingredient-usage`).then((r) => r.data),
  acceptBaking: (id: string) => api.put<OrderDetail>(`/orders/${id}/accept-baking`).then((r) => r.data),
  declineBaking: (id: string, reason: string) =>
    api.put<OrderDetail>(`/orders/${id}/decline-baking`, { reason }).then((r) => r.data),
  startBaking: (id: string, ingredients: { inventory_item_id: string; quantity_used: number; unit_id: string | null }[]) =>
    api.put<OrderDetail>(`/orders/${id}/start-baking`, { ingredients }).then((r) => r.data),
  markReady: (id: string) => api.put<OrderDetail>(`/orders/${id}/mark-ready`).then((r) => r.data),
  assignRider: (id: string, riderStaffId: string) =>
    api.put<OrderDetail>(`/orders/${id}/assign-rider`, { rider_staff_id: riderStaffId }).then((r) => r.data),
  startDelivery: (id: string) => api.put<OrderDetail>(`/orders/${id}/start-delivery`).then((r) => r.data),
  markDelivered: (id: string, amountCollected: number) =>
    api.put<OrderDetail>(`/orders/${id}/mark-delivered`, { amount_collected: amountCollected }).then((r) => r.data),
  handover: (id: string, amountReceived: number) =>
    api.put<OrderDetail>(`/orders/${id}/handover`, { amount_received: amountReceived }).then((r) => r.data),
  uploadReferenceImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/orders/upload-reference-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.url);
  },
};
