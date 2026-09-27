import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings, ShieldCheck, Users, Building2, MapPin, KeyRound, History, ScrollText, ChevronDown, Cake, ClipboardList, Package, BarChart3, LayoutDashboard } from "lucide-react";
import { Can } from "../components/Can";
import { BrandLogo } from "../components/BrandLogo";
import { CATALOG_CONFIGS } from "../config/catalogConfigs";
import { ProcessingDateCard } from "./ProcessingDateCard";

const CATALOG_ORDER = ["flavors", "fillings", "frostings", "shapes", "sizes", "themes", "addons", "boxes", "tiers", "colors"];

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [catalogOpen, setCatalogOpen] = useState(location.pathname.includes("/admin/catalog"));

  const NAV_ITEMS = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "" }, // everyone
    { to: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders.page.view" },
    { to: "/admin/inventory", label: "Inventory", icon: Package, permission: "inventory.page.view" },
    { to: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports.page.view" },
    { to: "/admin/organization", label: t("nav.organization"), icon: Building2, permission: "organization.page.view" },
    { to: "/admin/branches", label: t("nav.branches"), icon: MapPin, permission: "branches.page.view" },
    { to: "/admin/system", label: t("nav.systemSetup"), icon: Settings, permission: "system.config.page.view" },
    { to: "/admin/roles", label: t("nav.rolesPermissions"), icon: ShieldCheck, permission: "permissions.page.view" },
    { to: "/admin/staff", label: t("nav.staff"), icon: Users, permission: "staff.page.view" },
    { to: "/admin/access-policy", label: t("nav.accessPolicy"), icon: KeyRound, permission: "access_policy.page.view" },
    { to: "/admin/login-history", label: t("nav.loginHistory"), icon: History, permission: "login_history.page.view" },
    { to: "/admin/audit-trail", label: t("nav.auditTrail"), icon: ScrollText, permission: "audit_trail.page.view" },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm transition-colors ${
      isActive
        ? "bg-cream text-plum-dark font-semibold"
        : "text-cream/80 hover:text-cream hover:bg-plum/50"
    }`;

  return (
    <aside className="w-[248px] bg-plum-dark text-cream flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-7 pt-7 pb-6">
        <BrandLogo size={56} textClassName="font-display text-[26px] font-semibold tracking-tight leading-none block text-cream" />
        <p className="text-xs text-cream/70 mt-1.5">{t("login.internalSystem")}</p>
      </div>

      <nav className="flex-1 px-4 pb-4 flex flex-col gap-1 overflow-y-auto" aria-label="Main">
        {NAV_ITEMS.map(({ to, label, icon: Icon, permission }) => {
          const link = (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          );
          return permission ? <Can key={to} permission={permission}>{link}</Can> : link;
        })}

        {/* Order setup - collapsible group for the 7 cake attribute catalogs */}
        <button
          onClick={() => setCatalogOpen((v) => !v)}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm text-cream/80 hover:text-cream hover:bg-plum/50 transition-colors mt-1"
          aria-expanded={catalogOpen}
        >
          <Cake size={17} strokeWidth={1.75} />
          <span className="flex-1 text-left rtl:text-right">Order setup</span>
          <ChevronDown size={14} className={`transition-transform ${catalogOpen ? "rotate-180" : ""}`} />
        </button>

        {catalogOpen && (
          <div className="flex flex-col gap-0.5 pl-4 rtl:pl-0 rtl:pr-4">
            {CATALOG_ORDER.map((key) => {
              const config = CATALOG_CONFIGS[key];
              return (
                <Can key={key} permission={`${config.permissionPrefix}.page.view`}>
                  <NavLink
                    to={`/admin/catalog/${key}`}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                        isActive ? "text-cream font-semibold bg-plum/50" : "text-cream/70 hover:text-cream"
                      }`
                    }
                  >
                    {config.title}
                  </NavLink>
                </Can>
              );
            })}
            <Can permission="delivery_zones.page.view">
              <NavLink
                to="/admin/delivery-zones"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                    isActive ? "text-cream font-semibold bg-plum/50" : "text-cream/70 hover:text-cream"
                  }`
                }
              >
                Delivery zones
              </NavLink>
            </Can>
          </div>
        )}
      </nav>

      <div className="px-4 pb-5">
        <ProcessingDateCard />
      </div>
    </aside>
  );
}
