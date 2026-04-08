"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";

type FilingStatus = "upcoming" | "in_progress" | "filed" | "overdue" | "not_applicable";

type CalendarFiling = {
  id: string;
  filing_name: string;
  due_date: string;
  status: FilingStatus;
  jurisdiction: string | null;
  frequency: string | null;
  client_id: string | null;
  organization_id: string | null;
};

type CalendarItem = {
  id: string;
  title: string;
  company: string;
  dueDate: string;
  status: FilingStatus;
  jurisdiction: string;
  frequency: string;
};

type WorkspaceSummary = {
  workspaceName: string;
  workspaceType: "business_owner" | "accounting_firm" | "unknown";
};

function parseLocalDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function formatDate(date: string) {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDayLabel(date: string) {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysUntil(dateStr: string) {
  const today = new Date();
  const due = parseLocalDate(dateStr);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function statusPillClass(status: FilingStatus, dueDate: string) {
  if (status === "filed") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
  if (status === "in_progress") return "border-cyan-400/20 bg-cyan-500/10 text-cyan-300";
  if (status === "overdue" || daysUntil(dueDate) < 0) return "border-red-400/20 bg-red-500/10 text-red-300";
  if (daysUntil(dueDate) <= 7) return "border-yellow-400/20 bg-yellow-500/10 text-yellow-200";
  return "border-blue-400/20 bg-blue-500/10 text-blue-200";
}

function displayStatus(status: FilingStatus, dueDate: string) {
  if (status === "filed") return "Filed";
  if (status === "in_progress") return "Ready to File";
  if (status === "overdue") return "Overdue";
  const days = daysUntil(dueDate);
  if (days < 0) return "Overdue";
  if (days <= 7) return "Due Soon";
  return "Upcoming";
}

function urgencyText(status: FilingStatus, dueDate: string) {
  if (status === "filed") return "Completed";
  if (status === "in_progress") return "Prepared and ready";
  const days = daysUntil(dueDate);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days <= 7) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `Due in ${days} days`;
}

function getDayCellTone(items: CalendarItem[]) {
  if (items.some((item) => item.status !== "filed" && daysUntil(item.dueDate) < 0)) {
    return "border-red-400/15 bg-red-500/[0.05]";
  }
  if (items.some((item) => item.status === "in_progress")) {
    return "border-cyan-400/15 bg-cyan-500/[0.05]";
  }
  if (items.some((item) => item.status !== "filed" && daysUntil(item.dueDate) <= 7)) {
    return "border-yellow-400/15 bg-yellow-500/[0.05]";
  }
  if (items.some((item) => item.status === "filed")) {
    return "border-emerald-400/10 bg-emerald-500/[0.03]";
  }
  return "border-white/10 bg-white/[0.025]";
}

async function resolveWorkspaceId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("workspace_id", { ascending: true });

  return memberships?.[0]?.workspace_id ?? null;
}

export default function CalendarPage() {
  const pathname = usePathname();
  const supabase = createClient();

  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary>({
    workspaceName: "Due Horizon",
    workspaceType: "unknown",
  });
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("dh-sidebar-collapsed");
    setIsSidebarCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dh-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    async function loadCalendar() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      const metadataWorkspaceId =
        typeof user.user_metadata?.workspace_id === "string" ? user.user_metadata.workspace_id : null;
      const workspaceId = metadataWorkspaceId || (await resolveWorkspaceId(supabase, user.id));

      if (!workspaceId) {
        setItems([]);
        setLoading(false);
        return;
      }

      const [{ data: workspace }, { data: clients }, { data: organizations }, { data: filings }] = await Promise.all([
        supabase.from("workspaces").select("name, workspace_type").eq("id", workspaceId).single(),
        supabase.from("clients").select("id, client_name").eq("workspace_id", workspaceId),
        supabase.from("organizations").select("id, legal_name, display_name").eq("workspace_id", workspaceId),
        supabase
          .from("filings")
          .select("id, filing_name, due_date, status, jurisdiction, frequency, client_id, organization_id")
          .eq("workspace_id", workspaceId)
          .order("due_date", { ascending: true }),
      ]);

      const nameMap = new Map<string, string>();
      (clients || []).forEach((client) => nameMap.set(client.id, client.client_name));
      (organizations || []).forEach((org) => nameMap.set(org.id, org.display_name || org.legal_name));

      const mapped = ((filings || []) as CalendarFiling[]).map((filing) => ({
        id: filing.id,
        title: filing.filing_name,
        company:
          (filing.client_id && nameMap.get(filing.client_id)) ||
          (filing.organization_id && nameMap.get(filing.organization_id)) ||
          "Workspace",
        dueDate: filing.due_date,
        status: filing.status,
        jurisdiction: filing.jurisdiction || "—",
        frequency: filing.frequency || "—",
      }));

      setWorkspaceSummary({
        workspaceName: workspace?.name || "Due Horizon",
        workspaceType: workspace?.workspace_type || "unknown",
      });
      setItems(mapped);
      setLoading(false);

      if (mapped.length && !selectedDate) {
        setSelectedDate(mapped[0].dueDate);
      }
    }

    loadCalendar();
  }, [supabase]);

  const dueSoonCount = items.filter((item) => {
    const days = daysUntil(item.dueDate);
    return item.status !== "filed" && days >= 0 && days <= 7;
  }).length;

  const overdueCount = items.filter((item) => item.status !== "filed" && daysUntil(item.dueDate) < 0).length;
  const filedCount = items.filter((item) => item.status === "filed").length;

  const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const monthItems = useMemo(() => {
    return items.filter((item) => {
      const date = parseLocalDate(item.dueDate);
      return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
    });
  }, [items, monthKey]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of monthItems) {
      const list = map.get(item.dueDate) || [];
      list.push(item);
      map.set(item.dueDate, list);
    }
    return map;
  }, [monthItems]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(1 - firstOfMonth.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const ymd = toYmd(date);
      return {
        date,
        ymd,
        inMonth: date.getMonth() === currentMonth.getMonth(),
        items: itemsByDate.get(ymd) || [],
      };
    });
  }, [currentMonth, itemsByDate]);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return [];
    return items
      .filter((item) => item.dueDate === selectedDate)
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items, selectedDate]);

  const upcomingAgenda = useMemo(() => {
    return items
      .filter((item) => item.status !== "filed")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 8);
  }, [items]);

  const nextDeadline = upcomingAgenda[0] ?? null;

  function goToPreviousMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function goToToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toYmd(now));
  }

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 sm:py-6">
        <div className="rounded-[30px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_50px_rgba(34,211,238,0.06)] sm:p-4">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(11,21,38,0.96),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div
              className="lg:grid"
              style={{ gridTemplateColumns: isSidebarCollapsed ? "88px minmax(0,1fr)" : "272px minmax(0,1fr)" }}
            >
              <aside
                className={`hidden border-r border-white/10 bg-[linear-gradient(to_bottom,rgba(8,15,28,0.99),rgba(6,12,23,0.99))] lg:flex lg:min-h-[calc(100vh-9rem)] lg:flex-col transition-all duration-300 ease-out ${isSidebarCollapsed ? "px-3" : ""}`}
              >
                <div className={`border-b border-white/10 ${isSidebarCollapsed ? "px-2 py-6" : "px-5 py-6"} transition-all duration-300`}>
                  <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "justify-between gap-4"} transition-all duration-300`}>
                    <div className={`flex items-center ${isSidebarCollapsed ? "justify-center" : "gap-4"} transition-all duration-300`}>
                      <div className="relative flex items-center justify-center transition-all duration-300 hover:scale-[1.05]">
                        <div className="absolute inset-0 rounded-xl bg-cyan-400/8 blur-xl" />
                        <Image
                          src="/logo-final.png"
                          alt="Due Horizon"
                          width={32}
                          height={32}
                          className="relative drop-shadow-[0_0_12px_rgba(34,211,238,0.28)] transition-all duration-300"
                        />
                      </div>

                      <div
                        className={`grid transition-all duration-300 ease-out ${
                          isSidebarCollapsed
                            ? "max-w-0 grid-cols-[0fr] opacity-0 translate-x-[-8px] overflow-hidden"
                            : "max-w-[160px] grid-cols-[1fr] opacity-100 translate-x-0"
                        }`}
                      >
                        <div className="min-w-0 overflow-hidden">
                          <div className="whitespace-nowrap text-sm font-semibold tracking-tight text-white">Due Horizon</div>
                          <div className="mt-1 truncate whitespace-nowrap text-[11px] text-slate-400">
                            Compliance OS
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`transition-all duration-300 ${
                        isSidebarCollapsed ? "pointer-events-none w-0 translate-x-2 overflow-hidden opacity-0" : "w-auto translate-x-0 opacity-100"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setIsSidebarCollapsed(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-200"
                        aria-label="Collapse sidebar"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                  </div>

                  {isSidebarCollapsed && (
                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(false)}
                      className="mt-4 flex h-9 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-cyan-200"
                      aria-label="Expand sidebar"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>

                <div className={`flex-1 ${isSidebarCollapsed ? "py-5" : "px-4 py-5"}`}>
                  {!isSidebarCollapsed && (
                    <div className="mb-3 px-3 text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                      NAVIGATION
                    </div>
                  )}

                  <nav className="space-y-2">
                    <SidebarNavItem href="/dashboard" label="Dashboard" icon={LayoutDashboard} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem href="/filings" label="Filings" icon={FileText} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem href="/calendar" label="Calendar" icon={CalendarIcon} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem href="/reports" label="Reports" icon={CheckCircle2} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem
                      href="/businesses"
                      label={workspaceSummary.workspaceType === "accounting_firm" ? "Clients" : "Businesses"}
                      icon={Building2}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarNavItem href="/settings" label="Settings" icon={Settings} pathname={pathname} collapsed={isSidebarCollapsed} />
                  </nav>

                  {!isSidebarCollapsed && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(15,23,42,0.4))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                            WORKSPACE
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">{workspaceSummary.workspaceName}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {workspaceSummary.workspaceType === "accounting_firm" ? "Accounting firm" : workspaceSummary.workspaceType === "business_owner" ? "Business" : "Workspace"}
                          </div>
                        </div>
                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                          Live
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <WorkspaceMiniStat label="Scheduled" value={String(items.length)} helper="All calendar items" />
                        <WorkspaceMiniStat label="Due soon" value={String(dueSoonCount)} helper="Next 7 days" />
                        <WorkspaceMiniStat label="Overdue" value={String(overdueCount)} helper="Needs attention" />
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${isSidebarCollapsed ? "p-3" : "p-4"} border-t border-white/10`}>
                  {!isSidebarCollapsed ? (
                    <div className="rounded-2xl border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                      <div className="text-sm font-semibold text-white">Calendar first, workflow second</div>
                      <div className="mt-1 text-xs leading-5 text-slate-300">
                        Use the month view to plan timing, then jump into filings to do the work.
                      </div>
                      <Link
                        href="/filings"
                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400"
                      >
                        Go to Filings
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href="/filings"
                      className="flex h-12 w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/15"
                      title="Go to Filings"
                    >
                      <ArrowRight size={18} />
                    </Link>
                  )}
                </div>
              </aside>

              <div className="min-w-0">
                <div className="border-b border-white/10 px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-4 lg:hidden">
                        <div className="relative flex items-center justify-center">
                          <div className="absolute inset-0 rounded-xl bg-cyan-400/8 blur-xl" />
                          <Image
                            src="/logo-final.png"
                            alt="Due Horizon"
                            width={32}
                            height={32}
                            className="relative drop-shadow-[0_0_12px_rgba(34,211,238,0.28)]"
                          />
                        </div>
                        <div>
                          <div className="text-lg font-semibold tracking-tight">Due Horizon</div>
                          <div className="text-xs text-slate-400">{workspaceSummary.workspaceName}</div>
                        </div>
                      </div>

                      <div className="hidden lg:block">
                        <div className="text-xs font-semibold tracking-[0.18em] text-cyan-300/80">
                          CALENDAR
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                          A real calendar view for filing deadlines
                        </h1>
                        <p className="mt-2 text-slate-400">
                          See deadline density by day, scan the month fast, and click any date to inspect what is due.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
                      <Link
                        href="/filings"
                        className="hidden sm:inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        View Filings →
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 lg:hidden">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      A real calendar view for filing deadlines
                    </h1>
                    <p className="mt-2 text-slate-400">
                      See deadline density by day, scan the month fast, and click any date to inspect what is due.
                    </p>
                  </div>
                </div>

                <div className="overflow-visible px-4 py-6 sm:px-6 sm:py-8">
                  <div className="mx-auto max-w-[1320px]">
                    <div className="mb-6 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>Workspace</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">{workspaceSummary.workspaceName}</span>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                      <StatCard label="TOTAL FILINGS" value={String(items.length)} sublabel="All scheduled filings" icon={<CalendarIcon size={18} />} accent="blue" />
                      <StatCard label="DUE SOON" value={String(dueSoonCount)} sublabel="Next 7 days" icon={<Clock3 size={18} />} accent="yellow" />
                      <StatCard label="OVERDUE" value={String(overdueCount)} sublabel="Needs attention" icon={<AlertTriangle size={18} />} accent="red" />
                      <StatCard label="FILED" value={String(filedCount)} sublabel="Completed items" icon={<CheckCircle2 size={18} />} accent="green" />
                    </div>

                    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_360px]">
                      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                        <div className="border-b border-white/10 px-5 py-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">MONTH VIEW</div>
                              <div className="mt-2 text-2xl font-semibold text-white">{formatMonthLabel(currentMonth)}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={goToPreviousMonth}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                                aria-label="Previous month"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={goToToday}
                                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                              >
                                Today
                              </button>
                              <button
                                type="button"
                                onClick={goToNextMonth}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                                aria-label="Next month"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
                          {weekDays.map((day) => (
                            <div
                              key={day}
                              className="px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                            >
                              {day}
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-7">
                          {calendarDays.map((day) => {
                            const isToday = toYmd(new Date()) == day.ymd;
                            const isSelected = selectedDate === day.ymd;

                            return (
                              <button
                                key={day.ymd}
                                type="button"
                                onClick={() => setSelectedDate(day.ymd)}
                                className={`min-h-[126px] border-r border-b p-2 text-left align-top transition last:border-r-0 ${
                                  day.inMonth ? getDayCellTone(day.items) : "border-white/10 bg-white/[0.015] opacity-45"
                                } ${isSelected ? "ring-1 ring-inset ring-cyan-300/35" : ""} hover:bg-white/[0.05]`}
                              >
                                <div className="flex items-center justify-between">
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                                      isToday
                                        ? "bg-cyan-400 text-slate-950"
                                        : day.inMonth
                                          ? "text-white"
                                          : "text-slate-500"
                                    }`}
                                  >
                                    {day.date.getDate()}
                                  </div>
                                  {day.items.length > 0 && (
                                    <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                      {day.items.length}
                                    </div>
                                  )}
                                </div>

                                <div className="mt-3 space-y-1.5">
                                  {day.items.slice(0, 3).map((item) => (
                                    <div
                                      key={item.id}
                                      className={`truncate rounded-lg border px-2 py-1 text-[11px] ${statusPillClass(item.status, item.dueDate)}`}
                                    >
                                      {item.title}
                                    </div>
                                  ))}
                                  {day.items.length > 3 && (
                                    <div className="text-[11px] text-slate-400">+{day.items.length - 3} more</div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">SELECTED DAY</div>

                          {selectedDate ? (
                            <div className="mt-4">
                              <div className="text-lg font-semibold text-white">{formatDate(selectedDate)}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {selectedItems.length === 0
                                  ? "No filings on this date."
                                  : `${selectedItems.length} filing${selectedItems.length === 1 ? "" : "s"} scheduled`}
                              </div>

                              <div className="mt-4 space-y-3">
                                {selectedItems.length === 0 ? (
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                                    This day is clear.
                                  </div>
                                ) : (
                                  selectedItems.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-white">{item.title}</div>
                                          <div className="mt-1 text-sm text-slate-400">
                                            {item.company} • {item.jurisdiction} • {item.frequency}
                                          </div>
                                          <div className="mt-2 text-sm text-slate-300">
                                            {urgencyText(item.status, item.dueDate)}
                                          </div>
                                        </div>
                                        <div className={`rounded-xl border px-3 py-2 text-xs ${statusPillClass(item.status, item.dueDate)}`}>
                                          {displayStatus(item.status, item.dueDate)}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 text-sm text-slate-400">Select a day to inspect what is due.</div>
                          )}
                        </div>

                        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">AGENDA</div>
                              <div className="mt-2 text-lg font-semibold text-white">Upcoming deadlines</div>
                            </div>
                            {nextDeadline && (
                              <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-cyan-200">
                                NEXT UP
                              </div>
                            )}
                          </div>

                          <div className="mt-4 space-y-3">
                            {loading ? (
                              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
                                Loading agenda...
                              </div>
                            ) : upcomingAgenda.length === 0 ? (
                              <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] px-4 py-5 text-sm text-slate-300">
                                Everything upcoming is clear right now.
                              </div>
                            ) : (
                              upcomingAgenda.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    const date = parseLocalDate(item.dueDate);
                                    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                                    setSelectedDate(item.dueDate);
                                  }}
                                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white">{item.title}</div>
                                      <div className="mt-1 text-sm text-slate-400">{item.company}</div>
                                      <div className="mt-2 text-sm text-slate-300">{formatDate(item.dueDate)}</div>
                                    </div>
                                    <div className={`rounded-xl border px-3 py-2 text-xs ${statusPillClass(item.status, item.dueDate)}`}>
                                      {displayStatus(item.status, item.dueDate)}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>

                          <div className="mt-5 flex flex-col gap-3">
                            <Link
                              href="/filings"
                              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400"
                            >
                              Go to Filings
                            </Link>
                            <Link
                              href="/dashboard"
                              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                            >
                              Back to Dashboard
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center ${collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3"} rounded-2xl border transition ${
        isActive
          ? "border-cyan-300/20 bg-cyan-400/10 text-white shadow-[0_0_20px_rgba(34,211,238,0.08)]"
          : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      <Icon size={18} className={isActive ? "text-cyan-200" : "text-slate-400 group-hover:text-slate-200"} />
      {!collapsed && <span className="flex-1 text-sm font-medium">{label}</span>}
      {isActive && !collapsed && <div className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan-300" />}
    </Link>
  );
}

function WorkspaceMiniStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-300">{label}</div>
        <div className="mt-1 truncate text-[11px] text-slate-500">{helper}</div>
      </div>
      <div className="ml-4 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: "red" | "yellow" | "green" | "blue";
}) {
  const accentMap = {
    red: "border-red-400/15 bg-[linear-gradient(180deg,rgba(127,29,29,0.16),rgba(69,10,10,0.05))]",
    yellow: "border-yellow-300/15 bg-[linear-gradient(180deg,rgba(202,138,4,0.14),rgba(120,53,15,0.05))]",
    green: "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.14),rgba(4,47,46,0.05))]",
    blue: "border-blue-400/15 bg-[linear-gradient(180deg,rgba(30,58,138,0.14),rgba(15,23,42,0.05))]",
  }[accent];

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition hover:-translate-y-[2px] ${accentMap}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-400">{sublabel}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white">
          {icon}
        </div>
      </div>
    </div>
  );
}
