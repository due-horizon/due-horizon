export type FilingFrequency = "monthly" | "quarterly" | "annual" | "one_time";

export type EntityType =
  | "Individual"
  | "Single-Member LLC"
  | "LLC"
  | "S Corp"
  | "C Corp"
  | "Partnership"
  | "Nonprofit"
  | "Trust"
  | string;

export type ComplianceProfile = {
  stateCode: string;
  entityType?: EntityType | null;
  payrollEnabled: boolean;
  salesTaxEnabled: boolean;
  salesTaxFrequency?: Exclude<FilingFrequency, "one_time"> | null;
  incomeTaxEnabled: boolean;
  annualReportEnabled: boolean;
  boiEnabled: boolean;
  w21099Enabled: boolean;
  tax1040Enabled?: boolean;
  tax1120Enabled?: boolean;
  tax1120SEnabled?: boolean;
  tax1065Enabled?: boolean;
};

export type DueRuleType = "fixed_day" | "nth_day_after_period" | "annual_fixed_date";

export type DueRuleConfig = {
  month?: number;
  day?: number;
  days_after_period_end?: number;
};

export type ComplianceRule = {
  id: string;
  filing_key: string;
  filing_name: string;
  jurisdiction_level: "federal" | "state" | "local";
  jurisdiction_code: string;
  entity_type: string | null;
  trigger_type:
    | "payroll"
    | "sales_tax"
    | "income_tax"
    | "annual_report"
    | "boi"
    | "w2_1099"
    | "tax_1040"
    | "tax_1120"
    | "tax_1120s"
    | "tax_1065";
  frequency: FilingFrequency;
  due_rule_type: DueRuleType;
  due_rule_config: DueRuleConfig;
  active?: boolean;
  priority?: number;
  category?: "tax" | "payroll" | "compliance";
};

export type WorkflowTemplate = {
  id: string;
  filing_key: string;
  template_name: string;
  tasks: string[];
};

type RuleSeedArgs = {
  id: string;
  filingKey: string;
  filingName: string;
  jurisdictionLevel: ComplianceRule["jurisdiction_level"];
  jurisdictionCode: string;
  triggerType: ComplianceRule["trigger_type"];
  frequency: FilingFrequency;
  dueRuleType: DueRuleType;
  dueRuleConfig: DueRuleConfig;
  entityType?: string | null;
  priority?: number;
  category?: ComplianceRule["category"];
};

function makeRule(args: RuleSeedArgs): ComplianceRule {
  return {
    id: args.id,
    filing_key: args.filingKey,
    filing_name: args.filingName,
    jurisdiction_level: args.jurisdictionLevel,
    jurisdiction_code: args.jurisdictionCode,
    entity_type: args.entityType ?? null,
    trigger_type: args.triggerType,
    frequency: args.frequency,
    due_rule_type: args.dueRuleType,
    due_rule_config: args.dueRuleConfig,
    active: true,
    priority: args.priority ?? 100,
    category: args.category ?? "compliance",
  };
}

export const complianceRules: ComplianceRule[] = [
  makeRule({
    id: "fed-1040",
    filingKey: "federal_1040",
    filingName: "Federal 1040",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "tax_1040",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 4, day: 15 },
    priority: 10,
    category: "tax",
  }),
  makeRule({
    id: "fed-1120",
    filingKey: "federal_1120",
    filingName: "Federal 1120",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "tax_1120",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 4, day: 15 },
    priority: 10,
    category: "tax",
  }),
  makeRule({
    id: "fed-1120s",
    filingKey: "federal_1120s",
    filingName: "Federal 1120S",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "tax_1120s",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 3, day: 15 },
    priority: 10,
    category: "tax",
  }),
  makeRule({
    id: "fed-1065",
    filingKey: "federal_1065",
    filingName: "Federal 1065",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "tax_1065",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 3, day: 15 },
    priority: 10,
    category: "tax",
  }),
  makeRule({
    id: "fed-payroll-quarterly",
    filingKey: "payroll_returns",
    filingName: "Payroll Returns",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "payroll",
    frequency: "quarterly",
    dueRuleType: "nth_day_after_period",
    dueRuleConfig: { days_after_period_end: 30 },
    priority: 20,
    category: "payroll",
  }),
  makeRule({
    id: "fed-w2-1099",
    filingKey: "federal_w2_1099",
    filingName: "W-2 / 1099 Filing",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "w2_1099",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 1, day: 31 },
    priority: 15,
    category: "tax",
  }),
  makeRule({
    id: "fed-boi",
    filingKey: "boi_report",
    filingName: "BOI Report",
    jurisdictionLevel: "federal",
    jurisdictionCode: "FED",
    triggerType: "boi",
    frequency: "one_time",
    dueRuleType: "nth_day_after_period",
    dueRuleConfig: { days_after_period_end: 30 },
    priority: 5,
    category: "compliance",
  }),
  makeRule({
    id: "ny-sales-tax-monthly",
    filingKey: "ny_sales_tax",
    filingName: "New York Sales & Use Tax Return",
    jurisdictionLevel: "state",
    jurisdictionCode: "NY",
    triggerType: "sales_tax",
    frequency: "monthly",
    dueRuleType: "fixed_day",
    dueRuleConfig: { day: 20 },
    priority: 25,
    category: "tax",
  }),
  makeRule({
    id: "ny-sales-tax-quarterly",
    filingKey: "ny_sales_tax",
    filingName: "New York Sales & Use Tax Return",
    jurisdictionLevel: "state",
    jurisdictionCode: "NY",
    triggerType: "sales_tax",
    frequency: "quarterly",
    dueRuleType: "fixed_day",
    dueRuleConfig: { month: 3, day: 20 },
    priority: 25,
    category: "tax",
  }),
  makeRule({
    id: "ny-sales-tax-annual",
    filingKey: "ny_sales_tax",
    filingName: "New York Sales & Use Tax Return",
    jurisdictionLevel: "state",
    jurisdictionCode: "NY",
    triggerType: "sales_tax",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 3, day: 20 },
    priority: 25,
    category: "tax",
  }),
  makeRule({
    id: "ny-annual-report",
    filingKey: "ny_annual_report",
    filingName: "NY Annual Report",
    jurisdictionLevel: "state",
    jurisdictionCode: "NY",
    triggerType: "annual_report",
    frequency: "annual",
    dueRuleType: "annual_fixed_date",
    dueRuleConfig: { month: 12, day: 31 },
    priority: 30,
    category: "compliance",
  }),
];

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "tpl-federal-income-tax",
    filing_key: "federal_1040",
    template_name: "Federal 1040 Workflow",
    tasks: ["Prepare Federal 1040", "Review Federal 1040", "File Federal 1040", "Confirm Federal 1040"],
  },
  {
    id: "tpl-federal-1120",
    filing_key: "federal_1120",
    template_name: "Federal 1120 Workflow",
    tasks: ["Prepare Federal 1120", "Review Federal 1120", "File Federal 1120", "Confirm Federal 1120"],
  },
  {
    id: "tpl-federal-1120s",
    filing_key: "federal_1120s",
    template_name: "Federal 1120S Workflow",
    tasks: ["Prepare Federal 1120S", "Review Federal 1120S", "File Federal 1120S", "Confirm Federal 1120S"],
  },
  {
    id: "tpl-federal-1065",
    filing_key: "federal_1065",
    template_name: "Federal 1065 Workflow",
    tasks: ["Prepare Federal 1065", "Review Federal 1065", "File Federal 1065", "Confirm Federal 1065"],
  },
  {
    id: "tpl-payroll",
    filing_key: "payroll_returns",
    template_name: "Payroll Workflow",
    tasks: ["Collect payroll data", "Prepare payroll return", "Review payroll return", "File payroll return"],
  },
  {
    id: "tpl-sales-tax",
    filing_key: "ny_sales_tax",
    template_name: "New York Sales & Use Tax Workflow",
    tasks: ["Collect sales records", "Prepare sales tax return", "Review sales tax return", "File sales tax return"],
  },
  {
    id: "tpl-annual-report",
    filing_key: "ny_annual_report",
    template_name: "Annual Report Workflow",
    tasks: ["Prepare annual report", "Review annual report", "File annual report", "Confirm annual report"],
  },
  {
    id: "tpl-w2-1099",
    filing_key: "federal_w2_1099",
    template_name: "W-2 / 1099 Workflow",
    tasks: ["Collect wage/vendor data", "Prepare W-2 / 1099 filing", "Review W-2 / 1099 filing", "Submit W-2 / 1099 filing"],
  },
  {
    id: "tpl-boi",
    filing_key: "boi_report",
    template_name: "BOI Workflow",
    tasks: ["Collect beneficial ownership details", "Prepare BOI report", "Review BOI report", "Submit BOI report"],
  },
];
