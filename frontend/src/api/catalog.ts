import { api } from "./client";

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  price_modifier?: number;
  price?: number;
  max_qty?: number;
  servings?: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
}

export function createCatalogApi(basePath: string) {
  return {
    list: () => api.get<CatalogItem[]>(basePath).then((r) => r.data),
    create: (payload: Partial<CatalogItem>) => api.post<CatalogItem>(basePath, payload).then((r) => r.data),
    update: (id: string, payload: Partial<CatalogItem>) =>
      api.put<CatalogItem>(`${basePath}/${id}`, payload).then((r) => r.data),
    remove: (id: string) => api.delete(`${basePath}/${id}`).then((r) => r.data),
  };
}
