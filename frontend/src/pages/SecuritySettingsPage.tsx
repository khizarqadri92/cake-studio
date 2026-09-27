import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { securityApi } from "../api/security";
import { useAuthStore } from "../store/authStore";

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors";

export function SecuritySettingsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const expiredNotice = params.get("expired") === "1";

  const staff = useAuthStore((s) => s.staff);
  const [pwForm, setPwForm] = useState({ current: "", next: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const [totpSetup, setTotpSetup] = useState<{ secret: string; provisioning_uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(staff?.totp_enabled ?? false);
  const [totpMessage, setTotpMessage] = useState<string | null>(null);

  const changePassword = async () => {
    setPwError(null);
    setPwMessage(null);
    setPwSaving(true);
    try {
      await securityApi.changePassword(pwForm.current, pwForm.next);
      setPwMessage("Password updated.");
      setPwForm({ current: "", next: "" });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setPwError(Array.isArray(detail) ? detail.join(", ") : detail ?? "Couldn't update password.");
    } finally {
      setPwSaving(false);
    }
  };

  const startTotpSetup = async () => {
    const data = await securityApi.setupTwoFactor();
    setTotpSetup(data);
    setTotpMessage(null);
  };

  const verifyTotp = async () => {
    try {
      await securityApi.verifyTwoFactor(totpCode);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode("");
      setTotpMessage("Two-factor authentication is now enabled.");
    } catch {
      setTotpMessage("That code didn't verify. Try again.");
    }
  };

  const disableTotp = async () => {
    await securityApi.disableTwoFactor();
    setTotpEnabled(false);
    setTotpMessage("Two-factor authentication turned off.");
  };

  return (
    <div className="p-6 max-w-2xl space-y-10">
      <h1 className="text-lg font-medium text-ink">{t("security.title")}</h1>

      {expiredNotice && (
        <div className="bg-honey/10 border border-honey/30 text-sm text-ink rounded-lg px-4 py-3">
          Your password has expired. Please set a new one to continue.
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium text-ink mb-3">{t("security.changePassword")}</h2>
        <div className="space-y-2 max-w-sm mb-3">
          <input
            type="password"
            placeholder={t("security.currentPassword")}
            value={pwForm.current}
            onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
            className={inputClass}
          />
          <input
            type="password"
            placeholder={t("security.newPassword")}
            value={pwForm.next}
            onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
            className={inputClass}
          />
        </div>
        {pwMessage && <p className="text-sm text-sage mb-2">{pwMessage}</p>}
        {pwError && <p className="text-sm text-plum mb-2">{pwError}</p>}
        <button
          onClick={changePassword}
          disabled={pwSaving}
          className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {pwSaving ? t("common.saving") : t("security.updatePassword")}
        </button>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink mb-3">{t("security.twoFactorAuth")}</h2>

        {totpEnabled ? (
          <div>
            <p className="text-sm text-ink/70 mb-3">Two-factor authentication is currently enabled on your account.</p>
            <button onClick={disableTotp} className="border border-hairline text-sm px-3 py-1.5 rounded-lg text-ink/70">
              Disable two-factor authentication
            </button>
          </div>
        ) : totpSetup ? (
          <div className="max-w-sm">
            <p className="text-sm text-ink/70 mb-2">
              Add this account to your authenticator app (Google Authenticator, Authy, etc.) using this key:
            </p>
            <p className="font-mono text-sm bg-flour border border-hairline rounded-lg px-3 py-2 mb-3 break-all">
              {totpSetup.secret}
            </p>
            <p className="text-xs text-muted mb-3 break-all">{totpSetup.provisioning_uri}</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter the 6-digit code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className={`${inputClass} mb-3 font-mono tracking-widest`}
            />
            <button onClick={verifyTotp} className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg">
              Verify and enable
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-ink/70 mb-3">
              Two-factor authentication adds a code from your phone on top of your password when signing in.
            </p>
            <button onClick={startTotpSetup} className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg">
              Set up two-factor authentication
            </button>
          </div>
        )}

        {totpMessage && <p className="text-sm text-muted mt-3">{totpMessage}</p>}
      </section>
    </div>
  );
}
