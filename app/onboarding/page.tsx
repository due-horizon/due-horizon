"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { seedWorkspaceFromOnboarding } from "./actions/seed-onboarding";

type AccountType = "business_owner" | "accounting_firm" | null;
type IntakeMethod = "manual" | "csv" | "later" | null;
type Step = 1 | 2 | 3 | 4 | "loading" | 5;

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
];

const ENTITY_TYPE_OPTIONS = [
  { value: "Individual", label: "Individual" },
  { value: "Single-Member LLC", label: "Single-Member LLC" },
  { value: "LLC", label: "LLC" },
  { value: "S Corp", label: "S Corp" },
  { value: "C Corp", label: "C Corp" },
  { value: "Partnership", label: "Partnership" },
  { value: "Nonprofit", label: "Nonprofit" },
  { value: "Trust", label: "Trust" },
];

const defaultServices = (): ClientServiceMap => ({
  payroll: false,
  sales_tax: false,
  annual_report: false,
  w2_1099: false,
});

const defaultTaxReturns = (): ClientTaxReturnMap => ({
  f1040: false,
  f1120: false,
  f1120s: false,
  f1065: false,
});

const serviceLabels: Record<ServiceKey, string> = {
  payroll: "Payroll",
  sales_tax: "Sales tax",
  annual_report: "Annual report",
  w2_1099: "1099 / W-2",
};

const taxReturnLabels: Record<TaxReturnKey, string> = {
  f1040: "1040",
  f1120: "1120",
  f1120s: "1120S",
  f1065: "1065",
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return (
      (typeof maybeError.message === "string" && maybeError.message) ||
      (typeof maybeError.details === "string" && maybeError.details) ||
      (typeof maybeError.hint === "string" && maybeError.hint) ||
      (typeof maybeError.error_description === "string" && maybeError.error_description) ||
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

function getLockedInitialStep(accountType: AccountType): Step {
  if (accountType === "accounting_firm") return 2;
  if (accountType === "business_owner") return 1;
  return 1;
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
    normalized == "llc" ||
    normalized.includes("sole prop")
  ) {
    return { f1040: true, f1120: false, f1120s: false, f1065: false };
  }

  return defaultTaxReturns();
}

function hasSelectedTaxReturn(taxReturns: ClientTaxReturnMap) {
  return Object.values(taxReturns).some(Boolean);
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [signupType, setSignupType] = useState<AccountType>(null);
  const [signupWorkspaceName, setSignupWorkspaceName] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const resolvedSignupType =
      mapSignupTypeToOnboarding(params.get("type")) ||
      mapPlanToOnboarding(params.get("plan"));

    setSignupType(resolvedSignupType);
    setSignupWorkspaceName(params.get("workspace")?.trim() || "");
  }, []);

  const [step, setStep] = useState<Step>(() => getLockedInitialStep(signupType));
  const [accountType, setAccountType] = useState<AccountType>(signupType);
  const [firmName, setFirmName] = useState(
    signupType === "accounting_firm" ? signupWorkspaceName : ""
  );
  const [clientCount, setClientCount] = useState("");
  const [intakeMethod, setIntakeMethod] = useState<IntakeMethod>(null);

  const [manualClient, setManualClient] = useState<SetupForm>({
    name: "",
    state: "",
    entityType: "",
    services: defaultServices(),
    taxReturns: defaultTaxReturns(),
    salesTaxFrequency: "quarterly",
  });

  const [businessSetup, setBusinessSetup] = useState<SetupForm>({
    name: signupType === "business_owner" ? signupWorkspaceName : "",
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
  const [showFinalCta, setShowFinalCta] = useState(false);
  const [lockedAccountType, setLockedAccountType] = useState(Boolean(signupType));

  const parsedClientCount = Math.max(0, Number.parseInt(clientCount || "0", 10) || 0);

  useEffect(() => {
    if (!signupType) {
      setLockedAccountType(false);
      return;
    }

    setAccountType(signupType);
    setLockedAccountType(true);
    setStep(getLockedInitialStep(signupType));

    if (signupType === "accounting_firm") {
      if (signupWorkspaceName) {
        setFirmName((current) => current || signupWorkspaceName);
      }
      return;
    }

    if (signupWorkspaceName) {
      setBusinessSetup((current) => ({
        ...current,
        name: current.name || signupWorkspaceName,
      }));
    }
  }, [signupType, signupWorkspaceName]);

  useEffect(() => {
    let ignore = false;

    const redirectIfOnboarded = async () => {
      const params = new URLSearchParams(window.location.search);
      const allowRevisit = params.get("edit") === "true";

      if (allowRevisit) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (ignore) return;

      const user = session?.user ?? null;

      if (!user) {
        return;
      }

      const preferredFirmId =
        typeof user.user_metadata?.firm_id === "string"
          ? user.user_metadata.firm_id
          : typeof user.user_metadata?.workspace_id === "string"
            ? user.user_metadata.workspace_id
            : null;

      const { data: memberships, error: membershipError } = await supabase
        .from("firm_members")
        .select("firm_id")
        .eq("user_id", user.id);

      if (ignore) return;

      if (membershipError) {
        console.error("Onboarding membership lookup failed:", membershipError);
        return;
      }

      const membershipIds = (memberships || []).map((membership) => membership.firm_id);
      const resolvedFirmId =
        (preferredFirmId && membershipIds.includes(preferredFirmId) ? preferredFirmId : null) ||
        membershipIds[0] ||
        preferredFirmId ||
        null;

      if (!resolvedFirmId) {
        return;
      }

      const { data: firm, error: firmError } = await supabase
        .from("firms")
        .select("onboarding_completed")
        .eq("id", resolvedFirmId)
        .maybeSingle();

      if (ignore) return;

      if (firmError) {
        console.error("Onboarding firm lookup failed:", firmError);
        return;
      }

      if (firm?.onboarding_completed) {
        router.replace("/dashboard");
        router.refresh();
      }
    };

    redirectIfOnboarded();

    return () => {
      ignore = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (step !== 5) {
      setShowFinalCta(false);
      return;
    }

    const timer = window.setTimeout(() => setShowFinalCta(true), 350);
    return () => window.clearTimeout(timer);
  }, [step]);

  const totalSteps =
    accountType === "accounting_firm" ? (lockedAccountType ? 4 : 5) : 2;
  const currentStepDisplay = getCurrentStepDisplay(step, accountType, lockedAccountType);
  const progress = Math.min((currentStepDisplay / totalSteps) * 100, 100);

  const canContinueStep1 = Boolean(accountType);
  const canContinueFirmDetails =
    firmName.trim().length > 0 && clientCount.trim().length > 0;
  const canContinueIntakeChoice = Boolean(intakeMethod);

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

  const includedCsvRows = csvRows.filter((row) => row.include);
  const hasValidCsvImport = includedCsvRows.length > 0;

  const workspacePreview = useMemo(() => {
    if (accountType === "accounting_firm") {
      const count =
        intakeMethod === "manual"
          ? 1
          : intakeMethod === "csv"
            ? includedCsvRows.length
            : 0;

      return {
        clients: count,
        workflows: estimateWorkflowCount(
          intakeMethod === "manual"
            ? [{ services: manualClient.services, taxReturns: manualClient.taxReturns }]
            : includedCsvRows.map((row) => ({
                services: row.services,
                taxReturns: row.taxReturns,
              }))
        ),
      };
    }

    if (accountType === "business_owner") {
      return {
        clients: businessSetup.name.trim() ? 1 : 0,
        workflows: estimateWorkflowCount([
          { services: businessSetup.services, taxReturns: businessSetup.taxReturns },
        ]),
      };
    }

    return { clients: 0, workflows: 0 };
  }, [
    accountType,
    intakeMethod,
    includedCsvRows,
    manualClient.services,
    businessSetup.services,
    businessSetup.name,
  ]);

  function goForwardFromStep1() {
    if (!accountType) return;
    setSaveError(null);

    if (accountType === "business_owner") {
      setStep(1);
      return;
    }

    setStep(2);
  }

  function goBackFromIntakeChoice() {
    setSaveError(null);

    if (accountType === "business_owner") {
      setStep(1);
      return;
    }

    setStep(2);
  }

  async function ensureFirm() {
    if (firmId) return firmId;

    if (!accountType || !intakeMethod) {
      throw new Error("Missing onboarding selections.");
    }

    try {
      const result = await seedWorkspaceFromOnboarding({
        accountType,
        firmName:
          accountType === "business_owner"
            ? businessSetup.name.trim() || firmName
            : firmName,
        clientCount: accountType === "business_owner" ? 1 : parsedClientCount,
        intakeMethod,
      });

      console.log("Firm created/updated:", result);

      const resolvedFirmId = result.firmId || result.workspaceId;
      setFirmId(resolvedFirmId);
      return resolvedFirmId;
    } catch (err) {
      const message = getErrorMessage(err);
      console.error("FULL FIRM ERROR:", err);
      console.error("FULL FIRM ERROR MESSAGE:", message);
      setSaveError(message);
      throw new Error(message);
    }
  }

  async function upsertComplianceProfileAndGenerateFilings(
    resolvedFirmId: string,
    clientId: string,
    form: SetupForm
  ) {
    const { data: profileId, error: profileError } = await supabase.rpc(
      "upsert_client_compliance_profile",
      {
        p_workspace_id: resolvedFirmId,
        p_client_id: clientId,
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
      }
    );

    console.log("upsert_client_compliance_profile result:", {
      firmId: resolvedFirmId,
      clientId,
      profileId,
      profileError,
      payload: {
        state: form.state.trim().toUpperCase(),
        entityType: form.entityType.trim(),
        services: form.services,
        taxReturns: form.taxReturns,
        salesTaxFrequency: form.services.sales_tax ? form.salesTaxFrequency : null,
      },
    });

    if (profileError || !profileId) {
      throw new Error(
        profileError?.message ||
          profileError?.details ||
          profileError?.hint ||
          "Failed to save compliance profile."
      );
    }

    const { data: filingsData, error: filingsError } = await supabase.rpc(
      "generate_filings_for_profile",
      {
        p_profile_id: profileId,
      }
    );

    console.log("generate_filings_for_profile result:", {
      profileId,
      filingsData,
      filingsError,
    });

    if (filingsError) {
      throw new Error(
        filingsError?.message ||
          filingsError?.details ||
          filingsError?.hint ||
          "Failed to generate filings from compliance profile."
      );
    }
  }

  async function createClientRecord(
    resolvedFirmId: string,
    form: SetupForm,
    source: "manual" | "import" = "manual"
  ) {
    const { data: client, error } = await supabase
      .from("clients")
      .insert({
        firm_id: resolvedFirmId,
        client_name: form.name.trim(),
        state_code: form.state.trim().toUpperCase(),
        entity_type: form.entityType.trim(),
        source,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !client) throw error || new Error("Failed to create client.");

    await upsertComplianceProfileAndGenerateFilings(resolvedFirmId, client.id, form);

    return client.id;
  }

  async function finalizeBusinessOwnerManual() {
  const resolvedFirmId = await ensureFirm();

  // 1. Get the business organization (already created in seed file)
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("firm_id", resolvedFirmId)
    .eq("organization_type", "business")
    .maybeSingle();

  if (orgError || !org) {
    throw orgError || new Error("Business organization not found.");
  }

  // 2. Update organization with onboarding data
  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      legal_name: businessSetup.name.trim(),
      display_name: businessSetup.name.trim(),
      state_code: businessSetup.state.trim().toUpperCase(),
      entity_type: businessSetup.entityType.trim(),
    })
    .eq("id", org.id);

  if (updateError) {
    throw updateError;
  }

  // 3. Create compliance profile for ORGANIZATION (NOT client)
  const { data: profileId, error: profileError } = await supabase.rpc(
    "upsert_client_compliance_profile",
    {
      p_workspace_id: resolvedFirmId,
      p_organization_id: org.id,   // 🔥 THIS IS THE FIX
      p_client_id: null,
      p_state_code: businessSetup.state.trim().toUpperCase(),
      p_entity_type: businessSetup.entityType.trim(),
      p_payroll_enabled: businessSetup.services.payroll,
      p_sales_tax_enabled: businessSetup.services.sales_tax,
      p_sales_tax_frequency: businessSetup.services.sales_tax
        ? businessSetup.salesTaxFrequency
        : null,
      p_income_tax_enabled: hasSelectedTaxReturn(businessSetup.taxReturns),
      p_annual_report_enabled: businessSetup.services.annual_report,
      p_w2_1099_enabled: businessSetup.services.w2_1099,
      p_tax_1040_enabled: businessSetup.taxReturns.f1040,
      p_tax_1120_enabled: businessSetup.taxReturns.f1120,
      p_tax_1120s_enabled: businessSetup.taxReturns.f1120s,
      p_tax_1065_enabled: businessSetup.taxReturns.f1065,
    }
  );

  if (profileError || !profileId) {
    throw new Error("Failed to create business compliance profile.");
  }

  // 4. Generate filings
  const { error: filingsError } = await supabase.rpc(
    "generate_filings_for_profile",
    {
      p_profile_id: profileId,
    }
  );

  if (filingsError) {
    throw filingsError;
  }

  setStep(5);
}
  async function finalizeExploreFirst() {
    await ensureFirm();
    setStep(5);
  }

  async function finalizeManualClient() {
    const resolvedFirmId = await ensureFirm();
    await createClientRecord(resolvedFirmId, manualClient, "manual");
    setStep(5);
  }

  async function finalizeCsvImport() {
    const resolvedFirmId = await ensureFirm();

    const rowsToInsert = includedCsvRows.map((row) => ({
      firm_id: resolvedFirmId,
      client_name: row.client_name.trim(),
      state_code: row.state.trim().toUpperCase(),
      entity_type: row.entity_type.trim() || "Client",
      source: "import",
      status: "active",
    }));

    const { data: clients, error } = await supabase
      .from("clients")
      .insert(rowsToInsert)
      .select("id, state_code");

    if (error || !clients) throw error || new Error("Failed to import clients.");

    for (let i = 0; i < clients.length; i += 1) {
      const client = clients[i];
      const row = includedCsvRows[i];

      await upsertComplianceProfileAndGenerateFilings(resolvedFirmId, client.id, {
        name: row.client_name,
        state: client.state_code || row.state,
        entityType: row.entity_type,
        services: row.services,
        taxReturns: row.taxReturns,
        salesTaxFrequency: row.salesTaxFrequency,
      });
    }

    setStep(5);
  }

  async function generateWorkspace() {
    setSaveError(null);
    setSaving(true);

    try {
      if (!accountType || !intakeMethod) {
        throw new Error("Please complete onboarding first.");
      }

      if (accountType === "business_owner") {
        if (intakeMethod === "later") {
          setStep("loading");
          await finalizeExploreFirst();
          return;
        }

        if (intakeMethod === "manual") {
          if (step !== 2) {
            setStep(2);
            return;
          }

          if (!canFinishBusinessSetup) {
            throw new Error("Enter your business details and choose at least one service.");
          }

          setStep("loading");
          await finalizeBusinessOwnerManual();
          return;
        }

        throw new Error("Please choose how you want to get started.");
      }

      if (intakeMethod === "later") {
        setStep("loading");
        await finalizeExploreFirst();
        return;
      }

      if (intakeMethod === "manual") {
        if (step !== 4) {
          setStep(4);
          return;
        }

        if (!canFinishManualClient) {
          throw new Error("Add one client and select at least one service.");
        }
        setStep("loading");
        await finalizeManualClient();
        return;
      }

      if (intakeMethod === "csv") {
        if (step !== 4) {
          setStep(4);
          return;
        }

        if (!hasValidCsvImport) {
          throw new Error("Upload or paste a CSV and choose at least one client row.");
        }
        setStep("loading");
        await finalizeCsvImport();
        return;
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("GENERATE WORKSPACE ERROR:", error);
      console.error("GENERATE WORKSPACE ERROR MESSAGE:", message);
      setStep(
        accountType === "accounting_firm" && intakeMethod !== "later"
          ? 4
          : accountType === "business_owner" && intakeMethod === "manual"
            ? 2
            : accountType === "business_owner"
              ? 1
              : 3
      );
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

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
              ])
            );

            const findValue = (...candidates: string[]) => {
              const entry = Object.entries(normalized).find(([key]) =>
                candidates.some((candidate) => key.includes(candidate))
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
                  findValue("income tax", "income_tax", "tax return", "income")
                );
                const inferred = genericIncomeTax
                  ? getDefaultTaxReturnsForEntity(findValue("entity", "type"))
                  : defaultTaxReturns();

                return {
                  f1040: toBoolean(findValue("1040")) || inferred.f1040,
                  f1120: toBoolean(findValue("1120")) || inferred.f1120,
                  f1120s:
                    toBoolean(findValue("1120s", "1120-s", "1120 s")) || inferred.f1120s,
                  f1065: toBoolean(findValue("1065")) || inferred.f1065,
                };
              })(),
              salesTaxFrequency: normalizeSalesTaxFrequency(
                findValue("sales_tax_frequency", "sales tax frequency", "salestaxfrequency"),
                "quarterly"
              ),
            } satisfies CsvImportedRow;
          })
          .filter((row: CsvImportedRow) => row.client_name.trim().length > 0);

        setCsvRows(parsed);
      },
    });
  }

  const heading = getHeading(step, accountType, intakeMethod);
  const subheading = getSubheading(step, accountType, intakeMethod);

  const showPathChooserStep = step === 1 && !lockedAccountType;
  const showBusinessChoiceStep = step === 1 && accountType === "business_owner";
  const showFirmChoiceStep = step === 3 && accountType === "accounting_firm";

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
                : `Step ${currentStepDisplay} of ${totalSteps}`}
            </div>

            {lockedAccountType && accountType && (
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300 backdrop-blur-sm">
                {accountType === "accounting_firm"
                  ? "Firm plan selected"
                  : "Business plan selected"}
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
            A fast setup flow built to get you into a real, working workspace.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={String(step)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.22 }}
              >
                {showPathChooserStep && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <PathCard
                      title="I run a business"
                      subtitle="Get your own company set up with live deadlines and a real compliance workspace"
                      points={[
                        "Single-entity setup in minutes",
                        "Smart deadline detection",
                        "Calendar and reminders ready fast",
                      ]}
                      active={accountType === "business_owner"}
                      onClick={() => setAccountType("business_owner")}
                    />
                    <PathCard
                      title="I manage clients"
                      subtitle="Set up a firm workspace built for real clients, real services, and controlled workflow creation"
                      points={[
                        "Import only the clients you want",
                        "Choose services per client",
                        "Avoid creating 250 workflows by mistake",
                      ]}
                      active={accountType === "accounting_firm"}
                      onClick={() => setAccountType("accounting_firm")}
                    />

                    <div className="col-span-full mt-4 flex justify-end">
                      <button
                        type="button"
                        disabled={!canContinueStep1}
                        onClick={goForwardFromStep1}
                        className="h-12 cursor-pointer rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && accountType === "accounting_firm" && (
                  <div className="mx-auto max-w-xl space-y-6">
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
                      type="number"
                    />

                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setStep(lockedAccountType ? 2 : 1)}
                        className="text-slate-400 transition hover:text-slate-200"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!canContinueFirmDetails}
                        onClick={() => setStep(3)}
                        className="h-12 cursor-pointer rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                )}

                {(showBusinessChoiceStep || showFirmChoiceStep) && (
                  <div className="mx-auto max-w-xl space-y-6">
                    <Choice
                      title={accountType === "accounting_firm" ? "Upload a CSV" : "Import data later"}
                      subtitle={
                        accountType === "accounting_firm"
                          ? "Import a client list, preview it, and choose which clients to activate."
                          : "Jump in now and finish company setup from your dashboard."
                      }
                      badge={accountType === "accounting_firm" ? "Best for many clients" : "Flexible"}
                      active={intakeMethod === "csv"}
                      onClick={() => setIntakeMethod("csv")}
                      highlight={accountType === "accounting_firm"}
                      hidden={accountType === "business_owner"}
                    />

                    <Choice
                      title={accountType === "accounting_firm" ? "Add one client" : "Start with guided setup"}
                      subtitle={
                        accountType === "accounting_firm"
                          ? "Create one real client now and generate workflows only for selected services."
                          : "Answer a few questions and generate your first compliance plan."
                      }
                      badge={accountType === "business_owner" ? "Recommended" : "Best for first setup"}
                      active={intakeMethod === "manual"}
                      onClick={() => setIntakeMethod("manual")}
                    />

                    <Choice
                      title="Explore first"
                      subtitle={
                        accountType === "accounting_firm"
                          ? "Create the workspace only. Add clients and services later."
                          : "Take a look around before entering more company details."
                      }
                      active={intakeMethod === "later"}
                      onClick={() => setIntakeMethod("later")}
                    />

                    {saveError && (
                      <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {saveError}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4">
                      <button
                        type="button"
                        onClick={goBackFromIntakeChoice}
                        className="text-slate-400 transition hover:text-slate-200"
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        disabled={!canContinueIntakeChoice || saving}
                        onClick={generateWorkspace}
                        className="h-12 cursor-pointer rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {accountType === "accounting_firm" && intakeMethod !== "later"
                          ? "Continue"
                          : saving
                            ? "Generating..."
                            : intakeMethod === "later"
                              ? "Generate workspace"
                              : "Continue"}
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && accountType === "business_owner" && intakeMethod === "manual" && (
                  <SetupPanel
                    form={businessSetup}
                    setForm={setBusinessSetup}
                    title="Set up your business"
                    subtitle="Enter your company details and switch on only the filings you actually need."
                    buttonLabel={saving ? "Generating..." : "Create my compliance workspace"}
                    onBack={() => setStep(1)}
                    onSubmit={generateWorkspace}
                    disabled={!canFinishBusinessSetup || saving}
                    saveError={saveError}
                    isBusinessOwner
                  />
                )}

                {step === 4 && accountType === "accounting_firm" && intakeMethod === "manual" && (
                  <SetupPanel
                    form={manualClient}
                    setForm={setManualClient}
                    title="Add your first client"
                    subtitle="Create one real client and turn on only the services that apply."
                    buttonLabel={saving ? "Generating..." : "Create workspace and client"}
                    onBack={() => setStep(3)}
                    onSubmit={generateWorkspace}
                    disabled={!canFinishManualClient || saving}
                    saveError={saveError}
                  />
                )}

                {step === 4 && accountType === "accounting_firm" && intakeMethod === "csv" && (
                  <div className="mx-auto max-w-4xl space-y-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">Import client list</div>
                          <p className="mt-1 text-sm text-slate-400">
                            Paste CSV data or upload a file. Only checked rows will be imported.
                          </p>
                        </div>

                        <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-slate-200 hover:bg-white/10">
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
                      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-sm font-semibold text-white">Preview import</div>
                          <div className="text-sm text-slate-400">
                            {includedCsvRows.length} of {csvRows.length} clients selected
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
                                            : item
                                        )
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
                                            : item
                                        )
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
                                              : item
                                          )
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
                                          : item
                                      )
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
                        onClick={() => setStep(3)}
                        className="text-slate-400 transition hover:text-slate-200"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!hasValidCsvImport || saving}
                        onClick={generateWorkspace}
                        className="h-12 cursor-pointer rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving ? "Generating..." : "Import selected clients"}
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

                    <h2 className="text-center text-2xl font-semibold">Building your workspace</h2>
                    <p className="mt-3 text-center text-slate-400">
                      Creating the workspace, client records, and only the workflows you actually selected.
                    </p>

                    <div className="mt-8 space-y-4">
                      <LoadingRow label="Creating workspace" delay={0} />
                      <LoadingRow label="Saving clients and service selections" delay={0.2} />
                      <LoadingRow label="Generating only the needed workflows" delay={0.35} />
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 via-[#111827] to-[#111827] p-6">
                      <div className="mb-5">
                        <h2 className="text-2xl font-semibold">
                          {accountType === "accounting_firm"
                            ? `Your ${firmName || "firm"} workspace is ready`
                            : `Your ${businessSetup.name || "business"} workspace is ready`}
                        </h2>
                        <p className="mt-2 text-slate-400">
                          We created the workspace without blindly activating services for every client.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <PreviewStatCard
                          title={
                            accountType === "accounting_firm"
                              ? "Clients created"
                              : "Business entities created"
                          }
                          value={String(workspacePreview.clients)}
                          note="Only the records you chose were added."
                        />
                        <PreviewStatCard
                          title="Starter workflows"
                          value={String(workspacePreview.workflows)}
                          note="Generated only for the selected services."
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                      <div className="mb-4 text-sm font-semibold text-slate-300">What’s ready now</div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <PreviewCard
                          title="Guided setup is complete"
                          subtitle="Your workspace is set up so you can move straight into real compliance work."
                        />
                        <PreviewCard
                          title="Imports are ready"
                          subtitle="Client imports can be reviewed before you bring them into the workspace."
                        />
                        <PreviewCard
                          title="Clear handoff"
                          subtitle="You can see what was created before you enter the dashboard."
                        />
                      </div>

                      <AnimatePresence>
                        {showFinalCta && (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.25 }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                router.replace("/dashboard");
                                router.refresh();
                              }}
                              className="mt-6 h-12 w-full rounded-xl bg-blue-600 font-semibold transition hover:bg-blue-500"
                            >
                              Enter your dashboard
                            </button>
                            <p className="mt-2 text-center text-xs text-slate-500">
                              Your workspace is ready and waiting.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Why this setup works</div>
              <h3 className="mt-2 text-xl font-semibold">A cleaner way to launch</h3>
            </div>

            <div className="space-y-4">
              <MiniInsight
                title={accountType === "accounting_firm" ? "No accidental bulk setup" : "Faster first value"}
                body={
                  accountType === "accounting_firm"
                    ? "Only the clients, services, and filing tracks you actually choose get created."
                    : "Start with a workspace that already reflects the filings and services you actually need."
                }
              />
              <MiniInsight
                title="Service-level control"
                body="Choose exactly which services apply before anything is created."
              />
              <MiniInsight
                title="Built for real work"
                body="Your workspace starts with real clients or business details, not placeholders."
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function normalizeSalesTaxFrequency(
  value?: string,
  fallback: FilingFrequency = "quarterly"
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

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNextAnnualDueDate(offsetDays = 30) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toISODate(date);
}

function getNextQuarterlyDueDates(count = 4) {
  const today = new Date();
  const dueDates: string[] = [];
  let cursorYear = today.getFullYear();
  while (dueDates.length < count) {
    for (const month of [3, 6, 9, 12]) {
      const dueDate = new Date(cursorYear, month - 1, 15);
      if (dueDate > today) {
        dueDates.push(toISODate(dueDate));
        if (dueDates.length === count) return dueDates;
      }
    }
    cursorYear += 1;
  }
  return dueDates;
}

function getNextSalesTaxDueDates(state: string, frequency: FilingFrequency) {
  const normalizedState = state.trim().toUpperCase();
  const today = new Date();

  if (normalizedState === "NY") {
    if (frequency === "monthly") {
      const monthlyDates: string[] = [];
      let year = today.getFullYear();
      let month = today.getMonth() + 1;
      while (monthlyDates.length < 12) {
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        monthlyDates.push(toISODate(new Date(year, month - 1, 20)));
      }
      return monthlyDates;
    }

    if (frequency === "quarterly") {
      const quarterlyDates: string[] = [];
      let year = today.getFullYear();
      while (quarterlyDates.length < 4) {
        for (const [month, day] of [
          [3, 20],
          [6, 20],
          [9, 20],
          [12, 20],
        ] as const) {
          const dueDate = new Date(year, month - 1, day);
          if (dueDate > today) {
            quarterlyDates.push(toISODate(dueDate));
            if (quarterlyDates.length === 4) return quarterlyDates;
          }
        }
        year += 1;
      }
      return quarterlyDates;
    }

    const annualDueDate = new Date(today.getFullYear(), 2, 20);
    if (annualDueDate <= today) {
      annualDueDate.setFullYear(annualDueDate.getFullYear() + 1);
    }
    return [toISODate(annualDueDate)];
  }

  if (frequency === "monthly") {
    const dates: string[] = [];
    let year = today.getFullYear();
    let month = today.getMonth();
    while (dates.length < 12) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      dates.push(toISODate(new Date(year, month, 20)));
    }
    return dates;
  }

  if (frequency === "quarterly") {
    return getNextQuarterlyDueDates(4);
  }

  return [getNextAnnualDueDate(30)];
}

function getCurrentStepDisplay(
  step: Step,
  accountType: AccountType,
  lockedAccountType = false
) {
  if (accountType === "business_owner") {
    if (step === "loading" || step === 5) return 2;
    if (step === 1) return 1;
    if (step === 2) return 2;
    if (step === 3) return 1;
    if (step === 4) return 2;
    return 1;
  }

  if (lockedAccountType) {
    if (step === 2) return 1;
    if (step === 3) return 2;
    if (step === 4) return 3;
    if (step === "loading" || step === 5) return 4;
    return 1;
  }

  if (step === "loading" || step === 5) {
    return 5;
  }

  return Number(step);
}

function getHeading(step: Step, accountType: AccountType, intakeMethod: IntakeMethod) {
  if (step === 1 && accountType === "business_owner") {
    return "Choose your fastest path to go live";
  }
  if (step === 1) return "Let’s get your compliance fully under control";
  if (step === 2 && accountType === "accounting_firm") return "Set up your firm workspace";
  if (step === 3 && accountType === "accounting_firm") return "Choose how you want to get started";
  if (step === 2 && accountType === "business_owner" && intakeMethod === "manual") {
    return "Build your business workspace";
  }
  if (step === 4 && intakeMethod === "manual") return "Add your first client";
  if (step === 4 && intakeMethod === "csv") return "Import only the clients you want";
  if (step === "loading") return "Generating your Due Horizon workspace";
  if (step === 5) return "You’re ready to go";
  return "Set up your workspace";
}

function getSubheading(step: Step, accountType: AccountType, intakeMethod: IntakeMethod) {
  if (step === 1 && accountType === "business_owner") {
    return "Choose the path that gets your workspace live the fastest.";
  }
  if (step === 1) {
    return "You’ll have a real workspace with live filings and deadlines in just a few steps.";
  }
  if (step === 2 && accountType === "accounting_firm") {
    return "We’ll use this to shape your initial workspace, client setup, and compliance structure.";
  }
  if (step === 3 && accountType === "accounting_firm") {
    return "Import a list, add one client manually, or create the workspace first and finish setup later.";
  }
  if (step === 2 && accountType === "business_owner" && intakeMethod === "manual") {
    return "Enter your company details and generate only the filings your business actually needs.";
  }
  if (step === 4 && intakeMethod === "manual") {
    return "Create one real client and turn on only the services that apply.";
  }
  if (step === 4 && intakeMethod === "csv") {
    return "Preview your CSV and choose which rows and services should turn into real workflows.";
  }
  if (step === "loading") {
    return "We’re creating your workspace, saving clients, and generating only the necessary workflows.";
  }
  if (step === 5) {
    return "Your first dashboard now has real clients and real filings instead of placeholders.";
  }
  return "";
}

function estimateWorkflowCount(
  selections: Array<{ services: ClientServiceMap; taxReturns: ClientTaxReturnMap }>
) {
  return selections.reduce(
    (total, selection) =>
      total +
      Object.values(selection.services).filter(Boolean).length +
      Object.values(selection.taxReturns).filter(Boolean).length,
    0
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{title}</div>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label={isBusinessOwner ? "Business name" : "Client name"}
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder={isBusinessOwner ? "Acme Manufacturing LLC" : "Acme Inc"}
          />
          <Select
            label="State"
            value={form.state}
            onChange={(value) => setForm((prev) => ({ ...prev, state: value }))}
            options={US_STATES}
            placeholder="Select a state"
          />
          <Select
            label="Entity type"
            value={form.entityType}
            onChange={(value) =>
              setForm((prev) => {
                const nextTaxReturns = hasSelectedTaxReturn(prev.taxReturns)
                  ? prev.taxReturns
                  : getDefaultTaxReturnsForEntity(value);

                return {
                  ...prev,
                  entityType: value,
                  taxReturns: nextTaxReturns,
                };
              })
            }
            options={ENTITY_TYPE_OPTIONS}
            placeholder="Select an entity type"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <div className="text-sm font-semibold text-white">
          {isBusinessOwner ? "Compliance areas for your business" : "Services for this client"}
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {isBusinessOwner
            ? "Due Horizon will generate only the filing tracks you switch on here."
            : "Due Horizon will create workflows only for the services you switch on."}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(Object.keys(serviceLabels) as ServiceKey[]).map((service) => (
            <ServiceToggle
              key={service}
              title={serviceLabels[service]}
              enabled={form.services[service]}
              onToggle={() =>
                setForm((prev) => ({
                  ...prev,
                  services: {
                    ...prev.services,
                    [service]: !prev.services[service],
                  },
                }))
              }
            />
          ))}
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="text-sm font-semibold text-white">Income tax returns</div>
          <p className="mt-1 text-sm text-slate-400">
            Select the return types that apply for this client or business.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(Object.keys(taxReturnLabels) as TaxReturnKey[]).map((taxReturn) => (
              <ServiceToggle
                key={taxReturn}
                title={taxReturnLabels[taxReturn]}
                enabled={form.taxReturns[taxReturn]}
                onToggle={() =>
                  setForm((prev) => ({
                    ...prev,
                    taxReturns: {
                      ...prev.taxReturns,
                      [taxReturn]: !prev.taxReturns[taxReturn],
                    },
                  }))
                }
              />
            ))}
          </div>
        </div>
      </div>

      {form.services.sales_tax && (
        <SalesTaxFrequencySelector
          state={form.state}
          frequency={form.salesTaxFrequency}
          onChange={(frequency) =>
            setForm((prev) => ({
              ...prev,
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
          className="text-slate-400 transition hover:text-slate-200"
        >
          Back
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="h-12 cursor-pointer rounded-xl bg-blue-600 px-6 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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
          ? "Choose whether this filer is monthly, quarterly, or annual so Due Horizon creates the right NY sales tax schedule."
          : "Choose how often this filer submits sales tax so Due Horizon generates the right recurring filings."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(["monthly", "quarterly", "annual"] as FilingFrequency[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`cursor-pointer rounded-2xl border px-4 py-3 text-left text-sm transition ${
              frequency === option
                ? "border-cyan-300/40 bg-cyan-400/10 text-white"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]"
            }`}
          >
            <div className="font-semibold capitalize">{option}</div>
            <div className="mt-1 text-xs text-slate-400">
              {option === "monthly"
                ? "12 filings created"
                : option === "quarterly"
                  ? "4 filings created"
                  : "1 filing created"}
            </div>
          </button>
        ))}
      </div>
    </div>
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
      className={`cursor-pointer rounded-3xl border p-6 text-left transition ${
        active
          ? "border-blue-400 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.15)]"
          : "border-white/10 hover:bg-white/5"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <div
          className={`h-5 w-5 rounded-full border ${
            active ? "border-blue-400 bg-blue-400" : "border-white/20"
          }`}
        />
      </div>

      <p className="text-slate-400">{subtitle}</p>

      <div className="mt-5 space-y-2">
        {points.map((point) => (
          <div key={point} className="text-sm text-slate-300">
            • {point}
          </div>
        ))}
      </div>
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</label>
      <input
        type={type}
        inputMode={type === "number" ? "numeric" : undefined}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#020617] px-4 outline-none transition focus:border-blue-500"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#020617] px-4 text-white outline-none transition focus:border-blue-500"
      >
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Choice({
  title,
  subtitle,
  active,
  onClick,
  badge,
  highlight,
  hidden = false,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  highlight?: boolean;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-2xl border p-5 text-left transition ${
        active
          ? "border-blue-400 bg-blue-500/10 shadow-[0_0_0_1px_rgba(96,165,250,0.15)]"
          : "border-white/10 hover:bg-white/5"
      } ${highlight ? "ring-1 ring-blue-400/20" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        </div>

        {badge && (
          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {badge}
          </div>
        )}
      </div>
    </button>
  );
}

function ServiceToggle({
  title,
  enabled,
  onToggle,
  compact = false,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center justify-between rounded-2xl border px-4 ${
        compact ? "py-3" : "py-4"
      } transition ${
        enabled
          ? "border-blue-400 bg-blue-500/10 text-white"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5"
      }`}
    >
      <span className={compact ? "text-sm" : "text-sm font-medium"}>{title}</span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full p-1 transition ${
          enabled ? "justify-end bg-blue-500" : "justify-start bg-white/10"
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </button>
  );
}

function MiniInsight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function PreviewCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm font-semibold text-slate-300">{title}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{note}</div>
    </div>
  );
}

function LoadingRow({ label, delay = 0 }: { label: string; delay?: number }) {
  return (
    <motion.div
      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <span className="text-sm text-slate-300">{label}</span>
      <motion.span
        className="text-sm font-semibold text-blue-300"
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        In progress
      </motion.span>
    </motion.div>
  );
}