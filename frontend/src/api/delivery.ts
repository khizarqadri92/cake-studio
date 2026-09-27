import { api } from "./client";

export interface DeliveryZone {
  id: string;
  name: string | null;
  distance_from_km: number;
  distance_to_km: number;
  price: number;
  is_active: boolean;
  sort_order: number;
}

export const deliveryZonesApi = {
  list: () => api.get<DeliveryZone[]>("/delivery-zones").then((r) => r.data),
  create: (payload: Partial<DeliveryZone>) => api.post<DeliveryZone>("/delivery-zones", payload).then((r) => r.data),
  update: (id: string, payload: Partial<DeliveryZone>) =>
    api.put<DeliveryZone>(`/delivery-zones/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/delivery-zones/${id}`).then((r) => r.data),
};
