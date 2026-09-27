import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Lock, Eye, EyeOff, ClipboardList, Package, Users, Calculator } from "lucide-react";
import { login } from "../api/client";
import { BrandLogo, useBranding } from "../components/BrandLogo";

const FEATURES = [
  { icon: ClipboardList, key: "featureOrders" },
  { icon: Package, key: "featureInventory" },
  { icon: Users, key: "featureStaff" },
  { icon: Calculator, key: "featureAccounting" },
];

export function LoginPage() {
  const { t } = useTranslation();
  const branding = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password, needsTotp ? totpCode : undefined);
      if (data.password_expired) {
        navigate("/admin/security?expired=1");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === "totp_required") {
        setNeedsTotp(true);
        setError(null);
      } else if (err?.response?.status === 423) {
        setError(t("login.errorLocked"));
      } else {
        setError(needsTotp ? t("login.errorWrongCode") : t("login.errorWrongCredentials"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-flour">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[44%] bg-plum-dark text-cream flex-col justify-between p-14">
        <div>
          <p className="font-display text-[28px] font-semibold tracking-tight">{branding?.company_name ?? "Cake Studio"}</p>
          <p className="text-sm text-cream/75 mt-1">{t("login.internalSystem")}</p>
        </div>

        <div className="max-w-md">
          <p className="font-display text-[44px] leading-[1.1] font-semibold tracking-tight mb-10">
            {t("login.tagline")}
          </p>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-center gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-plum flex items-center justify-center shrink-0">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className="text-[15px] text-cream/90">{t(`login.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-cream/70">
          © {new Date().getFullYear()} {branding?.company_name ?? "Cake Studio"}
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="mb-8">
          <BrandLogo size={130} textClassName="font-display text-3xl text-ink" />
        </div>

        <div className="w-full max-w-[400px] bg-surface border border-hairline rounded-2xl shadow-sm p-9">
          <form onSubmit={handleSubmit}>
            {!needsTotp ? (
              <>
                <h2 className="font-display text-[28px] font-semibold tracking-tight text-ink mb-1.5">{t("login.signIn")}</h2>
                <p className="text-sm text-muted mb-8">{t("login.subtitle")}</p>

                <label className="block text-xs font-medium text-ink/70 mb-1.5" htmlFor="email">
                  {t("login.email")}
                </label>
                <div className="relative mb-4">
                  <Mail size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-ink/35" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@cakestudio.local"
                    className="w-full border border-hairline rounded-xl pl-10 rtl:pl-3 rtl:pr-10 pr-3 h-12 bg-flour/50 text-sm outline-none focus:border-plum focus:bg-surface focus:ring-4 focus:ring-plum/10 transition"
                    required
                  />
                </div>

                <label className="block text-xs font-medium text-ink/70 mb-1.5" htmlFor="password">
                  {t("login.password")}
                </label>
                <div className="relative mb-6">
                  <Lock size={16} className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-ink/35" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-hairline rounded-xl pl-10 pr-10 h-12 bg-flour/50 text-sm outline-none focus:border-plum focus:bg-surface focus:ring-4 focus:ring-plum/10 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-ink/35 hover:text-muted"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-[28px] font-semibold tracking-tight text-ink mb-1.5">{t("login.enterCode")}</h2>
                <p className="text-sm text-muted mb-8">{t("login.codeSubtitle")}</p>

                <label className="block text-xs font-medium text-ink/70 mb-1.5" htmlFor="totp">
                  {t("login.authenticatorCode")}
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full border border-hairline rounded-xl px-3 h-12 mb-6 bg-flour/50 text-sm font-mono tracking-[0.3em] text-center outline-none focus:border-plum focus:bg-surface focus:ring-4 focus:ring-plum/10 transition"
                  required
                />
              </>
            )}

            {error && (
              <p className="text-sm text-plum bg-plum/5 border border-plum/20 rounded-lg px-3 py-2 mb-5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-plum text-cream rounded-xl h-12 text-[15px] font-bold hover:bg-plum-dark transition-colors disabled:opacity-50"
            >
              {loading ? t("login.signingIn") : needsTotp ? t("login.verify") : t("login.signIn")}
            </button>
          </form>
        </div>

        <p className="text-xs text-muted mt-6">{t("login.footer")}</p>
      </div>
    </div>
  );
}
