import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useNumberFormatStore } from "../store/numberFormatStore";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AdminLayout() {
  // Decimal places + separators, loaded once after sign-in. Subscribing here
  // means every page re-renders with the new format the moment it changes.
  const load = useNumberFormatStore((st) => st.load);
  useNumberFormatStore((st) => `${st.amount_decimals}|${st.quantity_decimals}|${st.number_format}`);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="cs-page flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
