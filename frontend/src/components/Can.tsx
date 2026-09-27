import { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";

interface CanProps {
  permission: string;
  children: ReactNode;
  /** If true, render children but disabled instead of hiding them entirely. */
  fallbackDisabled?: boolean;
}

/**
 * Wrap any page section, field, or button with this.
 *
 * <Can permission="orders.button.delete">
 *   <DeleteButton />
 * </Can>
 *
 * Note: this is UX only. The backend must independently enforce the same
 * permission key on the corresponding API endpoint - never trust the
 * frontend hide/show alone.
 */
export function Can({ permission, children, fallbackDisabled = false }: CanProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const allowed = hasPermission(permission);

  if (allowed) return <>{children}</>;

  if (fallbackDisabled) {
    return <div style={{ opacity: 0.5, pointerEvents: "none" }}>{children}</div>;
  }

  return null;
}
