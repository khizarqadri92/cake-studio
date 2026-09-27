import { useEffect, useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { branchesApi, Branch } from "../api/branches";
import { branchAccessApi, BranchAccessMap, AccessLevel } from "../api/branchAccess";

const SECTION_SENTINEL = "_section_";

const SECTION_LABELS: Record<string, string> = {
  main: "Main Branch Section",
  contact: "Address and Contact",
  hours: "Hours, Time Zone, Currency",
  status: "Status",
};

const FIELD_LABELS: Record<string, string> = {
  address_line1: "Address Line 1",
  address_line2: "Address Line 2",
  city: "City",
  state: "Province / State",
  country: "Country",
  postal_code: "Postal Code",
  phone: "Phone",
  email: "Email",
  manager_staff_id: "Manager",
  business_hours: "Business Hours",
  timezone: "Time Zone",
  currency: "Currency",
  is_active: "Active Status",
  is_default: "Default Branch",
};

const SECTION_ORDER = ["main", "contact", "hours", "status"];

const LEVEL_STYLES: Record<AccessLevel, string> = {
  enable: "text-sage",
  view_only: "text-honey",
  disable: "text-muted",
};

function AccessDropdown({ value, onChange }: { value: AccessLevel; onChange: (v: AccessLevel) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AccessLevel)}
      className={`border border-hairline rounded-lg px-2 py-1 text-xs bg-surface ${LEVEL_STYLES[value]}`}
    >
      <option value="enable">Enable</option>
      <option value="disable">Disable</option>
      <option value="view_only">View only</option>
    </select>
  );
}

export function BranchAccessTree({ roleId }: { roleId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [accessByBranch, setAccessByBranch] = useState<Record<string, BranchAccessMap>>({});
  const [dirtyBranches, setDirtyBranches] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [savedBranch, setSavedBranch] = useState<string | null>(null);

  useEffect(() => {
    branchesApi.list().then(setBranches);
  }, []);

  // Reset everything when the role being configured changes.
  useEffect(() => {
    setExpandedBranchId(null);
    setExpandedSections(new Set());
    setAccessByBranch({});
    setDirtyBranches(new Set());
  }, [roleId]);

  const toggleBranch = async (branchId: string) => {
    if (expandedBranchId === branchId) {
      setExpandedBranchId(null);
      return;
    }
    setExpandedBranchId(branchId);
    if (!accessByBranch[branchId]) {
      const data = await branchAccessApi.get(roleId, branchId);
      setAccessByBranch((prev) => ({ ...prev, [branchId]: data }));
    }
  };

  const toggleSection = (branchId: string, sectionKey: string) => {
    const key = `${branchId}:${sectionKey}`;
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setLevel = (branchId: string, sectionKey: string, fieldKey: string, level: AccessLevel) => {
    setAccessByBranch((prev) => ({
      ...prev,
      [branchId]: {
        ...prev[branchId],
        [sectionKey]: { ...prev[branchId]?.[sectionKey], [fieldKey]: level },
      },
    }));
    setDirtyBranches((prev) => new Set(prev).add(branchId));
    setSavedBranch(null);
  };

  const saveBranch = async (branchId: string) => {
    const map = accessByBranch[branchId];
    if (!map) return;
    const entries = Object.entries(map).flatMap(([section_key, fields]) =>
      Object.entries(fields).map(([field_key, access_level]) => ({ section_key, field_key, access_level }))
    );
    setSaving(branchId);
    try {
      await branchAccessApi.set(roleId, branchId, entries);
      setDirtyBranches((prev) => {
        const next = new Set(prev);
        next.delete(branchId);
        return next;
      });
      setSavedBranch(branchId);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mt-6 border-t border-hairline pt-5">
      <h3 className="text-sm font-medium text-ink mb-3">Branch access</h3>
      <div className="border border-hairline rounded-lg overflow-hidden">
        {branches.map((branch) => {
          const isOpen = expandedBranchId === branch.id;
          const access = accessByBranch[branch.id];
          return (
            <div key={branch.id} className="border-t border-hairline first:border-t-0">
              <button
                onClick={() => toggleBranch(branch.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-flour/60 text-left"
              >
                <ChevronRight size={15} className={`text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
                <span className="font-medium text-ink">{branch.name}</span>
                <span className="text-xs text-muted font-mono">{branch.code}</span>
                {dirtyBranches.has(branch.id) && <span className="text-xs text-honey ml-auto">Unsaved</span>}
              </button>

              {isOpen && access && (
                <div className="px-4 pb-4 pl-9 space-y-1">
                  {SECTION_ORDER.map((sectionKey) => {
                    const fields = Object.keys(access[sectionKey] ?? {});
                    const isSectionOnly = fields.length === 1 && fields[0] === SECTION_SENTINEL;
                    const sectionExpanded = expandedSections.has(`${branch.id}:${sectionKey}`);

                    if (isSectionOnly) {
                      return (
                        <div key={sectionKey} className="flex items-center justify-between py-1.5 text-sm">
                          <span className="text-ink/80">{SECTION_LABELS[sectionKey]}</span>
                          <AccessDropdown
                            value={access[sectionKey][SECTION_SENTINEL]}
                            onChange={(v) => setLevel(branch.id, sectionKey, SECTION_SENTINEL, v)}
                          />
                        </div>
                      );
                    }

                    return (
                      <div key={sectionKey}>
                        <button
                          onClick={() => toggleSection(branch.id, sectionKey)}
                          className="w-full flex items-center gap-2 py-1.5 text-sm text-left"
                        >
                          <ChevronRight
                            size={13}
                            className={`text-muted transition-transform ${sectionExpanded ? "rotate-90" : ""}`}
                          />
                          <span className="text-ink/80">{SECTION_LABELS[sectionKey]}</span>
                        </button>
                        {sectionExpanded && (
                          <div className="pl-6 space-y-1.5">
                            {fields.map((fieldKey) => (
                              <div key={fieldKey} className="flex items-center justify-between py-1 text-sm">
                                <span className="text-muted text-xs">{FIELD_LABELS[fieldKey] ?? fieldKey}</span>
                                <AccessDropdown
                                  value={access[sectionKey][fieldKey]}
                                  onChange={(v) => setLevel(branch.id, sectionKey, fieldKey, v)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => saveBranch(branch.id)}
                      disabled={saving === branch.id || !dirtyBranches.has(branch.id)}
                      className="bg-plum text-cream text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
                    >
                      {saving === branch.id ? "Saving…" : `Save ${branch.name} access`}
                    </button>
                    {savedBranch === branch.id && (
                      <span className="flex items-center gap-1 text-xs text-sage">
                        <Check size={13} /> Saved
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
