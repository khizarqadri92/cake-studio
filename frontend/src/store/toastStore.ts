import { create } from "zustand";

export interface Toast { id: number; text: string; tone: "success" | "error" | "info" }

interface State {
  toasts: Toast[];
  show: (text: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Short confirmation messages ("Staff account created ..."), shown bottom-right. */
export const useToastStore = create<State>((set, get) => ({
  toasts: [],
  show: (text, tone = "success") => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => get().dismiss(id), tone === "error" ? 8000 : 4500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Use anywhere: notify("Saved") */
export const notify = (text: string, tone?: Toast["tone"]) => useToastStore.getState().show(text, tone);
