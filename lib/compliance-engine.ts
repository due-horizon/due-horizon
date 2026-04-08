export type FilingFrequency = "monthly" | "quarterly" | "annual" | "one_time";

export type ComplianceProfile = {
  stateCode: string;
  entityType?: string | null;
  payrollEnabled: boolean;
  salesTaxEnabled: boolean;
  salesTaxFrequency?: "monthly" | "quarterly" | "annual" | null;
  incomeTaxEnabled: boolean;
  annualReportEnabled: boolean;
  boiEnabled: boolean;
  w21099Enabled: boolean;
};

export type ComplianceRule = {
  id: string;
  filing_key: string;
  filing_name: string;
  jurisdiction_level: "federal" | "state" | "local";
  jurisdiction_code: string;
  entity_type: string | null;
  trigger_type: string;
  frequency: FilingFrequency;
  due_rule_type: "fixed_day" | "nth_day_after_period" | "annual_fixed_date";
  due_rule_config: Record<string, any>;
  active?: boolean;
};

export type WorkflowTemplate = {
  id: string;
  filing_key: string;
  template_name: string;
  tasks: string[];
};

export type SuggestedFiling = {
  filingKey: string;
  filingName: string;
  jurisdictionCode: string;
  frequency: FilingFrequency;
  dueDate: string;
  tasks: string[];
};

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeText(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function ruleApplies(profile: ComplianceProfile, rule: ComplianceRule) {
  if (rule.active === false) return false;

  const profileState = profile.stateCode.trim().toUpperCase();
  const ruleJurisdictionCode = rule.jurisdiction_code.trim().toUpperCase();

  if (rule.jurisdiction_level === "state" && ruleJurisdictionCode !== profileState) {
    return false;
  }

  if (rule.trigger_type === "payroll" && !profile.payrollEnabled) return false;
  if (rule.trigger_type === "sales_tax" && !profile.salesTaxEnabled) return false;
  if (rule.trigger_type === "income_tax" && !profile.incomeTaxEnabled) return false;
  if (rule.trigger_type === "annual_report" && !profile.annualReportEnabled) return false;
  if (rule.trigger_type === "boi" && !profile.boiEnabled) return false;
  if (rule.trigger_type === "w2_1099" && !profile.w21099Enabled) return false;

  if (
    rule.trigger_type === "sales_tax" &&
    profile.salesTaxFrequency &&
    rule.frequency !== profile.salesTaxFrequency
  ) {
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

function nextAnnualFixedDate(month: number, day: number) {
  const today = new Date();
  const date = new Date(today.getFullYear(), month - 1, day);
  if (date < today) {
    date.setFullYear(date.getFullYear() + 1);
  }
  return toISODate(date);
}

function nextFixedDayMonthly(day: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  let due = new Date(year, month, day);
  if (due < today) {
    due = new Date(year, month + 1, day);
  }

  return toISODate(due);
}

function nextNthDayAfterMonthlyPeriod(daysAfterPeriodEnd: number) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const currentMonthEnd = new Date(year, month + 1, 0);
  const due = new Date(currentMonthEnd);
  due.setDate(due.getDate() + daysAfterPeriodEnd);

  if (due >= today) return toISODate(due);

  const nextMonthEnd = new Date(year, month + 2, 0);
  nextMonthEnd.setDate(nextMonthEnd.getDate() + daysAfterPeriodEnd);
  return toISODate(nextMonthEnd);
}

function nextNthDayAfterQuarterlyPeriod(daysAfterPeriodEnd: number) {
  const today = new Date();
  const year = today.getFullYear();

  const quarterEnds = [
    new Date(year, 2, 31),
    new Date(year, 5, 30),
    new Date(year, 8, 30),
    new Date(year, 11, 31),
  ];

  for (const quarterEnd of quarterEnds) {
    const due = new Date(quarterEnd);
    due.setDate(due.getDate() + daysAfterPeriodEnd);
    if (due >= today) return toISODate(due);
  }

  const nextYearQ1 = new Date(year + 1, 2, 31);
  nextYearQ1.setDate(nextYearQ1.getDate() + daysAfterPeriodEnd);
  return toISODate(nextYearQ1);
}

export function getNextDueDate(rule: ComplianceRule) {
  if (rule.due_rule_type === "annual_fixed_date") {
    return nextAnnualFixedDate(
      Number(rule.due_rule_config.month),
      Number(rule.due_rule_config.day)
    );
  }

  if (rule.due_rule_type === "fixed_day") {
    const day = Number(rule.due_rule_config.day);
    if (rule.frequency === "monthly") {
      return nextFixedDayMonthly(day);
    }

    if (rule.frequency === "annual") {
      const month = Number(rule.due_rule_config.month || 12);
      return nextAnnualFixedDate(month, day);
    }
  }

  if (rule.due_rule_type === "nth_day_after_period") {
    const offset = Number(rule.due_rule_config.days_after_period_end || 0);

    if (rule.frequency === "monthly") {
      return nextNthDayAfterMonthlyPeriod(offset);
    }

    if (rule.frequency === "quarterly") {
      return nextNthDayAfterQuarterlyPeriod(offset);
    }
  }

  return nextAnnualFixedDate(12, 31);
}

export function buildSuggestedFilings(args: {
  profile: ComplianceProfile;
  rules: ComplianceRule[];
  templates: WorkflowTemplate[];
}) {
  const { profile, rules, templates } = args;

  return rules
    .filter((rule) => ruleApplies(profile, rule))
    .map((rule) => {
      const template = templates.find((t) => t.filing_key === rule.filing_key);

      return {
        filingKey: rule.filing_key,
        filingName: rule.filing_name,
        jurisdictionCode: rule.jurisdiction_code,
        frequency: rule.frequency,
        dueDate: getNextDueDate(rule),
        tasks: template?.tasks || [],
      };
    });
}