
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Papa from "papaparse";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { seedWorkspaceFromOnboarding } from "./actions/seed-onboarding";
import { buildAllSuggestedFilings } from "@/lib/compliance-engine";
import type { ComplianceProfile } from "@/lib/compliance-rules";
import {
  complianceRules,
  workflowTemplates,
} from "@/lib/compliance-rules";

type AccountType = "business_owner" | "accounting_firm" | null;
type IntakeMethod = "manual" | "csv";
type Step = 1 | 2 | 3 | "loading" | 4;

type ServiceKey = "payroll" | "sales_tax" | "annual_report" | "w2_1099";
type TaxReturnKey = "f1040" | "f1120" | "f1120s" | "f1065";
type FilingFrequency = "monthly" | "quarterly" | "annual";

type ClientServiceMap = Record<ServiceKey, boolean>;
type ClientTaxReturnMap = Record<TaxReturnKey, boolean>;

type SetupForm = {
  name: string;
  state: string;
  entityType: string;
  services: ClientServiceMap;
  taxReturns: ClientTaxReturnMap;
  salesTaxFrequency: FilingFrequency;
};

type CsvImportedRow = {
  id: string;
  include: boolean;
  client_name: string;
  state: string;
  entity_type: string;
  services: ClientServiceMap;
  taxReturns: ClientTaxReturnMap;
  salesTaxFrequency: FilingFrequency;
};

type FilingPreview = {
  filingName: string;
  dueDate: string;
  jurisdictionCode: string;
};

type WorkspacePreviewSummary = {
  clients: number;
  workflows: number;
  filings: FilingPreview[];
  primaryFilings: FilingPreview[];
  supportingFilings: FilingPreview[];
};

const US_STATES = [
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
] as const;

const ENTITY_TYPE_OPTIONS = [
  { value: "Individual", label: "Individual" },
  { value: "Single-Member LLC", label: "Single-Member LLC" },
  { value: "LLC", label: "LLC" },
  { value: "S Corp", label: "S Corp" },
  { value: "C Corp", label: "C Corp" },
  { value: "Partnership", label: "Partnership" },
  { value: "Nonprofit", label: "Nonprofit" },
  { value: "Trust", label: "Trust" },
] as const;

const serviceLabels: Record<ServiceKey, string> = {
  payroll: "Payroll filings",
  sales_tax: "Sales tax returns",
  annual_report: "Annual reports",
  w2_1099: "W-2 / 1099 reporting",
};

const serviceDescriptions: Record<ServiceKey, string> = {
  payroll: "Form 941, Form 940, NYS-45, and recurring payroll deadlines.",
  sales_tax: "Monthly, quarterly, or annual sales tax filing schedules.",
  annual_report: "State annual or biennial report tracking.",
  w2_1099: "Year-end employee and contractor reporting workflows.",
};

const taxReturnLabels: Record<TaxReturnKey, string> = {
  f1040: "Individual / Sole proprietor",
  f1120: "Corporation",
  f1120s: "S Corporation",
  f1065: "Partnership",
};

const taxReturnDescriptions: Record<TaxReturnKey, string> = {
  f1040: "Form 1040",
  f1120: "Form 1120",
  f1120s: "Form 1120-S",
  f1065: "Form 1065",
};

function defaultServices(): ClientServiceMap {
  return {
    payroll: false,
    sales_tax: false,
    annual_report: false,
    w2_1099: false,
  };
}

function defaultTaxReturns(): ClientTaxReturnMap {
  return {
    f1040: false,
    f1120: false,
    f1120s: false,
    f1065: false,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return (
      (typeof maybeError.message === "string" && maybeError.message) ||
      (typeof maybeError.details === "string" && maybeError.details) ||
      (typeof maybeError.hint === "string" && maybeError.hint) ||
      (typeof maybeError.error_description === "string" &&
        maybeError.error_description) ||
      "Something went wrong while generating your workspace."
    );
  }
  return "Something went wrong while generating your workspace.";
}

function mapSignupTypeToOnboarding(value: string | null): AccountType {
  if (value === "firm") return "accounting_firm";
  if (value === "business") return "business_owner";
  return null;
}

function mapPlanToOnboarding(value: string | null): AccountType {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["starter", "growth", "scale"].includes(normalized)) return "accounting_firm";
  if (["core", "operations", "enterprise"].includes(normalized)) return "business_owner";
  return null;
}

function getDefaultTaxReturnsForEntity(entityType: string): ClientTaxReturnMap {
  const normalized = entityType.trim().toLowerCase();

  if (normalized.includes("s corp")) {
    return { f1040: false, f1120: false, f1120s: true, f1065: false };
  }
  if (normalized.includes("c corp")) {
    return { f1040: false, f1120: true, f1120s: false, f1065: false };
  }
  if (normalized.includes("partnership")) {
    return { f1040: false, f1120: false, f1120s: false, f1065: true };
  }
  if (
    normalized.includes("individual") ||
    normalized.includes("single-member") ||
    normalized === "llc" ||
    normalized.includes("sole prop")
  ) {
    return { f1040: true, f1120: false, f1120s: false, f1065: false };
  }
  return defaultTaxReturns();
}

function hasSelectedTaxReturn(taxReturns: ClientTaxReturnMap) {
  return Object.values(taxReturns).some(Boolean);
}

function getSmartRecommendation(entityType: string) {
  const normalized = entityType.trim().toLowerCase();

  if (!normalized) {
    return "Select an entity type and Due Horizon will suggest the most likely income tax return.";
  }

  if (normalized.includes("s corp")) {
    return "Recommended for S Corps: Form 1120-S, annual report tracking, and payroll filings if wages are paid.";
  }

  if (normalized.includes("c corp")) {
    return "Recommended for corporations: Form 1120, annual report tracking, and payroll filings if wages are paid.";
  }

  if (normalized.includes("partnership")) {
    return "Recommended for partnerships: Form 1065 and state annual report tracking where required.";
  }

  if (normalized.includes("individual") || normalized.includes("single-member") || normalized === "llc") {
    return "Recommended for individuals and single-member LLCs: Form 1040 with sales tax or payroll added only if needed.";
  }

  return "Due Horizon will generate filings based only on the services and returns you turn on.";
}

function toComplianceProfile(form: SetupForm): ComplianceProfile {
  return {
    stateCode: form.state.trim().toUpperCase(),
    entityType: form.entityType.trim() || null,
    payrollEnabled: form.services.payroll,
    salesTaxEnabled: form.services.sales_tax,
    salesTaxFrequency: form.services.sales_tax ? form.salesTaxFrequency : null,
    incomeTaxEnabled: hasSelectedTaxReturn(form.taxReturns),
    annualReportEnabled: form.services.annual_report,
    boiEnabled: false,
    w21099Enabled: form.services.w2_1099,
    tax1040Enabled: form.taxReturns.f1040,
    tax1120Enabled: form.taxReturns.f1120,
    tax1120SEnabled: form.taxReturns.f1120s,
    tax1065Enabled: form.taxReturns.f1065,
  };
}

function normalizeSalesTaxFrequency(
  value?: string,
  fallback: FilingFrequency = "quarterly",
): FilingFrequency {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "monthly" || normalized === "quarterly" || normalized === "annual") {
    return normalized;
  }
  return fallback;
}

function toBoolean(value?: string) {
  return /^(y|yes|true|1|x|on)$/i.test(String(value || "").trim());
}

function formatDueDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString();
}

function splitPreviewFilings(
  filings: any[],
  taxReturns: ClientTaxReturnMap | null,
): {
  primaryFilings: FilingPreview[];
  supportingFilings: FilingPreview[];
  filings: FilingPreview[];
} {
  const isPrimaryFiling = (filing: any) => {
    const name = String(filing.filingName || "").toLowerCase();

    const isIncomeTax =
      name.includes("1040") ||
      name.includes("1120") ||
      name.includes("1120s") ||
      name.includes("1120-s") ||
      name.includes("1120 s") ||
      name.includes("1065");

    const isPayroll =
      name.includes("941") ||
      name.includes("940") ||
      name.includes("nys-45") ||
      name.includes("payroll");

    const isSalesTax = name.includes("sales tax");

    return isIncomeTax || isPayroll || isSalesTax;
  };

  const primaryCandidates = filings.filter(isPrimaryFiling);
  const supportingCandidates = filings.filter(
    (filing: any) => !primaryCandidates.includes(filing),
  );

  const dedupeAndMap = (items: any[]): FilingPreview[] => {
    const seen = new Set<string>();
    return items
      .filter((filing: any) => {
        const key = `${filing.filingName}-${filing.dueDate}-${filing.jurisdictionCode}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((filing: any) => ({
        filingName: filing.filingName,
        dueDate: filing.dueDate,
        jurisdictionCode: filing.jurisdictionCode,
      }));
  };

  const primaryFilings = dedupeAndMap(primaryCandidates).slice(0, 4);
  const supportingFilings = dedupeAndMap(supportingCandidates).slice(0, 4);

  return {
    primaryFilings,
    supportingFilings,
    filings: [...primaryFilings, ...supportingFilings],
  };
}


export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [signupType, setSignupType] = useState<AccountType>(null);
  const [signupWorkspaceName, setSignupWorkspaceName] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [intakeMethod, setIntakeMethod] = useState<IntakeMethod>("manual");

  const [firmName, setFirmName] = useState("");
  const [clientCount, setClientCount] = useState("");

  const [manualClient, setManualClient] = useState<SetupForm>({
    name: "",
    state: "",
    entityType: "",
    services: defaultServices(),
    taxReturns: defaultTaxReturns(),
    salesTaxFrequency: "quarterly",
  });

  const [businessSetup, setBusinessSetup] = useState<SetupForm>({
    name: "",
    state: "",
    entityType: "",
    services: defaultServices(),
    taxReturns: defaultTaxReturns(),
    salesTaxFrequency: "quarterly",
  });

  const [csvText, setCsvText] = useState("");
  const [csvRows, setCsvRows] = useState<CsvImportedRow[]>([]);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewRules, setPreviewRules] = useState<any[]>(complianceRules as any[]);
  const [previewTemplates, setPreviewTemplates] = useState<any[]>(workflowTemplates as any[]);
  const [previewConfigLoaded, setPreviewConfigLoaded] = useState(false);
  const [showGeneratingCue, setShowGeneratingCue] = useState(false);
  const [checkoutStarting, setCheckoutStarting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const resolvedSignupType =
      mapSignupTypeToOnboarding(params.get("type")) ||
      mapPlanToOnboarding(params.get("plan"));

    const workspace = params.get("workspace")?.trim() || "";

    setSignupType(resolvedSignupType);
    setSignupWorkspaceName(workspace);

    if (resolvedSignupType === "accounting_firm") {
      setAccountType("accounting_firm");
      setFirmName(workspace);
      setStep(1);
      return;
    }

    if (resolvedSignupType === "business_owner") {
      setAccountType("business_owner");
      setBusinessSetup((current) => ({ ...current, name: current.name || workspace }));
      setStep(2);
      return;
    }

    setStep(1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadPreviewConfig() {
      try {
        const [{ data: rulesData }, { data: templatesData }] = await Promise.all([
          supabase.from("compliance_rules").select("*").eq("active", true),
          supabase.from("workflow_templates").select("*").eq("active", true),
        ]);

        if (ignore) return;

        if (Array.isArray(rulesData) && rulesData.length > 0) {
          setPreviewRules(rulesData as any[]);
        }
        if (Array.isArray(templatesData) && templatesData.length > 0) {
          setPreviewTemplates(templatesData as any[]);
        }
      } catch (error) {
        console.error("Preview configuration load failed:", error);
      } finally {
        if (!ignore) setPreviewConfigLoaded(true);
      }
    }

    loadPreviewConfig();

    return () => {
      ignore = true;
    };
  }, [supabase]);

  const parsedClientCount = Math.max(0, Number.parseInt(clientCount || "0", 10) || 0);
  const includedCsvRows = csvRows.filter((row) => row.include);
  const hasValidCsvImport = includedCsvRows.length > 0;

  const canContinueAccountSelection = Boolean(accountType);
  const canContinueFirmDetails =
    firmName.trim().length > 0 && clientCount.trim().length > 0;

  const manualClientSelectionCount =
    Object.values(manualClient.services).filter(Boolean).length +
    Object.values(manualClient.taxReturns).filter(Boolean).length;
  const canFinishManualClient =
    manualClient.name.trim().length > 0 &&
    manualClient.state.trim().length === 2 &&
    manualClient.entityType.trim().length > 0 &&
    manualClientSelectionCount > 0;

  const businessSelectionCount =
    Object.values(businessSetup.services).filter(Boolean).length +
    Object.values(businessSetup.taxReturns).filter(Boolean).length;
  const canFinishBusinessSetup =
    businessSetup.name.trim().length > 0 &&
    businessSetup.state.trim().length === 2 &&
    businessSetup.entityType.trim().length > 0 &&
    businessSelectionCount > 0;

  const workspacePreview = useMemo<WorkspacePreviewSummary>(() => {
    if (!previewRules.length || !previewTemplates.length) {
      return {
        clients: 0,
        workflows: 0,
        filings: [],
        primaryFilings: [],
        supportingFilings: [],
      };
    }

    if (accountType === "business_owner") {
      const filings = buildAllSuggestedFilings({
        profile: toComplianceProfile(businessSetup),
        rules: previewRules,
        templates: previewTemplates,
        payrollEvents: [],
      });

      const split = splitPreviewFilings(filings, null);

      return {
        clients: businessSetup.name.trim() ? 1 : 0,
        workflows: filings.length,
        filings: split.filings,
        primaryFilings: split.primaryFilings,
        supportingFilings: split.supportingFilings,
      };
    }

    if (intakeMethod === "csv") {
      const filings = includedCsvRows.flatMap((row) =>
        buildAllSuggestedFilings({
          profile: toComplianceProfile({
            name: row.client_name,
            state: row.state,
            entityType: row.entity_type,
            services: row.services,
            taxReturns: row.taxReturns,
            salesTaxFrequency: row.salesTaxFrequency,
          }),
          rules: previewRules,
          templates: previewTemplates,
            payrollEvents: [],
          }),
      );

      const split = splitPreviewFilings(filings, null);

      return {
        clients: includedCsvRows.length,
        workflows: filings.length,
        filings: split.filings,
        primaryFilings: split.primaryFilings,
        supportingFilings: split.supportingFilings,
      };
    }

    const filings = buildAllSuggestedFilings({
      profile: toComplianceProfile(manualClient),
      rules: previewRules,
      templates: previewTemplates,
    });

    const split = splitPreviewFilings(filings, null);

    return {
      clients: manualClient.name.trim() ? 1 : 0,
      workflows: filings.length,
      filings: split.filings,
      primaryFilings: split.primaryFilings,
      supportingFilings: split.supportingFilings,
    };
  }, [
    accountType,
    businessSetup,
    includedCsvRows,
    intakeMethod,
    manualClient,
    previewRules,
    previewTemplates,
  ]);

  const nextFiling = workspacePreview.filings[0] || null;

  const totalSteps = accountType === "business_owner" ? 2 : 3;
  const currentStepDisplay =
    step === "loading" ? totalSteps : step === 4 ? totalSteps : step;
  const progress = Math.min((currentStepDisplay / totalSteps) * 100, 100);

  function parseCsv(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setCsvRows([]);
      return;
    }

    Papa.parse<Record<string, string>>(trimmed, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        const parsed = (results.data || [])
          .map((row: Record<string, string>, index: number) => {
            const normalized = Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key.trim().toLowerCase(),
                String(value ?? "").trim(),
              ]),
            );

            const findValue = (...candidates: string[]) => {
              const entry = Object.entries(normalized).find(([key]) =>
                candidates.some((candidate) => key.includes(candidate)),
              );
              return entry?.[1] || "";
            };

            return {
              id: `csv-${index + 1}`,
              include: true,
              client_name: findValue("client", "company", "name"),
              state: findValue("state").toUpperCase(),
              entity_type: findValue("entity", "type") || "Client",
              services: {
                payroll: toBoolean(findValue("payroll")),
                sales_tax: toBoolean(findValue("sales tax", "sales_tax", "salestax")),
                annual_report: toBoolean(findValue("annual report", "annual_report")),
                w2_1099: toBoolean(findValue("1099", "w2", "w-2")),
              },
              taxReturns: (() => {
                const genericIncomeTax = toBoolean(
                  findValue("income tax", "income_tax", "tax return", "income"),
                );
                const inferred = genericIncomeTax
                  ? getDefaultTaxReturnsForEntity(findValue("entity", "type"))
                  : defaultTaxReturns();

                return {
                  f1040: toBoolean(findValue("1040")) || inferred.f1040,
                  f1120: toBoolean(findValue("1120")) || inferred.f1120,
                  f1120s:
                    toBoolean(findValue("1120s", "1120-s", "1120 s")) ||
                    inferred.f1120s,
                  f1065: toBoolean(findValue("1065")) || inferred.f1065,
                };
              })(),
              salesTaxFrequency: normalizeSalesTaxFrequency(
                findValue(
                  "sales_tax_frequency",
                  "sales tax frequency",
                  "salestaxfrequency",
                ),
                "quarterly",
              ),
            } satisfies CsvImportedRow;
          })
          .filter((row: CsvImportedRow) => row.client_name.trim().length > 0);

        setCsvRows(parsed);
      },
    });
  }

  async function ensureFirm() {
    if (firmId) return firmId;
    if (!accountType) {
      throw new Error("Missing onboarding selections.");
    }

    const result = await seedWorkspaceFromOnboarding({
      accountType,
      firmName:
        accountType === "business_owner"
          ? businessSetup.name.trim() || signupWorkspaceName
          : firmName.trim(),
      clientCount:
        accountType === "business_owner"
          ? 1
          : intakeMethod === "csv"
            ? includedCsvRows.length || parsedClientCount || 1
            : 1,
      intakeMethod,
    });

    const resolvedFirmId = result.firmId || result.workspaceId;
    setFirmId(resolvedFirmId);
    return resolvedFirmId;
  }

  async function upsertComplianceProfileAndGenerateFilings(
    resolvedFirmId: string,
    clientId: string | null,
    organizationId: string | null,
    form: SetupForm,
  ) {
    const { data: profileId, error: profileError } = await supabase.rpc(
      "upsert_client_compliance_profile",
      {
        p_workspace_id: resolvedFirmId,
        p_client_id: clientId,
        p_organization_id: organizationId,
        p_state_code: form.state.trim().toUpperCase(),
        p_entity_type: form.entityType.trim(),
        p_payroll_enabled: form.services.payroll,
        p_sales_tax_enabled: form.services.sales_tax,
        p_sales_tax_frequency: form.services.sales_tax ? form.salesTaxFrequency : null,
        p_income_tax_enabled: hasSelectedTaxReturn(form.taxReturns),
        p_annual_report_enabled: form.services.annual_report,
        p_w2_1099_enabled: form.services.w2_1099,
        p_tax_1040_enabled: form.taxReturns.f1040,
        p_tax_1120_enabled: form.taxReturns.f1120,
        p_tax_1120s_enabled: form.taxReturns.f1120s,
        p_tax_1065_enabled: form.taxReturns.f1065,
      },
    );

    if (profileError || !profileId) {
      throw new Error(
        profileError?.message ||
          profileError?.details ||
          profileError?.hint ||
          "Failed to save compliance profile.",
      );
    }

    const { error: filingsError } = await supabase.rpc(
      "generate_filings_for_profile",
      { p_profile_id: profileId },
    );

    if (filingsError) {
      throw new Error(
        filingsError?.message ||
          filingsError?.details ||
          filingsError?.hint ||
          "Failed to generate filings from compliance profile.",
      );
    }
  }

  async function createClientRecord(
    resolvedFirmId: string,
    form: SetupForm,
    source: "manual" | "import",
  ) {
    const normalizedName = form.name.trim().replace(/\s+/g, " ");
    const normalizedState = form.state.trim().toUpperCase();

    const { data: existingClients, error: existingError } = await supabase
      .from("clients")
      .select("id, client_name")
      .eq("firm_id", resolvedFirmId);

    if (existingError) throw existingError;

    const existingClient = (existingClients || []).find(
      (client) =>
        String(client.client_name || "")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase() === normalizedName.toLowerCase(),
    );

    let clientId: string;

    if (existingClient?.id) {
      clientId = existingClient.id;
    } else {
      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          firm_id: resolvedFirmId,
          client_name: normalizedName,
          state_code: normalizedState,
          entity_type: form.entityType.trim(),
          source,
          status: "active",
        })
        .select("id")
        .single();

      if (error || !client) throw error || new Error("Failed to create client.");
      clientId = client.id;
    }

    await upsertComplianceProfileAndGenerateFilings(
      resolvedFirmId,
      clientId,
      null,
      {
        ...form,
        name: normalizedName,
        state: normalizedState,
      },
    );
  }

  async function finalizeBusinessOwnerManual() {
    const resolvedFirmId = await ensureFirm();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("firm_id", resolvedFirmId)
      .eq("organization_type", "business")
      .maybeSingle();

    if (orgError || !org) {
      throw orgError || new Error("Business organization not found.");
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        legal_name: businessSetup.name.trim(),
        display_name: businessSetup.name.trim(),
        state_code: businessSetup.state.trim().toUpperCase(),
        entity_type: businessSetup.entityType.trim(),
      })
      .eq("id", org.id);

    if (updateError) throw updateError;

    await upsertComplianceProfileAndGenerateFilings(
      resolvedFirmId,
      null,
      org.id,
      businessSetup,
    );
  }

  async function generateWorkspace() {
    setSaveError(null);
    setSaving(true);
    setShowGeneratingCue(true);

    try {
      if (!accountType) {
        throw new Error("Please complete onboarding first.");
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
      setStep("loading");

      if (accountType === "business_owner") {
        if (!canFinishBusinessSetup) {
          throw new Error("Enter your business details and choose at least one service.");
        }
        await finalizeBusinessOwnerManual();
        setStep(4);
        return;
      }

      if (intakeMethod === "csv") {
        if (!hasValidCsvImport) {
          throw new Error("Upload a CSV and keep at least one client selected.");
        }
        const resolvedFirmId = await ensureFirm();
        for (const row of includedCsvRows) {
          await createClientRecord(
            resolvedFirmId,
            {
              name: row.client_name,
              state: row.state,
              entityType: row.entity_type,
              services: row.services,
              taxReturns: row.taxReturns,
              salesTaxFrequency: row.salesTaxFrequency,
            },
            "import",
          );
        }
        setStep(4);
        return;
      }

      if (!canFinishManualClient) {
        throw new Error("Add one client and choose at least one service or return.");
      }

      const resolvedFirmId = await ensureFirm();
      await createClientRecord(resolvedFirmId, manualClient, "manual");
      setStep(4);
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setStep(accountType === "business_owner" ? 2 : intakeMethod === "csv" ? 3 : 2);
    } finally {
      setSaving(false);
      setShowGeneratingCue(false);
    }
  }

  async function goToCheckout() {
    setCheckoutStarting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const params = new URLSearchParams();
    const normalizedType =
      accountType === "business_owner" ? "business" : "firm";
    const searchParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const planFromUrl = searchParams?.get("plan");
    const resolvedPlan =
      planFromUrl || (normalizedType === "business" ? "operations" : "growth");

    params.set("plan", resolvedPlan);
    params.set("type", normalizedType);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const resolvedFirmId =
      firmId ||
      (typeof user?.user_metadata?.firm_id === "string"
        ? user.user_metadata.firm_id
        : typeof user?.user_metadata?.workspace_id === "string"
          ? user.user_metadata.workspace_id
          : null);

    if (typeof window !== "undefined") {
      if (user?.email) {
        window.localStorage.setItem("dh_checkout_email", user.email);
      }
      if (resolvedFirmId) {
        window.localStorage.setItem("dh_checkout_firm_id", resolvedFirmId);
      }
    }

    router.replace(`/checkout?${params.toString()}`);
    router.refresh();
  }

  const heading =
    step === "loading"
      ? "Building your compliance system"
      : step === 4
        ? "Your compliance system is ready"
        : accountType === "business_owner"
          ? step === 2
            ? "Your filing schedule is ready to build"
            : "Choose who this workspace is for"
          : step === 1
            ? "Set up your firm"
            : step === 2
              ? "Your filing schedule is ready to build"
              : "Import clients from CSV";

  const subheading =
    step === "loading"
      ? "Creating the workspace, saving your setup, and generating only the filings you need."
      : step === 4
        ? "Your filings, workflows, and deadline tracking are generated. Start your free trial to unlock the dashboard."
        : accountType === "business_owner"
          ? step === 2
            ? "Enter the basics and Due Horizon will detect the first deadlines, workflows, and filing schedule for this business."
            : "We’ll tailor the setup based on whether this workspace is for your own business or for client work."
          : step === 1
            ? "Start with one real client, see real filings immediately, and expand after the workspace is live."
            : step === 2
              ? "Start with one client so you can see the compliance engine working before importing everyone else."
              : "Upload your client list. You’ll review everything before anything is created.";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.08),transparent_30%),linear-gradient(to_bottom,#0b1220,#0b1220,#08101c)] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex items-center justify-center">
          <img src="/logo-final.png" alt="Due Horizon" className="h-12 w-auto" />
        </div>

        <div className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300 backdrop-blur-sm">
              {step === "loading"
                ? "Building workspace"
                : step === 4
                  ? "Workspace ready"
                  : accountType
                    ? "Smart setup"
                    : `Step ${currentStepDisplay} of ${totalSteps}`}
            </div>

            {accountType && (
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300 backdrop-blur-sm">
                {accountType === "accounting_firm" ? "Firm setup" : "Business setup"}
              </div>
            )}
          </div>

          <div className="mx-auto mb-6 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
          <p className="mt-3 text-slate-400">{subheading}</p>
          <p className="mt-3 text-sm text-slate-500">
            Fast setup, smart recommendations, and real deadline previews before checkout.
          </p>

          {showGeneratingCue && step !== "loading" && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Generating your filings...
            </div>
          )}

          {!previewConfigLoaded && (
            <p className="mt-2 text-xs text-slate-500">
              Syncing live compliance rules and workflow templates...
            </p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr,0.85fr]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={String(step)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.22 }}
              >
                {!accountType && step === 1 && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <PathCard
                      title="I run a business"
                      subtitle="Set up one company fast and generate the filings you actually need."
                      points={[
                        "Single-entity setup in minutes",
                        "Live filing preview as you select services",
                        "Built to get you into checkout fast",
                      ]}
                      active={accountType === "business_owner"}
                      onClick={() => setAccountType("business_owner")}
                    />
                    <PathCard
                      title="I manage clients"
                      subtitle="Start with one real client now, then expand once the workspace is live."
                      points={[
                        "Best conversion path for firms",
                        "No accidental mass workflow creation",
                        "CSV import still available one step later",
                      ]}
                      active={accountType === "accounting_firm"}
                      onClick={() => setAccountType("accounting_firm")}
                    />

                    <div className="col-span-full mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={!canContinueAccountSelection}
                        onClick={() => setStep(accountType === "business_owner" ? 2 : 1)}
                        className="h-12 rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:opacity-40"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {accountType === "accounting_firm" && step === 1 && (
                  <div className="mx-auto max-w-xl space-y-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                    <div>
                      <div className="text-sm font-semibold text-white">Firm details</div>
                      <p className="mt-1 text-sm text-slate-400">
                        This sets up the workspace. You’ll add one real client on the next step.
                      </p>
                    </div>

                    <Input
                      label="Firm name"
                      value={firmName}
                      onChange={setFirmName}
                      placeholder="Carr Accounting Solutions"
                    />
                    <Input
                      label="Approximate number of clients"
                      value={clientCount}
                      onChange={setClientCount}
                      placeholder="250"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (signupType) return;
                          setAccountType(null);
                          setStep(1);
                        }}
                        className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!canContinueFirmDetails}
                        onClick={() => setStep(2)}
                        className="h-12 rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:opacity-40"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {accountType === "business_owner" && step === 2 && (
                  <SetupPanel
                    form={businessSetup}
                    setForm={setBusinessSetup}
                    title="Build your filing schedule"
                    subtitle="Enter your business details and switch on only the filings you actually need. We’ll generate the first version of your compliance system instantly."
                    buttonLabel={saving ? "Generating..." : "Generate my workspace"}
                    onBack={() => {
                      if (signupType) return;
                      setAccountType(null);
                      setStep(1);
                    }}
                    onSubmit={generateWorkspace}
                    disabled={!canFinishBusinessSetup || saving}
                    saveError={saveError}
                    isBusinessOwner
                  />
                )}

                {accountType === "accounting_firm" && step === 2 && (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            Start with one client
                          </div>
                          <p className="mt-1 max-w-xl text-sm text-slate-400">
                            This is the fastest path. Enter one real client and we’ll generate live filings immediately.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSaveError(null);
                            setIntakeMethod(intakeMethod === "manual" ? "csv" : "manual");
                            setStep(intakeMethod === "manual" ? 3 : 2);
                          }}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          {intakeMethod === "manual"
                            ? "Import from CSV instead"
                            : "Start with one client instead"}
                        </button>
                      </div>
                    </div>

                    <SetupPanel
                      form={manualClient}
                      setForm={setManualClient}
                      title="Build your filing schedule"
                      subtitle="Tell us about one client so we can generate real deadlines and workflows now. You can import the rest after the workspace is live."
                      buttonLabel={saving ? "Generating..." : "Generate my workspace"}
                      onBack={() => setStep(1)}
                      onSubmit={generateWorkspace}
                      disabled={!canFinishManualClient || saving}
                      saveError={saveError}
                    />
                  </div>
                )}

                {accountType === "accounting_firm" && step === 3 && (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            Upload your client list
                          </div>
                          <p className="mt-1 text-sm text-slate-400">
                            You’ll review selected rows before anything is created. This is still safe.
                          </p>
                        </div>

                        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 hover:bg-white/10">
                          <Upload className="h-4 w-4" />
                          Upload CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const text = await file.text();
                              setCsvText(text);
                              parseCsv(text);
                            }}
                          />
                        </label>
                      </div>

                      <textarea
                        value={csvText}
                        onChange={(e) => {
                          setCsvText(e.target.value);
                          parseCsv(e.target.value);
                        }}
                        rows={8}
                        placeholder={`client_name,state,entity_type,payroll,sales_tax,1040,1120,1120s,1065,annual_report,1099
Acme Inc,NY,S Corp,yes,no,no,no,yes,no,yes,no`}
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-[#020617] p-4 text-sm text-white outline-none transition focus:border-blue-500"
                      />
                    </div>

                    {csvRows.length > 0 && (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-sm font-semibold text-white">Preview import</div>
                          <div className="text-sm text-slate-400">
                            {includedCsvRows.length} of {csvRows.length} selected
                          </div>
                        </div>

                        <div className="space-y-3">
                          {csvRows.slice(0, 12).map((row) => (
                            <div
                              key={row.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                <label className="flex items-center gap-3 text-sm text-white">
                                  <input
                                    type="checkbox"
                                    checked={row.include}
                                    onChange={() =>
                                      setCsvRows((prev) =>
                                        prev.map((item) =>
                                          item.id === row.id
                                            ? { ...item, include: !item.include }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                  <span className="font-semibold">{row.client_name}</span>
                                </label>
                                <div className="text-sm text-slate-400">
                                  {row.state || "—"} • {row.entity_type || "Client"}
                                </div>
                              </div>

                              <div className="grid gap-2 md:grid-cols-3">
                                {(Object.keys(serviceLabels) as ServiceKey[]).map((service) => (
                                  <ServiceToggle
                                    key={service}
                                    title={serviceLabels[service]}
                                    subtitle={serviceDescriptions[service]}
                                    enabled={row.services[service]}
                                    compact
                                    onToggle={() =>
                                      setCsvRows((prev) =>
                                        prev.map((item) =>
                                          item.id === row.id
                                            ? {
                                                ...item,
                                                services: {
                                                  ...item.services,
                                                  [service]: !item.services[service],
                                                },
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                ))}
                              </div>

                              <div className="mt-3">
                                <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                                  Tax returns
                                </div>
                                <div className="grid gap-2 md:grid-cols-4">
                                  {(Object.keys(taxReturnLabels) as TaxReturnKey[]).map((taxReturn) => (
                                    <ServiceToggle
                                      key={taxReturn}
                                      title={taxReturnLabels[taxReturn]}
                                      subtitle={taxReturnDescriptions[taxReturn]}
                                      enabled={row.taxReturns[taxReturn]}
                                      compact
                                      onToggle={() =>
                                        setCsvRows((prev) =>
                                          prev.map((item) =>
                                            item.id === row.id
                                              ? {
                                                  ...item,
                                                  taxReturns: {
                                                    ...item.taxReturns,
                                                    [taxReturn]: !item.taxReturns[taxReturn],
                                                  },
                                                }
                                              : item,
                                          ),
                                        )
                                      }
                                    />
                                  ))}
                                </div>
                              </div>

                              {row.services.sales_tax && (
                                <SalesTaxFrequencySelector
                                  state={row.state}
                                  frequency={row.salesTaxFrequency}
                                  onChange={(frequency) =>
                                    setCsvRows((prev) =>
                                      prev.map((item) =>
                                        item.id === row.id
                                          ? { ...item, salesTaxFrequency: frequency }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {saveError && (
                      <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {saveError}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIntakeMethod("manual");
                          setStep(2);
                        }}
                        className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!hasValidCsvImport || saving}
                        onClick={generateWorkspace}
                        className="h-12 rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:opacity-40"
                      >
                        {saving ? "Generating..." : "Generate my workspace"}
                      </button>
                    </div>
                  </div>
                )}

                {step === "loading" && (
                  <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-8">
                    <div className="mb-6 flex justify-center">
                      <div className="relative h-16 w-16">
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-blue-400/30"
                          animate={{ scale: [1, 1.18, 1], opacity: [0.35, 0.9, 0.35] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                        />
                        <motion.div
                          className="absolute inset-2 rounded-full border-2 border-blue-400"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    </div>

                    <h2 className="text-center text-2xl font-semibold">
                      Generating your compliance system
                    </h2>
                    <p className="mt-3 text-center text-slate-400">
                      Creating the workspace, saving your setup, and generating only the filings you actually need.
                    </p>

                    <div className="mt-8 space-y-4">
                      <LoadingRow label="Creating secure workspace" delay={0} />
                      <LoadingRow label="Configuring compliance engine" delay={0.18} />
                      <LoadingRow label="Building filing calendar" delay={0.32} />
                      <LoadingRow label="Preparing workflow automation" delay={0.46} />
                      <LoadingRow label="Finalizing dashboard" delay={0.6} />
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 via-[#111827] to-[#111827] p-6">
                      <div className="mb-5">
                        <h2 className="text-2xl font-semibold">
                          Activate your workspace
                        </h2>
                        <p className="mt-2 text-slate-400">
                          Your compliance system is already built. Your dashboard, filings, and deadlines are waiting — start your free trial to unlock access.
                        </p>
                      </div>

                      {nextFiling && (
                        <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4">
                          <div className="text-xs uppercase tracking-[0.16em] text-emerald-300/90">
                            Your first deadline is already waiting
                          </div>
                          <div className="mt-1 text-lg font-semibold text-white">
                            {nextFiling.filingName}
                          </div>
                          <div className="mt-1 text-sm text-emerald-100/90">
                            Due {formatDueDate(nextFiling.dueDate)} in {nextFiling.jurisdictionCode}
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <PreviewStatCard
                          title={accountType === "business_owner" ? "Businesses configured" : "Clients created"}
                          value={String(workspacePreview.clients)}
                          note="Only the records you selected were created."
                        />
                        <PreviewStatCard
                          title="Filings + workflows"
                          value={String(workspacePreview.workflows)}
                          note="Built from what you told us."
                        />
                      </div>

                      {(workspacePreview.primaryFilings.length > 0 ||
                        workspacePreview.supportingFilings.length > 0) && (
                        <div className="mt-5 space-y-4">
                          {workspacePreview.primaryFilings.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                                Primary filings
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {workspacePreview.primaryFilings.map((filing) => (
                                  <div
                                    key={`${filing.filingName}-${filing.dueDate}-primary`}
                                    className="rounded-xl border border-cyan-400/15 bg-[#0b1220] px-3 py-3"
                                  >
                                    <div className="text-sm font-medium text-white">{filing.filingName}</div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {filing.jurisdictionCode} • due {formatDueDate(filing.dueDate)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {accountType === "accounting_firm" &&
                            workspacePreview.supportingFilings.length > 0 && (
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                                  Supporting filings
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {workspacePreview.supportingFilings.map((filing) => (
                                    <div
                                      key={`${filing.filingName}-${filing.dueDate}-supporting`}
                                      className="rounded-xl border border-white/10 bg-[#0b1220] px-3 py-3"
                                    >
                                      <div className="text-sm font-medium text-white">{filing.filingName}</div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        {filing.jurisdictionCode} • due {formatDueDate(filing.dueDate)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                      <div className="mb-4 text-sm font-semibold text-slate-300">
                        What happens next
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <PreviewCard
                          title="Your compliance system is ready"
                          subtitle="Start your free trial to unlock the dashboard and begin tracking deadlines."
                        />
                        <PreviewCard
                          title="View your dashboard"
                          subtitle="Your highest-priority deadlines and workflow actions will be waiting."
                        />
                        <PreviewCard
                          title="Add more clients anytime"
                          subtitle="Import more clients later or add more filings once the workspace is live."
                        />
                      </div>

                      <div className="mt-6 flex flex-col gap-3">
                        <p className="text-center text-sm text-emerald-300">
                          Your workspace is live — you just need to activate it
                        </p>

                        <button
                          type="button"
                          onClick={goToCheckout}
                          disabled={checkoutStarting}
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {checkoutStarting ? "Starting your trial..." : "Start free trial"}
                          <ArrowRight className="h-4 w-4" />
                        </button>

                        <p className="text-center text-sm text-slate-500">
                          Secure checkout • Takes less than 60 seconds
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Live preview</div>
              <h3 className="mt-2 text-xl font-semibold">What we’ll create</h3>
            </div>

            <div className="space-y-4">
              <MiniInsight
                title={accountType === "accounting_firm" ? "No accidental bulk setup" : "Fast first value"}
                body={
                  accountType === "accounting_firm"
                    ? "Start with one client by default. Import the rest only after you’ve seen the workspace working."
                    : "Start with a real workspace that already reflects your business and your actual filing needs."
                }
              />
              <MiniInsight
                title="Built around your selections"
                body="Only the services you enable will generate filings and workflows."
              />
              <MiniInsight
                title="Real deadlines, not placeholders"
                body="This preview is driven by your compliance rules and workflow templates."
              />

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-cyan-300/80">Preview</div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {workspacePreview.workflows > 0
                    ? `${workspacePreview.workflows} filing${workspacePreview.workflows === 1 ? "" : "s"} will be generated`
                    : previewConfigLoaded
                      ? "Select services to preview filings"
                      : "Loading live filing preview"}
                </div>

                <div className="mt-3 space-y-4">
                  {workspacePreview.primaryFilings.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                        Primary filings
                      </div>
                      <div className="space-y-2">
                        {workspacePreview.primaryFilings.map((filing) => (
                          <div
                            key={`${filing.filingName}-${filing.dueDate}-aside-primary`}
                            className="rounded-xl border border-cyan-400/15 bg-white/[0.04] px-3 py-2"
                          >
                            <div className="text-sm text-white">{filing.filingName}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {filing.jurisdictionCode} • due {formatDueDate(filing.dueDate)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {accountType === "accounting_firm" &&
                    workspacePreview.supportingFilings.length > 0 && (
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                          Supporting filings
                        </div>
                        <div className="space-y-2">
                          {workspacePreview.supportingFilings.map((filing) => (
                            <div
                              key={`${filing.filingName}-${filing.dueDate}-aside-supporting`}
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                            >
                              <div className="text-sm text-white">{filing.filingName}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {filing.jurisdictionCode} • due {formatDueDate(filing.dueDate)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {previewConfigLoaded && workspacePreview.filings.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-400">
                      Add a business or client, choose at least one service or return, and the filing preview will appear here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  pattern,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
      <input
        type={type}
        inputMode={inputMode}
        pattern={pattern}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-[#020617] px-4 text-white outline-none transition [appearance:textfield] focus:border-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}

function StateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
      <input
        list="dh-state-options"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 2))}
        placeholder="NY"
        className="h-12 w-full rounded-xl border border-white/10 bg-[#020617] px-4 text-white outline-none transition focus:border-blue-500"
      />
      <datalist id="dh-state-options">
        {US_STATES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-white/10 bg-[#020617] px-4 text-white outline-none transition focus:border-blue-500"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SetupPanel({
  form,
  setForm,
  title,
  subtitle,
  buttonLabel,
  onBack,
  onSubmit,
  disabled,
  saveError,
  isBusinessOwner = false,
}: {
  form: SetupForm;
  setForm: React.Dispatch<React.SetStateAction<SetupForm>>;
  title: string;
  subtitle: string;
  buttonLabel: string;
  onBack: () => void;
  onSubmit: () => void;
  disabled: boolean;
  saveError: string | null;
  isBusinessOwner?: boolean;
}) {
  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label={isBusinessOwner ? "Business name" : "Client name"}
          value={form.name}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              name: value,
            }))
          }
          placeholder={isBusinessOwner ? "Acme Holdings LLC" : "Hudson Valley Plumbing"}
        />

        <StateInput
          label="State"
          value={form.state}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              state: value,
            }))
          }
        />

        <div className="md:col-span-2">
          <Select
            label="Entity type"
            value={form.entityType}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                entityType: value,
                taxReturns: getDefaultTaxReturnsForEntity(value),
              }))
            }
            options={ENTITY_TYPE_OPTIONS}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-cyan-300" />
          <div>
            <div className="text-sm font-semibold text-cyan-100">Smart recommendation</div>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              {getSmartRecommendation(form.entityType)}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-white">What does this business need help with?</div>
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(serviceLabels) as ServiceKey[]).map((service) => (
            <ServiceToggle
              key={service}
              title={serviceLabels[service]}
              subtitle={serviceDescriptions[service]}
              enabled={form.services[service]}
              onToggle={() =>
                setForm((current) => ({
                  ...current,
                  services: {
                    ...current.services,
                    [service]: !current.services[service],
                  },
                }))
              }
            />
          ))}
        </div>
      </div>

      <div>
          <div className="mb-3 text-sm font-semibold text-white">Income tax return type</div>
          <div className="grid gap-2 md:grid-cols-4">
            {(Object.keys(taxReturnLabels) as TaxReturnKey[]).map((taxReturn) => (
              <ServiceToggle
                key={taxReturn}
                title={taxReturnLabels[taxReturn]}
                subtitle={taxReturnDescriptions[taxReturn]}
                enabled={form.taxReturns[taxReturn]}
                onToggle={() =>
                  setForm((current) => ({
                    ...current,
                    taxReturns: {
                      ...current.taxReturns,
                      [taxReturn]: !current.taxReturns[taxReturn],
                    },
                  }))
                }
              />
            ))}
          </div>
        </div>

      {form.services.sales_tax && (
        <SalesTaxFrequencySelector
          state={form.state}
          frequency={form.salesTaxFrequency}
          onChange={(frequency) =>
            setForm((current) => ({
              ...current,
              salesTaxFrequency: frequency,
            }))
          }
        />
      )}

      {saveError && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-400 transition hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="h-12 rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function SalesTaxFrequencySelector({
  state,
  frequency,
  onChange,
}: {
  state: string;
  frequency: FilingFrequency;
  onChange: (frequency: FilingFrequency) => void;
}) {
  return (
    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-5">
      <div className="text-sm font-semibold text-white">
        {state.trim().toUpperCase() === "NY"
          ? "New York sales tax frequency"
          : "Sales tax filing frequency"}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {state.trim().toUpperCase() === "NY"
          ? "Choose monthly, quarterly, or annual so Due Horizon creates the right NY sales tax schedule."
          : "Choose how often this filer submits sales tax so Due Horizon generates the right recurring filings."}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(["monthly", "quarterly", "annual"] as FilingFrequency[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`rounded-xl border px-4 py-3 text-sm transition ${
              frequency === value
                ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ServiceToggle({
  title,
  subtitle,
  enabled,
  onToggle,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
        enabled
          ? "border-cyan-300/30 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
      } ${compact ? "text-sm" : ""}`}
    >
      <span>
        <span className="block font-medium">{title}</span>
        {subtitle ? (
          <span className="mt-1 block text-xs leading-5 text-slate-400">{subtitle}</span>
        ) : null}
      </span>
      <CheckCircle2
        className={`h-4 w-4 shrink-0 ${enabled ? "opacity-100" : "opacity-30"}`}
      />
    </button>
  );
}

function PathCard({
  title,
  subtitle,
  points,
  active,
  onClick,
}: {
  title: string;
  subtitle: string;
  points: string[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-6 text-left transition ${
        active
          ? "border-cyan-300/30 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.035] hover:bg-white/[0.05]"
      }`}
    >
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {points.map((point) => (
          <div key={point} className="flex items-start gap-3 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
            <span>{point}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function MiniInsight({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function PreviewCard({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm leading-6 text-slate-400">{subtitle}</p>
    </div>
  );
}

function PreviewStatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{note}</div>
    </div>
  );
}

function LoadingRow({
  label,
  delay,
}: {
  label: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.3, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
    >
      <div className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
      <div className="text-sm text-slate-200">{label}</div>
    </motion.div>
  );
}
