import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { SystemConfigPage } from "./pages/admin/SystemConfigPage";
import { RolesPermissionsPage } from "./pages/admin/RolesPermissionsPage";
import { StaffPage } from "./pages/admin/StaffPage";
import { OrganizationPage } from "./pages/admin/OrganizationPage";
import { BranchesPage } from "./pages/admin/BranchesPage";
import { AccessPolicyPage } from "./pages/admin/AccessPolicyPage";
import { LoginHistoryPage } from "./pages/admin/LoginHistoryPage";
import { AuditTrailPage } from "./pages/admin/AuditTrailPage";
import { CatalogPage } from "./pages/admin/CatalogPage";
import { DeliveryZonesPage } from "./pages/admin/DeliveryZonesPage";
import { OrdersPage } from "./pages/admin/OrdersPage";
import { InventoryItemsPage } from "./pages/admin/InventoryItemsPage";
import { ReportsPage } from "./pages/admin/ReportsPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { SecuritySettingsPage } from "./pages/SecuritySettingsPage";
import { RequireAuth } from "./routes/RequireAuth";
import { AdminLayout } from "./routes/AdminLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="branches" element={<BranchesPage />} />
          <Route path="system" element={<SystemConfigPage />} />
          <Route path="roles" element={<RolesPermissionsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="access-policy" element={<AccessPolicyPage />} />
          <Route path="login-history" element={<LoginHistoryPage />} />
          <Route path="audit-trail" element={<AuditTrailPage />} />
          <Route path="catalog/:catalogKey" element={<CatalogPage />} />
          <Route path="delivery-zones" element={<DeliveryZonesPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="inventory" element={<InventoryItemsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="security" element={<SecuritySettingsPage />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
