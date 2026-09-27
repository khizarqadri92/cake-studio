export type CatalogFieldSet = "named" | "size" | "theme" | "addon";

export interface CatalogConfig {
  key: string;
  title: string;
  apiBase: string;
  permissionPrefix: string;
  fieldSet: CatalogFieldSet;
}

export const CATALOG_CONFIGS: Record<string, CatalogConfig> = {
  flavors: {
    key: "flavors",
    title: "Cake flavours",
    apiBase: "/catalog/cake-flavors",
    permissionPrefix: "cake_flavors",
    fieldSet: "named",
  },
  fillings: {
    key: "fillings",
    title: "Cake fillings",
    apiBase: "/catalog/cake-fillings",
    permissionPrefix: "cake_fillings",
    fieldSet: "named",
  },
  frostings: {
    key: "frostings",
    title: "Cake frostings",
    apiBase: "/catalog/cake-frostings",
    permissionPrefix: "cake_frostings",
    fieldSet: "named",
  },
  shapes: {
    key: "shapes",
    title: "Cake shapes",
    apiBase: "/catalog/cake-shapes",
    permissionPrefix: "cake_shapes",
    fieldSet: "named",
  },
  sizes: {
    key: "sizes",
    title: "Cake sizes",
    apiBase: "/catalog/cake-sizes",
    permissionPrefix: "cake_sizes",
    fieldSet: "size",
  },
  themes: {
    key: "themes",
    title: "Themes / occasions",
    apiBase: "/catalog/themes",
    permissionPrefix: "themes",
    fieldSet: "theme",
  },
  addons: {
    key: "addons",
    title: "Decorations / add-ons",
    apiBase: "/catalog/cake-addons",
    permissionPrefix: "cake_addons",
    fieldSet: "addon",
  },
  boxes: {
    key: "boxes",
    title: "Cake boxes",
    apiBase: "/catalog/cake-boxes",
    permissionPrefix: "cake_boxes",
    fieldSet: "named",
  },
  tiers: {
    key: "tiers",
    title: "Cake tiers",
    apiBase: "/catalog/cake-tiers",
    permissionPrefix: "cake_tiers",
    fieldSet: "named",
  },
  colors: {
    key: "colors",
    title: "Cake colors",
    apiBase: "/catalog/cake-colors",
    permissionPrefix: "cake_colors",
    fieldSet: "named",
  },
};
