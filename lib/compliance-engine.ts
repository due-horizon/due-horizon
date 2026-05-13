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

export type PayrollEvent = {
  id: string;
  companyId?: string | null;
  companyKind?: "client" | "organization" | null;
  stateCode: string;
  payDate: string;
  withholdingAmount: number;
  quarterKey?: string | null;
  filerType?: "3_day" | "5_day" | null;
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
    .replace(/\bnys-1\b/g, "nys1")
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
    case "withholding_threshold":
      if (!profile.payrollEnabled) return false;
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

const DEFAULT_TASKS_BY_ALIAS: Record<string, string[]> = {
  "sales-tax": [
    "Review taxable sales and exemptions",
    "Reconcile sales tax payable to source reports",
    "Prepare and file sales tax return",
    "Record payment confirmation",
  ],
  "payroll-tax-filing": [
    "Review payroll registers for the period",
    "Reconcile payroll tax liabilities",
    "Prepare payroll tax filing",
    "Save filing confirmation and payment support",
  ],
  "941": [
    "Review quarterly payroll registers",
    "Reconcile Form 941 wages and taxes",
    "Prepare Form 941",
    "Save filing confirmation",
  ],
  "940": [
    "Review annual FUTA wages",
    "Reconcile FUTA liability",
    "Prepare Form 940",
    "Save filing confirmation",
  ],
  "annual-report": [
    "Verify entity information",
    "Prepare annual report filing",
    "Submit report to the state",
    "Save confirmation receipt",
  ],
  "biennial-statement": [
    "Verify entity information",
    "Prepare biennial statement",
    "Submit statement to the state",
    "Save confirmation receipt",
  ],
  "1120": [
    "Review corporate trial balance",
    "Prepare federal corporate return",
    "Review tax due or refund",
    "Save filed return and confirmation",
  ],
  "1120s": [
    "Review S corporation books",
    "Prepare Form 1120-S",
    "Prepare shareholder K-1s",
    "Save filed return and confirmations",
  ],
  "1065": [
    "Review partnership books",
    "Prepare Form 1065",
    "Prepare partner K-1s",
    "Save filed return and confirmations",
  ],
  "1040": [
    "Collect taxpayer source documents",
    "Prepare individual return",
    "Review tax due or refund",
    "Save filed return and confirmation",
  ],
  "1099": [
    "Review vendor payment report",
    "Validate W-9 information",
    "Prepare 1099 forms",
    "Save filing confirmation",
  ],
  "w2": [
    "Review year-end payroll totals",
    "Prepare W-2 forms",
    "Submit W-2 filing",
    "Save filing confirmation",
  ],
  "boi": [
    "Review reporting company status",
    "Collect beneficial owner information",
    "Prepare BOI report",
    "Save submission confirmation",
  ],
  "nys1": [
    "Review NY withholding threshold trigger",
    "Confirm payroll date and withholding amount",
    "Submit NYS-1 payment",
    "Save payment confirmation",
  ],
};

function compactKey(value?: string | null) {
  return normalizeText(value)
    .replace(/form\s*/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function templateCandidateKeys(template: WorkflowTemplate) {
  const rawTemplate = template as unknown as Record<string, unknown>;
  const possibleValues = [
    template.filing_key,
    rawTemplate.filingKey,
    rawTemplate.key,
    rawTemplate.template_key,
    rawTemplate.templateKey,
    rawTemplate.filing_name,
    rawTemplate.filingName,
    rawTemplate.name,
    rawTemplate.title,
    rawTemplate.titleSuggestion,
    rawTemplate.type,
  ];

  const keys = new Set<string>();

  for (const value of possibleValues) {
    if (typeof value !== "string" || !value.trim()) continue;
    keys.add(filingAliasKey(value));
    keys.add(compactKey(value));
  }

  return keys;
}

function getDefaultTasksForFiling(filingKey: string, filingName?: string | null) {
  const candidates = [filingAliasKey(filingKey), filingAliasKey(filingName), compactKey(filingKey), compactKey(filingName)];

  for (const candidate of candidates) {
    if (candidate && DEFAULT_TASKS_BY_ALIAS[candidate]) {
      return DEFAULT_TASKS_BY_ALIAS[candidate];
    }
  }

  const combined = `${filingKey} ${filingName || ""}`.toLowerCase();

  if (combined.includes("sales") && combined.includes("tax")) return DEFAULT_TASKS_BY_ALIAS["sales-tax"];
  if (combined.includes("941")) return DEFAULT_TASKS_BY_ALIAS["941"];
  if (combined.includes("940")) return DEFAULT_TASKS_BY_ALIAS["940"];
  if (combined.includes("1120s") || combined.includes("1120-s")) return DEFAULT_TASKS_BY_ALIAS["1120s"];
  if (combined.includes("1120")) return DEFAULT_TASKS_BY_ALIAS["1120"];
  if (combined.includes("1065")) return DEFAULT_TASKS_BY_ALIAS["1065"];
  if (combined.includes("1040")) return DEFAULT_TASKS_BY_ALIAS["1040"];
  if (combined.includes("1099")) return DEFAULT_TASKS_BY_ALIAS["1099"];
  if (combined.includes("w-2") || combined.includes("w2")) return DEFAULT_TASKS_BY_ALIAS["w2"];
  if (combined.includes("boi") || combined.includes("beneficial ownership")) return DEFAULT_TASKS_BY_ALIAS["boi"];
  if (combined.includes("nys-1") || combined.includes("nys1")) return DEFAULT_TASKS_BY_ALIAS["nys1"];
  if (combined.includes("annual report")) return DEFAULT_TASKS_BY_ALIAS["annual-report"];
  if (combined.includes("biennial")) return DEFAULT_TASKS_BY_ALIAS["biennial-statement"];
  if (combined.includes("payroll")) return DEFAULT_TASKS_BY_ALIAS["payroll-tax-filing"];

  return [];
}

function getTemplateTasks(templates: WorkflowTemplate[], filingKey: string, filingName?: string | null) {
  const ruleKeys = new Set([
    filingAliasKey(filingKey),
    filingAliasKey(filingName),
    compactKey(filingKey),
    compactKey(filingName),
  ].filter(Boolean));

  const directMatch = templates.find((template) => {
    const candidateKeys = templateCandidateKeys(template);
    return Array.from(ruleKeys).some((key) => candidateKeys.has(key));
  });

  if (directMatch?.tasks?.length) {
    return directMatch.tasks;
  }

  const fuzzyMatch = templates.find((template) => {
    const candidateKeys = Array.from(templateCandidateKeys(template));
    return Array.from(ruleKeys).some((ruleKey) =>
      candidateKeys.some((candidateKey) =>
        Boolean(ruleKey && candidateKey && (ruleKey.includes(candidateKey) || candidateKey.includes(ruleKey)))
      )
    );
  });

  if (fuzzyMatch?.tasks?.length) {
    return fuzzyMatch.tasks;
  }

  return getDefaultTasksForFiling(filingKey, filingName);
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
  if (rule.engine_type === "event") {
    return [];
  }

  if (isNySalesTaxQuarterlyRule(rule)) {
    return getNyQuarterlySalesTaxEntries();
  }

  const dueDate = getNextDueDate(rule);
  return [
    {
      dueDate,
      periodLabel: getPeriodLabel(rule.frequency || "one_time", dueDate),
    },
  ];
}

function addBusinessDays(startIso: string, businessDays: number) {
  const date = new Date(`${startIso}T00:00:00`);
  let added = 0;

  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return toISODate(date);
}

function deriveQuarterKey(payDateIso: string) {
  const date = new Date(`${payDateIso}T00:00:00`);
  return `${date.getFullYear()}-Q${quarterFromMonth(date.getMonth())}`;
}

function groupByQuarter(events: PayrollEvent[]) {
  return events.reduce<Record<string, PayrollEvent[]>>((acc, event) => {
    const key = event.quarterKey || deriveQuarterKey(event.payDate);
    acc[key] ??= [];
    acc[key].push(event);
    return acc;
  }, {});
}

function getWeekRange(payDateIso: string) {
  const date = new Date(`${payDateIso}T00:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function getEventsInSameWeek(events: PayrollEvent[], payDateIso: string) {
  const { start, end } = getWeekRange(payDateIso);

  return events.filter((event) => {
    const eventDate = new Date(`${event.payDate}T00:00:00`);
    return eventDate >= start && eventDate <= end;
  });
}

export function buildEventTriggeredFilings(args: {
  profile: ComplianceProfile;
  rules?: ComplianceRule[];
  templates?: WorkflowTemplate[];
  existingFilings?: ExistingFilingLike[];
  payrollEvents?: PayrollEvent[];
}): SuggestedFiling[] {
  const {
    profile,
    rules = defaultComplianceRules,
    templates = defaultWorkflowTemplates,
    existingFilings = [],
    payrollEvents = [],
  } = args;

  const eventRules = rules.filter(
    (rule) => rule.engine_type === "event" && ruleApplies(profile, rule),
  );

  const filings: SuggestedFiling[] = [];

  for (const rule of eventRules) {
    if (rule.filing_key !== "nys_1") continue;

    const nyEvents = payrollEvents
      .filter((event) => normalizeStateCode(event.stateCode) === "NY")
      .sort((a, b) => a.payDate.localeCompare(b.payDate));

    const byQuarter = groupByQuarter(nyEvents);

    for (const [quarterKey, quarterEvents] of Object.entries(byQuarter)) {
      let runningWithholding = 0;

      for (let index = 0; index < quarterEvents.length; index += 1) {
        const currentEvent = quarterEvents[index];
        runningWithholding += coerceNumber(currentEvent.withholdingAmount, 0);

        const thresholdAmount = coerceNumber(
          rule.event_trigger_config?.threshold_amount,
          700,
        );

        if (runningWithholding < thresholdAmount) {
          continue;
        }

        const weekEvents = getEventsInSameWeek(quarterEvents, currentEvent.payDate).sort((a, b) =>
          a.payDate.localeCompare(b.payDate),
        );

        const lastPayrollInWeek = weekEvents[weekEvents.length - 1] || currentEvent;
        const filerType = lastPayrollInWeek.filerType || "5_day";
        const businessDayOffset =
          filerType === "3_day"
            ? 3
            : coerceNumber(rule.event_trigger_config?.default_business_day_offset, 5);

        const dueDate = addBusinessDays(lastPayrollInWeek.payDate, businessDayOffset);

        filings.push({
          filingKey: `nys_1_${quarterKey}_${dueDate}`,
          filingName: rule.filing_name,
          jurisdictionCode: normalizeStateCode(rule.jurisdiction_code),
          frequency: "one_time",
          dueDate,
          periodLabel: quarterKey,
          tasks: getTemplateTasks(templates, rule.filing_key, rule.filing_name),
          priority: rule.priority ?? 100,
          category: rule.category,
        });

        break;
      }
    }
  }

  const deduped = uniqueFilings(filings);
  const withoutExisting = excludeExistingConfiguredFilings(deduped, existingFilings);

  return withoutExisting.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.filingName.localeCompare(b.filingName);
  });
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
    .filter((rule) => rule.engine_type !== "event")
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
        frequency: rule.frequency || "one_time",
        dueDate: entry.dueDate,
        periodLabel: entry.periodLabel,
        tasks: getTemplateTasks(templates, rule.filing_key, rule.filing_name),
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

export function buildAllSuggestedFilings(args: {
  profile: ComplianceProfile;
  rules?: ComplianceRule[];
  templates?: WorkflowTemplate[];
  existingFilings?: ExistingFilingLike[];
  payrollEvents?: PayrollEvent[];
}): SuggestedFiling[] {
  const scheduled = buildSuggestedFilings(args);
  const eventTriggered = buildEventTriggeredFilings(args);

  const combined = uniqueFilings([...scheduled, ...eventTriggered]);
  return combined.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.filingName.localeCompare(b.filingName);
  });
}
