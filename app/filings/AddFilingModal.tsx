"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { SuggestedFiling } from "@/lib/compliance-engine";

type FilingTemplateKey =
  | "Sales Tax Filing"
  | "Payroll Tax Filing"
  | "Form 941"
  | "Form 940"
  | "Annual Report"
  | "Biennial Statement"
  | "Franchise Tax"
  | "Business License Renewal"
  | "Estimated Tax Payment"
  | "Personal Tax Return"
  | "Corporate Tax Return"
  | "Partnership Return"
  | "S Corp Return"
  | "BOI Filing"
  | "1099 Filing"
  | "W-2 Filing";

type NewFilingForm = {
  title: string;
  company: string;
  state: string;
  dueDate: string;
  type: string;
  templateKey: FilingTemplateKey | "";
  assignee: string;
};

type CompanyOption = {
  id: string;
  name: string;
  state: string;
  kind: "client" | "organization";
};

type FilingTemplateMap = Record<
  FilingTemplateKey,
  {
    titleSuggestion: string;
    type: string;
    tasks: string[];
  }
>;

type AddFilingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  newFiling: NewFilingForm;
  setNewFiling: Dispatch<SetStateAction<NewFilingForm>>;
  errors: Partial<Record<keyof NewFilingForm, string>>;
  submitAttempted: boolean;
  updateForm: <K extends keyof NewFilingForm>(field: K, value: NewFilingForm[K]) => void;
  companyOptions: CompanyOption[];
  suggestedFilings: SuggestedFiling[];
  selectedSuggestionKeys: string[];
  toggleSuggestedFiling: (suggestion: SuggestedFiling) => void;
  loadComplianceSuggestions: () => void | Promise<void>;
  isLoadingSuggestions: boolean;
  isSavingFiling: boolean;
  filingTemplates?: FilingTemplateMap;
};

type CreationMode = "engine" | "manual" | "template";
type PreviewStatus = "Overdue" | "Due Soon" | "Ready" | "Upcoming";

function fieldClass(hasError?: boolean) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
    hasError
      ? "border-red-400/40 bg-red-500/5 text-white placeholder:text-slate-500"
      : "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.07]"
  }`;
}

function badgeClass(active: boolean) {
  return active
    ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_32px_rgba(34,211,238,0.08)]"
    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]";
}

function formatFriendlyDate(value: string) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function derivePreviewStatus(dueDate: string): PreviewStatus | null {
  if (!dueDate) return null;
  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays <= 7) return "Due Soon";
  if (diffDays <= 30) return "Ready";
  return "Upcoming";
}

function previewStatusTone(status: PreviewStatus | null) {
  switch (status) {
    case "Overdue":
      return "border-red-400/25 bg-red-500/10 text-red-200";
    case "Due Soon":
      return "border-yellow-300/25 bg-yellow-400/10 text-yellow-200";
    case "Ready":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "Upcoming":
      return "border-blue-400/25 bg-blue-500/10 text-blue-200";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function normalizeCompanyKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function getSuggestionSelectionKey(suggestion: SuggestedFiling) {
  return `${suggestion.filingKey}|${suggestion.dueDate}|${suggestion.jurisdictionCode}`;
}

function getCompanyPriority(company: CompanyOption) {
  return (company.kind === "client" ? 10 : 0) + (company.state ? 1 : 0);
}

function getCreationModeMeta(mode: CreationMode) {
  if (mode === "engine") {
    return {
      icon: Sparkles,
      label: "Smart recommendations",
      description: "Use your compliance profile to suggest what should be filed next.",
      accent:
        "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.09),rgba(255,255,255,0.02))]",
    };
  }

  if (mode === "template") {
    return {
      icon: Layers3,
      label: "Template workflow",
      description: "Start from a proven structure and fill in the details.",
      accent:
        "border-violet-400/20 bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(255,255,255,0.02))]",
    };
  }

  return {
    icon: Wand2,
    label: "Manual one-off",
    description: "Create a filing directly when you already know what needs to be added.",
    accent:
      "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]",
  };
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
        {eyebrow}
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-400">{description}</div>
    </div>
  );
}

export default function AddFilingModal({
  isOpen,
  onClose,
  onSave,
  newFiling,
  setNewFiling,
  errors,
  submitAttempted,
  updateForm,
  companyOptions,
  suggestedFilings,
  selectedSuggestionKeys,
  toggleSuggestedFiling,
  loadComplianceSuggestions,
  isLoadingSuggestions,
  isSavingFiling,
  filingTemplates,
}: AddFilingModalProps) {
  const modalTitleRef = useRef<HTMLInputElement | null>(null);
  const companyButtonRef = useRef<HTMLButtonElement | null>(null);
  const companyPanelRef = useRef<HTMLDivElement | null>(null);
  const lastRequestedCompanyRef = useRef<string | null>(null);
  const autoLoadedCompanyRef = useRef<string | null>(null);

  const [creationMode, setCreationMode] = useState<CreationMode>("engine");
  const [companyQuery, setCompanyQuery] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);

  const visibleCompanyOptions = useMemo(() => {
    const clientOptions = companyOptions.filter((company) => company.kind === "client");
    return clientOptions.length > 0 ? clientOptions : companyOptions;
  }, [companyOptions]);

  const dedupedCompanies = useMemo(() => {
    const map = new Map<string, CompanyOption>();

    for (const company of visibleCompanyOptions) {
      const key = normalizeCompanyKey(company.name);
      if (!key) continue;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, company);
        continue;
      }

      if (getCompanyPriority(company) > getCompanyPriority(existing)) {
        map.set(key, company);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleCompanyOptions]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return dedupedCompanies.slice(0, 50);
    return dedupedCompanies.filter((company) => {
      return company.name.toLowerCase().includes(q) || company.state.toLowerCase().includes(q);
    });
  }, [companyQuery, dedupedCompanies]);

  const recentCompanies = useMemo(() => dedupedCompanies.slice(0, 5), [dedupedCompanies]);

  const selectedCompany = useMemo(() => {
    const normalizedSelected = normalizeCompanyKey(newFiling.company);
    return (
      dedupedCompanies.find((company) => normalizeCompanyKey(company.name) === normalizedSelected) ||
      null
    );
  }, [dedupedCompanies, newFiling.company]);

  const templateKeys = useMemo(() => {
    return filingTemplates ? (Object.keys(filingTemplates) as FilingTemplateKey[]) : [];
  }, [filingTemplates]);

  const selectedSuggestions = useMemo(() => {
    return suggestedFilings.filter((suggestion) =>
      selectedSuggestionKeys.includes(getSuggestionSelectionKey(suggestion))
    );
  }, [suggestedFilings, selectedSuggestionKeys]);

  const manualTaskCount =
    newFiling.templateKey && filingTemplates?.[newFiling.templateKey]
      ? filingTemplates[newFiling.templateKey].tasks.length
      : 0;

  const previewTaskCount =
    creationMode === "engine"
      ? selectedSuggestions.reduce((sum, suggestion) => sum + suggestion.tasks.length, 0)
      : manualTaskCount;

  const previewStatus = derivePreviewStatus(
    creationMode === "engine" && selectedSuggestions[0]
      ? selectedSuggestions[0].dueDate
      : newFiling.dueDate
  );

  const dynamicPrimaryLabel =
    creationMode === "engine" && selectedSuggestionKeys.length > 0
      ? `Create ${selectedSuggestionKeys.length} Filing${selectedSuggestionKeys.length === 1 ? "" : "s"}`
      : isSavingFiling
        ? "Saving..."
        : "Create Filing";

  const modeMeta = getCreationModeMeta(creationMode);
  const ModeIcon = modeMeta.icon;

  const hasClientError = submitAttempted && !!errors.company && !newFiling.company;

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollBarWidth}px`;

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      lastRequestedCompanyRef.current = null;
      autoLoadedCompanyRef.current = null;
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isCompanyPickerOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        companyPanelRef.current?.contains(target) ||
        companyButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsCompanyPickerOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isCompanyPickerOpen]);

  useEffect(() => {
    if (!isOpen || creationMode !== "engine" || !selectedCompany || isLoadingSuggestions) return;

    const requestKey = `${selectedCompany.id}|${selectedCompany.name}`;
    if (autoLoadedCompanyRef.current === requestKey) return;

    autoLoadedCompanyRef.current = requestKey;
    lastRequestedCompanyRef.current = selectedCompany.id;

    const timer = window.setTimeout(() => {
      void loadComplianceSuggestions();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isOpen, creationMode, selectedCompany, isLoadingSuggestions, loadComplianceSuggestions]);

  function handleSelectCompany(company: CompanyOption) {
    const requestKey = `${company.id}|${company.name}`;
    autoLoadedCompanyRef.current = null;

    setNewFiling((current) => ({
      ...current,
      company: company.name,
      state: company.state ? company.state.toUpperCase() : current.state,
    }));

    updateForm("company", company.name);
    if (company.state) {
      updateForm("state", company.state.toUpperCase());
    }

    lastRequestedCompanyRef.current = null;
    setCompanyQuery(company.name);
    setIsCompanyPickerOpen(false);

    if (creationMode === "engine") {
      autoLoadedCompanyRef.current = requestKey;
      lastRequestedCompanyRef.current = company.id;
      window.setTimeout(() => {
        void loadComplianceSuggestions();
      }, 120);
    }
  }

  if (!isOpen) return null;

  const canSubmit =
    creationMode === "engine"
      ? selectedSuggestionKeys.length > 0 ||
        (!!newFiling.title && !!newFiling.type && !!newFiling.dueDate)
      : !!newFiling.company &&
        !!newFiling.title &&
        !!newFiling.type &&
        !!newFiling.state &&
        !!newFiling.dueDate;

  async function handleEngineRefresh() {
    if (!newFiling.company || isLoadingSuggestions) return;
    lastRequestedCompanyRef.current = selectedCompany?.id ?? newFiling.company;
    autoLoadedCompanyRef.current = selectedCompany
      ? `${selectedCompany.id}|${selectedCompany.name}`
      : newFiling.company;
    await loadComplianceSuggestions();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/92 px-4 py-6 backdrop-blur-2xl">
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dh-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.34) #020617;
        }

        .dh-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .dh-scroll::-webkit-scrollbar-track {
          background: rgba(2, 6, 23, 0.88);
          border-radius: 9999px;
        }

        .dh-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(
            180deg,
            rgba(34, 211, 238, 0.42),
            rgba(59, 130, 246, 0.36)
          );
          border-radius: 9999px;
          border: 2px solid rgba(2, 6, 23, 0.88);
        }

        .dh-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(
            180deg,
            rgba(34, 211, 238, 0.58),
            rgba(59, 130, 246, 0.48)
          );
        }
      `}</style>

      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] border border-cyan-400/10 bg-[linear-gradient(180deg,#031025,#020617)] shadow-[0_40px_120px_rgba(0,0,0,0.68)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_42%)] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-4xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Add Filing
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">
                Create filings with confidence
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Pick a client, let the compliance engine surface smart recommendations, or switch
                to a template or manual flow when you need a one-off.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setCreationMode("engine")}
              className={`rounded-[24px] border p-4 text-left transition ${badgeClass(creationMode === "engine")}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-2.5 text-cyan-200">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Use Compliance Engine</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">
                    Smart recommendations load automatically after you choose a client.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("template")}
              className={`rounded-[24px] border p-4 text-left transition ${badgeClass(creationMode === "template")}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-violet-300/15 bg-violet-400/10 p-2.5 text-violet-200">
                  <Layers3 size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Create From Template</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">
                    Start with a proven workflow and let the filing details auto-fill.
                  </div>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("manual")}
              className={`rounded-[24px] border p-4 text-left transition ${badgeClass(creationMode === "manual")}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-slate-200">
                  <Wand2 size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Add Manually</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">
                    Create a one-off filing when you already know exactly what needs to be added.
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="dh-scroll min-h-0 overflow-y-auto border-r border-white/10 p-6">
            <div className="space-y-6">
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5">
                <SectionHeader
                  eyebrow="Step 1"
                  title="Choose a client"
                  description="Nothing is preselected. Once you choose a client, the engine can immediately check what belongs here."
                />

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Client</label>

                  <div className="relative">
                    <button
                      ref={companyButtonRef}
                      type="button"
                      onClick={() => setIsCompanyPickerOpen((prev) => !prev)}
                      className={`${fieldClass(hasClientError)} flex items-center justify-between text-left`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-cyan-200">
                          <Building2 size={16} />
                        </span>
                        <span className={`truncate ${newFiling.company ? "text-white" : "text-slate-500"}`}>
                          {newFiling.company || "Search or select a client"}
                        </span>
                      </span>
                      <ChevronDown size={16} className="shrink-0 text-slate-400" />
                    </button>

                    {isCompanyPickerOpen ? (
                      <div
                        ref={companyPanelRef}
                        className="absolute z-20 mt-2 w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#071224] shadow-[0_24px_50px_rgba(0,0,0,0.4)]"
                      >
                        <div className="border-b border-white/10 p-3">
                          <div className="relative">
                            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              value={companyQuery}
                              onChange={(event) => setCompanyQuery(event.target.value)}
                              placeholder="Search client..."
                              className={`${fieldClass(false)} pl-11`}
                            />
                          </div>
                        </div>

                        <div className="dh-scroll max-h-80 overflow-y-auto p-2">
                          {!companyQuery.trim() && recentCompanies.length > 0 ? (
                            <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Recent
                            </div>
                          ) : null}

                          {filteredCompanies.length === 0 ? (
                            <div className="rounded-xl px-3 py-4 text-sm text-slate-500">
                              No matching clients found.
                            </div>
                          ) : (
                            filteredCompanies.map((company) => {
                              const isSelected =
                                normalizeCompanyKey(newFiling.company) ===
                                normalizeCompanyKey(company.name);

                              return (
                                <div
                                  key={company.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleSelectCompany(company)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleSelectCompany(company);
                                    }
                                  }}
                                  className={`mb-1 w-full cursor-pointer rounded-2xl border px-3 py-3 text-left transition ${
                                    isSelected
                                      ? "border-cyan-400/30 bg-cyan-400/10"
                                      : "border-transparent hover:border-white/10 hover:bg-white/[0.06]"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-3">
                                        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-cyan-200">
                                          <Building2 size={15} />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-white">
                                            {company.name}
                                          </div>
                                          <div className="mt-1 text-xs text-slate-400">
                                            {company.state || "No state set"}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {isSelected ? (
                                      <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-200">
                                        Selected
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {hasClientError ? (
                    <p className="mt-2 text-xs text-red-300">{errors.company}</p>
                  ) : null}

                  {selectedCompany ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                      <span>Client selected</span>
                      <span className="text-cyan-300/60">•</span>
                      <span>{selectedCompany.state || "No state set"}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={`rounded-[26px] border p-5 transition ${modeMeta.accent}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2.5 text-cyan-200">
                      <ModeIcon size={18} />
                    </div>
                    <div>
                      <SectionHeader
                        eyebrow="Step 2"
                        title={modeMeta.label}
                        description={
                          creationMode === "engine"
                            ? "Recommendations appear automatically after you choose a client. Use refresh if you changed compliance settings and want to re-check."
                            : modeMeta.description
                        }
                      />
                    </div>
                  </div>

                  {creationMode === "engine" && selectedCompany ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleEngineRefresh();
                      }}
                      disabled={isLoadingSuggestions}
                      className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.22)] transition duration-300 hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400 hover:shadow-[0_0_40px_rgba(34,211,238,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingSuggestions ? "Loading..." : "Refresh Suggestions"}
                    </button>
                  ) : null}
                </div>

                {creationMode === "engine" ? (
                  <div className="mt-5 space-y-3">
                    {!newFiling.company ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-500">
                        Choose a client to instantly load recommended filings.
                      </div>
                    ) : suggestedFilings.length === 0 ? (
                      <div className="rounded-[24px] border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))] p-5">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-emerald-200">
                            <ShieldCheck size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">
                              All filings are up to date
                            </div>
                            <div className="mt-1 text-sm leading-6 text-slate-400">
                              No missing or duplicate filings were detected for this client.
                            </div>
                            <div className="mt-2 text-xs text-slate-500">
                              Last checked just now.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-[fadeIn_0.35s_ease] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                            <Sparkles size={14} />
                            {suggestedFilings.length} recommendation{suggestedFilings.length === 1 ? "" : "s"} found
                          </div>
                          <div className="text-xs text-slate-500">
                            Based on compliance profile + active rules
                          </div>
                        </div>

                        {suggestedFilings.map((suggestion) => {
                          const selectionKey = getSuggestionSelectionKey(suggestion);
                          const selected = selectedSuggestionKeys.includes(selectionKey);

                          return (
                            <button
                              key={selectionKey}
                              type="button"
                              onClick={() => toggleSuggestedFiling(suggestion)}
                              className={`w-full rounded-[24px] border p-4 text-left transition duration-300 hover:scale-[1.01] ${
                                selected
                                  ? "border-cyan-400/35 bg-[linear-gradient(180deg,rgba(34,211,238,0.12),rgba(34,211,238,0.04))] shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_26px_rgba(34,211,238,0.08)]"
                                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2 text-cyan-200">
                                      <FileCheck2 size={15} />
                                    </div>
                                    <div className="text-sm font-semibold text-white">
                                      {suggestion.filingName}
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-slate-400">
                                    {suggestion.jurisdictionCode} • {suggestion.frequency} • {suggestion.periodLabel}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-500">
                                    Recommended from the client’s compliance settings and active filing rules.
                                  </div>
                                </div>

                                <div className="flex flex-col items-start gap-2 md:items-end">
                                  <div className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] text-slate-300">
                                    {suggestion.category ? `${suggestion.category} • ` : ""}Due {formatFriendlyDate(suggestion.dueDate)}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {suggestion.tasks.length} starter task{suggestion.tasks.length === 1 ? "" : "s"}
                                  </div>
                                  {selected ? (
                                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200">
                                      <CheckCircle2 size={12} />
                                      Selected
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                {creationMode === "template" ? (
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Template
                    </label>
                    <select
                      className={fieldClass(!!(submitAttempted && errors.templateKey))}
                      value={newFiling.templateKey}
                      onChange={(event) => {
                        const nextTemplate = event.target.value as NewFilingForm["templateKey"];
                        updateForm("templateKey", nextTemplate);
                      }}
                    >
                      <option value="">Select template</option>
                      {templateKeys.map((templateKey) => (
                        <option key={templateKey} value={templateKey}>
                          {templateKey}
                        </option>
                      ))}
                    </select>
                    {submitAttempted && errors.templateKey ? (
                      <p className="mt-2 text-xs text-red-300">{errors.templateKey}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
                <SectionHeader
                  eyebrow="Step 3"
                  title="Filing details"
                  description="Confirm the filing information below before creating it."
                />

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Filing name
                    </label>
                    <input
                      ref={modalTitleRef}
                      placeholder="Sales Tax Filing"
                      className={fieldClass(!!(submitAttempted && errors.title))}
                      value={newFiling.title}
                      onChange={(event) => updateForm("title", event.target.value)}
                    />
                    {submitAttempted && errors.title ? (
                      <p className="mt-2 text-xs text-red-300">{errors.title}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Filing type
                    </label>
                    <input
                      placeholder="Type"
                      className={fieldClass(!!(submitAttempted && errors.type))}
                      value={newFiling.type}
                      onChange={(event) => updateForm("type", event.target.value)}
                    />
                    {submitAttempted && errors.type ? (
                      <p className="mt-2 text-xs text-red-300">{errors.type}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">State</label>
                    <input
                      placeholder="NY"
                      maxLength={2}
                      className={fieldClass(!!(submitAttempted && errors.state))}
                      value={newFiling.state}
                      onChange={(event) => updateForm("state", event.target.value.toUpperCase())}
                    />
                    {submitAttempted && errors.state ? (
                      <p className="mt-2 text-xs text-red-300">{errors.state}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Due date
                    </label>
                    <input
                      type="date"
                      className={fieldClass(!!(submitAttempted && errors.dueDate))}
                      value={newFiling.dueDate}
                      onChange={(event) => updateForm("dueDate", event.target.value)}
                    />
                    {submitAttempted && errors.dueDate ? (
                      <p className="mt-2 text-xs text-red-300">{errors.dueDate}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-6">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/80">
                    Review
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
                    {creationMode === "engine" && selectedSuggestions.length > 0
                      ? `${selectedSuggestions.length} filing${selectedSuggestions.length === 1 ? "" : "s"} ready`
                      : newFiling.title.trim() || "New filing preview"}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    {creationMode === "engine"
                      ? "Review the selected engine recommendations before creating them."
                      : creationMode === "template"
                        ? "This filing will be created from a structured workflow template."
                        : "This filing will be added as a manual one-off entry."}
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-200">
                  <FileCheck2 size={18} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className={`rounded-full border px-3 py-1.5 text-xs ${previewStatusTone(previewStatus)}`}>
                  {previewStatus || "No status yet"}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                  Source:{" "}
                  {creationMode === "engine"
                    ? "Compliance Engine"
                    : creationMode === "template"
                      ? "Template"
                      : "Manual"}
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                  Tasks: {previewTaskCount}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Client</div>
                  <div className="mt-2 text-sm font-medium text-white">{newFiling.company || "—"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Type</div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {creationMode === "engine" && selectedSuggestions.length > 1
                      ? `${selectedSuggestions.length} selected`
                      : newFiling.type || "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">State</div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {creationMode === "engine" && selectedSuggestions[0]
                      ? selectedSuggestions[0].jurisdictionCode
                      : newFiling.state || "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Due date</div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {creationMode === "engine" && selectedSuggestions[0]
                      ? formatFriendlyDate(selectedSuggestions[0].dueDate)
                      : formatFriendlyDate(newFiling.dueDate)}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Creation summary</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {creationMode === "engine"
                        ? "This will create the selected engine recommendations."
                        : creationMode === "template"
                          ? "This will create one filing from the selected template."
                          : "This will create one manually configured filing."}
                    </div>
                  </div>
                  <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                    {creationMode === "engine" ? `${selectedSuggestionKeys.length} selected` : "1 filing"}
                  </div>
                </div>
              </div>

              {creationMode === "engine" && selectedSuggestions.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-medium text-white">What will be created</div>
                  <div className="mt-3 space-y-3">
                    {selectedSuggestions.map((suggestion) => (
                      <div
                        key={getSuggestionSelectionKey(suggestion)}
                        className="rounded-2xl border border-emerald-400/15 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.02))] p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
                              <CheckCircle2 size={15} className="text-emerald-300" />
                              {suggestion.filingName}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {suggestion.jurisdictionCode} • {suggestion.frequency} • {suggestion.periodLabel}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatFriendlyDate(suggestion.dueDate)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {newFiling.templateKey && filingTemplates?.[newFiling.templateKey] ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-medium text-white">Starter tasks included</div>
                  <div className="mt-3 space-y-2">
                    {filingTemplates[newFiling.templateKey].tasks.map((task, index) => (
                      <div key={`${task}-${index}`} className="text-sm text-slate-400">
                        • {task}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(2,6,23,0.98))] px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              {canSubmit
                ? "All required fields complete."
                : "Select a client and complete the required fields to continue."}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setNewFiling((current) => ({
                    ...current,
                    title: "",
                    type: "",
                    dueDate: "",
                    templateKey: "",
                  }));
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
              >
                Clear fields
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onSave}
                disabled={isSavingFiling || !canSubmit}
                className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_26px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingFiling ? "Saving..." : dynamicPrimaryLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
