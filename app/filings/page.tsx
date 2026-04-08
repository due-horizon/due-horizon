"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddFilingModal from "./AddFilingModal";
import {
  buildSuggestedFilings,
  type ComplianceProfile,
  type ComplianceRule,
  type WorkflowTemplate,
  type SuggestedFiling,
} from "@/lib/compliance-engine";

type FilingStatus = "OVERDUE" | "DUE SOON" | "READY TO FILE" | "UPCOMING" | "FILED";
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

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

type Filing = {
  id: string;
  title: string;
  company: string;
  companyId: string;
  state: string;
  dueDate: string;
  status: FilingStatus;
  type: string;
  templateKey?: FilingTemplateKey;
  assignee?: string;
  tasks: Task[];
  clientId?: string | null;
  organizationId?: string | null;
};

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

type DbTask = {
  id: string;
  filing_id: string | null;
  title: string;
  status: "todo" | "in_progress" | "done";
  assignee_user_id: string | null;
};

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
};

const assignees = ["Unassigned", "Rob", "Staff 1", "Staff 2"];

const filingTemplates: Record<
  FilingTemplateKey,
  {
    titleSuggestion: string;
    type: string;
    tasks: string[];
  }
> = {
  "Sales Tax Filing": {
    titleSuggestion: "Sales Tax Filing",
    type: "Sales Tax Filing",
    tasks: [
      "Pull sales report",
      "Reconcile taxable sales",
      "Review exempt sales",
      "Prepare sales tax filing",
      "Submit return and payment",
      "Save confirmation",
    ],
  },
  "Payroll Tax Filing": {
    titleSuggestion: "Payroll Tax Filing",
    type: "Payroll Tax Filing",
    tasks: [
      "Pull payroll register",
      "Reconcile wages and withholding",
      "Review tax liabilities",
      "Prepare payroll tax filing",
      "Submit payment",
      "Save confirmation",
    ],
  },
  "Form 941": {
    titleSuggestion: "Quarterly Form 941",
    type: "Form 941",
    tasks: [
      "Pull quarterly payroll summary",
      "Reconcile federal withholding",
      "Prepare Form 941",
      "Review tax deposits",
      "File Form 941",
      "Save acceptance",
    ],
  },
  "Form 940": {
    titleSuggestion: "Annual Form 940",
    type: "Form 940",
    tasks: [
      "Pull annual payroll totals",
      "Reconcile FUTA wages",
      "Prepare Form 940",
      "Review payments made",
      "File Form 940",
      "Save acceptance",
    ],
  },
  "Annual Report": {
    titleSuggestion: "Annual Report",
    type: "Annual Report",
    tasks: [
      "Collect company information",
      "Verify registered agent details",
      "Prepare filing",
      "Submit filing",
      "Confirm acceptance",
    ],
  },
  "Biennial Statement": {
    titleSuggestion: "Biennial Statement",
    type: "Biennial Statement",
    tasks: [
      "Verify entity details",
      "Review state requirements",
      "Prepare statement",
      "Submit statement",
      "Confirm acceptance",
    ],
  },
  "Franchise Tax": {
    titleSuggestion: "Franchise Tax Filing",
    type: "Franchise Tax",
    tasks: [
      "Gather financial information",
      "Calculate tax due",
      "Prepare return",
      "Review filing",
      "Submit payment",
      "Save receipt",
    ],
  },
  "Business License Renewal": {
    titleSuggestion: "Business License Renewal",
    type: "Business License Renewal",
    tasks: [
      "Review renewal notice",
      "Verify business details",
      "Prepare renewal package",
      "Submit renewal",
      "Confirm approval",
    ],
  },
  "Estimated Tax Payment": {
    titleSuggestion: "Estimated Tax Payment",
    type: "Estimated Tax Payment",
    tasks: [
      "Calculate estimate",
      "Review prior payments",
      "Prepare payment voucher",
      "Submit payment",
      "Save proof of payment",
    ],
  },
  "Personal Tax Return": {
    titleSuggestion: "Personal Tax Return",
    type: "Personal Tax Return",
    tasks: [
      "Request tax documents",
      "Organize income documents",
      "Prepare return",
      "Review with client",
      "File return",
      "Save acceptance",
    ],
  },
  "Corporate Tax Return": {
    titleSuggestion: "Corporate Tax Return",
    type: "Corporate Tax Return",
    tasks: [
      "Request year-end financials",
      "Reconcile tax workpapers",
      "Prepare return",
      "Review return",
      "File return",
      "Save acceptance",
    ],
  },
  "Partnership Return": {
    titleSuggestion: "Partnership Return",
    type: "Partnership Return",
    tasks: [
      "Request year-end financials",
      "Prepare partnership return",
      "Review partner allocations",
      "Finalize K-1s",
      "File return",
      "Save acceptance",
    ],
  },
  "S Corp Return": {
    titleSuggestion: "S Corp Return",
    type: "S Corp Return",
    tasks: [
      "Request year-end financials",
      "Prepare S Corp return",
      "Review shareholder allocations",
      "Finalize K-1s",
      "File return",
      "Save acceptance",
    ],
  },
  "BOI Filing": {
    titleSuggestion: "BOI Filing",
    type: "BOI Filing",
    tasks: [
      "Request beneficial owner details",
      "Verify reporting company info",
      "Prepare BOI filing",
      "Submit BOI filing",
      "Save confirmation",
    ],
  },
  "1099 Filing": {
    titleSuggestion: "1099 Filing",
    type: "1099 Filing",
    tasks: [
      "Request vendor totals",
      "Review W-9 information",
      "Prepare 1099s",
      "Deliver recipient copies",
      "File 1099s",
      "Save acceptance",
    ],
  },
  "W-2 Filing": {
    titleSuggestion: "W-2 Filing",
    type: "W-2 Filing",
    tasks: [
      "Reconcile payroll totals",
      "Review employee data",
      "Prepare W-2s",
      "Distribute employee copies",
      "File with SSA/state",
      "Save acceptance",
    ],
  },
};

const emptyForm: NewFilingForm = {
  title: "",
  company: "",
  state: "",
  dueDate: "",
  type: "",
  templateKey: "",
  assignee: "Unassigned",
};

function dbToDisplayStatus(dbStatus: string, dueDate: string): FilingStatus {
  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.round(
    (new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (dbStatus === "filed") return "FILED";
  if (dbStatus === "in_progress") return "READY TO FILE";
  if (dbStatus === "overdue") return "OVERDUE";
  if (diffDays < 0) return "OVERDUE";
  if (diffDays <= 7) return "DUE SOON";
  return "UPCOMING";
}

function displayToDbStatus(status: FilingStatus): "upcoming" | "in_progress" | "filed" | "overdue" {
  switch (status) {
    case "FILED":
      return "filed";
    case "READY TO FILE":
      return "in_progress";
    case "OVERDUE":
      return "overdue";
    case "DUE SOON":
    case "UPCOMING":
      return "upcoming";
  }
}

function getStatusRank(status: FilingStatus) {
  switch (status) {
    case "OVERDUE":
      return 1;
    case "DUE SOON":
      return 2;
    case "READY TO FILE":
      return 3;
    case "UPCOMING":
      return 4;
    case "FILED":
      return 5;
  }
}


function formatDisplayType(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeFilingNameForMatch(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^ny\s+/i, "")
    .replace(/\breturn\b/g, "filing")
    .replace(/\bquarterly\s+form\s+941\b/g, "form 941")
    .replace(/\bannual\s+form\s+940\b/g, "form 940")
    .replace(/[_-]+/g, " ");
}

function normalizeFilingDisplayName(name: string, stateCode?: string, frequency?: string) {
  const normalizedState = (stateCode || "").trim().toUpperCase();
  const normalizedFrequency = (frequency || "").trim().toLowerCase();
  const cleaned = normalizeWhitespace(name);

  if (!cleaned) return cleaned;

  if (/sales\s+tax/i.test(cleaned)) {
    if (normalizedState) {
      return normalizedFrequency
        ? `${normalizedState} Sales Tax Filing (${normalizedFrequency[0].toUpperCase()}${normalizedFrequency.slice(1)})`
        : `${normalizedState} Sales Tax Filing`;
    }
    return normalizedFrequency
      ? `Sales Tax Filing (${normalizedFrequency[0].toUpperCase()}${normalizedFrequency.slice(1)})`
      : "Sales Tax Filing";
  }

  if (/payroll\s+tax/i.test(cleaned)) {
    return normalizedState ? `${normalizedState} Payroll Tax Filing` : "Payroll Tax Filing";
  }

  if (/annual\s+report/i.test(cleaned)) {
    return normalizedState ? `${normalizedState} Annual Report` : "Annual Report";
  }

  if (/boi/i.test(cleaned)) return "BOI Filing";
  if (/form\s*941/i.test(cleaned)) return "Form 941";
  if (/form\s*940/i.test(cleaned)) return "Form 940";
  if (/1099/i.test(cleaned)) return "1099 Filing";
  if (/w-?2/i.test(cleaned)) return "W-2 Filing";
  if (/1120s/i.test(cleaned)) return "S Corp Return";
  if (/1120/i.test(cleaned)) return "Corporate Tax Return";
  if (/1065/i.test(cleaned)) return "Partnership Return";
  if (/1040|personal\s+tax/i.test(cleaned)) return "Personal Tax Return";

  return cleaned;
}

function filingCategoryKey(name: string) {
  const normalized = normalizeFilingNameForMatch(name);
  if (normalized.includes("sales tax")) return "sales_tax";
  if (normalized.includes("payroll")) return "payroll";
  if (normalized.includes("annual report")) return "annual_report";
  if (normalized.includes("boi")) return "boi";
  if (normalized.includes("form 941")) return "form_941";
  if (normalized.includes("form 940")) return "form_940";
  if (normalized.includes("1099")) return "1099";
  if (normalized.includes("w-2")) return "w2";
  if (normalized.includes("corporate tax")) return "corporate_tax";
  if (normalized.includes("partnership")) return "partnership";
  if (normalized.includes("s corp")) return "s_corp";
  if (normalized.includes("personal tax")) return "personal_tax";
  return normalized;
}

function getFallbackCompanyName(
  companyChoices: CompanyOption[],
  clientId?: string | null,
  organizationId?: string | null
) {
  if (companyChoices.length === 1) return companyChoices[0].name;
  if (clientId || organizationId) return "Workspace";
  return "—";
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(date: string) {
  const today = new Date();
  const due = new Date(`${date}T00:00:00`);
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
}

function getActionLabel(status: FilingStatus) {
  switch (status) {
    case "OVERDUE":
    case "READY TO FILE":
      return "Mark Filed";
    case "DUE SOON":
    case "UPCOMING":
      return "Mark Ready";
    case "FILED":
      return "Reopen";
  }
}

function getStatusTone(status: FilingStatus) {
  switch (status) {
    case "OVERDUE":
      return "border-red-400/20 bg-red-500/10 text-red-200";
    case "DUE SOON":
      return "border-yellow-300/20 bg-yellow-400/10 text-yellow-200";
    case "READY TO FILE":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "UPCOMING":
      return "border-blue-400/20 bg-blue-500/10 text-blue-200";
    case "FILED":
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function getStatusDotClass(status: FilingStatus) {
  switch (status) {
    case "OVERDUE":
      return "bg-red-400";
    case "DUE SOON":
      return "bg-yellow-300";
    case "READY TO FILE":
      return "bg-emerald-400";
    case "UPCOMING":
      return "bg-blue-400";
    case "FILED":
      return "bg-slate-400";
  }
}

function statusDotClass(status: "ALL" | FilingStatus) {
  switch (status) {
    case "OVERDUE":
      return "bg-red-400";
    case "DUE SOON":
      return "bg-yellow-300";
    case "READY TO FILE":
      return "bg-emerald-400";
    case "UPCOMING":
      return "bg-blue-400";
    case "FILED":
      return "bg-slate-400";
    case "ALL":
      return "bg-cyan-300";
  }
}

function sortLabel(sortBy: string) {
  switch (sortBy) {
    case "dueDateAsc":
      return "Due Date (Earliest)";
    case "dueDateDesc":
      return "Due Date (Latest)";
    case "companyAsc":
      return "Company (A-Z)";
    case "assigneeAsc":
      return "Assignee (A-Z)";
    case "status":
      return "Status Priority";
    default:
      return "Sort";
  }
}

function inputClass(error?: string) {
  return `w-full rounded-2xl border bg-white/[0.055] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition ${
    error
      ? "border-red-400/30 focus:border-red-300/40"
      : "border-white/10 focus:border-cyan-300/40 focus:bg-white/[0.07]"
  }`;
}

function getAssigneeStorageKey(firmId: string | null) {
  return firmId ? `dh-filing-assignees:${firmId}` : null;
}

function readStoredAssignees(firmId: string | null) {
  if (typeof window === "undefined") return {} as Record<string, string>;
  const key = getAssigneeStorageKey(firmId);
  if (!key) return {} as Record<string, string>;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, string>;
  }
}

function writeStoredAssignees(firmId: string | null, assigneeMap: Record<string, string>) {
  if (typeof window === "undefined") return;
  const key = getAssigneeStorageKey(firmId);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(assigneeMap));
}

export default function FilingsPage() {
  const supabase = createClient();
  const [firmId, setFirmId] = useState<string | null>(null);
  const [firmType, setFirmType] = useState<"firm" | "business" | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FilingStatus>("ALL");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("dueDateAsc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [focusedRowId, setFocusedRowId] = useState<string | null>(null);
  const [activeFilingId, setActiveFilingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFiling, setNewFiling] = useState<NewFilingForm>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NewFilingForm, string>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState("Unassigned");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [bulkStatusAction, setBulkStatusAction] = useState<"MARK_FILED" | "MARK_READY" | "REOPEN">("MARK_FILED");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingFiling, setIsSavingFiling] = useState(false);
  const [pendingStatusIds, setPendingStatusIds] = useState<string[]>([]);
  const [pendingTaskIds, setPendingTaskIds] = useState<string[]>([]);
  const [pendingAssigneeIds, setPendingAssigneeIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [suggestedFilings, setSuggestedFilings] = useState<SuggestedFiling[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  function showToast(tone: ToastTone, title: string, body?: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, title, body }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2800);
  }

  function applyStoredAssignees(rows: Filing[], targetFirmId: string | null) {
    const stored = readStoredAssignees(targetFirmId);
    return rows.map((row) => ({
      ...row,
      assignee: stored[row.id] || row.assignee || "Unassigned",
    }));
  }

  function persistAssigneeForRows(updates: Record<string, string>) {
    const current = readStoredAssignees(firmId);
    const next = { ...current, ...updates };
    writeStoredAssignees(firmId, next);
  }

  const companies = useMemo(
    () => ["ALL", ...Array.from(new Set(filings.map((f) => f.company)))],
    [filings]
  );

  const assigneeOptions = useMemo(() => ["ALL", ...assignees], []);

  const counts = useMemo(
    () => ({
      ALL: filings.length,
      OVERDUE: filings.filter((f) => f.status === "OVERDUE").length,
      "DUE SOON": filings.filter((f) => f.status === "DUE SOON").length,
      "READY TO FILE": filings.filter((f) => f.status === "READY TO FILE").length,
      UPCOMING: filings.filter((f) => f.status === "UPCOMING").length,
      FILED: filings.filter((f) => f.status === "FILED").length,
    }),
    [filings]
  );

  const filteredFilings = useMemo(() => {
    let rows = [...filings];

    if (statusFilter !== "ALL") rows = rows.filter((f) => f.status === statusFilter);
    if (companyFilter !== "ALL") rows = rows.filter((f) => f.company === companyFilter);
    if (assigneeFilter !== "ALL") {
      rows = rows.filter((f) => (f.assignee ?? "Unassigned") === assigneeFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.company.toLowerCase().includes(q) ||
          f.state.toLowerCase().includes(q) ||
          f.type.toLowerCase().includes(q) ||
          (f.assignee ?? "Unassigned").toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      switch (sortBy) {
        case "dueDateAsc":
          return a.dueDate.localeCompare(b.dueDate);
        case "dueDateDesc":
          return b.dueDate.localeCompare(a.dueDate);
        case "companyAsc":
          return a.company.localeCompare(b.company);
        case "assigneeAsc":
          return (a.assignee ?? "Unassigned").localeCompare(b.assignee ?? "Unassigned");
        case "status":
          return getStatusRank(a.status) - getStatusRank(b.status);
        default:
          return 0;
      }
    });

    return rows;
  }, [filings, search, statusFilter, companyFilter, assigneeFilter, sortBy]);

  const selectedCount = selectedIds.length;

  const allVisibleSelected =
    filteredFilings.length > 0 &&
    filteredFilings.every((row) => selectedIds.includes(row.id));

  const activeFiling =
    filteredFilings.find((item) => item.id === activeFilingId) ||
    filings.find((item) => item.id === activeFilingId) ||
    null;

  const activeCompletion = activeFiling
    ? activeFiling.tasks.length === 0
      ? 0
      : Math.round((activeFiling.tasks.filter((task) => task.completed).length / activeFiling.tasks.length) * 100)
    : 0;

  async function resolveFirmId(userId: string, preferredFirmId?: string | null) {
    if (preferredFirmId) return preferredFirmId;

    const { data: memberships, error } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to resolve firm membership:", error);
      return null;
    }

    return memberships?.[0]?.firm_id ?? null;
  }

  async function loadData(options?: { silent?: boolean }) {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFilings([]);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    const resolvedFirmId = await resolveFirmId(
      user.id,
      typeof user.user_metadata?.firm_id === "string"
        ? user.user_metadata.firm_id
        : typeof user.user_metadata?.workspace_id === "string"
          ? user.user_metadata.workspace_id
          : null
    );

    if (!resolvedFirmId) {
      setFilings([]);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    setFirmId(resolvedFirmId);

    const [
      { data: firm },
      { data: clients },
      { data: organizations },
      { data: filingsData },
      { data: tasksData },
    ] = await Promise.all([
      supabase.from("firms").select("type").eq("id", resolvedFirmId).single(),
      supabase.from("clients").select("id, client_name, state_code").eq("firm_id", resolvedFirmId),
      supabase.from("organizations").select("id, legal_name, display_name, state_code").eq("firm_id", resolvedFirmId),
      supabase
        .from("filings")
        .select("id, organization_id, client_id, filing_name, filing_code, due_date, status, jurisdiction")
        .or(`firm_id.eq.${resolvedFirmId},workspace_id.eq.${resolvedFirmId}`),
      supabase.from("tasks").select("id, filing_id, title, status, assignee_user_id"),
    ]);

    setFirmType((firm?.type as "firm" | "business") ?? null);

    const companyChoices: CompanyOption[] = [
      ...(clients || []).map((c) => ({
        id: c.id,
        name: c.client_name,
        state: c.state_code || "",
        kind: "client" as const,
      })),
      ...(organizations || []).map((o) => ({
        id: o.id,
        name: o.display_name || o.legal_name,
        state: o.state_code || "",
        kind: "organization" as const,
      })),
    ];

    setCompanyOptions(companyChoices);

    const filingIds = new Set((filingsData || []).map((f: any) => String(f.id)));
    const filingTasksMap = new Map<string, Task[]>();
    const filingAssigneeMap = new Map<string, string>();

    ((tasksData || []) as DbTask[])
      .filter((task) => task.filing_id && filingIds.has(String(task.filing_id)))
      .forEach((task) => {
        if (!task.filing_id) return;
        const arr = filingTasksMap.get(task.filing_id) || [];
        arr.push({
          id: task.id,
          title: task.title,
          completed: task.status === "done",
        });
        filingTasksMap.set(task.filing_id, arr);
        if (task.assignee_user_id && !filingAssigneeMap.has(task.filing_id)) {
          filingAssigneeMap.set(task.filing_id, "Rob");
        }
      });

    const rows: Filing[] = (filingsData || []).map((f: any) => {
      const companyMatch = companyChoices.find((o) => o.id === (f.client_id || f.organization_id));
      const company = companyMatch || {
        id: "",
        name: getFallbackCompanyName(companyChoices, f.client_id, f.organization_id),
        state: "",
        kind: "organization" as const,
      };

      const normalizedState = (company.state || f.jurisdiction || "").toUpperCase();
      const normalizedTitle = normalizeFilingDisplayName(
        f.filing_name || f.filing_code || "Filing",
        normalizedState
      );
      const normalizedType = normalizeFilingDisplayName(
        formatDisplayType(f.filing_code || f.filing_name || "Filing"),
        normalizedState
      );

      return {
        id: String(f.id),
        title: normalizedTitle,
        company: company.name,
        companyId: company.id,
        state: normalizedState,
        dueDate: f.due_date,
        status: dbToDisplayStatus(f.status, f.due_date),
        type: normalizedType,
        assignee: filingAssigneeMap.get(String(f.id)) || "Unassigned",
        tasks: filingTasksMap.get(String(f.id)) || [],
        clientId: f.client_id,
        organizationId: f.organization_id,
      };
    });

    setFilings(applyStoredAssignees(rows, resolvedFirmId));
    setLoading(false);
    setIsRefreshing(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!filteredFilings.length) {
      setFocusedRowId(null);
      setActiveFilingId(null);
      return;
    }
    if (focusedRowId === null || !filteredFilings.some((row) => row.id === focusedRowId)) {
      setFocusedRowId(filteredFilings[0].id);
    }
    if (activeFilingId === null || !filteredFilings.some((row) => row.id === activeFilingId)) {
      setActiveFilingId(filteredFilings[0].id);
    }
  }, [filteredFilings, focusedRowId, activeFilingId]);

  const urlStatus = useMemo(() => {
    const statusFromUrl = searchParams.get("status");
    const allowedStatuses = ["ALL", "OVERDUE", "DUE SOON", "READY TO FILE", "UPCOMING", "FILED"] as const;
    if (statusFromUrl && allowedStatuses.includes(statusFromUrl as (typeof allowedStatuses)[number])) {
      return statusFromUrl as "ALL" | FilingStatus;
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (!urlStatus) return;
    setStatusFilter(urlStatus);
    setSearch("");
    setCompanyFilter("ALL");
    setAssigneeFilter("ALL");
  }, [urlStatus]);




  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredFilings.some((f) => f.id === id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredFilings.map((f) => f.id)])));
    }

    if (filteredFilings.length > 0) {
      setLastSelectedId(filteredFilings[0].id);
    }
  }

  function toggleRow(id: string, options?: { shiftKey?: boolean }) {
    const visibleIds = filteredFilings.map((row) => row.id);

    if (options?.shiftKey && lastSelectedId !== null) {
      const startIndex = visibleIds.indexOf(lastSelectedId);
      const endIndex = visibleIds.indexOf(id);

      if (startIndex !== -1 && endIndex !== -1) {
        const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeIds = visibleIds.slice(start, end + 1);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedId(id);
        return;
      }
    }

    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setLastSelectedId(id);
  }

  async function updateStatus(id: string, nextStatus: FilingStatus) {
    const previous = filings;
    setPendingStatusIds((prev) => [...prev, id]);
    setFilings((prev) => prev.map((row) => (row.id === id ? { ...row, status: nextStatus } : row)));

    const { error } = await supabase.from("filings").update({ status: displayToDbStatus(nextStatus) }).eq("id", id);
    if (error) {
      console.error("Failed to update filing status:", error);
      setFilings(previous);
      showToast("error", "Couldn’t update filing status", "Your previous status was restored.");
      setPendingStatusIds((prev) => prev.filter((item) => item !== id));
      return;
    }

    setPendingStatusIds((prev) => prev.filter((item) => item !== id));
    showToast("success", "Filing updated", `Status changed to ${nextStatus}.`);
  }

  async function updateAssignee(id: string, assignee: string) {
    setPendingAssigneeIds((prev) => [...prev, id]);
    const normalized = assignee || "Unassigned";
    setFilings((prev) => prev.map((row) => (row.id === id ? { ...row, assignee: normalized } : row)));
    persistAssigneeForRows({ [id]: normalized });
    setPendingAssigneeIds((prev) => prev.filter((item) => item !== id));
    showToast("success", "Assignee updated", `${normalized} is now assigned to this filing.`);
  }

  async function toggleTask(filingId: string, taskId: string) {
    const filing = filings.find((f) => f.id === filingId);
    const task = filing?.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const previous = filings;
    setPendingTaskIds((prev) => [...prev, taskId]);
    setFilings((prev) =>
      prev.map((row) =>
        row.id === filingId
          ? {
              ...row,
              tasks: row.tasks.map((item) => (item.id === taskId ? { ...item, completed: !item.completed } : item)),
            }
          : row
      )
    );

    const { error } = await supabase
      .from("tasks")
      .update({ status: task.completed ? "todo" : "done" })
      .eq("id", taskId);

    if (error) {
      console.error("Failed to update task:", error);
      setFilings(previous);
      showToast("error", "Couldn’t update task", "The change was rolled back.");
      setPendingTaskIds((prev) => prev.filter((item) => item !== taskId));
      return;
    }

    setPendingTaskIds((prev) => prev.filter((item) => item !== taskId));
  }

  function handlePrimaryAction(row: Filing) {
    switch (row.status) {
      case "OVERDUE":
      case "READY TO FILE":
        updateStatus(row.id, "FILED");
        return;
      case "DUE SOON":
      case "UPCOMING":
        updateStatus(row.id, "READY TO FILE");
        return;
      case "FILED":
        updateStatus(row.id, "READY TO FILE");
        return;
    }
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!filteredFilings.length) return;
    const currentIndex = filteredFilings.findIndex((row) => row.id === focusedRowId);

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      setSelectedIds(filteredFilings.map((row) => row.id));
      if (filteredFilings.length > 0) setLastSelectedId(filteredFilings[0].id);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < filteredFilings.length - 1 ? currentIndex + 1 : currentIndex;
      const nextId = filteredFilings[nextIndex].id;
      setFocusedRowId(nextId);
      setActiveFilingId(nextId);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      const nextId = filteredFilings[nextIndex].id;
      setFocusedRowId(nextId);
      setActiveFilingId(nextId);
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      if (focusedRowId !== null) toggleRow(focusedRowId);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (focusedRowId !== null) {
        setActiveFilingId(focusedRowId);
      }
    }
  }

  function openStatusModal(action: "MARK_FILED" | "MARK_READY" | "REOPEN") {
    if (!selectedIds.length) return;
    setBulkStatusAction(action);
    setIsStatusModalOpen(true);
  }

  function closeStatusModal() {
    setIsStatusModalOpen(false);
  }

  async function applyBulkStatusAction() {
    if (!selectedIds.length) return;

    const nextStatus =
      bulkStatusAction === "MARK_FILED"
        ? "FILED"
        : bulkStatusAction === "MARK_READY"
          ? "READY TO FILE"
          : "UPCOMING";

    const previous = filings;
    setPendingStatusIds((prev) => [...prev, ...selectedIds]);
    setFilings((prev) => prev.map((row) => (selectedIds.includes(row.id) ? { ...row, status: nextStatus } : row)));

    const { error } = await supabase
      .from("filings")
      .update({ status: displayToDbStatus(nextStatus) })
      .in("id", selectedIds);

    if (error) {
      console.error("Failed bulk update:", error);
      setFilings(previous);
      showToast("error", "Bulk update failed", "No status changes were saved.");
      setPendingStatusIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
      return;
    }

    setPendingStatusIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
    showToast("success", "Bulk update complete", `${selectedIds.length} filing${selectedIds.length === 1 ? " was" : "s were"} updated.`);
    closeStatusModal();
    setSelectedIds([]);
  }

  function openAssignModal() {
    if (!selectedIds.length) return;
    setBulkAssignee("Unassigned");
    setIsAssignModalOpen(true);
  }

  function closeAssignModal() {
    setIsAssignModalOpen(false);
    setBulkAssignee("Unassigned");
  }

  function openDeleteModal() {
    if (!selectedIds.length) return;
    setIsDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setIsDeleteModalOpen(false);
  }

  async function applyBulkDelete() {
    if (!selectedIds.length) return;

    const idsToDelete = [...selectedIds];

    const { error: tasksError } = await supabase.from("tasks").delete().in("filing_id", idsToDelete);

    if (tasksError) {
      console.error("Failed to delete related tasks:", tasksError);
      showToast("error", "Couldn’t delete filings", "Related tasks could not be removed.");
      return;
    }

    const { error: filingsError } = await supabase.from("filings").delete().in("id", idsToDelete);

    if (filingsError) {
      console.error("Failed to delete filings:", filingsError);
      showToast("error", "Couldn’t delete filings", "No filings were deleted.");
      return;
    }

    setFilings((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));
    setSelectedIds([]);
    setActiveFilingId((prev) => (prev && idsToDelete.includes(prev) ? null : prev));
    setFocusedRowId((prev) => (prev && idsToDelete.includes(prev) ? null : prev));
    closeDeleteModal();
    showToast("success", "Filings deleted", `${idsToDelete.length} filing${idsToDelete.length === 1 ? " was" : "s were"} deleted.`);
  }

  function applyBulkAssign() {
    if (!selectedIds.length) return;

    const normalized = bulkAssignee || "Unassigned";
    setPendingAssigneeIds((prev) => [...prev, ...selectedIds]);
    setFilings((prev) => prev.map((row) => (selectedIds.includes(row.id) ? { ...row, assignee: normalized } : row)));
    persistAssigneeForRows(Object.fromEntries(selectedIds.map((id) => [id, normalized])));
    setPendingAssigneeIds((prev) => prev.filter((id) => !selectedIds.includes(id)));
    showToast("success", "Bulk assign complete", `${selectedIds.length} filing${selectedIds.length === 1 ? " now has" : "s now have"} ${normalized}.`);
    closeAssignModal();
  }

  function exportRowsToCsv(rows: Filing[]) {
    const headers = [
      "Filing",
      "Type",
      "Company",
      "State",
      "Due Date",
      "Status",
      "Assignee",
      "Completed Tasks",
      "Total Tasks",
    ];

    const csvRows = rows.map((row) => [
      row.title,
      row.type,
      row.company,
      row.state,
      row.dueDate,
      row.status,
      row.assignee ?? "Unassigned",
      String(row.tasks.filter((task) => task.completed).length),
      String(row.tasks.length),
    ]);

    const escapeCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...csvRows].map((row) => row.map((cell) => escapeCell(cell)).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const suffix = rows.length === selectedIds.length && selectedIds.length > 0 ? "selected" : "filtered";
    link.href = url;
    link.setAttribute("download", `due-horizon-${suffix}-filings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  function handleExport() {
    const rowsToExport = selectedIds.length > 0 ? filings.filter((row) => selectedIds.includes(row.id)) : filteredFilings;
    exportRowsToCsv(rowsToExport);
  }

  function openModal() {
    setIsModalOpen(true);
    setSubmitAttempted(false);
    setErrors({});
    setSuggestedFilings([]);
    setIsLoadingSuggestions(false);
    setSelectedSuggestionKeys([]);
  }

  function closeModal() {
    setIsModalOpen(false);
    setNewFiling(emptyForm);
    setErrors({});
    setSubmitAttempted(false);
    setSuggestedFilings([]);
    setIsLoadingSuggestions(false);
    setSelectedSuggestionKeys([]);
  }

  function validateForm(form: NewFilingForm) {
    const nextErrors: Partial<Record<keyof NewFilingForm, string>> = {};
    if (!form.templateKey && selectedSuggestionKeys.length === 0) nextErrors.templateKey = "Template or engine suggestion is required.";
    if (!form.title.trim()) nextErrors.title = "Filing name is required.";
    if (!form.company.trim()) nextErrors.company = "Company is required.";
    if (!form.type.trim()) nextErrors.type = "Filing type is required.";

    const state = form.state.trim().toUpperCase();
    if (!state) nextErrors.state = "State is required.";
    else if (!/^[A-Z]{2}$/.test(state)) nextErrors.state = "Use 2-letter state code.";

    if (!form.dueDate) nextErrors.dueDate = "Due date is required.";
    else if (Number.isNaN(new Date(`${form.dueDate}T00:00:00`).getTime())) nextErrors.dueDate = "Enter a valid due date.";

    return nextErrors;
  }

  async function loadComplianceSuggestions() {
    if (!firmId) {
      showToast("error", "No firm found", "Refresh and try again.");
      return;
    }

    const companyName = newFiling.company.trim();
    if (!companyName) {
      setErrors((prev) => ({ ...prev, company: "Choose a company first." }));
      return;
    }

    const companyRecord = companyOptions.find((option) => option.name === companyName);
    if (!companyRecord) {
      setErrors((prev) => ({ ...prev, company: "Choose an existing company from onboarding data." }));
      return;
    }

    setIsLoadingSuggestions(true);
    setSuggestedFilings([]);
    setSelectedSuggestionKeys([]);

    const profileQuery =
  companyRecord.kind === "client"
    ? supabase
        .from("client_compliance_profiles")
        .select("*")
        .eq("workspace_id", firmId)
        .eq("client_id", companyRecord.id)
        .maybeSingle()
    : supabase
        .from("client_compliance_profiles")
        .select("*")
        .eq("workspace_id", firmId)
        .eq("organization_id", companyRecord.id)
        .maybeSingle();

    const [
      { data: profileRow, error: profileError },
      { data: rulesRows, error: rulesError },
      { data: templateRows, error: templatesError },
    ] = await Promise.all([
      profileQuery,
      supabase.from("compliance_rules").select("*").eq("active", true),
      supabase.from("workflow_templates").select("*").eq("active", true),
    ]);

    if (profileError || !profileRow) {
      console.error(profileError);
      showToast("error", "No compliance profile found", "This company does not have a compliance profile yet.");
      setIsLoadingSuggestions(false);
      return;
    }

    if (rulesError) {
      console.error(rulesError);
      showToast("error", "Couldn’t load compliance rules");
      setIsLoadingSuggestions(false);
      return;
    }

    if (templatesError) {
      console.error(templatesError);
      showToast("error", "Couldn’t load workflow templates");
      setIsLoadingSuggestions(false);
      return;
    }

    const profile: ComplianceProfile = {
      stateCode: profileRow.state_code,
      entityType: profileRow.entity_type,
      payrollEnabled: profileRow.payroll_enabled,
      salesTaxEnabled: profileRow.sales_tax_enabled,
      salesTaxFrequency: profileRow.sales_tax_frequency,
      incomeTaxEnabled: profileRow.income_tax_enabled,
      annualReportEnabled: profileRow.annual_report_enabled,
      boiEnabled: profileRow.boi_enabled,
      w21099Enabled: profileRow.w2_1099_enabled,
    };

    const suggestions = buildSuggestedFilings({
  profile,
  rules: (rulesRows || []) as ComplianceRule[],
  templates: (templateRows || []) as WorkflowTemplate[],
});

const normalizedSuggestions = suggestions.map((suggestion) => ({
  ...suggestion,
  filingName: normalizeFilingDisplayName(
    suggestion.filingName,
    suggestion.jurisdictionCode,
    suggestion.frequency
  ),
}));

const dedupedSuggestions = Array.from(
  new Map(
    normalizedSuggestions.map((suggestion) => {
      const key = [
        suggestion.jurisdictionCode.toUpperCase(),
        filingCategoryKey(suggestion.filingName),
        suggestion.frequency.toLowerCase(),
      ].join("|");

      return [key, suggestion];
    })
  ).values()
);

const existingForCompany = filings.filter((filing) =>
  companyRecord.kind === "client"
    ? filing.clientId === companyRecord.id
    : filing.organizationId === companyRecord.id
);

const filteredSuggestions = dedupedSuggestions.filter((suggestion) => {
  return !existingForCompany.some((existing) => {
    const suggestionState = suggestion.jurisdictionCode.toUpperCase();
    const existingState = (existing.state || companyRecord.state || "").toUpperCase();

    const sameState =
      !existingState ||
      existingState === suggestionState ||
      existingState.includes(suggestionState) ||
      suggestionState.includes(existingState);

    const existingCategory = filingCategoryKey(`${existing.title} ${existing.type}`);
    const suggestionCategory = filingCategoryKey(suggestion.filingName);

    return sameState && existingCategory === suggestionCategory;
  });
});

setSuggestedFilings(filteredSuggestions);
setIsLoadingSuggestions(false);

if (!filteredSuggestions.length) {
  showToast("info", "No suggestions found", "All matching filings already exist for this company.");
  return;
}

showToast(
  "success",
  "Suggestions loaded",
  `${filteredSuggestions.length} filing suggestion${filteredSuggestions.length === 1 ? "" : "s"} found.`
);
  }

  function toggleSuggestedFiling(suggestion: SuggestedFiling) {
    const matchedTemplateKey =
      (Object.keys(filingTemplates) as FilingTemplateKey[]).find(
        (key) =>
          filingTemplates[key].type === suggestion.filingName ||
          filingTemplates[key].titleSuggestion === suggestion.filingName
      ) || "";

    setSelectedSuggestionKeys((prev) => {
      const exists = prev.includes(suggestion.filingKey);
      const nextKeys = exists ? prev.filter((key) => key !== suggestion.filingKey) : [...prev, suggestion.filingKey];

      if (!exists) {
        const normalizedSuggestionName = normalizeFilingDisplayName(
          suggestion.filingName,
          suggestion.jurisdictionCode,
          suggestion.frequency
        );

        const nextForm: NewFilingForm = {
          ...newFiling,
          title: normalizedSuggestionName,
          type: normalizedSuggestionName,
          state: suggestion.jurisdictionCode,
          dueDate: suggestion.dueDate,
          templateKey: matchedTemplateKey as FilingTemplateKey | "",
        };
        setNewFiling(nextForm);
        if (submitAttempted) setErrors(validateForm(nextForm));
      } else if (nextKeys.length === 0) {
        const nextForm = { ...newFiling, templateKey: "" as FilingTemplateKey | "" };
        setNewFiling(nextForm);
        if (submitAttempted) setErrors(validateForm(nextForm));
      }

      return nextKeys;
    });
  }

  function getDerivedStatus(dueDate: string): FilingStatus {
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const due = new Date(`${dueDate}T00:00:00`);
    const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round((dueOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "OVERDUE";
    if (diffDays <= 7) return "DUE SOON";
    if (diffDays <= 30) return "READY TO FILE";
    return "UPCOMING";
  }

  async function saveNewFiling() {
    setSubmitAttempted(true);
    setIsSavingFiling(true);
    const validation = validateForm(newFiling);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setIsSavingFiling(false);
      return;
    }
    if (!firmId) {
      setIsSavingFiling(false);
      return;
    }

    const normalizedCompany = newFiling.company.trim();
    const companyRecord = companyOptions.find((option) => option.name === normalizedCompany);

    if (!companyRecord) {
      setErrors((prev) => ({ ...prev, company: "Choose an existing company from onboarding data." }));
      setIsSavingFiling(false);
      return;
    }

    if (selectedSuggestionKeys.length > 0) {
      const selected = suggestedFilings.filter((item) => selectedSuggestionKeys.includes(item.filingKey));

      if (!selected.length) {
        showToast("error", "No suggestions selected", "Choose one or more suggestions first.");
        setIsSavingFiling(false);
        return;
      }

      const createdIds: string[] = [];

      for (const suggestion of selected) {
        const derivedStatus = getDerivedStatus(suggestion.dueDate);
        const normalizedSuggestionName = normalizeFilingDisplayName(
          suggestion.filingName,
          suggestion.jurisdictionCode,
          suggestion.frequency
        );

        const filingPayload = {
          firm_id: firmId,
          workspace_id: firmId,
          filing_key: suggestion.filingKey,
          filing_name: normalizedSuggestionName,
          filing_code: suggestion.filingKey,
          jurisdiction: suggestion.jurisdictionCode,
          frequency: suggestion.frequency,
          due_date: suggestion.dueDate,
          status: displayToDbStatus(derivedStatus),
          priority: "medium",
          source: "engine",
          client_id: firmType === "firm" && companyRecord.kind === "client" ? companyRecord.id : null,
          organization_id: firmType === "business" || companyRecord.kind === "organization" ? companyRecord.id : null,
        };

        const { data: insertedFiling, error } = await supabase
          .from("filings")
          .insert(filingPayload)
          .select("id")
          .single();

        if (error || !insertedFiling) {
          console.error("Failed to create filing:", error);
          showToast(
            "error",
            "Couldn’t create filings",
            error?.message ? `Stopped while creating ${suggestion.filingName}: ${error.message}` : `Stopped while creating ${suggestion.filingName}.`
          );
          setIsSavingFiling(false);
          return;
        }

        createdIds.push(insertedFiling.id);

        if (suggestion.tasks.length > 0) {
          const { error: taskError } = await supabase.from("tasks").insert(
            suggestion.tasks.map((task) => ({
              filing_id: insertedFiling.id,
              title: task,
              status: "todo",
              assignee_user_id: null,
            }))
          );

          if (taskError) {
            console.error("Failed to create tasks:", taskError);
          }
        }
      }

      setStatusFilter("ALL");
      setCompanyFilter("ALL");
      setAssigneeFilter("ALL");
      setSearch("");
      setSelectedIds([]);
      closeModal();
      await loadData({ silent: true });
      setActiveFilingId(createdIds[0] || null);
      setFocusedRowId(createdIds[0] || null);
      setIsSavingFiling(false);
      showToast("success", "Filings created", `${selected.length} compliance filing${selected.length === 1 ? " was" : "s were"} added.`);
      return;
    }

    const normalizedState = newFiling.state.trim().toUpperCase();
    const normalizedTitle = normalizeFilingDisplayName(newFiling.title.trim(), normalizedState);
    const normalizedType = normalizeFilingDisplayName(newFiling.type.trim(), normalizedState);
    const derivedStatus = getDerivedStatus(newFiling.dueDate);
    const templateTasksList = newFiling.templateKey ? filingTemplates[newFiling.templateKey as FilingTemplateKey].tasks : [];

    if (!templateTasksList.length) {
      showToast("error", "No workflow tasks found", "Choose a template first.");
      setIsSavingFiling(false);
      return;
    }

    const filingPayload = {
      firm_id: firmId,
      workspace_id: firmId,
      filing_name: normalizedTitle,
      filing_code: normalizedType || null,
      jurisdiction: normalizedState,
      frequency: "quarterly",
      due_date: newFiling.dueDate,
      status: displayToDbStatus(derivedStatus),
      priority: "medium",
      source: "manual",
      client_id: firmType === "firm" && companyRecord.kind === "client" ? companyRecord.id : null,
      organization_id: firmType === "business" || companyRecord.kind === "organization" ? companyRecord.id : null,
    };

    const { data: insertedFiling, error } = await supabase
      .from("filings")
      .insert(filingPayload)
      .select("id")
      .single();

    if (error || !insertedFiling) {
      console.error("Failed to create filing:", error);
      showToast("error", "Couldn’t create filing", "Please try again.");
      setIsSavingFiling(false);
      return;
    }

    const { error: taskError } = await supabase.from("tasks").insert(
      templateTasksList.map((task) => ({
        filing_id: insertedFiling.id,
        title: task,
        status: "todo",
        assignee_user_id: null,
      }))
    );

    if (taskError) {
      console.error("Failed to create tasks:", taskError);
      showToast("info", "Filing created", "The filing was saved, but starter tasks were not created.");
    }

    setStatusFilter("ALL");
    setCompanyFilter("ALL");
    setAssigneeFilter("ALL");
    setSearch("");
    setSelectedIds([]);
    closeModal();
    await loadData({ silent: true });
    setActiveFilingId(insertedFiling.id);
    setFocusedRowId(insertedFiling.id);
    setIsSavingFiling(false);
    showToast("success", "Filing created", `${normalizedTitle} is now live in your firm.`);
  }

  function updateForm<K extends keyof NewFilingForm>(field: K, value: NewFilingForm[K]) {
    setNewFiling((current) => {
      let next: NewFilingForm = { ...current, [field]: value };

      if (field === "templateKey" && value) {
        const template = filingTemplates[value as FilingTemplateKey];
        next = {
          ...next,
          templateKey: value as FilingTemplateKey,
          type: template.type,
          title: next.title.trim() ? next.title : template.titleSuggestion,
        };
      }

      if (submitAttempted) setErrors(validateForm(next));
      return next;
    });
  }


  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1650px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-[30px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_60px_rgba(34,211,238,0.07)] sm:p-4">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(11,21,38,0.96),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_42%)] px-5 py-6 sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">Filing Operations</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">All Filings</div>
                  <div className="mt-2 text-sm leading-7 text-slate-400">
                    Work the list from the left, handle the selected filing on the right, and keep the whole team aligned without digging through a giant table. The current page already had deep workflow logic, bulk actions, assignee updates, tasks, and compliance suggestions; this redesign is about making that workflow feel like a product instead of a utility. 
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href="/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white">
                    ← Back to Dashboard
                  </Link>

                  <button
                    type="button"
                    onClick={() => loadData({ silent: true })}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                  </button>

                  <button
                    type="button"
                    onClick={openModal}
                    className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.28)] transition hover:from-cyan-300 hover:to-blue-400 active:scale-[0.98]"
                  >
                    + Add Filing
                  </button>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <TopKpi label="All" value={String(counts.ALL)} accent="cyan" />
                <TopKpi label="Overdue" value={String(counts.OVERDUE)} accent="red" />
                <TopKpi label="Due Soon" value={String(counts["DUE SOON"])} accent="yellow" />
                <TopKpi label="Ready" value={String(counts["READY TO FILE"])} accent="green" />
                <TopKpi label="Filed" value={String(counts.FILED)} accent="slate" />
              </div>

              <div className="mt-5 rounded-[26px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                      Control Bar
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">
                      {statusFilter === "ALL" ? "Entire workflow workspace" : `${statusFilter} workflow view`}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Keep the core workflow simple up front. Advanced filters stay tucked away until you need them.
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {statusFilter !== "ALL" && (
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter("ALL");
                          setSearch("");
                          setCompanyFilter("ALL");
                          setAssigneeFilter("ALL");
                        }}
                        className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        Clear Filter
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      {showAdvancedFilters ? "Hide Advanced" : "Advanced Filters"}
                    </button>

                    <button
                      type="button"
                      onClick={handleExport}
                      className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      {selectedCount > 0 ? `Export ${selectedCount}` : "Export View"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,1.7fr)_220px_auto]">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Search
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 1 1-14 0a7 7 0 0 1 14 0Z"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search filing, company, state, type, or assignee..."
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition duration-200 focus:border-cyan-300/40 focus:bg-white/[0.07] hover:border-white/15"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Status
                    </div>
                    <StatusTabs
                      value={statusFilter}
                      onChange={setStatusFilter}
                      counts={counts}
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Selected
                    </div>
                    <div className="mt-1 text-sm text-white">
                      {selectedCount === 0 ? "No filings selected" : `${selectedCount} filing${selectedCount === 1 ? "" : "s"} selected`}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <BulkActionButton disabled={!selectedCount} onClick={() => openStatusModal("MARK_READY")}>
                        Mark Ready
                      </BulkActionButton>
                      <BulkActionButton disabled={!selectedCount} onClick={() => openStatusModal("MARK_FILED")}>
                        Mark Filed
                      </BulkActionButton>
                      <BulkActionButton disabled={!selectedCount} onClick={openAssignModal}>
                        Assign
                      </BulkActionButton>
                      <BulkActionButton disabled={!selectedCount} onClick={openDeleteModal} danger>
                        Delete
                      </BulkActionButton>
                    </div>
                  </div>
                </div>

                {showAdvancedFilters && (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Company
                      </div>
                      <CustomDropdown value={companyFilter} options={companies} onChange={setCompanyFilter} placeholder="All Companies" />
                    </div>

                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Assignee
                      </div>
                      <CustomDropdown
                        value={assigneeFilter}
                        options={assigneeOptions}
                        onChange={setAssigneeFilter}
                        displayValue={assigneeFilter === "ALL" ? "All Assignees" : assigneeFilter}
                        placeholder="All Assignees"
                      />
                    </div>

                    <div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Sort
                      </div>
                      <CustomDropdown
                        value={sortBy}
                        options={["dueDateAsc", "dueDateDesc", "companyAsc", "assigneeAsc", "status"]}
                        onChange={setSortBy}
                        displayValue={sortLabel(sortBy)}
                        labelMap={{
                          dueDateAsc: "Due Date (Earliest)",
                          dueDateDesc: "Due Date (Latest)",
                          companyAsc: "Company (A-Z)",
                          assigneeAsc: "Assignee (A-Z)",
                          status: "Status Priority",
                        }}
                        placeholder="Sort"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
                <div className="min-w-0 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold text-white">Filings Queue</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Click any row to work that filing in the side panel.
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                      />
                      Select All
                    </label>
                  </div>

                  <div
                    ref={listRef}
                    tabIndex={0}
                    onKeyDown={handleListKeyDown}
                    className="p-3 outline-none"
                  >
                    {loading ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-sm text-slate-400">
                        Loading your firm...
                      </div>
                    ) : filteredFilings.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-10 text-sm text-slate-400">
                        No filings match your current filters.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredFilings.map((row) => {
                          const taskComplete = row.tasks.filter((task) => task.completed).length;
                          const isActive = activeFilingId === row.id;
                          const isFocused = focusedRowId === row.id;
                          const isSelected = selectedIds.includes(row.id);
                          const isPendingStatus = pendingStatusIds.includes(row.id);
                          const isPendingAssignee = pendingAssigneeIds.includes(row.id);

                          return (
                            <div
                              key={row.id}
                              onClick={() => {
                                setActiveFilingId(row.id);
                                setFocusedRowId(row.id);
                              }}
                              className={`cursor-pointer rounded-[24px] border p-4 transition ${
                                isActive
                                  ? "border-cyan-300/25 bg-cyan-400/[0.08] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_20px_45px_rgba(2,132,199,0.10)]"
                                  : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]"
                              } ${isFocused ? "ring-1 ring-inset ring-white/12" : ""}`}
                            >
                              <div className="flex items-start gap-4">
                                <div className="pt-1">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => toggleRow(row.id, { shiftKey: event.nativeEvent.shiftKey })}
                                    className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-400 focus:ring-cyan-400"
                                  />
                                </div>

                                <div className={`mt-1 h-3 w-3 rounded-full ${getStatusDotClass(row.status)}`} />

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="truncate text-base font-medium text-white">{row.title}</div>
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${getStatusTone(row.status)}`}>
                                          {row.status}
                                        </span>
                                      </div>
                                      <div className="mt-1 text-sm text-slate-400">
                                        {row.company} • {row.state || "—"} • {row.type}
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2">
                                      <div className="text-sm font-medium text-white">{formatDate(row.dueDate)}</div>
                                      <div className="text-xs text-slate-400">
                                        {daysUntil(row.dueDate) < 0
                                          ? `${Math.abs(daysUntil(row.dueDate))} day${Math.abs(daysUntil(row.dueDate)) === 1 ? "" : "s"} late`
                                          : daysUntil(row.dueDate) === 0
                                            ? "Due today"
                                            : `Due in ${daysUntil(row.dueDate)} day${daysUntil(row.dueDate) === 1 ? "" : "s"}`}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                                      Assignee: {row.assignee ?? "Unassigned"}{isPendingAssignee ? "..." : ""}
                                    </span>
                                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                                      Tasks: {taskComplete}/{row.tasks.length}
                                    </span>
                                    {isPendingStatus && (
                                      <span className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">
                                        Updating...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="text-sm font-semibold text-white">Active Filing</div>
                    <div className="mt-1 text-sm text-slate-400">
                      The selected filing becomes the working surface instead of forcing everything into the table.
                    </div>
                  </div>

                  <div className="p-5">
                    {!activeFiling ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-sm text-slate-400">
                        Select a filing to review its status, assignee, and task workflow.
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-xl font-semibold text-white">{activeFiling.title}</div>
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${getStatusTone(activeFiling.status)}`}>
                                  {activeFiling.status}
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-slate-400">
                                {activeFiling.company} • {activeFiling.state || "—"} • {activeFiling.type}
                              </div>
                              <div className="mt-2 text-sm text-slate-300">
                                Due {formatDate(activeFiling.dueDate)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePrimaryAction(activeFiling)}
                              className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400"
                            >
                              {getActionLabel(activeFiling.status)}
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <DetailStat label="Timeline" value={daysUntil(activeFiling.dueDate) < 0 ? `${Math.abs(daysUntil(activeFiling.dueDate))} days overdue` : daysUntil(activeFiling.dueDate) === 0 ? "Due today" : `${daysUntil(activeFiling.dueDate)} days remaining`} />
                            <DetailStat label="Progress" value={`${activeCompletion}%`} />
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Assignee</div>
                          <CustomDropdown
                            value={activeFiling.assignee ?? "Unassigned"}
                            options={assignees}
                            onChange={(value) => updateAssignee(activeFiling.id, value)}
                            placeholder="Assignee"
                          />
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</div>
                              <div className="mt-1 text-sm text-slate-300">
                                {activeFiling.tasks.filter((task) => task.completed).length} of {activeFiling.tasks.length} tasks completed
                              </div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                              {activeCompletion}%
                            </div>
                          </div>

                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${activeCompletion}%` }} />
                          </div>

                          <div className="mt-4 space-y-2">
                            {activeFiling.tasks.length === 0 ? (
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                                No tasks were created for this filing yet.
                              </div>
                            ) : (
                              activeFiling.tasks.map((task) => {
                                const taskPending = pendingTaskIds.includes(task.id);
                                return (
                                  <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => toggleTask(activeFiling.id, task.id)}
                                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                                      task.completed
                                        ? "border-emerald-400/15 bg-emerald-500/[0.06]"
                                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                                    }`}
                                  >
                                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${task.completed ? "border-emerald-400/25 bg-emerald-500/15 text-emerald-300" : "border-white/15 text-slate-500"}`}>
                                      {task.completed ? "✓" : ""}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className={`text-sm ${task.completed ? "text-white" : "text-slate-200"}`}>{task.title}</div>
                                    </div>
                                    {taskPending && <span className="text-xs text-cyan-200">Saving...</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => updateStatus(activeFiling.id, "READY TO FILE")}
                            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                          >
                            Mark Ready
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(activeFiling.id, "FILED")}
                            className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200 transition hover:bg-emerald-500/15"
                          >
                            Mark Filed
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <AddFilingModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSave={saveNewFiling}
          newFiling={newFiling}
          setNewFiling={setNewFiling}
          errors={errors}
          submitAttempted={submitAttempted}
          updateForm={updateForm}
          companyOptions={companyOptions}
          suggestedFilings={suggestedFilings}
          selectedSuggestionKeys={selectedSuggestionKeys}
          toggleSuggestedFiling={toggleSuggestedFiling}
          loadComplianceSuggestions={loadComplianceSuggestions}
          isLoadingSuggestions={isLoadingSuggestions}
          isSavingFiling={isSavingFiling}
          filingTemplates={filingTemplates}
        />

        <ConfirmModal
          open={isAssignModalOpen}
          title="Bulk assign filings"
          description={`Assign ${selectedCount} selected filing${selectedCount === 1 ? "" : "s"} to a team member.`}
          onClose={closeAssignModal}
          actions={
            <>
              <CustomDropdown value={bulkAssignee} options={assignees} onChange={setBulkAssignee} placeholder="Assignee" />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyBulkAssign}
                  className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400"
                >
                  Apply
                </button>
              </div>
            </>
          }
        />

        <ConfirmModal
          open={isStatusModalOpen}
          title="Bulk status update"
          description={`Update ${selectedCount} selected filing${selectedCount === 1 ? "" : "s"} to ${bulkStatusAction === "MARK_FILED" ? "Filed" : bulkStatusAction === "MARK_READY" ? "Ready to File" : "Upcoming"}.`}
          onClose={closeStatusModal}
          actions={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeStatusModal}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBulkStatusAction}
                className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400"
              >
                Confirm
              </button>
            </div>
          }
        />

        <ConfirmModal
          open={isDeleteModalOpen}
          title="Delete selected filings"
          description={`This will permanently remove ${selectedCount} filing${selectedCount === 1 ? "" : "s"} and any related tasks.`}
          onClose={closeDeleteModal}
          actions={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyBulkDelete}
                className="flex-1 rounded-xl border border-red-400/20 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
              >
                Delete
              </button>
            </div>
          }
        />

        <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-full max-w-sm flex-col gap-3">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
                toast.tone === "success"
                  ? "border-emerald-400/20 bg-[linear-gradient(180deg,rgba(6,78,59,0.32),rgba(4,47,46,0.24))]"
                  : toast.tone === "error"
                    ? "border-red-400/20 bg-[linear-gradient(180deg,rgba(127,29,29,0.32),rgba(69,10,10,0.24))]"
                    : "border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.32),rgba(15,23,42,0.24))]"
              }`}
            >
              <div className="text-sm font-semibold text-white">{toast.title}</div>
              {toast.body && <div className="mt-1 text-sm text-slate-200">{toast.body}</div>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function TopKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "red" | "yellow" | "green" | "slate";
}) {
  const accents = {
    cyan: "border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.05))]",
    red: "border-red-400/15 bg-[linear-gradient(180deg,rgba(127,29,29,0.18),rgba(69,10,10,0.05))]",
    yellow: "border-yellow-300/15 bg-[linear-gradient(180deg,rgba(202,138,4,0.16),rgba(120,53,15,0.05))]",
    green: "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(4,47,46,0.05))]",
    slate: "border-white/10 bg-[linear-gradient(180deg,rgba(30,41,59,0.18),rgba(15,23,42,0.05))]",
  }[accent];

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] ${accents}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
    </div>
  );
}

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: "ALL" | FilingStatus;
  onChange: (value: "ALL" | FilingStatus) => void;
  counts: Record<"ALL" | FilingStatus, number>;
}) {
  const options: Array<"ALL" | FilingStatus> = ["ALL", "OVERDUE", "DUE SOON", "READY TO FILE", "UPCOMING", "FILED"];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.14em] transition ${
              active
                ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${statusDotClass(option)}`} />
            <span>{option}</span>
            <span className="text-[10px] opacity-80">{counts[option]}</span>
          </button>
        );
      })}
    </div>
  );
}

function BulkActionButton({
  children,
  onClick,
  disabled,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? "border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/15"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      {children}
      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  actions: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="text-xl font-semibold text-white">{title}</div>
        <div className="mt-2 text-sm leading-7 text-slate-400">{description}</div>
        <div className="mt-5">{actions}</div>
      </div>
    </div>
  );
}

function CustomDropdown({
  value,
  options,
  onChange,
  placeholder,
  displayValue,
  labelMap,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  displayValue?: string;
  labelMap?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.07]"
    >
      {placeholder && !options.includes(value) && (
        <option value="" className="bg-slate-900">
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option} value={option} className="bg-slate-900">
          {option === value && displayValue ? displayValue : labelMap?.[option] || option}
        </option>
      ))}
    </select>
  );
}
