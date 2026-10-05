import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ordersApi, OrderListItem, OrderPayload, OrderStatus, OrderDetail, PrintJob, Baker, Rider, InventoryItem, IngredientUsage } from "../../api/orders";
import { mediaUrl } from "../../api/client";
import { customersApi, Customer } from "../../api/customers";
import { createCatalogApi, CatalogItem } from "../../api/catalog";
import { deliveryZonesApi, DeliveryZone } from "../../api/delivery";
import { Can } from "../../components/Can";
import { fmtAmount, fmtQty, amountInputValue, fmtTime } from "../../lib/format";
import { TimeSelect } from "../../components/TimeSelect";
import { OrderJourneyPanel, STATUS_TONE } from "../../components/OrderJourneyPanel";
import { ReceiptModal, ReceiptContext } from "../../components/ReceiptModal";
import { notify } from "../../store/toastStore";
import { KitchenTicketModal } from "../../components/KitchenTicketModal";
import { printTicketInBrowser } from "../../lib/printTicket";
import { Receipt, Printer, ChefHat, Wheat } from "lucide-react";
import { api } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useAuthStore } from "../../store/authStore";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

interface IngredientRow {
  inventory_item_id: string;
  quantity_used: string;
  unit_id: string | null; // null = the ingredient's own stock unit
}

const emptyIngredientRow = (): IngredientRow => ({ inventory_item_id: "", quantity_used: "", unit_id: null });

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  sent_to_baker: "Sent to baker",
  in_production: "Baking",
  ready: "Ready",
  rider_assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered · cash pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = STATUS_TONE;

type TabKey = "all" | "active" | "kitchen" | "road" | "cash" | "done";
const TABS: { key: TabKey; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "active", label: "Active", statuses: ["draft", "confirmed", "sent_to_baker", "in_production", "ready", "rider_assigned", "out_for_delivery", "delivered"] },
  { key: "kitchen", label: "In the kitchen", statuses: ["sent_to_baker", "in_production"] },
  { key: "road", label: "On the road", statuses: ["rider_assigned", "out_for_delivery"] },
  { key: "cash", label: "Cash pending", statuses: ["delivered"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
  { key: "all", label: "All", statuses: null },
];

const catalogApis = {
  flavors: createCatalogApi("/catalog/cake-flavors"),
  fillings: createCatalogApi("/catalog/cake-fillings"),
  frostings: createCatalogApi("/catalog/cake-frostings"),
  shapes: createCatalogApi("/catalog/cake-shapes"),
  sizes: createCatalogApi("/catalog/cake-sizes"),
  themes: createCatalogApi("/catalog/themes"),
  addons: createCatalogApi("/catalog/cake-addons"),
  boxes: createCatalogApi("/catalog/cake-boxes"),
  tiers: createCatalogApi("/catalog/cake-tiers"),
  colors: createCatalogApi("/catalog/cake-colors"),
};

interface Catalogs {
  flavors: CatalogItem[];
  fillings: CatalogItem[];
  frostings: CatalogItem[];
  shapes: CatalogItem[];
  sizes: CatalogItem[];
  themes: CatalogItem[];
  addons: CatalogItem[];
  boxes: CatalogItem[];
  tiers: CatalogItem[];
  colors: CatalogItem[];
}

function emptyForm(): OrderPayload {
  return {
    fulfillment_type: "pickup",
    delivery_date: new Date().toISOString().slice(0, 10),
    discount: 0,
    advance_paid: 0,
    item: {
      cake_flavor_id: null, cake_filling_id: null, cake_frosting_id: null, cake_shape_id: null,
      cake_size_id: null, theme_id: null, cake_box_id: null, cake_tier_id: null, cake_color_id: null,
      custom_message: null, special_instructions: null, quantity: 1, addons: [],
      is_customer_design: false, reference_image_url: null,
    },
  };
}

export function OrdersPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const currentStaffId = useAuthStore((s) => s.staff?.id);
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [catalogs, setCatalogs] = useState<Catalogs | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrderPayload>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // customer search / selection
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ full_name: "", phone: "", email: "", address_line1: "", city: "" });

  // review-then-confirm popup
  const [confirmOrder, setConfirmOrder] = useState<OrderDetail | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  // Baker's accept/decline step on an assigned order
  const [declineMode, setDeclineMode] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [respondSaving, setRespondSaving] = useState(false);
  const [respondError, setRespondError] = useState<string | null>(null);

  // send-to-baker popup
  const [bakerPickerOrderId, setBakerPickerOrderId] = useState<string | null>(null);
  const [bakers, setBakers] = useState<Baker[]>([]);
  const [selectedBakerId, setSelectedBakerId] = useState("");
  const [bakerSaving, setBakerSaving] = useState(false);
  const [bakerError, setBakerError] = useState<string | null>(null);

  // Start baking - baker logs ingredient usage before production begins
  const [bakingOrderId, setBakingOrderId] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);
  const [bakingSaving, setBakingSaving] = useState(false);
  const [bakingError, setBakingError] = useState<string | null>(null);

  // Mark ready
  const [markingReadyId, setMarkingReadyId] = useState<string | null>(null);

  // Assign rider (delivery orders only)
  const [riderPickerOrderId, setRiderPickerOrderId] = useState<string | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [riderSaving, setRiderSaving] = useState(false);
  const [riderError, setRiderError] = useState<string | null>(null);

  // Handover - pickup direct from READY, or after delivery from OUT_FOR_DELIVERY
  const [handoverOrderId, setHandoverOrderId] = useState<string | null>(null);
  const [handoverOrder, setHandoverOrder] = useState<OrderDetail | null>(null);
  // Rider's own delivery actions
  const [startingDeliveryId, setStartingDeliveryId] = useState<string | null>(null);
  const [deliverOrder, setDeliverOrder] = useState<OrderDetail | null>(null);
  const [amountCollected, setAmountCollected] = useState("");
  const [deliverSaving, setDeliverSaving] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [handoverSaving, setHandoverSaving] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);

  // Viewing ingredient usage on an already-baking/completed order
  const [viewingUsageOrderId, setViewingUsageOrderId] = useState<string | null>(null);
  const [usageRows, setUsageRows] = useState<IngredientUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [catalogsLoaded, setCatalogsLoaded] = useState(false);

  const loadOrders = () => ordersApi.list().then(setOrders);

  // --- list view: selected order (journey panel), filter tab, business date ---
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptFor, setReceiptFor] = useState<{ id: string; context: ReceiptContext; riderName?: string } | null>(null);
  const [ticketFor, setTicketFor] = useState<string | null>(null);
  const [printNotice, setPrintNotice] = useState<{ tone: "ok" | "error" | "info"; text: string; orderId?: string } | null>(null);
  const [reprintingId, setReprintingId] = useState<string | null>(null);

  // Turns a print result into a notice; in browser mode it also opens the print dialog.
  const handlePrintResult = async (orderId: string, orderNumber: string, job: PrintJob | null | undefined, confirmed: boolean) => {
    const lead = confirmed ? `${orderNumber} confirmed.` : `${orderNumber}:`;
    if (!job) {
      setPrintNotice({ tone: "info", text: `${lead} Automatic kitchen printing is off (System setup).`, orderId });
      return;
    }
    if (job.status === "sent") {
      setPrintNotice({ tone: "ok", text: `${lead} Kitchen ticket sent to the printer${job.printer ? ` (${job.printer})` : ""}.` });
    } else if (job.status === "failed") {
      setPrintNotice({ tone: "error", text: `${lead} The kitchen ticket didn't print: ${job.error ?? "unknown error"}`, orderId });
    } else {
      try {
        const r = await ordersApi.receipt(orderId);
        await printTicketInBrowser(r.ticket_lines, r.ticket_width);
        setPrintNotice({ tone: "ok", text: `${lead} Kitchen ticket opened for printing.` });
      } catch {
        setPrintNotice({ tone: "error", text: `${lead} Couldn't open the kitchen ticket for printing.`, orderId });
      }
    }
  };

  const doReprint = async (orderId: string, orderNumber: string) => {
    setReprintingId(orderId);
    try {
      const job = await ordersApi.printTicket(orderId);
      await handlePrintResult(orderId, orderNumber, job, false);
      await loadOrders();
    } catch (err: any) {
      setPrintNotice({ tone: "error", text: err?.response?.data?.detail ?? "Couldn't reprint the kitchen ticket.", orderId });
    } finally {
      setReprintingId(null);
    }
  };
  const [selectedDetail, setSelectedDetail] = useState<OrderDetail | null>(null);
  const [tab, setTab] = useState<TabKey>("active");
  const [businessDate, setBusinessDate] = useState<string | null>(null);

  useEffect(() => {
    api.get("/system/processing-date").then((r) => setBusinessDate(r.data.processing_date)).catch(() => {});
  }, []);

  // Reload the panel whenever the selection changes or the list refreshes
  // (e.g. right after an action), so the journey is never stale.
  useEffect(() => {
    if (!selectedId) { setSelectedDetail(null); return; }
    let live = true;
    ordersApi.get(selectedId).then((d) => live && setSelectedDetail(d)).catch(() => live && setSelectedDetail(null));
    return () => { live = false; };
  }, [selectedId, orders]);

  const counts = useMemo(() => {
    const c = {} as Record<TabKey, number>;
    TABS.forEach((t) => { c[t.key] = orders.filter((o) => t.statuses === null || t.statuses.includes(o.status)).length; });
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    return t.statuses === null ? orders : orders.filter((o) => t.statuses!.includes(o.status));
  }, [orders, tab]);

  const tiles = useMemo(() => {
    const open = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
    const dueToday = businessDate ? open.filter((o) => o.delivery_date === businessDate) : [];
    const kitchen = orders.filter((o) => o.status === "sent_to_baker" || o.status === "in_production");
    const road = orders.filter((o) => o.status === "rider_assigned" || o.status === "out_for_delivery");
    const cash = orders.filter((o) => o.status === "delivered");
    const names = Array.from(new Set(road.map((o) => o.rider_name).filter(Boolean))) as string[];
    return [
      { label: "Due today", value: businessDate ? String(dueToday.length) : "—",
        note: `${dueToday.filter((o) => o.fulfillment_type === "delivery").length} delivery, ${dueToday.filter((o) => o.fulfillment_type === "pickup").length} pickup` },
      { label: "In the kitchen", value: String(kitchen.length),
        note: `${kitchen.filter((o) => o.status === "in_production").length} baking, ${kitchen.filter((o) => o.status === "sent_to_baker").length} with baker` },
      { label: "On the road", value: String(road.length), note: names.length ? names.join(", ") : "No riders out" },
      { label: "Cash with riders", value: String(cash.length), note: cash.length === 1 ? "order to close" : "orders to close" },
    ];
  }, [orders, businessDate]);

  const formatDue = (iso: string) => {
    if (businessDate && iso === businessDate) return "Today";
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  };

  // Deferred: a viewer who can only see the order list (e.g. a baker) never
  // needs the create/edit form's dropdown data, so this only fetches once,
  // the first time openAdd() or openEdit() is actually used.
  const ensureCatalogsLoaded = async () => {
    if (catalogsLoaded) return;
    const [flavors, fillings, frostings, shapes, sizes, themes, addons, boxes, tiers, colors, zoneList] = await Promise.all([
      catalogApis.flavors.list(), catalogApis.fillings.list(), catalogApis.frostings.list(),
      catalogApis.shapes.list(), catalogApis.sizes.list(), catalogApis.themes.list(),
      catalogApis.addons.list(), catalogApis.boxes.list(), catalogApis.tiers.list(), catalogApis.colors.list(), deliveryZonesApi.list(),
    ]);
    setCatalogs({ flavors, fillings, frostings, shapes, sizes, themes, addons, boxes, tiers, colors });
    setZones(zoneList);
    setCatalogsLoaded(true);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const handle = setTimeout(() => {
      customersApi.search(customerQuery.trim()).then(setCustomerResults);
    }, 250);
    return () => clearTimeout(handle);
  }, [customerQuery]);

  const resetCustomerPicker = () => {
    setSelectedCustomer(null);
    setAddingNewCustomer(false);
    setCustomerQuery("");
    setCustomerResults([]);
    setNewCustomer({ full_name: "", phone: "", email: "", address_line1: "", city: "" });
  };

  const openAdd = async () => {
    try {
      await ensureCatalogsLoaded();
    } catch (err: any) {
      notify(`Couldn't open the order form: ${err?.response?.data?.detail ?? "the cake options didn't load"}. Ask an administrator to check your permissions.`, "error");
      return;
    }
    setEditingId(null);
    setForm(emptyForm());
    resetCustomerPicker();
    setError(null);
    setModalOpen(true);
  };

  const openEdit = async (orderId: string) => {
    let detail;
    try {
      await ensureCatalogsLoaded();
      detail = await ordersApi.get(orderId);
    } catch (err: any) {
      notify(`Couldn't open this order for editing: ${err?.response?.data?.detail ?? "it didn't load"}.`, "error");
      return;
    }
    setEditingId(orderId);
    setForm({
      customer_id: detail.customer_id,
      branch_id: detail.branch_id ?? undefined,
      fulfillment_type: detail.fulfillment_type,
      delivery_zone_id: detail.delivery_zone_id ?? undefined,
      delivery_address: detail.delivery_address ?? undefined,
      delivery_date: detail.delivery_date,
      delivery_time: detail.delivery_time ?? undefined,
      discount: detail.discount,
      advance_paid: detail.advance_paid,
      notes: detail.notes ?? undefined,
      item: detail.item
        ? {
            cake_flavor_id: detail.item.cake_flavor_id, cake_filling_id: detail.item.cake_filling_id,
            cake_frosting_id: detail.item.cake_frosting_id, cake_shape_id: detail.item.cake_shape_id,
            cake_size_id: detail.item.cake_size_id, theme_id: detail.item.theme_id, cake_box_id: detail.item.cake_box_id,
            cake_tier_id: detail.item.cake_tier_id, cake_color_id: detail.item.cake_color_id,
            custom_message: detail.item.custom_message, special_instructions: detail.item.special_instructions,
            quantity: detail.item.quantity,
            addons: detail.item.addons.map((a) => ({ addon_id: a.addon_id, quantity: a.quantity })),
            is_customer_design: detail.item.is_customer_design,
            reference_image_url: detail.item.reference_image_url,
          }
        : emptyForm().item,
    });
    setSelectedCustomer({
      id: detail.customer_id, full_name: detail.customer_name, phone: detail.customer_phone,
      email: null, address_line1: null, city: null, notes: null,
    });
    setAddingNewCustomer(false);
    setError(null);
    setModalOpen(true);
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setAddingNewCustomer(false);
    setCustomerQuery("");
    setCustomerResults([]);
  };

  const startNewCustomer = () => {
    setAddingNewCustomer(true);
    setSelectedCustomer(null);
    setNewCustomer((prev) => ({ ...prev, full_name: /^\d+$/.test(customerQuery) ? "" : customerQuery, phone: /^\d+$/.test(customerQuery) ? customerQuery : "" }));
    setCustomerResults([]);
  };

  const setItem = (patch: Partial<OrderPayload["item"]>) => setForm({ ...form, item: { ...form.item, ...patch } });

  const toggleAddon = (addonId: string, maxQty: number) => {
    const exists = form.item.addons.find((a) => a.addon_id === addonId);
    if (exists) {
      setItem({ addons: form.item.addons.filter((a) => a.addon_id !== addonId) });
    } else {
      setItem({ addons: [...form.item.addons, { addon_id: addonId, quantity: 1 }] });
    }
  };

  const setAddonQty = (addonId: string, qty: number) => {
    setItem({ addons: form.item.addons.map((a) => (a.addon_id === addonId ? { ...a, quantity: qty } : a)) });
  };

  // client-side price preview only - the real numbers are computed and saved server-side
  const pricePreview = useMemo(() => {
    if (!catalogs) return { unit: 0, addonsTotal: 0, lineTotal: 0, delivery: 0, total: 0 };
    const findPrice = (list: CatalogItem[], id: string | null) => {
      const found = list.find((c) => c.id === id);
      return found ? found.price_modifier ?? found.price ?? 0 : 0;
    };
    const unit =
      findPrice(catalogs.flavors, form.item.cake_flavor_id) +
      findPrice(catalogs.fillings, form.item.cake_filling_id) +
      findPrice(catalogs.frostings, form.item.cake_frosting_id) +
      findPrice(catalogs.shapes, form.item.cake_shape_id) +
      findPrice(catalogs.sizes, form.item.cake_size_id) +
      findPrice(catalogs.boxes, form.item.cake_box_id) +
      findPrice(catalogs.tiers, form.item.cake_tier_id) +
      findPrice(catalogs.colors, form.item.cake_color_id);
    const addonsTotal = form.item.addons.reduce((sum, a) => {
      const addon = catalogs.addons.find((c) => c.id === a.addon_id);
      return sum + (addon?.price ?? 0) * a.quantity;
    }, 0);
    const lineTotal = unit * form.item.quantity + addonsTotal;
    const delivery = form.fulfillment_type === "delivery" ? zones.find((z) => z.id === form.delivery_zone_id)?.price ?? 0 : 0;
    const total = lineTotal + delivery - (form.discount || 0);
    return { unit, addonsTotal, lineTotal, delivery, total };
  }, [catalogs, form, zones]);

  const save = async () => {
    setError(null);
    if (uploadingImage) {
      setError("The design image is still uploading - wait for it to finish before saving.");
      return;
    }
    if (!selectedCustomer && !addingNewCustomer) {
      setError("Search for a customer or add a new one.");
      return;
    }
    if (addingNewCustomer && (!newCustomer.full_name || !newCustomer.phone)) {
      setError("New customer needs at least a name and phone number.");
      return;
    }
    setSaving(true);
    try {
      const payload: OrderPayload = {
        ...form,
        customer_id: selectedCustomer?.id,
        new_customer: addingNewCustomer
          ? { full_name: newCustomer.full_name, phone: newCustomer.phone, email: newCustomer.email || null, address_line1: newCustomer.address_line1 || null, city: newCustomer.city || null }
          : undefined,
      };
      if (editingId) {
        await ordersApi.update(editingId, payload);
      } else {
        const created = await ordersApi.create(payload);
        setReceiptFor({ id: created.id, context: "saved" });
      }
      setModalOpen(false);
      await loadOrders();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(", ") : detail ?? "Couldn't save order.");
    } finally {
      setSaving(false);
    }
  };

  const openConfirmReview = async (orderId: string) => {
    const detail = await ordersApi.get(orderId);
    setDeclineMode(false);
    setDeclineReason("");
    setRespondError(null);
    setConfirmOrder(detail);
  };

  const doAcceptBaking = async () => {
    if (!confirmOrder) return;
    setRespondSaving(true);
    setRespondError(null);
    try {
      await ordersApi.acceptBaking(confirmOrder.id);
      setConfirmOrder(null);
      await loadOrders();
    } catch (err: any) {
      setRespondError(err?.response?.data?.detail ?? "Couldn't accept this order.");
    } finally {
      setRespondSaving(false);
    }
  };

  const doDeclineBaking = async () => {
    if (!confirmOrder) return;
    if (!declineReason.trim()) {
      setRespondError("Please enter a reason for declining.");
      return;
    }
    setRespondSaving(true);
    setRespondError(null);
    try {
      await ordersApi.declineBaking(confirmOrder.id, declineReason.trim());
      setConfirmOrder(null);
      await loadOrders();
    } catch (err: any) {
      setRespondError(err?.response?.data?.detail ?? "Couldn't decline this order.");
    } finally {
      setRespondSaving(false);
    }
  };

  const doConfirm = async () => {
    if (!confirmOrder) return;
    setConfirmSaving(true);
    try {
      const confirmed = await ordersApi.confirm(confirmOrder.id);
      setConfirmOrder(null);
      await loadOrders();
      await handlePrintResult(confirmed.id, confirmed.order_number, confirmed.latest_print, true);
    } finally {
      setConfirmSaving(false);
    }
  };

  const openBakerPicker = async (orderId: string) => {
    setBakerPickerOrderId(orderId);
    setSelectedBakerId("");
    setBakerError(null);
    const list = await ordersApi.availableBakers();
    setBakers(list);
  };

  const doSendToBaker = async () => {
    if (!bakerPickerOrderId || !selectedBakerId) {
      setBakerError("Select a baker first.");
      return;
    }
    setBakerSaving(true);
    setBakerError(null);
    try {
      await ordersApi.sendToBaker(bakerPickerOrderId, selectedBakerId);
      setBakerPickerOrderId(null);
      await loadOrders();
    } catch (err: any) {
      setBakerError(err?.response?.data?.detail ?? "Couldn't send to baker.");
    } finally {
      setBakerSaving(false);
    }
  };

  const activeOptions = (list: CatalogItem[]) => list.filter((c) => c.is_active);

  // --- Start baking: baker logs ingredient usage, order moves to in_production ---
  const openBakingModal = async (orderId: string) => {
    setBakingOrderId(orderId);
    setIngredientRows([emptyIngredientRow()]);
    setBakingError(null);
    // Reload every time so stock-on-hand figures are current, not cached
    // from whenever the popup was first opened.
    setIngredientsLoading(true);
    setIngredientsError(null);
    try {
      setInventoryItems(await ordersApi.inventoryItems());
    } catch (err: any) {
      setInventoryItems([]);
      setIngredientsError(err?.response?.data?.detail ?? "Couldn't load the ingredient list.");
    } finally {
      setIngredientsLoading(false);
    }
  };

  const addIngredientRow = () => setIngredientRows([...ingredientRows, emptyIngredientRow()]);
  const removeIngredientRow = (index: number) => setIngredientRows(ingredientRows.filter((_, i) => i !== index));
  const updateIngredientRow = (index: number, patch: Partial<IngredientRow>) =>
    setIngredientRows(ingredientRows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const doStartBaking = async () => {
    if (!bakingOrderId) return;
    const usable = ingredientRows.filter((r) => r.inventory_item_id && Number(r.quantity_used) > 0);
    setBakingSaving(true);
    setBakingError(null);
    try {
      await ordersApi.startBaking(
        bakingOrderId,
        usable.map((r) => ({ inventory_item_id: r.inventory_item_id, quantity_used: Number(r.quantity_used), unit_id: r.unit_id }))
      );
      setBakingOrderId(null);
      await loadOrders();
    } catch (err: any) {
      setBakingError(err?.response?.data?.detail ?? "Couldn't start baking.");
    } finally {
      setBakingSaving(false);
    }
  };

  // --- Mark ready: no extra input needed, just confirm the transition ---
  const doMarkReady = async (orderId: string) => {
    setMarkingReadyId(orderId);
    try {
      await ordersApi.markReady(orderId);
      await loadOrders();
    } finally {
      setMarkingReadyId(null);
    }
  };

  // --- Assign rider: delivery orders only, ready -> out_for_delivery ---
  const openRiderPicker = async (orderId: string) => {
    setRiderPickerOrderId(orderId);
    setSelectedRiderId("");
    setRiderError(null);
    setRiders([]);
    try {
      setRiders(await ordersApi.availableRiders());
    } catch (err: any) {
      setRiderError(err?.response?.data?.detail ?? "Couldn't load the rider list.");
    }
  };

  const doAssignRider = async () => {
    if (!riderPickerOrderId || !selectedRiderId) {
      setRiderError("Select a rider first.");
      return;
    }
    setRiderSaving(true);
    setRiderError(null);
    try {
      const assignedId = riderPickerOrderId;
      await ordersApi.assignRider(assignedId, selectedRiderId);
      setRiderPickerOrderId(null);
      await loadOrders();
      setReceiptFor({ id: assignedId, context: "rider", riderName: riders.find((r) => r.id === selectedRiderId)?.full_name });
    } catch (err: any) {
      setRiderError(err?.response?.data?.detail ?? "Couldn't assign rider.");
    } finally {
      setRiderSaving(false);
    }
  };

  // --- Handover: pickup goes straight from READY, delivery goes from OUT_FOR_DELIVERY ---
  const doStartDelivery = async (orderId: string) => {
    setStartingDeliveryId(orderId);
    try {
      await ordersApi.startDelivery(orderId);
      await loadOrders();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't start this delivery.");
    } finally {
      setStartingDeliveryId(null);
    }
  };

  const openDeliverModal = async (orderId: string) => {
    setDeliverOrder(null);
    setAmountCollected("");
    setDeliverError(null);
    try {
      const detail = await ordersApi.get(orderId);
      setDeliverOrder(detail);
      setAmountCollected(amountInputValue(Math.max(detail.total - detail.advance_paid, 0)));
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "Couldn't load this order.");
    }
  };

  const doMarkDelivered = async () => {
    if (!deliverOrder) return;
    const amount = Number(amountCollected);
    if (amountCollected === "" || Number.isNaN(amount) || amount < 0) {
      setDeliverError("Enter the amount you collected from the customer.");
      return;
    }
    setDeliverSaving(true);
    setDeliverError(null);
    try {
      const deliveredId = deliverOrder.id;
      await ordersApi.markDelivered(deliveredId, amount);
      setDeliverOrder(null);
      await loadOrders();
      setReceiptFor({ id: deliveredId, context: "paid" });
    } catch (err: any) {
      setDeliverError(err?.response?.data?.detail ?? "Couldn't mark this order delivered.");
    } finally {
      setDeliverSaving(false);
    }
  };

  const openHandoverModal = async (orderId: string) => {
    setHandoverOrderId(orderId);
    setHandoverOrder(null);
    setAmountReceived("");
    setHandoverError(null);
    try {
      const detail = await ordersApi.get(orderId);
      setHandoverOrder(detail);
      // Delivery: pre-fill with what the rider says he collected. Pickup: what's still owed.
      // Either way staff can change it to what they actually received.
      const expected =
        detail.fulfillment_type === "delivery" && detail.rider_amount_collected != null
          ? detail.rider_amount_collected
          : Math.max(detail.total - detail.advance_paid, 0);
      setAmountReceived(amountInputValue(expected));
    } catch (err: any) {
      setHandoverError(err?.response?.data?.detail ?? "Couldn't load this order's amounts.");
    }
  };

  const doHandover = async () => {
    if (!handoverOrderId) return;
    const amount = Number(amountReceived);
    if (!amountReceived || amount < 0) {
      setHandoverError("Enter the amount received.");
      return;
    }
    setHandoverSaving(true);
    setHandoverError(null);
    try {
      const handedId = handoverOrderId;
      await ordersApi.handover(handedId, amount);
      setHandoverOrderId(null);
      await loadOrders();
      setReceiptFor({ id: handedId, context: "paid" });
    } catch (err: any) {
      setHandoverError(err?.response?.data?.detail ?? "Couldn't complete handover.");
    } finally {
      setHandoverSaving(false);
    }
  };

  // --- View ingredient usage (read-only, for orders already baking or beyond) ---
  const openUsageView = async (orderId: string) => {
    setViewingUsageOrderId(orderId);
    setUsageRows([]);
    setUsageLoading(true);
    setUsageError(null);
    try {
      setUsageRows(await ordersApi.ingredientUsage(orderId));
    } catch (err: any) {
      setUsageError(err?.response?.data?.detail ?? "Couldn't load the ingredients for this order.");
    } finally {
      setUsageLoading(false);
    }
  };
  const usageOrder = viewingUsageOrderId ? orders.find((x) => x.id === viewingUsageOrderId) : undefined;
  const canSeeCost = hasPermission("reports.profit.view");

  // Next-step buttons for an order. Used in its table row and in the journey panel,
  // so both always show exactly the same, permission-checked actions.
  const renderActions = (o: OrderListItem) => (
    <div className="cs-actions flex flex-wrap gap-2 items-center justify-end rtl:justify-start">
      {(["in_production", "ready", "rider_assigned", "out_for_delivery", "delivered", "completed"] as OrderStatus[]).includes(o.status) && (
        <button onClick={() => openUsageView(o.id)} className="text-xs text-plum underline">Ingredients used</button>
      )}
      {o.baker_staff_id === currentStaffId && !!o.baker_accepted_at && (o.status === "sent_to_baker" || o.status === "in_production") && (
        <button onClick={() => setTicketFor(o.id)} className="text-xs text-plum underline">Kitchen ticket</button>
      )}
              {o.status === "draft" && (
                <>
                  <Can permission="orders.field.edit">
                    <button onClick={() => openEdit(o.id)} className="text-xs text-plum underline">Edit</button>
                  </Can>
                  <Can permission="orders.button.confirm">
                    <button onClick={() => openConfirmReview(o.id)} className="text-xs bg-plum text-cream px-2 py-1 rounded">
                      Confirm order
                    </button>
                  </Can>
                </>
              )}
              {o.status === "confirmed" && o.decline_reason && (
                <span className="text-xs text-plum" title={o.decline_reason}>Declined by baker</span>
              )}
              {o.status === "confirmed" && (
                <Can permission="orders.button.send_to_baker">
                  <button onClick={() => openBakerPicker(o.id)} className="text-xs bg-honey text-ink px-2 py-1 rounded">
                    Send to baker
                  </button>
                </Can>
              )}
              {o.status === "sent_to_baker" && o.baker_staff_id === currentStaffId && !o.baker_accepted_at && (
                <Can permission="orders.button.accept_baking">
                  <button onClick={() => openConfirmReview(o.id)} className="text-xs bg-honey text-ink px-2 py-1 rounded">
                    Review &amp; respond
                  </button>
                  <button onClick={() => setTicketFor(o.id)} className="text-xs text-plum underline">Kitchen ticket</button>
                </Can>
              )}
              {o.status === "sent_to_baker" && o.baker_staff_id !== currentStaffId && (
                <span className="text-xs text-muted">
                  {o.baker_accepted_at ? "Accepted by baker" : "Awaiting baker"}
                </span>
              )}
              {o.status === "sent_to_baker" && o.baker_staff_id === currentStaffId && o.baker_accepted_at && (
                <Can permission="orders.button.start_baking">
                  <button onClick={() => openBakingModal(o.id)} className="text-xs bg-plum text-cream px-2 py-1 rounded">
                    Start baking
                  </button>
                </Can>
              )}
              {o.status === "in_production" && (
                <>
                  {o.baker_staff_id === currentStaffId && (
                    <Can permission="orders.button.mark_ready">
                      <button
                        onClick={() => doMarkReady(o.id)}
                        disabled={markingReadyId === o.id}
                        className="text-xs bg-sage text-cream px-2 py-1 rounded disabled:opacity-50"
                      >
                        {markingReadyId === o.id ? "Marking…" : "Mark ready"}
                      </button>
                    </Can>
                  )}
                </>
              )}
              {o.status === "ready" && o.fulfillment_type === "delivery" && (
                <Can permission="orders.button.assign_rider">
                  <button onClick={() => openRiderPicker(o.id)} className="text-xs bg-honey text-ink px-2 py-1 rounded">
                    Assign rider
                  </button>
                </Can>
              )}
              {o.status === "ready" && o.fulfillment_type === "pickup" && (
                <Can permission="orders.button.handover">
                  <button onClick={() => openHandoverModal(o.id)} className="text-xs bg-sage text-cream px-2 py-1 rounded">
                    Pickup done
                  </button>
                </Can>
              )}
              {o.status === "rider_assigned" && o.rider_staff_id === currentStaffId && (
                <Can permission="orders.button.start_delivery">
                  <button
                    onClick={() => doStartDelivery(o.id)}
                    disabled={startingDeliveryId === o.id}
                    className="text-xs bg-plum text-cream px-2 py-1 rounded disabled:opacity-50"
                  >
                    {startingDeliveryId === o.id ? "Starting…" : "Start delivery"}
                  </button>
                </Can>
              )}
              {o.status === "rider_assigned" && o.rider_staff_id !== currentStaffId && (
                <>
                  <span className="text-xs text-muted">Waiting for rider</span>
                  <Can permission="orders.button.assign_rider">
                    <button onClick={() => openRiderPicker(o.id)} className="text-xs text-plum underline">Change rider</button>
                  </Can>
                </>
              )}
              {o.status === "out_for_delivery" && o.rider_staff_id === currentStaffId && (
                <Can permission="orders.button.mark_delivered">
                  <button onClick={() => openDeliverModal(o.id)} className="text-xs bg-sage text-cream px-2 py-1 rounded">
                    Mark delivered
                  </button>
                </Can>
              )}
              {o.status === "out_for_delivery" && o.rider_staff_id !== currentStaffId && (
                <span className="text-xs text-muted">On the way</span>
              )}
              {o.status === "delivered" && (
                <Can permission="orders.button.handover">
                  <button onClick={() => openHandoverModal(o.id)} className="text-xs bg-sage text-cream px-2 py-1 rounded">
                    Mark complete
                  </button>
                </Can>
              )}
    </div>
  );

  const statusLabel = (st: OrderStatus) => STATUS_LABELS[st];
  const listItem = selectedId ? orders.find((o) => o.id === selectedId) : undefined;

  return (
    <Can permission="orders.page.view">
      <div className="flex flex-col xl:flex-row min-h-full">
      <div className="flex-1 min-w-0 px-6 lg:px-10 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1>Orders</h1>
            <p className="text-[15px] text-muted mt-1.5">Click an order to follow its journey.</p>
          </div>
          <Can permission="orders.button.create">
            <button onClick={openAdd} className="h-12 flex items-center gap-2 bg-plum text-cream px-5 rounded-xl text-[15px] font-bold">
              <Plus size={18} /> New order
            </button>
          </Can>
        </div>

        {printNotice && (
          <div
            role="status"
            className={`flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 text-sm ${
              printNotice.tone === "error"
                ? "border-plum/30 bg-plum/5 text-ink"
                : printNotice.tone === "ok"
                ? "border-sage/40 bg-sage/10 text-ink"
                : "border-hairline bg-surface text-ink"
            }`}
          >
            <Printer size={18} className={printNotice.tone === "error" ? "text-plum" : "text-muted"} />
            <span className="flex-1 min-w-[12rem]">{printNotice.text}</span>
            {printNotice.tone === "error" && printNotice.orderId && (
              <Can permission="orders.button.print">
                <button
                  onClick={() => {
                    const o = orders.find((x) => x.id === printNotice.orderId);
                    doReprint(printNotice.orderId!, o?.order_number ?? "");
                  }}
                  disabled={reprintingId === printNotice.orderId}
                  className="h-9 px-4 rounded-xl bg-plum text-cream text-sm font-bold disabled:opacity-50"
                >
                  {reprintingId === printNotice.orderId ? "Printing…" : "Reprint"}
                </button>
              </Can>
            )}
            <button onClick={() => setPrintNotice(null)} className="text-muted hover:text-ink text-sm underline underline-offset-2">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="bg-surface border border-hairline rounded-2xl px-5 py-4">
              <p className="text-[13px] text-muted">{tile.label}</p>
              <p className="font-display text-[30px] leading-tight font-semibold text-ink mt-0.5">{tile.value}</p>
              <p className="text-xs text-muted mt-0.5">{tile.note}</p>
            </div>
          ))}
        </div>

        <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
          <div className="flex gap-2 px-4 py-3 border-b border-hairline overflow-x-auto" role="tablist" aria-label="Filter orders">
            {TABS.map((tb) => (
              <button
                key={tb.key}
                role="tab"
                aria-selected={tab === tb.key}
                onClick={() => setTab(tb.key)}
                className={`h-9 px-4 rounded-full text-[13px] border transition-colors whitespace-nowrap shrink-0 ${
                  tab === tb.key ? "bg-plum border-plum text-cream font-semibold" : "bg-surface border-hairline text-ink/80 hover:bg-flour"
                }`}
              >
                {tb.label} <span className={tab === tb.key ? "text-cream/80" : "text-muted"}>{counts[tb.key]}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
          <table className="cs-plain w-full text-sm">
            <thead>
              <tr className="text-left rtl:text-right">
                <th className="px-5">Order</th>
                <th className="px-3">Customer</th>
                <th className="px-3">Due</th>
                <th className={`px-3 ${selectedId ? "hidden 2xl:table-cell" : ""}`}>Baker</th>
                <th className={`px-3 ${selectedId ? "hidden 2xl:table-cell" : ""}`}>Rider</th>
                <th className="px-3">Status</th>
                <th className="px-3 text-right rtl:text-left">Total</th>
                {!selectedId && <th className="px-5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  aria-selected={selectedId === o.id}
                  className={`cursor-pointer border-t border-hairline/70 ${selectedId === o.id ? "!bg-[#FBF3E4] dark:!bg-plum/20" : ""}`}
                >
                  <td className="px-5 font-mono text-[13px] text-plum font-medium whitespace-nowrap">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedId(o.id); }}
                      className="hover:underline"
                      aria-label={`Show journey for ${o.order_number}`}
                    >
                      {o.order_number}
                    </button>
                  </td>
                  <td className="px-3">
                    <div className="font-semibold text-ink whitespace-nowrap">{o.customer_name}</div>
                    <div className="text-xs text-muted whitespace-nowrap">{o.customer_phone}</div>
                  </td>
                  <td className="px-3 whitespace-nowrap text-ink/80">{formatDue(o.delivery_date)}</td>
                  <td className={`px-3 text-ink/80 ${selectedId ? "hidden 2xl:table-cell" : ""}`}>{o.baker_name ?? "—"}</td>
                  <td className={`px-3 ${selectedId ? "hidden 2xl:table-cell" : ""}`}>
                    {o.fulfillment_type === "delivery" ? (
                      o.rider_name ? <span className="text-ink/80">{o.rider_name}</span> : <span className="text-muted">Not assigned</span>
                    ) : (
                      <span className="text-muted">Pickup</span>
                    )}
                  </td>
                  <td className="px-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_COLORS[o.status]}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-3 text-right rtl:text-left font-mono text-[13px] whitespace-nowrap">Rs {fmtAmount(o.total)}</td>
                  {!selectedId && <td className="px-5" onClick={(e) => e.stopPropagation()}>{renderActions(o)}</td>}
                </tr>
              ))}
              {visibleOrders.length === 0 && (
                <tr>
                  <td colSpan={selectedId ? 5 : 8} className="px-5 py-10 text-center text-sm text-muted">
                    {orders.length === 0 ? "No orders yet. Create one with New order." : "No orders in this view. Pick another filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {selectedId && selectedDetail && listItem && (
        <OrderJourneyPanel
          order={selectedDetail}
          statusLabel={statusLabel(selectedDetail.status)}
          dueLabel={formatDue(selectedDetail.delivery_date)}
          actions={renderActions(listItem)}
          onOpenDetails={() => openConfirmReview(selectedId)}
          extras={
            <div className="space-y-2">
              {selectedDetail.latest_print && (
                <p className={`text-xs ${selectedDetail.latest_print.status === "failed" ? "text-plum" : "text-muted"}`}>
                  Kitchen ticket:{" "}
                  {selectedDetail.latest_print.status === "sent"
                    ? `sent to printer ${new Date(selectedDetail.latest_print.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                    : selectedDetail.latest_print.status === "failed"
                    ? `didn't print (${selectedDetail.latest_print.error ?? "error"})`
                    : `opened for printing ${new Date(selectedDetail.latest_print.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`}
                </p>
              )}
              {(["in_production", "ready", "rider_assigned", "out_for_delivery", "delivered", "completed"] as OrderStatus[]).includes(selectedDetail.status) && (
                <button
                  onClick={() => openUsageView(selectedDetail.id)}
                  className="w-full h-11 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center justify-center gap-2"
                >
                  <Wheat size={16} /> Ingredients used
                </button>
              )}
              {selectedDetail.status !== "draft" && selectedDetail.status !== "cancelled" && (
                <button
                  onClick={() => setTicketFor(selectedDetail.id)}
                  className="w-full h-11 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center justify-center gap-2"
                >
                  <ChefHat size={16} /> Kitchen ticket
                </button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReceiptFor({ id: selectedDetail.id, context: null })}
                  className="h-11 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center justify-center gap-2"
                >
                  <Receipt size={16} /> Receipt
                </button>
                {selectedDetail.status !== "draft" && selectedDetail.status !== "cancelled" ? (
                  <Can permission="orders.button.print">
                    <button
                      onClick={() => doReprint(selectedDetail.id, selectedDetail.order_number)}
                      disabled={reprintingId === selectedDetail.id}
                      className="h-11 rounded-xl border border-hairline text-sm font-semibold text-ink hover:bg-flour flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Printer size={16} /> {reprintingId === selectedDetail.id ? "Printing…" : "Reprint ticket"}
                    </button>
                  </Can>
                ) : <span />}
              </div>
            </div>
          }
          onClose={() => setSelectedId(null)}
        />
      )}
      </div>

      {modalOpen && catalogs && (
        <Modal title={editingId ? "Edit order" : "New order"} onClose={() => setModalOpen(false)} wide>
          <div className="space-y-6">
            {error && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{error}</p>}

            {/* Customer */}
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-2">Customer</h3>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-flour/50 border border-hairline rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{selectedCustomer.full_name}</p>
                    <p className="text-xs text-muted">{selectedCustomer.phone}</p>
                  </div>
                  <button onClick={resetCustomerPicker} className="text-xs text-plum underline">Change</button>
                </div>
              ) : addingNewCustomer ? (
                <div className="border border-hairline rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted">New customer</p>
                    <button onClick={resetCustomerPicker} className="text-xs text-plum underline">Cancel</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} placeholder="Full name *" value={newCustomer.full_name} onChange={(e) => setNewCustomer({ ...newCustomer, full_name: e.target.value })} />
                    <input className={inputClass} placeholder="Phone *" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                    <input className={inputClass} placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                    <input className={inputClass} placeholder="City" value={newCustomer.city} onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })} />
                    <input className={`${inputClass} col-span-2`} placeholder="Address" value={newCustomer.address_line1} onChange={(e) => setNewCustomer({ ...newCustomer, address_line1: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    className={inputClass}
                    placeholder="Search by name or phone…"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                  />
                  {customerQuery.trim().length >= 2 && (
                    <div className="border border-hairline rounded-lg mt-1 bg-surface shadow-sm max-h-48 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-flour border-b border-hairline last:border-0">
                          {c.full_name} <span className="text-muted">— {c.phone}</span>
                        </button>
                      ))}
                      <button onClick={startNewCustomer} className="w-full text-left px-3 py-2 text-sm text-plum hover:bg-flour">
                        + Add "{customerQuery}" as a new customer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cake details */}
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-2">Cake details</h3>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ["Flavour", "cake_flavor_id", catalogs.flavors],
                  ["Filling", "cake_filling_id", catalogs.fillings],
                  ["Frosting", "cake_frosting_id", catalogs.frostings],
                  ["Shape", "cake_shape_id", catalogs.shapes],
                  ["Size", "cake_size_id", catalogs.sizes],
                  ["Theme / occasion", "theme_id", catalogs.themes],
                  ["Box", "cake_box_id", catalogs.boxes],
                  ["Tier", "cake_tier_id", catalogs.tiers],
                  ["Color", "cake_color_id", catalogs.colors],
                ] as const).map(([label, field, list]) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-ink/70 mb-1">{label}</label>
                    <select
                      className={inputClass}
                      value={(form.item as any)[field] ?? ""}
                      onChange={(e) => setItem({ [field]: e.target.value || null } as any)}
                    >
                      <option value="">—</option>
                      {activeOptions(list).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{(c.price_modifier ?? c.price) ? ` (+${fmtAmount(c.price_modifier ?? c.price)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Quantity</label>
                  <input type="number" min={1} className={inputClass} value={form.item.quantity} onChange={(e) => setItem({ quantity: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Custom message</label>
                  <input className={inputClass} value={form.item.custom_message ?? ""} onChange={(e) => setItem({ custom_message: e.target.value })} placeholder="e.g. Happy Birthday Ayesha" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Special instructions</label>
                  <input className={inputClass} value={form.item.special_instructions ?? ""} onChange={(e) => setItem({ special_instructions: e.target.value })} />
                </div>
              </div>

              <div className="mt-3 border border-hairline rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm mb-2">
                  <input
                    type="checkbox"
                    checked={form.item.is_customer_design}
                    onChange={(e) => setItem({ is_customer_design: e.target.checked, reference_image_url: e.target.checked ? form.item.reference_image_url : null })}
                  />
                  Customer provided their own cake design
                </label>

                {form.item.is_customer_design && (
                  <div>
                    <p className="text-xs text-muted mb-2">
                      Upload the customer's reference photo. This will be visible when the order is reviewed and sent to the baker.
                    </p>
                    <div className="flex items-center gap-3">
                      {form.item.reference_image_url && (
                        <button type="button" onClick={() => setLightboxImage(form.item.reference_image_url)}>
                          <img
                            src={mediaUrl(form.item.reference_image_url)}
                            alt="Customer design reference"
                            className="w-16 h-16 object-cover rounded-lg border border-hairline cursor-zoom-in hover:opacity-80 transition-opacity"
                          />
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          setUploadError(null);
                          try {
                            const url = await ordersApi.uploadReferenceImage(file);
                            setItem({ reference_image_url: url });
                          } catch (err: any) {
                            const detail = err?.response?.data?.detail;
                            setUploadError(
                              detail ??
                                (err?.response?.status === 403
                                  ? "You don't have permission to upload images."
                                  : "Upload failed. Please try again.")
                            );
                          } finally {
                            setUploadingImage(false);
                            e.target.value = ""; // allow re-selecting the same file after an error
                          }
                        }}
                        className="text-xs"
                      />
                      {uploadingImage && <span className="text-xs text-muted">Uploading…</span>}
                    </div>
                    {uploadError && <p className="text-xs text-plum mt-2">{uploadError}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Add-ons */}
            {catalogs.addons.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-ink mb-2">Decorations / add-ons</h3>
                <div className="grid grid-cols-2 gap-2">
                  {activeOptions(catalogs.addons).map((addon) => {
                    const selected = form.item.addons.find((a) => a.addon_id === addon.id);
                    return (
                      <div key={addon.id} className="flex items-center justify-between border border-hairline rounded-lg px-3 py-1.5">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!selected} onChange={() => toggleAddon(addon.id, addon.max_qty ?? 1)} />
                          {addon.name} <span className="text-muted text-xs">+{fmtAmount(addon.price ?? 0)}</span>
                        </label>
                        {selected && (addon.max_qty ?? 1) > 1 && (
                          <input
                            type="number" min={1} max={addon.max_qty}
                            className="w-14 border border-hairline rounded px-1.5 py-0.5 text-xs"
                            value={selected.quantity}
                            onChange={(e) => setAddonQty(addon.id, Number(e.target.value))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fulfillment */}
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-2">Fulfillment</h3>
              <div className="flex gap-4 mb-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.fulfillment_type === "pickup"} onChange={() => setForm({ ...form, fulfillment_type: "pickup" })} />
                  Pickup
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.fulfillment_type === "delivery"} onChange={() => setForm({ ...form, fulfillment_type: "delivery" })} />
                  Delivery
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Delivery date</label>
                  <input type="date" className={inputClass} value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Delivery time (optional)</label>
                  <TimeSelect className={inputClass} value={form.delivery_time} date={form.delivery_date} onChange={(t) => setForm({ ...form, delivery_time: t })} />
                </div>

                {form.fulfillment_type === "delivery" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-ink/70 mb-1">Delivery zone</label>
                      <select className={inputClass} value={form.delivery_zone_id ?? ""} onChange={(e) => setForm({ ...form, delivery_zone_id: e.target.value || null })}>
                        <option value="">—</option>
                        {zones.filter((z) => z.is_active).map((z) => (
                          <option key={z.id} value={z.id}>{z.name ?? `${z.distance_from_km}-${z.distance_to_km}km`} (+{fmtAmount(z.price)})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink/70 mb-1">Delivery address</label>
                      <input className={inputClass} value={form.delivery_address ?? ""} onChange={(e) => setForm({ ...form, delivery_address: e.target.value })} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Pricing */}
            <div>
              <h3 className="text-[13px] font-semibold text-ink mb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Discount</label>
                  <input type="number" className={inputClass} value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">Advance paid</label>
                  <input type="number" className={inputClass} value={form.advance_paid} onChange={(e) => setForm({ ...form, advance_paid: Number(e.target.value) })} />
                </div>
              </div>
              <div className="bg-flour/50 border border-hairline rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted">Unit price</span><span>{fmtAmount(pricePreview.unit)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Add-ons</span><span>{fmtAmount(pricePreview.addonsTotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Line total</span><span>{fmtAmount(pricePreview.lineTotal)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Delivery charge</span><span>{fmtAmount(pricePreview.delivery)}</span></div>
                <div className="flex justify-between font-medium border-t border-hairline pt-1 mt-1"><span>Total</span><span>{fmtAmount(pricePreview.total)}</span></div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Notes</label>
              <textarea className={inputClass} rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={save}
                disabled={saving || uploadingImage}
                title={uploadingImage ? "Wait for the image to finish uploading" : undefined}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {uploadingImage ? "Uploading image…" : saving ? "Saving…" : "Save as draft"}
              </button>
              <button onClick={() => setModalOpen(false)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Review order details, then confirm */}
      {confirmOrder && (
        <Modal title={`Order ${confirmOrder.order_number}`} onClose={() => setConfirmOrder(null)}>
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[confirmOrder.status]}`}>
                {STATUS_LABELS[confirmOrder.status]}
              </span>
              <span className="text-xs text-muted text-right">
                {confirmOrder.baker_name && <span className="block">Baker: {confirmOrder.baker_name}</span>}
                {confirmOrder.rider_name && <span className="block">Rider: {confirmOrder.rider_name}</span>}
              </span>
            </div>

            {confirmOrder.status === "confirmed" && confirmOrder.decline_reason && (
              <div className="border border-plum/30 bg-plum/5 rounded-lg p-3">
                <p className="text-xs text-plum mb-1">
                  Declined{confirmOrder.declined_by_name ? ` by ${confirmOrder.declined_by_name}` : ""}
                </p>
                <p className="text-ink/80">{confirmOrder.decline_reason}</p>
                <p className="text-xs text-muted mt-1">Send it to another baker to continue.</p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted mb-1">Customer</p>
              <p className="text-ink">{confirmOrder.customer_name} — {confirmOrder.customer_phone}</p>
            </div>

            {confirmOrder.item && (
              <div>
                <p className="text-xs text-muted mb-1">Cake</p>
                <ul className="text-ink/80 space-y-0.5">
                  {confirmOrder.item.cake_flavor_name && <li>Flavour: {confirmOrder.item.cake_flavor_name}</li>}
                  {confirmOrder.item.cake_filling_name && <li>Filling: {confirmOrder.item.cake_filling_name}</li>}
                  {confirmOrder.item.cake_frosting_name && <li>Frosting: {confirmOrder.item.cake_frosting_name}</li>}
                  {confirmOrder.item.cake_shape_name && <li>Shape: {confirmOrder.item.cake_shape_name}</li>}
                  {confirmOrder.item.cake_size_name && <li>Size: {confirmOrder.item.cake_size_name}</li>}
                  {confirmOrder.item.cake_tier_name && <li>Tier: {confirmOrder.item.cake_tier_name}</li>}
                  {confirmOrder.item.cake_color_name && <li>Color: {confirmOrder.item.cake_color_name}</li>}
                  {confirmOrder.item.theme_name && <li>Theme: {confirmOrder.item.theme_name}</li>}
                  {confirmOrder.item.cake_box_name && <li>Box: {confirmOrder.item.cake_box_name}</li>}
                  <li>Quantity: {confirmOrder.item.quantity}</li>
                  {confirmOrder.item.addons.length > 0 && (
                    <li>
                      Add-ons: {confirmOrder.item.addons.map((a) => `${a.name} ×${a.quantity}`).join(", ")}
                    </li>
                  )}
                  {confirmOrder.item.custom_message && <li>Message: "{confirmOrder.item.custom_message}"</li>}
                  {confirmOrder.item.special_instructions && <li>Instructions: {confirmOrder.item.special_instructions}</li>}
                </ul>
              </div>
            )}

            {confirmOrder.item?.is_customer_design && confirmOrder.item.reference_image_url && (
              <div>
                <p className="text-xs text-muted mb-1">Customer's design reference</p>
                <button
                  type="button"
                  onClick={() => setLightboxImage(confirmOrder.item!.reference_image_url)}
                  className="block"
                >
                  <img
                    src={mediaUrl(confirmOrder.item.reference_image_url)}
                    alt="Customer design reference"
                    className="w-28 h-28 object-cover rounded-lg border border-hairline cursor-zoom-in hover:opacity-80 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const fallback = document.getElementById(`img-fallback-${confirmOrder.item?.reference_image_url}`);
                      if (fallback) fallback.style.display = "block";
                    }}
                  />
                  <p
                    id={`img-fallback-${confirmOrder.item.reference_image_url}`}
                    className="hidden text-xs text-plum"
                  >
                    Couldn't load this image ({confirmOrder.item.reference_image_url})
                  </p>
                </button>
              </div>
            )}

            <div>
              <p className="text-xs text-muted mb-1">Fulfillment</p>
              <p className="text-ink/80">
                {confirmOrder.fulfillment_type === "delivery" ? "Delivery" : "Pickup"} — {confirmOrder.delivery_date}
                {confirmOrder.delivery_time ? ` at ${fmtTime(confirmOrder.delivery_time)}` : ""}
              </p>
              {confirmOrder.delivery_address && <p className="text-muted text-xs">{confirmOrder.delivery_address}</p>}
            </div>

            <div className="bg-flour/50 border border-hairline rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{fmtAmount(confirmOrder.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Delivery</span><span>{fmtAmount(confirmOrder.delivery_charge)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Discount</span><span>-{fmtAmount(confirmOrder.discount)}</span></div>
              <div className="flex justify-between font-medium border-t border-hairline pt-1 mt-1"><span>Total</span><span>{fmtAmount(confirmOrder.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Advance paid</span><span>-{fmtAmount(confirmOrder.advance_paid)}</span></div>
              <div className="flex justify-between font-medium">
                <span>Balance to collect</span>
                <span>{fmtAmount(Math.max(confirmOrder.total - confirmOrder.advance_paid, 0))}</span>
              </div>
              {confirmOrder.rider_amount_collected != null && (
                <div className="flex justify-between text-plum"><span>Collected by rider</span><span>{fmtAmount(confirmOrder.rider_amount_collected)}</span></div>
              )}
              {confirmOrder.amount_received != null && (
                <div className="flex justify-between text-sage"><span>Received at close</span><span>{fmtAmount(confirmOrder.amount_received)}</span></div>
              )}
            </div>

            {confirmOrder.notes && (
              <div>
                <p className="text-xs text-muted mb-1">Notes</p>
                <p className="text-ink/70">{confirmOrder.notes}</p>
              </div>
            )}

            {confirmOrder.status === "sent_to_baker" &&
              confirmOrder.baker_staff_id === currentStaffId &&
              !confirmOrder.baker_accepted_at && (
                <Can permission="orders.button.accept_baking">
                  <div className="pt-2 border-t border-hairline space-y-2">
                    {declineMode && (
                      <div>
                        <label className="text-xs text-muted block mb-1">Reason for declining</label>
                        <textarea
                          value={declineReason}
                          onChange={(e) => setDeclineReason(e.target.value)}
                          rows={3}
                          autoFocus
                          placeholder="e.g. Missing ingredients, fully booked for this date, design not feasible…"
                          className="w-full border border-hairline rounded-lg p-2 text-sm bg-surface"
                        />
                      </div>
                    )}
                    {respondError && <p className="text-xs text-plum">{respondError}</p>}
                    <div className="flex gap-2">
                      {!declineMode ? (
                        <>
                          <button onClick={doAcceptBaking} disabled={respondSaving} className="bg-sage text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                            {respondSaving ? "Accepting…" : "Accept baking"}
                          </button>
                          <button
                            onClick={() => { setDeclineMode(true); setRespondError(null); }}
                            disabled={respondSaving}
                            className="border border-plum text-plum px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                          >
                            Decline baking
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={doDeclineBaking} disabled={respondSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                            {respondSaving ? "Declining…" : "Confirm decline"}
                          </button>
                          <button
                            onClick={() => { setDeclineMode(false); setDeclineReason(""); setRespondError(null); }}
                            disabled={respondSaving}
                            className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70"
                          >
                            Back
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Can>
              )}

            {confirmOrder.status === "draft" && (
              <p className="text-xs text-muted pt-2">Confirming prints the kitchen ticket.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
              {confirmOrder.status === "draft" ? (
                <Can permission="orders.button.confirm">
                  <button onClick={doConfirm} disabled={confirmSaving} className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                    {confirmSaving ? "Confirming…" : "Confirm"}
                  </button>
                </Can>
              ) : null}
              {(["in_production", "ready", "rider_assigned", "out_for_delivery", "delivered", "completed"] as OrderStatus[]).includes(confirmOrder.status) && (
                <button
                  onClick={() => openUsageView(confirmOrder.id)}
                  className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink flex items-center gap-1.5"
                >
                  <Wheat size={15} /> Ingredients used
                </button>
              )}
              {confirmOrder.status !== "draft" && confirmOrder.status !== "cancelled" && (
                <button
                  onClick={() => setTicketFor(confirmOrder.id)}
                  className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink flex items-center gap-1.5"
                >
                  <ChefHat size={15} /> Kitchen ticket
                </button>
              )}
              <button
                onClick={() => setReceiptFor({ id: confirmOrder.id, context: null })}
                className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink flex items-center gap-1.5"
              >
                <Receipt size={15} /> Receipt
              </button>
              <button onClick={() => setConfirmOrder(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                {confirmOrder.status === "draft" ? "Cancel" : "Close"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pick a baker and send the order to their queue */}
      {bakerPickerOrderId && (
        <Modal title="Send to baker" onClose={() => setBakerPickerOrderId(null)}>
          <div className="space-y-4">
            {bakerError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{bakerError}</p>}

            {bakers.length === 0 ? (
              <p className="text-sm text-muted">
                No active staff hold the Baker role yet. Assign the Baker role to someone from Roles and permissions, or add a staff member with that role.
              </p>
            ) : (
              <div className="space-y-1.5">
                {bakers.map((baker) => (
                  <label key={baker.id} className="flex items-center gap-2 border border-hairline rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="baker"
                      checked={selectedBakerId === baker.id}
                      onChange={() => setSelectedBakerId(baker.id)}
                    />
                    {baker.full_name}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={doSendToBaker}
                disabled={bakerSaving || bakers.length === 0}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {bakerSaving ? "Sending…" : "Send to baker"}
              </button>
              <button onClick={() => setBakerPickerOrderId(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {bakingOrderId && (
        <Modal title="Start baking" onClose={() => setBakingOrderId(null)} wide>
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Log the ingredients and quantities used for this cake. Each entry deducts from stock on hand.
            </p>

            {bakingError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{bakingError}</p>}

            {ingredientsLoading && <p className="text-xs text-muted">Loading ingredients…</p>}
            {ingredientsError && (
              <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{ingredientsError}</p>
            )}
            {!ingredientsLoading && !ingredientsError && inventoryItems.length === 0 && (
              <p className="text-sm text-ink/70 bg-honey/10 border border-honey/30 rounded-lg px-3 py-2">
                No active ingredients in inventory yet. Ask a manager to add them under Inventory first.
              </p>
            )}

            <div>
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 mb-1 text-[11px] text-muted">
                <span className="col-span-6">Ingredient</span>
                <span className="col-span-3">Quantity</span>
                <span className="col-span-2">Unit</span>
                <span className="col-span-1" />
              </div>

              <div className="space-y-2">
                {ingredientRows.map((row, i) => {
                  const item = inventoryItems.find((it) => it.id === row.inventory_item_id);
                  const options = item?.unit_options ?? [];
                  const opt = options.find((u) => u.unit_id === row.unit_id) ?? options[0];
                  const qty = Number(row.quantity_used) || 0;
                  const deducted = item && opt ? +(qty * opt.to_item_unit).toFixed(4) : 0;
                  const remaining = item ? +(item.qty_on_hand - deducted).toFixed(4) : 0;
                  return (
                    <div key={i} className="border border-hairline rounded-lg p-3 bg-flour/40">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <select
                          className={`${inputClass} col-span-12 sm:col-span-6 min-w-0`}
                          value={row.inventory_item_id}
                          onChange={(e) => {
                            const picked = inventoryItems.find((it) => it.id === e.target.value);
                            updateIngredientRow(i, { inventory_item_id: e.target.value, unit_id: picked?.unit_options[0]?.unit_id ?? null });
                          }}
                        >
                          <option value="">Select ingredient…</option>
                          {inventoryItems.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Qty"
                          className={`${inputClass} col-span-5 sm:col-span-3 min-w-0`}
                          value={row.quantity_used}
                          onChange={(e) => updateIngredientRow(i, { quantity_used: e.target.value })}
                        />
                        <select
                          className={`${inputClass} col-span-5 sm:col-span-2 min-w-0`}
                          title={options.length === 1 ? "This ingredient's unit has no related units set up" : "Unit"}
                          value={row.unit_id ?? ""}
                          disabled={!item}
                          onChange={(e) => updateIngredientRow(i, { unit_id: e.target.value || null })}
                        >
                          {!item && <option value="">Unit</option>}
                          {options.map((u) => (
                            <option key={u.unit_id ?? "own"} value={u.unit_id ?? ""}>{u.abbreviation || "unit"}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeIngredientRow(i)}
                          disabled={ingredientRows.length === 1}
                          className="col-span-2 sm:col-span-1 h-9 flex items-center justify-center rounded-lg text-muted hover:text-plum hover:bg-plum/5 disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>

                      {item && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span>
                            On hand <span className="text-ink/80">{fmtQty(item.qty_on_hand)} {item.unit}</span>
                            {qty > 0 && (
                              <>
                                {" "}→ <span className={remaining < 0 ? "text-plum font-medium" : "text-ink/80"}>{fmtQty(remaining)} {item.unit}</span> after
                              </>
                            )}
                          </span>
                          {qty > 0 && opt && opt.to_item_unit !== 1 && (
                            <span className="text-muted">
                              ({fmtQty(qty)} {opt.abbreviation} = {fmtQty(deducted)} {item.unit})
                            </span>
                          )}
                          {qty > 0 && remaining < 0 && (
                            <span className="text-plum">More than recorded stock — it will go negative.</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={addIngredientRow} className="text-sm text-plum hover:underline">
              + Add another ingredient
            </button>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={doStartBaking}
                disabled={bakingSaving}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {bakingSaving ? "Starting…" : "Start baking"}
              </button>
              <button onClick={() => setBakingOrderId(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {riderPickerOrderId && (
        <Modal title="Assign rider" onClose={() => setRiderPickerOrderId(null)}>
          <div className="space-y-4">
            {riderError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{riderError}</p>}

            {riders.length === 0 ? (
              <p className="text-sm text-muted">
                No active staff hold the Delivery Boy role yet. Give someone that role from the Staff page (Edit → Role).
              </p>
            ) : (
              <div className="space-y-1.5">
                {riders.map((rider) => (
                  <label key={rider.id} className="flex items-center gap-2 border border-hairline rounded-lg px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="rider"
                      checked={selectedRiderId === rider.id}
                      onChange={() => setSelectedRiderId(rider.id)}
                    />
                    {rider.full_name}
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={doAssignRider}
                disabled={riderSaving || riders.length === 0}
                className="bg-plum text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {riderSaving ? "Assigning…" : "Assign rider"}
              </button>
              <button onClick={() => setRiderPickerOrderId(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deliverOrder && (
        <Modal title="Mark delivered" onClose={() => setDeliverOrder(null)}>
          <div className="space-y-4">
            <div className="text-sm text-ink/80 space-y-0.5">
              <p className="font-medium">{deliverOrder.order_number} — {deliverOrder.customer_name}</p>
              <p className="text-muted">{deliverOrder.customer_phone}</p>
              {deliverOrder.delivery_address && <p className="text-muted">{deliverOrder.delivery_address}</p>}
            </div>
            <div className="bg-flour/50 border border-hairline rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">Order total</span><span>{fmtAmount(deliverOrder.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Advance paid</span><span>-{fmtAmount(deliverOrder.advance_paid)}</span></div>
              <div className="flex justify-between font-medium border-t border-hairline pt-1 mt-1">
                <span>To collect</span>
                <span>{fmtAmount(Math.max(deliverOrder.total - deliverOrder.advance_paid, 0))}</span>
              </div>
            </div>
            {deliverError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{deliverError}</p>}
            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">Amount collected from customer</label>
              <input
                type="number"
                step="any"
                autoFocus
                className={inputClass}
                value={amountCollected}
                onChange={(e) => setAmountCollected(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button onClick={doMarkDelivered} disabled={deliverSaving} className="bg-sage text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                {deliverSaving ? "Saving…" : "Mark delivered"}
              </button>
              <button onClick={() => setDeliverOrder(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {handoverOrderId && (
        <Modal
          title={handoverOrder?.fulfillment_type === "delivery" ? "Mark complete — cash from rider" : "Pickup done"}
          onClose={() => setHandoverOrderId(null)}
        >
          <div className="space-y-4">
            {handoverOrder ? (
              <>
                <p className="text-sm text-ink/80">
                  {handoverOrder.order_number} — {handoverOrder.customer_name}
                  {handoverOrder.rider_name && <span className="text-muted"> · delivered by {handoverOrder.rider_name}</span>}
                </p>
                <div className="bg-flour/50 border border-hairline rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted">Order total</span><span>{fmtAmount(handoverOrder.total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Advance paid</span><span>-{fmtAmount(handoverOrder.advance_paid)}</span></div>
                  <div className="flex justify-between font-medium border-t border-hairline pt-1 mt-1">
                    <span>Balance due</span>
                    <span>{fmtAmount(Math.max(handoverOrder.total - handoverOrder.advance_paid, 0))}</span>
                  </div>
                  {handoverOrder.fulfillment_type === "delivery" && handoverOrder.rider_amount_collected != null && (
                    <div className="flex justify-between font-medium text-plum">
                      <span>Rider says he collected</span>
                      <span>{fmtAmount(handoverOrder.rider_amount_collected)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              !handoverError && <p className="text-xs text-muted">Loading order…</p>
            )}

            {handoverError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2">{handoverError}</p>}

            <div>
              <label className="block text-xs font-medium text-ink/70 mb-1">
                {handoverOrder?.fulfillment_type === "delivery" ? "Amount received from rider" : "Amount received"}
              </label>
              <input
                type="number"
                step="any"
                autoFocus
                className={inputClass}
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-hairline">
              <button
                onClick={doHandover}
                disabled={handoverSaving}
                className="bg-sage text-cream px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {handoverSaving ? "Saving…" : handoverOrder?.fulfillment_type === "delivery" ? "Mark complete" : "Mark pickup done"}
              </button>
              <button onClick={() => setHandoverOrderId(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewingUsageOrderId && (
        <Modal title={`Ingredients used${usageOrder ? ` · ${usageOrder.order_number}` : ""}`} onClose={() => setViewingUsageOrderId(null)} wide>
          <div className="space-y-4">
            {usageOrder && (
              <p className="text-sm text-muted">
                {usageOrder.customer_name}
                {usageOrder.baker_name && <> · baked by <span className="text-ink">{usageOrder.baker_name}</span></>}
              </p>
            )}
            {usageError && <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-xl px-4 py-3">{usageError}</p>}
            {usageLoading && <p className="text-sm text-muted">Loading…</p>}
            {!usageLoading && !usageError && usageRows.length === 0 && (
              <p className="text-sm text-muted rounded-xl bg-flour px-4 py-6 text-center">No ingredients were logged for this order.</p>
            )}
            {usageRows.length > 0 && (
              <div className="rounded-xl border border-hairline overflow-x-auto">
                <table className="cs-plain w-full text-sm">
                  <thead>
                    <tr className="text-left rtl:text-right">
                      <th className="px-4">Ingredient</th>
                      <th className="px-4">Quantity used</th>
                      <th className="px-4">Logged by</th>
                      {canSeeCost && <th className="px-4 text-right">Cost</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {usageRows.map((row, idx) => (
                      <tr key={idx} className="border-t border-hairline/70">
                        <td className="px-4 font-medium text-ink">{row.inventory_item_name}</td>
                        <td className="px-4 whitespace-nowrap">
                          {row.entered_unit && row.entered_unit !== row.unit ? (
                            <>
                              {fmtQty(row.entered_quantity)} {row.entered_unit}{" "}
                              <span className="text-muted">(= {fmtQty(row.quantity_used)} {row.unit})</span>
                            </>
                          ) : (
                            <>{fmtQty(row.quantity_used)} {row.unit}</>
                          )}
                        </td>
                        <td className="px-4 text-muted whitespace-nowrap">
                          {row.recorded_by ?? "—"}
                          {row.recorded_at && (
                            <span className="block text-xs">
                              {new Date(row.recorded_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </td>
                        {canSeeCost && (
                          <td className="px-4 text-right font-mono text-[13px] whitespace-nowrap">
                            {row.cost != null ? fmtAmount(row.cost) : <span className="font-sans text-xs text-plum">No price</span>}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {canSeeCost && (
                    <tfoot>
                      <tr className="border-t border-hairline bg-flour/60">
                        <td className="px-4 py-2.5 font-semibold" colSpan={3}>Ingredient cost for this cake</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[13px] font-semibold whitespace-nowrap">
                          {fmtAmount(usageRows.reduce((a, r) => a + (r.cost ?? 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
            {canSeeCost && usageRows.some((r) => r.cost == null) && (
              <p className="text-xs text-muted">
                "No price" means that ingredient has never been bought through Purchases, so its cost isn't known and the total is too low.
              </p>
            )}
            <button onClick={() => setViewingUsageOrderId(null)} className="border border-hairline px-4 py-2 rounded-lg text-sm text-ink/70">
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Full-size view of a design reference photo - click the thumbnail to open, click anywhere to close */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-ink/80 flex items-center justify-center p-6 z-[60] cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={mediaUrl(lightboxImage)}
            alt="Customer design reference"
            className="max-w-full max-h-full rounded-lg shadow-lg"
          />
        </div>
      )}
      {receiptFor && (
        <ReceiptModal orderId={receiptFor.id} context={receiptFor.context} riderName={receiptFor.riderName} onClose={() => setReceiptFor(null)} />
      )}
      {ticketFor && <KitchenTicketModal orderId={ticketFor} onClose={() => setTicketFor(null)} />}
    </Can>
  );
}
