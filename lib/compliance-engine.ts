import {
  complianceRules as defaultComplianceRules,
  workflowTemplates as defaultWorkflowTemplates,
} from "./compliance-rules";

import type {
  ComplianceProfile,
  ComplianceRule,
  DueRuleConfig,
  FilingFrequency,
  WorkflowTemplate,
} from "./compliance-rules";

export type SuggestedFiling = {
  filingKey: string;
  filingName: string;
  jurisdictionCode: string;
  frequency: FilingFrequency;
  dueDate: string;
  periodLabel: string;
  tasks: string[];
  priority: number;
  category?: "tax" | "payroll" | "compliance";
};

export type ExistingFilingLike = {
  filingKey?: string | null;
  filingName?: string | null;
  jurisdictionCode?: string | null;
  stateCode?: string | null;
  dueDate?: string | null;
  periodLabel?: string | null;
  status?: string | null;
  isConfigured?: boolean | null;
  source?: string | null;
};

type DueEntry = {
  dueDate: string;
  periodLabel: string;
};

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeStateCode(value?: string | null) {
  return (value || "").trim().toUpperCase();
}

function normalizeDueDate(value?: string | null) {
  const normalized = (value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function coerceNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function quarterFromMonth(monthIndexZeroBased: number) {
  return Math.floor(monthIndexZeroBased / 3) + 1;
}

function buildAnnualFixedDate(month: number, day: number) {
  const today = startOfToday();
  const currentYear = today.getFullYear();

  let dueDate = new Date(currentYear, month - 1, day);
  if (dueDate < today) {
    dueDate = new Date(currentYear + 1, month - 1, day);
  }

  return dueDate;
}

function buildMonthlyFixedDate(day: number) {
  const today = startOfToday();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let dueDate = new Date(currentYear, currentMonth, day);
  if (dueDate < today) {
    dueDate = new Date(currentYear, currentMonth + 1, day);
  }

  return dueDate;
}

function buildMonthlyOffsetDate(daysAfterPeriodEnd: number) {
  const today = startOfToday();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const currentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
  const dueDate = new Date(currentMonthEnd);
  dueDate.setDate(dueDate.getDate() + daysAfterPeriodEnd);

  if (dueDate >= today) {
    return dueDate;
  }

  const nextMonthEnd = new Date(currentYear, currentMonth + 2, 0);
  nextMonthEnd.setDate(nextMonthEnd.getDate() + daysAfterPeriodEnd);
  return nextMonthEnd;
}

function buildQuarterlyOffsetDate(daysAfterPeriodEnd: number) {
  const today = startOfToday();
  const currentYear = today.getFullYear();

  const quarterEnds = [
    new Date(currentYear, 2, 31),
    new Date(currentYear, 5, 30),
    new Date(currentYear, 8, 30),
    new Date(currentYear, 11, 31),
  ];

  for (const quarterEnd of quarterEnds) {
    const dueDate = new Date(quarterEnd);
    dueDate.setDate(dueDate.getDate() + daysAfterPeriodEnd);

    if (dueDate >= today) {
      return dueDate;
    }
  }

  const nextYearQ1 = new Date(currentYear + 1, 2, 31);
  nextYearQ1.setDate(nextYearQ1.getDate() + daysAfterPeriodEnd);
  return nextYearQ1;
}

function buildOneTimeOffsetDate(daysAfterPeriodEnd: number) {
  const today = startOfToday();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + daysAfterPeriodEnd);
  return dueDate;
}

function isActiveExistingFiling(filing: ExistingFilingLike) {
  const status = normalizeText(filing.status);
  return !["filed", "completed", "archived", "cancelled", "canceled", "deleted"].includes(status);
}

function filingAliasKey(value?: string | null) {
  return normalizeText(value)
    .replace(/form\s*/g, "")
    .replace(/\bfederal\b/g, "")
    .replace(/\bnew york\b/g, "ny")
    .replace(/\bnys\b/g, "ny")
    .replace(/\bsales\s*&\s*use\s*tax\s*return\b/g, "sales-tax")
    .replace(/\bsales tax filing\b/g, "sales-tax")
    .replace(/\bny sales tax\b/g, "sales-tax")
    .replace(/\bannual report\b/g, "annual-report")
    .replace(/\bbiennial statement\b/g, "biennial-statement")
    .replace(/\bcorporate tax return\b/g, "1120")
    .replace(/\bs corp return\b/g, "1120s")
    .replace(/\bpartnership return\b/g, "1065")
    .replace(/\bpersonal tax return\b/g, "1040")
    .replace(/\bw-2 filing\b/g, "w2")
    .replace(/\b1099 filing\b/g, "1099")
    .replace(/\bboi filing\b/g, "boi")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dedupeKeyFromSuggested(filing: SuggestedFiling) {
  return [
    filingAliasKey(filing.filingKey || filing.filingName),
    normalizeStateCode(filing.jurisdictionCode),
    normalizeText(filing.periodLabel),
  ].join("|");
}

function dedupeKeyFromExisting(filing: ExistingFilingLike) {
  return [
    filingAliasKey(filing.filingKey || filing.filingName),
    normalizeStateCode(filing.jurisdictionCode || filing.stateCode),
    normalizeText(filing.periodLabel),
  ].join("|");
}

function exactDueDateKeyFromSuggested(filing: SuggestedFiling) {
  return [
    filingAliasKey(filing.filingKey || filing.filingName),
    normalizeStateCode(filing.jurisdictionCode),
    normalizeDueDate(filing.dueDate),
  ].join("|");
}

function exactDueDateKeyFromExisting(filing: ExistingFilingLike) {
  return [
    filingAliasKey(filing.filingKey || filing.filingName),
    normalizeStateCode(filing.jurisdictionCode || filing.stateCode),
    normalizeDueDate(filing.dueDate),
  ].join("|");
}

export function ruleApplies(profile: ComplianceProfile, rule: ComplianceRule) {
  if (rule.active === false) return false;

  const profileState = normalizeStateCode(profile.stateCode);
  const ruleJurisdictionCode = normalizeStateCode(rule.jurisdiction_code);

  if (rule.jurisdiction_level === "state" && ruleJurisdictionCode !== profileState) {
    return false;
  }

  switch (rule.trigger_type) {
    case "payroll":
      if (!profile.payrollEnabled) return false;
      break;
    case "sales_tax":
      if (!profile.salesTaxEnabled) return false;
      if (profile.salesTaxFrequency && rule.frequency !== profile.salesTaxFrequency) return false;
      break;
    case "income_tax":
      if (!profile.incomeTaxEnabled) return false;
      break;
    case "annual_report":
      if (!profile.annualReportEnabled) return false;
      break;
    case "boi":
      if (!profile.boiEnabled) return false;
      break;
    case "w2_1099":
      if (!profile.w21099Enabled) return false;
      break;
    case "tax_1040":
      if (!profile.tax1040Enabled) return false;
      break;
    case "tax_1120":
      if (!profile.tax1120Enabled) return false;
      break;
    case "tax_1120s":
      if (!profile.tax1120SEnabled) return false;
      break;
    case "tax_1065":
      if (!profile.tax1065Enabled) return false;
      break;
    default:
      return false;
  }

  if (
    rule.entity_type &&
    profile.entityType &&
    normalizeText(rule.entity_type) !== normalizeText(profile.entityType)
  ) {
    return false;
  }

  return true;
}

export function getNextDueDate(rule: ComplianceRule): string {
  const config: DueRuleConfig = rule.due_rule_config || {};

  if (rule.due_rule_type === "annual_fixed_date") {
    return toISODate(buildAnnualFixedDate(coerceNumber(config.month, 12), coerceNumber(config.day, 31)));
  }

  if (rule.due_rule_type === "fixed_day") {
    const day = coerceNumber(config.day, 20);

    if (rule.frequency === "monthly") {
      return toISODate(buildMonthlyFixedDate(day));
    }

    if (rule.frequency === "annual" || rule.frequency === "quarterly") {
      return toISODate(buildAnnualFixedDate(coerceNumber(config.month, 12), day));
    }
  }

  if (rule.due_rule_type === "nth_day_after_period") {
    const offset = coerceNumber(config.days_after_period_end, 0);

    if (rule.frequency === "monthly") {
      return toISODate(buildMonthlyOffsetDate(offset));
    }

    if (rule.frequency === "quarterly") {
      return toISODate(buildQuarterlyOffsetDate(offset));
    }

    if (rule.frequency === "one_time") {
      return toISODate(buildOneTimeOffsetDate(offset));
    }
  }

  return toISODate(buildAnnualFixedDate(12, 31));
}

export function getPeriodLabel(frequency: FilingFrequency, dueDate: string) {
  const date = new Date(`${dueDate}T00:00:00`);

  if (frequency === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  if (frequency === "quarterly") {
    return `Q${quarterFromMonth(date.getMonth())} ${date.getFullYear()}`;
  }

  if (frequency === "annual") {
    return `${date.getFullYear()}`;
  }

  return dueDate;
}

function getTemplateTasks(templates: WorkflowTemplate[], filingKey: string) {
  const template = templates.find((item) => item.filing_key === filingKey);
  return template?.tasks ?? [];
}

function uniqueFilings(filings: SuggestedFiling[]) {
  const map = new Map<string, SuggestedFiling>();

  for (const filing of filings) {
    const key = [
      filingAliasKey(filing.filingName || filing.filingKey),
      normalizeStateCode(filing.jurisdictionCode),
      normalizeDueDate(filing.dueDate),
      normalizeText(filing.periodLabel),
    ].join("|");

    if (!map.has(key)) {
      map.set(key, filing);
      continue;
    }

    const existing = map.get(key)!;
    const existingTaskCount = existing.tasks.length;
    const nextTaskCount = filing.tasks.length;

    if (nextTaskCount > existingTaskCount) {
      map.set(key, filing);
      continue;
    }

    if (nextTaskCount === existingTaskCount && filing.priority < existing.priority) {
      map.set(key, filing);
    }
  }

  return Array.from(map.values());
}

function excludeExistingConfiguredFilings(
  filings: SuggestedFiling[],
  existingFilings: ExistingFilingLike[],
) {
  if (!existingFilings.length) return filings;

  const configuredPeriodKeys = new Set<string>();
  const configuredDueDateKeys = new Set<string>();

  for (const filing of existingFilings) {
    if (!isActiveExistingFiling(filing)) continue;

    const periodKey = dedupeKeyFromExisting(filing);
    const dueKey = exactDueDateKeyFromExisting(filing);

    if (periodKey !== "||") configuredPeriodKeys.add(periodKey);
    if (dueKey !== "||") configuredDueDateKeys.add(dueKey);
  }

  return filings.filter((filing) => {
    const suggestedPeriodKey = dedupeKeyFromSuggested(filing);
    const suggestedDueKey = exactDueDateKeyFromSuggested(filing);

    if (configuredDueDateKeys.has(suggestedDueKey)) return false;
    if (configuredPeriodKeys.has(suggestedPeriodKey)) return false;

    return true;
  });
}

function isNySalesTaxQuarterlyRule(rule: ComplianceRule) {
  return (
    normalizeStateCode(rule.jurisdiction_code) === "NY" &&
    rule.trigger_type === "sales_tax" &&
    rule.frequency === "quarterly"
  );
}

function getNyQuarterlySalesTaxEntries(): DueEntry[] {
  const today = startOfToday();
  const currentYear = today.getFullYear();

  const schedule = [
    { quarter: "Q4", year: currentYear, dueDate: new Date(currentYear, 2, 20) },
    { quarter: "Q1", year: currentYear, dueDate: new Date(currentYear, 5, 20) },
    { quarter: "Q2", year: currentYear, dueDate: new Date(currentYear, 8, 20) },
    { quarter: "Q3", year: currentYear, dueDate: new Date(currentYear, 11, 20) },
    { quarter: "Q4", year: currentYear + 1, dueDate: new Date(currentYear + 1, 2, 20) },
    { quarter: "Q1", year: currentYear + 1, dueDate: new Date(currentYear + 1, 5, 20) },
    { quarter: "Q2", year: currentYear + 1, dueDate: new Date(currentYear + 1, 8, 20) },
    { quarter: "Q3", year: currentYear + 1, dueDate: new Date(currentYear + 1, 11, 20) },
  ];

  return schedule
    .filter((entry) => entry.dueDate >= today)
    .slice(0, 4)
    .map((entry) => ({
      dueDate: toISODate(entry.dueDate),
      periodLabel: `${entry.quarter} ${entry.year}`,
    }));
}

function getDueEntries(rule: ComplianceRule): DueEntry[] {
  if (isNySalesTaxQuarterlyRule(rule)) {
    return getNyQuarterlySalesTaxEntries();
  }

  const dueDate = getNextDueDate(rule);
  return [
    {
      dueDate,
      periodLabel: getPeriodLabel(rule.frequency, dueDate),
    },
  ];
}

export function buildSuggestedFilings(args: {
  profile: ComplianceProfile;
  rules?: ComplianceRule[];
  templates?: WorkflowTemplate[];
  existingFilings?: ExistingFilingLike[];
}): SuggestedFiling[] {
  const {
    profile,
    rules = defaultComplianceRules,
    templates = defaultWorkflowTemplates,
    existingFilings = [],
  } = args;

  const filings = rules
    .filter((rule) => ruleApplies(profile, rule))
    .flatMap((rule) => {
      const dueEntries = getDueEntries(rule);

      return dueEntries.map((entry, index) => ({
        filingKey:
          dueEntries.length > 1
            ? `${rule.filing_key}_${entry.periodLabel.replace(/\s+/g, "_")}`
            : rule.filing_key,
        filingName: rule.filing_name,
        jurisdictionCode: normalizeStateCode(rule.jurisdiction_code),
        frequency: rule.frequency,
        dueDate: entry.dueDate,
        periodLabel: entry.periodLabel,
        tasks: getTemplateTasks(templates, rule.filing_key),
        priority: (rule.priority ?? 100) + index,
        category: rule.category,
      } satisfies SuggestedFiling));
    });

  const deduped = uniqueFilings(filings);
  const withoutExisting = excludeExistingConfiguredFilings(deduped, existingFilings);

  return withoutExisting.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.filingName.localeCompare(b.filingName);
  });
}
