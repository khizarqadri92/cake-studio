import { create } from "zustand";
import { api } from "../api/client";

export interface NumberFormatSettings {
  amount_decimals: number;   // prices, totals, payments
  quantity_decimals: number; // stock and ingredient quantities
  number_format: string;     // separator sample from Organization, e.g. "1,234.56"
  time_format?: string;      // "hh:mm A" (12-hour) or "HH:mm" (24-hour)
  business_hours?: Record<string, { open: string; close: string; closed: boolean }> | null;
}

const DEFAULTS: NumberFormatSettings = { amount_decimals: 2, quantity_decimals: 3, number_format: "1,234.56", time_format: "hh:mm A", business_hours: null };

interface State extends NumberFormatSettings {
  loaded: boolean;
  load: () => Promise<void>;
  set: (s: NumberFormatSettings) => void;
}

export const useNumberFormatStore = create<State>((set) => ({
  ...DEFAULTS,
  loaded: false,
  load: async () => {
    try {
      const res = await api.get<NumberFormatSettings>("/system/number-format");
      set({ ...res.data, loaded: true });
    } catch {
      set({ loaded: true }); // keep defaults; numbers still display
    }
  },
  set: (s) => set({ ...s }),
}));
