import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { organizationApi, Organization } from "../../api/organization";
import { mediaUrl } from "../../api/client";
import { Can } from "../../components/Can";
import { BusinessHoursEditor } from "../../components/BusinessHoursEditor";
import { applyLanguage } from "../../i18n";

const BUSINESS_TYPES = ["Sole proprietorship", "Partnership", "LLC", "Corporation", "Other"];
const TIMEZONES = ["Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];
const LANGUAGES = [{ code: "en", label: "English" }, { code: "ur", label: "اردو (Urdu)" }, { code: "ar", label: "العربية (Arabic)" }];
const CURRENCIES = ["PKR", "USD", "GBP", "EUR", "AED", "INR"];
const DATE_FORMATS = [
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "YYYY-MM-DD",
  "DD-MM-YYYY",
  "MM-DD-YYYY",
  "DD.MM.YYYY",
  "YYYY/MM/DD",
  "DD/MM/YY",
  "MM/DD/YY",
  "D MMM YYYY",
  "MMM D, YYYY",
  "D MMMM YYYY",
];
const TIME_FORMATS = [
  { value: "hh:mm A", label: "hh:mm AM/PM (12-hour) — 02:30 PM" },
  { value: "hh:mm:ss A", label: "hh:mm:ss AM/PM (12-hour, with seconds) — 02:30:15 PM" },
  { value: "HH:mm", label: "HH:mm (24-hour) — 14:30" },
  { value: "HH:mm:ss", label: "HH:mm:ss (24-hour, with seconds) — 14:30:15" },
];
const NUMBER_FORMATS = [
  { value: "1,234.56", label: "1,234.56 (comma thousands)" },
  { value: "1.234,56", label: "1.234,56 (dot thousands)" },
  { value: "1 234.56", label: "1 234.56 (space thousands)" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink/70 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface outline-none focus:border-plum transition-colors disabled:bg-flour disabled:text-muted";

export function OrganizationPage() {
  const { t } = useTranslation();
  const [org, setOrg] = useState<Organization | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = () => organizationApi.get().then(setOrg);

  useEffect(() => {
    load();
  }, []);

  if (!org) return <div className="p-6 text-sm text-muted">{t("common.loading")}</div>;

  const set = (patch: Partial<Organization>) => setOrg({ ...org, ...patch });

  const saveSection = async (section: string, fn: () => Promise<Organization>) => {
    setSaving(section);
    try {
      const updated = await fn();
      setOrg(updated);
      if (section === "locale") {
        applyLanguage(updated.default_language); // switch the whole app's language immediately
      }
    } finally {
      setSaving(null);
    }
  };

  const handleFile = async (kind: "logo" | "favicon", file: File | undefined) => {
    if (!file) return;
    const updated = kind === "logo" ? await organizationApi.uploadLogo(file) : await organizationApi.uploadFavicon(file);
    setOrg(updated);
  };

  return (
    <Can permission="organization.page.view">
      <div className="p-6 max-w-3xl space-y-10">
        <h1 className="text-lg font-medium text-ink">{t("organization.title")}</h1>

        <section>
          <h2 className="text-sm font-medium text-ink mb-3">{t("organization.identity")}</h2>
          <Can permission="organization.field.identity.edit" fallbackDisabled>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label={t("organization.companyName")}>
                <input className={inputClass} value={org.company_name} onChange={(e) => set({ company_name: e.target.value })} />
              </Field>
              <Field label={t("organization.legalName")}>
                <input className={inputClass} value={org.legal_name ?? ""} onChange={(e) => set({ legal_name: e.target.value })} />
              </Field>
              <Field label={t("organization.registrationNumber")}>
                <input className={inputClass} value={org.registration_number ?? ""} onChange={(e) => set({ registration_number: e.target.value })} />
              </Field>
              <Field label={t("organization.taxNumber")}>
                <input className={inputClass} value={org.tax_number ?? ""} onChange={(e) => set({ tax_number: e.target.value })} />
              </Field>
              <Field label={t("organization.businessType")}>
                <select className={inputClass} value={org.business_type ?? ""} onChange={(e) => set({ business_type: e.target.value })}>
                  <option value="">—</option>
                  {BUSINESS_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </Field>
              <Field label={t("organization.industry")}>
                <input className={inputClass} value={org.industry ?? ""} onChange={(e) => set({ industry: e.target.value })} placeholder="Bakery and confectionery" />
              </Field>
            </div>
          </Can>
          <Can permission="organization.field.identity.edit">
            <button
              onClick={() => saveSection("identity", () => organizationApi.updateIdentity(org))}
              disabled={saving === "identity"}
              className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving === "identity" ? t("common.saving") : t("organization.saveIdentity")}
            </button>
          </Can>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ink mb-3">{t("organization.branding")}</h2>
          <Can permission="organization.field.branding.edit" fallbackDisabled>
            <div className="flex gap-8">
              <div>
                <p className="text-xs font-medium text-ink/70 mb-2">{t("organization.logo")}</p>
                {org.logo_url && <img src={mediaUrl(org.logo_url)} alt="Company logo" className="w-16 h-16 object-contain border border-hairline rounded-lg mb-2 bg-surface" />}
                <input type="file" accept="image/*" onChange={(e) => handleFile("logo", e.target.files?.[0])} className="text-xs" />
              </div>
              <div>
                <p className="text-xs font-medium text-ink/70 mb-2">{t("organization.favicon")}</p>
                {org.favicon_url && <img src={mediaUrl(org.favicon_url)} alt="Favicon" className="w-8 h-8 object-contain border border-hairline rounded-lg mb-2 bg-surface" />}
                <input type="file" accept="image/*" onChange={(e) => handleFile("favicon", e.target.files?.[0])} className="text-xs" />
              </div>
            </div>
          </Can>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ink mb-3">{t("organization.addressContact")}</h2>
          <Can permission="organization.field.contact.edit" fallbackDisabled>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label={t("organization.addressLine1")}>
                <input className={inputClass} value={org.address_line1 ?? ""} onChange={(e) => set({ address_line1: e.target.value })} />
              </Field>
              <Field label={t("organization.addressLine2")}>
                <input className={inputClass} value={org.address_line2 ?? ""} onChange={(e) => set({ address_line2: e.target.value })} />
              </Field>
              <Field label={t("organization.city")}>
                <input className={inputClass} value={org.city ?? ""} onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label={t("organization.state")}>
                <input className={inputClass} value={org.state ?? ""} onChange={(e) => set({ state: e.target.value })} />
              </Field>
              <Field label={t("organization.country")}>
                <input className={inputClass} value={org.country ?? ""} onChange={(e) => set({ country: e.target.value })} />
              </Field>
              <Field label={t("organization.postalCode")}>
                <input className={inputClass} value={org.postal_code ?? ""} onChange={(e) => set({ postal_code: e.target.value })} />
              </Field>
              <Field label={t("organization.primaryPhone")}>
                <input className={inputClass} value={org.phone_primary ?? ""} onChange={(e) => set({ phone_primary: e.target.value })} />
              </Field>
              <Field label={t("organization.secondaryPhone")}>
                <input className={inputClass} value={org.phone_secondary ?? ""} onChange={(e) => set({ phone_secondary: e.target.value })} />
              </Field>
              <Field label={t("organization.primaryEmail")}>
                <input className={inputClass} value={org.email_primary ?? ""} onChange={(e) => set({ email_primary: e.target.value })} />
              </Field>
              <Field label={t("organization.secondaryEmail")}>
                <input className={inputClass} value={org.email_secondary ?? ""} onChange={(e) => set({ email_secondary: e.target.value })} />
              </Field>
              <Field label={t("organization.websiteUrl")}>
                <input className={inputClass} value={org.website_url ?? ""} onChange={(e) => set({ website_url: e.target.value })} />
              </Field>
            </div>
          </Can>
          <Can permission="organization.field.contact.edit">
            <button
              onClick={() => saveSection("contact", () => organizationApi.updateContact(org))}
              disabled={saving === "contact"}
              className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving === "contact" ? t("common.saving") : t("organization.saveContact")}
            </button>
          </Can>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ink mb-3">{t("organization.hoursTimezone")}</h2>
          <Can permission="organization.field.hours.edit" fallbackDisabled>
            <div className="mb-3">
              <Field label={t("organization.timezone")}>
                <select className={`${inputClass} max-w-xs mb-4`} value={org.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>
              <BusinessHoursEditor value={org.business_hours} onChange={(business_hours) => set({ business_hours })} />
            </div>
          </Can>
          <Can permission="organization.field.hours.edit">
            <button
              onClick={() => saveSection("hours", () => organizationApi.updateHours({ business_hours: org.business_hours, timezone: org.timezone }))}
              disabled={saving === "hours"}
              className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving === "hours" ? t("common.saving") : t("organization.saveHours")}
            </button>
          </Can>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ink mb-3">{t("organization.locale")}</h2>
          <Can permission="organization.field.locale.edit" fallbackDisabled>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <Field label={t("organization.defaultLanguage")}>
                <select className={inputClass} value={org.default_language} onChange={(e) => set({ default_language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </Field>
              <Field label={t("organization.defaultCurrency")}>
                <select className={inputClass} value={org.default_currency} onChange={(e) => set({ default_currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t("organization.dateFormat")}>
                <select className={inputClass} value={org.date_format} onChange={(e) => set({ date_format: e.target.value })}>
                  {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label={t("organization.timeFormat")}>
                <select className={inputClass} value={org.time_format} onChange={(e) => set({ time_format: e.target.value })}>
                  {TIME_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
              <Field label={t("organization.numberFormat")}>
                <select className={inputClass} value={org.number_format} onChange={(e) => set({ number_format: e.target.value })}>
                  {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
            </div>
          </Can>
          <Can permission="organization.field.locale.edit">
            <button
              onClick={() => saveSection("locale", () => organizationApi.updateLocale(org))}
              disabled={saving === "locale"}
              className="bg-plum text-cream text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving === "locale" ? t("common.saving") : t("organization.saveLocale")}
            </button>
          </Can>
        </section>
      </div>
    </Can>
  );
}
