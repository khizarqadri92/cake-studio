import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { securityLogsApi, LoginHistoryEntry } from "../../api/security";
import { Can } from "../../components/Can";

const REASON_LABELS: Record<string, string> = {
  invalid_credentials: "Wrong email or password",
  account_locked: "Account locked",
  ip_restricted: "Blocked network",
  totp_required: "Authenticator code required",
  totp_invalid: "Wrong authenticator code",
};

export function LoginHistoryPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LoginHistoryEntry[]>([]);

  useEffect(() => {
    securityLogsApi.loginHistory().then(setEntries);
  }, []);

  return (
    <Can permission="login_history.page.view">
      <div className="p-6 max-w-4xl">
        <h1 className="text-lg font-medium text-ink mb-6">{t("nav.loginHistory")}</h1>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 border-hairline border-b">Time</th>
              <th className="text-left p-2 border-hairline border-b">Email</th>
              <th className="text-left p-2 border-hairline border-b">Result</th>
              <th className="text-left p-2 border-hairline border-b">IP address</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="p-2 border-hairline border-b font-mono text-xs text-muted">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="p-2 border-hairline border-b">{e.attempted_email}</td>
                <td className="p-2 border-hairline border-b">
                  {e.success ? (
                    <span className="text-sage">Success</span>
                  ) : (
                    <span className="text-plum">{REASON_LABELS[e.failure_reason ?? ""] ?? "Failed"}</span>
                  )}
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
