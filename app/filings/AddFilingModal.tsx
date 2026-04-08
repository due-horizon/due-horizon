"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

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

type SuggestedFiling = {
  filingKey: string;
  filingName: string;
  jurisdictionCode: string;
  dueDate: string;
  frequency: string;
  tasks: string[];
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

function fieldClass(hasError?: string) {
  return `w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
    hasError
      ? "border-red-400/40 bg-red-500/5 text-white placeholder:text-slate-500"
      : "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.07]"
  }`;
}

function badgeClass(active: boolean) {
  return active
    ? "border-cyan-400/40 bg-cyan-400/12 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
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

function getCompanyPriority(company: CompanyOption) {
  return (company.kind === "organization" ? 10 : 0) + (company.state ? 1 : 0);
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

  const [creationMode, setCreationMode] = useState<CreationMode>("engine");
  const [companyQuery, setCompanyQuery] = useState("");
  const [isCompanyPickerOpen, setIsCompanyPickerOpen] = useState(false);

  const dedupedCompanies = useMemo(() => {
    const map = new Map<string, CompanyOption>();

    for (const company of companyOptions) {
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
  }, [companyOptions]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return dedupedCompanies;
    return dedupedCompanies.filter((company) => {
      return (
        company.name.toLowerCase().includes(q) ||
        company.state.toLowerCase().includes(q) ||
        company.kind.toLowerCase().includes(q)
      );
    });
  }, [companyQuery, dedupedCompanies]);

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
      selectedSuggestionKeys.includes(suggestion.filingKey)
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

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => modalTitleRef.current?.focus(), 70);
    return () => window.clearTimeout(timer);
  }, [isOpen, creationMode]);

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

  function handleSelectCompany(company: CompanyOption) {
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
    await loadComplianceSuggestions();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-cyan-400/10 bg-[linear-gradient(180deg,#031025,#020617)] shadow-[0_40px_100px_rgba(0,0,0,0.62)]">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_42%)] px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Add Filing
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Create filings with confidence
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Pick a company, let the compliance engine recommend what belongs here, or switch
                to a manual or template-based filing when you need a one-off.
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

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setCreationMode("engine")}
              className={`rounded-2xl border p-4 text-left transition ${badgeClass(creationMode === "engine")}`}
            >
              <div className="text-sm font-semibold text-white">Use Compliance Engine</div>
              <div className="mt-1 text-sm text-slate-400">
                Let Due Horizon suggest filings from the company’s compliance profile.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("template")}
              className={`rounded-2xl border p-4 text-left transition ${badgeClass(creationMode === "template")}`}
            >
              <div className="text-sm font-semibold text-white">Create From Template</div>
              <div className="mt-1 text-sm text-slate-400">
                Start from a structured workflow and let the filing details auto-fill.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("manual")}
              className={`rounded-2xl border p-4 text-left transition ${badgeClass(creationMode === "manual")}`}
            >
              <div className="text-sm font-semibold text-white">Add Manually</div>
              <div className="mt-1 text-sm text-slate-400">
                Create a one-off filing when you already know exactly what needs to be added.
              </div>
            </button>
          </div>
        </div>

        <div className="grid max-h-[calc(92vh-210px)] overflow-y-auto lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-r border-white/10 p-6">
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Company</label>

                <div className="relative">
                  <button
                    ref={companyButtonRef}
                    type="button"
                    onClick={() => setIsCompanyPickerOpen((prev) => !prev)}
                    className={`${fieldClass(errors.company)} flex items-center justify-between text-left`}
                  >
                    <span className={newFiling.company ? "text-white" : "text-slate-500"}>
                      {newFiling.company || "Search or select a company"}
                    </span>
                    <span className="text-slate-400">⌄</span>
                  </button>

                  {isCompanyPickerOpen ? (
                    <div
                      ref={companyPanelRef}
                      className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#071224] shadow-[0_24px_50px_rgba(0,0,0,0.4)]"
                    >
                      <div className="border-b border-white/10 p-3">
                        <input
                          value={companyQuery}
                          onChange={(event) => setCompanyQuery(event.target.value)}
                          placeholder="Search company..."
                          className={fieldClass(undefined)}
                        />
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2">
                        {filteredCompanies.length === 0 ? (
                          <div className="rounded-xl px-3 py-4 text-sm text-slate-500">
                            No matching companies found.
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
                                className="w-full cursor-pointer rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.06]"
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <div className="text-sm font-medium text-white">
                                      {company.name}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {company.kind === "client" ? "Client" : "Organization"} •{" "}
                                      {company.state || "No state"}
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

                {submitAttempted && errors.company ? (
                  <p className="mt-2 text-xs text-red-300">{errors.company}</p>
                ) : null}

                {selectedCompany ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                    <span>{selectedCompany.kind === "client" ? "Client" : "Organization"}</span>
                    <span className="text-cyan-300/60">•</span>
                    <span>{selectedCompany.state || "No state set"}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {creationMode === "engine"
                        ? "Compliance Engine"
                        : creationMode === "template"
                          ? "Template Builder"
                          : "Manual Filing"}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">
                      {creationMode === "engine"
                        ? "Run the engine when you are ready. It will only fire once per click now, so you won’t get toast spam."
                        : creationMode === "template"
                          ? "Pick a proven filing workflow template and then fine-tune the details."
                          : "Use this when you need a one-off filing that should not rely on the engine."}
                    </div>
                  </div>

                  {creationMode === "engine" ? (
                    <button
                      type="button"
                      onClick={() => {
                        void handleEngineRefresh();
                      }}
                      disabled={isLoadingSuggestions || !newFiling.company}
                      className="rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingSuggestions ? "Loading..." : "Run Compliance Engine"}
                    </button>
                  ) : null}
                </div>

                {creationMode === "engine" ? (
                  <div className="mt-5 space-y-3">
                    {!newFiling.company ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-500">
                        Select a company, then click Run Compliance Engine.
                      </div>
                    ) : suggestedFilings.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-500">
                        {isLoadingSuggestions
                          ? "Checking the compliance profile and active rules..."
                          : lastRequestedCompanyRef.current ===
                              (selectedCompany?.id ?? newFiling.company)
                            ? "No suggestions were returned for this company. If the profile is missing, add filings manually or use a template."
                            : "No suggestions loaded yet. Click Run Compliance Engine to check this company."}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-slate-300">
                            {suggestedFilings.length} recommendation
                            {suggestedFilings.length === 1 ? "" : "s"} found
                          </div>
                          <div className="text-xs text-slate-500">
                            Based on compliance profile + active rules
                          </div>
                        </div>

                        {suggestedFilings.map((suggestion) => {
                          const selected = selectedSuggestionKeys.includes(suggestion.filingKey);
                          return (
                            <button
                              key={suggestion.filingKey}
                              type="button"
                              onClick={() => toggleSuggestedFiling(suggestion)}
                              className={`w-full rounded-[22px] border p-4 text-left transition ${
                                selected
                                  ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                                  : "border-white/10 bg-white/[0.025] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {suggestion.filingName}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {suggestion.jurisdictionCode} • {suggestion.frequency}
                                  </div>
                                  <div className="mt-2 text-xs text-slate-500">
                                    Recommended from the company’s compliance settings and active
                                    filing rules.
                                  </div>
                                </div>

                                <div className="flex flex-col items-start gap-2 md:items-end">
                                  <div className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] text-slate-300">
                                    Due {formatFriendlyDate(suggestion.dueDate)}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {suggestion.tasks.length} starter task
                                    {suggestion.tasks.length === 1 ? "" : "s"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                ) : null}

                {creationMode === "template" ? (
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-medium text-slate-300">
                      Template
                    </label>
                    <select
                      className={fieldClass(errors.templateKey)}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Filing name
                  </label>
                  <input
                    ref={modalTitleRef}
                    placeholder="Sales Tax Filing"
                    className={fieldClass(errors.title)}
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
                    className={fieldClass(errors.type)}
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
                    className={fieldClass(errors.state)}
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
                    className={fieldClass(errors.dueDate)}
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

          <div className="p-6">
            <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]">
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

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div
                  className={`rounded-full border px-3 py-1.5 text-xs ${previewStatusTone(previewStatus)}`}
                >
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

              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <span className="text-slate-400">Company</span>
                  <span className="text-right text-white">{newFiling.company || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <span className="text-slate-400">Type</span>
                  <span className="text-right text-white">
                    {creationMode === "engine" && selectedSuggestions.length > 1
                      ? `${selectedSuggestions.length} selected`
                      : newFiling.type || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <span className="text-slate-400">State</span>
                  <span className="text-right text-white">
                    {creationMode === "engine" && selectedSuggestions[0]
                      ? selectedSuggestions[0].jurisdictionCode
                      : newFiling.state || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <span className="text-slate-400">Due date</span>
                  <span className="text-right text-white">
                    {creationMode === "engine" && selectedSuggestions[0]
                      ? formatFriendlyDate(selectedSuggestions[0].dueDate)
                      : formatFriendlyDate(newFiling.dueDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Selected suggestions</span>
                  <span className="text-right text-white">{selectedSuggestionKeys.length}</span>
                </div>
              </div>

              {creationMode === "engine" && selectedSuggestions.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-medium text-white">What will be created</div>
                  <div className="mt-3 space-y-3">
                    {selectedSuggestions.map((suggestion) => (
                      <div
                        key={suggestion.filingKey}
                        className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-white">
                              {suggestion.filingName}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {suggestion.jurisdictionCode} • {suggestion.frequency}
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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
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
