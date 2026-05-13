"use client";

import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

type WorkspaceType = "accounting_firm" | "business_owner" | "unknown";
type EntityType =
  | "sole_prop"
  | "single_member_llc"
  | "partnership"
  | "llc"
  | "s_corp"
  | "c_corp"
  | "nonprofit"
  | "other";

type SalesTaxFrequency = "monthly" | "quarterly" | "annual" | "";
type IncomeTaxType = "1040" | "1120" | "1120S" | "1065" | "990";

type NewClientForm = {
  name: string;
  state: string;
  entityType: EntityType | "";
  payrollEnabled: boolean;
  salesTaxEnabled: boolean;
  salesTaxFrequency: SalesTaxFrequency;
  incomeTaxTypes?: IncomeTaxType[];
  incomeTaxEnabled?: boolean;
  annualReportEnabled: boolean;
  boiEnabled: boolean;
  w21099Enabled: boolean;
};

const entityTypeOptions: Array<{ value: EntityType; label: string }> = [
  { value: "sole_prop", label: "Sole Proprietor" },
  { value: "single_member_llc", label: "Single-Member LLC" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "Multi-Member LLC" },
  { value: "s_corp", label: "S Corporation" },
  { value: "c_corp", label: "C Corporation" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

const incomeTaxOptions: Array<{ value: IncomeTaxType; label: string; description: string }> = [
  { value: "1040", label: "1040", description: "Individual return" },
  { value: "1120", label: "1120", description: "C corporation return" },
  { value: "1120S", label: "1120S", description: "S corporation return" },
  { value: "1065", label: "1065", description: "Partnership return" },
  { value: "990", label: "990", description: "Nonprofit return" },
];

const usStates = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

function inputClass(hasError?: boolean) {
  return `w-full rounded-2xl border bg-white/[0.055] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition ${
    hasError
      ? "border-red-400/30 focus:border-red-300/40"
      : "border-white/10 focus:border-cyan-300/40 focus:bg-white/[0.07]"
  }`;
}

function selectClass(hasError?: boolean) {
  return `w-full appearance-none rounded-2xl border bg-slate-950 px-4 py-3 text-sm text-white outline-none transition ${
    hasError
      ? "border-red-400/30 focus:border-red-300/40"
      : "border-white/10 focus:border-cyan-300/40"
  }`;
}

function profileOptionClass(active: boolean) {
  return `rounded-2xl border px-4 py-4 text-left transition ${
    active
      ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.10)]"
      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.065]"
  }`;
}

export default function AddClientModal({
  isOpen,
  onClose,
  onSave,
  form,
  setForm,
  isSaving,
  error,
  workspaceType,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  form: NewClientForm;
  setForm: Dispatch<SetStateAction<NewClientForm>>;
  isSaving: boolean;
  error: string | null;
  workspaceType: WorkspaceType;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const didFocusOnOpenRef = useRef(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nameId = useId();
  const stateId = useId();
  const entityTypeId = useId();
  const salesTaxFrequencyId = useId();

  const label = workspaceType === "business_owner" ? "Business" : "Client";
  const trimmedName = form.name.trim();
  const normalizedState = form.state.trim().toUpperCase();
  const incomeTaxTypes = form.incomeTaxTypes ?? [];

  const nameError = useMemo(() => {
    if (!trimmedName) return `${label} name is required.`;
    return "";
  }, [trimmedName, label]);

  const stateError = useMemo(() => {
    if (!normalizedState) return "State is required.";
    if (!/^[A-Z]{2}$/.test(normalizedState)) return "Use a valid 2-letter state code.";
    return "";
  }, [normalizedState]);

  const entityTypeError = useMemo(() => {
    if (!form.entityType) return "Choose an entity type.";
    return "";
  }, [form.entityType]);

  const salesTaxFrequencyError = useMemo(() => {
    if (form.salesTaxEnabled && !form.salesTaxFrequency) return "Choose a sales tax frequency.";
    return "";
  }, [form.salesTaxEnabled, form.salesTaxFrequency]);

  const hasValidationErrors = Boolean(nameError || stateError || entityTypeError || salesTaxFrequencyError);
  const showNameError = submitAttempted && Boolean(nameError);
  const showStateError = submitAttempted && Boolean(stateError);
  const showEntityTypeError = submitAttempted && Boolean(entityTypeError);
  const showSalesTaxFrequencyError = submitAttempted && Boolean(salesTaxFrequencyError);

  const selectedProfileItems = [
    form.payrollEnabled ? "Payroll" : null,
    form.salesTaxEnabled ? `Sales tax${form.salesTaxFrequency ? ` (${form.salesTaxFrequency})` : ""}` : null,
    incomeTaxTypes.length > 0 ? `Income tax: ${incomeTaxTypes.join(", ")}` : null,
    form.annualReportEnabled ? "Annual report" : null,
    form.boiEnabled ? "BOI" : null,
    form.w21099Enabled ? "W-2 / 1099" : null,
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (!isOpen) {
      didFocusOnOpenRef.current = false;
      setSubmitAttempted(false);
      return;
    }

    if (didFocusOnOpenRef.current) return;
    didFocusOnOpenRef.current = true;

    const focusTimer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 10);

    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  function handleSaveClick() {
    setSubmitAttempted(true);
    if (hasValidationErrors || isSaving) return;
    onSave();
  }

  function toggleIncomeTaxType(type: IncomeTaxType) {
    setForm((prev) => {
      const current = prev.incomeTaxTypes ?? [];
      const exists = current.includes(type);
      const nextIncomeTaxTypes = exists ? current.filter((item) => item !== type) : [...current, type];

      return {
        ...prev,
        incomeTaxTypes: nextIncomeTaxTypes,
        incomeTaxEnabled: nextIncomeTaxTypes.length > 0,
      };
    });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        event.preventDefault();
        onClose();
      }

      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();

        if (tagName !== "textarea" && tagName !== "select" && !isSaving) {
          event.preventDefault();
          handleSaveClick();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, hasValidationErrors, onClose, onSave]);

  if (!isOpen) return null;

  const stateLabel = usStates.find((state) => state.value === normalizedState)?.label || normalizedState || "—";
  const entityTypeLabel = entityTypeOptions.find((option) => option.value === form.entityType)?.label || "—";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (isSaving) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${nameId}-title`}
        className="w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(10,18,32,0.985),rgba(6,12,23,0.995))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                Workspace record
              </div>
              <div id={`${nameId}-title`} className="mt-2 text-2xl font-semibold text-white">
                Add {label}
              </div>
              <div className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                Add the {label.toLowerCase()} record and optional compliance profile. Add Filing uses this profile to recommend filings — this does not create filings by itself.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              aria-label={`Close add ${label.toLowerCase()} modal`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Required details
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Basic information</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  These fields create the client or business record.
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label
                      htmlFor={nameId}
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      {label} name
                    </label>
                    <input
                      id={nameId}
                      ref={nameInputRef}
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder={`Enter ${label.toLowerCase()} name...`}
                      autoComplete="off"
                      className={inputClass(showNameError)}
                    />
                    {showNameError ? <div className="mt-2 text-sm text-red-300">{nameError}</div> : null}
                  </div>

                  <div>
                    <label
                      htmlFor={stateId}
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      State
                    </label>
                    <select
                      id={stateId}
                      value={form.state}
                      onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                      className={selectClass(showStateError)}
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="" className="bg-slate-950 text-white">
                        Select state...
                      </option>
                      {usStates.map((state) => (
                        <option key={state.value} value={state.value} className="bg-slate-950 text-white">
                          {state.label} ({state.value})
                        </option>
                      ))}
                    </select>
                    {showStateError ? <div className="mt-2 text-sm text-red-300">{stateError}</div> : null}
                  </div>

                  <div>
                    <label
                      htmlFor={entityTypeId}
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      Entity type
                    </label>
                    <select
                      id={entityTypeId}
                      value={form.entityType}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          entityType: e.target.value as EntityType,
                        }))
                      }
                      className={selectClass(showEntityTypeError)}
                      style={{ colorScheme: "dark" }}
                    >
                      <option value="" className="bg-slate-950 text-white">
                        Select entity type...
                      </option>
                      {entityTypeOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {showEntityTypeError ? (
                      <div className="mt-2 text-sm text-red-300">{entityTypeError}</div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Optional profile
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Compliance profile</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  These settings only help Add Filing recommend the right filings. Nothing is filed or created here.
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, payrollEnabled: !prev.payrollEnabled }))}
                    className={profileOptionClass(form.payrollEnabled)}
                  >
                    <div className="text-sm font-semibold text-white">Payroll</div>
                    <div className="mt-1 text-sm text-slate-400">Helps suggest payroll filings such as 941, 940, and state payroll forms.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        salesTaxEnabled: !prev.salesTaxEnabled,
                        salesTaxFrequency: prev.salesTaxEnabled ? "" : prev.salesTaxFrequency,
                      }))
                    }
                    className={profileOptionClass(form.salesTaxEnabled)}
                  >
                    <div className="text-sm font-semibold text-white">Sales tax</div>
                    <div className="mt-1 text-sm text-slate-400">Helps suggest state sales tax filings by frequency.</div>
                  </button>

                  {form.salesTaxEnabled ? (
                    <div className="md:col-span-2">
                      <label
                        htmlFor={salesTaxFrequencyId}
                        className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                      >
                        Sales tax frequency
                      </label>
                      <select
                        id={salesTaxFrequencyId}
                        value={form.salesTaxFrequency}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, salesTaxFrequency: e.target.value as SalesTaxFrequency }))
                        }
                        className={selectClass(showSalesTaxFrequencyError)}
                        style={{ colorScheme: "dark" }}
                      >
                        <option value="" className="bg-slate-950 text-white">Select frequency...</option>
                        <option value="monthly" className="bg-slate-950 text-white">Monthly</option>
                        <option value="quarterly" className="bg-slate-950 text-white">Quarterly</option>
                        <option value="annual" className="bg-slate-950 text-white">Annual</option>
                      </select>
                      {showSalesTaxFrequencyError ? (
                        <div className="mt-2 text-sm text-red-300">{salesTaxFrequencyError}</div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
                    <div className="text-sm font-semibold text-white">Income tax return types</div>
                    <div className="mt-1 text-sm text-slate-400">Optional. Used only for Add Filing recommendations.</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {incomeTaxOptions.map((option) => {
                        const active = incomeTaxTypes.includes(option.value);
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleIncomeTaxType(option.value)}
                            className={profileOptionClass(active)}
                          >
                            <div className="text-sm font-semibold text-white">{option.label}</div>
                            <div className="mt-1 text-sm text-slate-400">{option.description}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, annualReportEnabled: !prev.annualReportEnabled }))}
                    className={profileOptionClass(form.annualReportEnabled)}
                  >
                    <div className="text-sm font-semibold text-white">Annual report</div>
                    <div className="mt-1 text-sm text-slate-400">Helps suggest annual or periodic entity reports.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, boiEnabled: !prev.boiEnabled }))}
                    className={profileOptionClass(form.boiEnabled)}
                  >
                    <div className="text-sm font-semibold text-white">BOI</div>
                    <div className="mt-1 text-sm text-slate-400">Helps surface beneficial ownership reporting where applicable.</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, w21099Enabled: !prev.w21099Enabled }))}
                    className={profileOptionClass(form.w21099Enabled)}
                  >
                    <div className="text-sm font-semibold text-white">W-2 / 1099</div>
                    <div className="mt-1 text-sm text-slate-400">Helps suggest year-end information return workflows.</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                Preview
              </div>
              <div className="mt-2 text-lg font-semibold text-white">Record summary</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">
                This record and profile will be available to Add Filing.
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Name</div>
                  <div className="mt-1 text-white">{trimmedName || `New ${label}`}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">State</div>
                  <div className="mt-1 text-white">{stateLabel}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Entity type</div>
                  <div className="mt-1 text-white">{entityTypeLabel}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Add Filing signals</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProfileItems.length > 0 ? (
                      selectedProfileItems.map((item) => (
                        <span key={item} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">No optional profile signals selected.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-400">
                Add Filing will use these profile signals to recommend reports, filings, and workflows. Saving this modal will not create any filing records.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)] transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
          >
            {isSaving ? `Saving ${label.toLowerCase()}...` : `Save ${label}`}
          </button>
        </div>
      </div>
    </div>
  );
}
