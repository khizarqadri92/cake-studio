import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { securityLogsApi, AuditLogEntry } from "../../api/security";
import { Can } from "../../components/Can";

const ACTION_LABELS: Record<string, string> = {
  "staff.created": "Staff account created",
  "staff.roles_changed": "Staff roles changed",
  "staff.status_changed": "Staff status changed",
  "role.permissions_changed": "Role permissions changed",
  "account.locked": "Account locked",
  "2fa.enabled": "Two-factor enabled",
  "2fa.disabled": "Two-factor disabled",
  "password.changed": "Password changed",
};

export function AuditTrailPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    securityLogsApi.auditTrail().then(setEntries);
  }, []);

  return (
    <Can permission="audit_trail.page.view">
      <div className="p-6 max-w-4xl">
        <h1 className="text-lg font-medium text-ink mb-6">{t("nav.auditTrail")}</h1>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-hairline border-b">Time</th>
              <th className="text-left p-2 border-hairline border-b">Action</th>
              <th className="text-left p-2 border-hairline border-b">Target</th>
              <th className="text-left p-2 border-hairline border-b">IP address</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="p-2 border-hairline border-b font-mono text-xs text-muted">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="p-2 border-hairline border-b">{ACTION_LABELS[e.action] ?? e.action}</td>
                <td className="p-2 border-hairline border-b font-mono text-xs text-muted">
                  {e.target_type ? `${e.target_type}:${e.target_id?.slice(0, 8)}` : "—"}
                </td>
                <td className="p-2 border-hairline border-b font-mono text-xs text-muted">{e.ip_address ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Can>
  );
}
