"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Download,
  FileBarChart2,
  LayoutDashboard,
  PieChart,
  TrendingUp,
} from "lucide-react";

type FilingStatus = "upcoming" | "in_progress" | "filed" | "overdue" | "not_applicable";

type DbFiling = {
  id: string;
  filing_name: string;
  due_date: string;
  status: FilingStatus;
  jurisdiction: string | null;
  frequency: string | null;
};

type WorkspaceSummary = {
  workspaceName: string;
  workspaceType: "business_owner" | "accounting_firm" | "unknown";
  clientCount: number;
};

type ExportOption = "register" | "overdue" | "summary";

function daysUntil(dateStr: string) {
  const today = new Date();
  const due = new Date(`${dateStr}T00:00:00`);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function formatFriendlyDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthKey(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function formatFrequency(value: string | null) {
  if (!value) return "Unspecified";
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status: FilingStatus, dueDate: string) {
  if (status === "filed") return "Filed";
  if (status === "in_progress") return "Ready to File";
  if (status === "overdue" || daysUntil(dueDate) < 0) return "Overdue";
  if (daysUntil(dueDate) <= 7) return "Due Soon";
  return "Upcoming";
}

function downloadCsv(filename: string, rows: string[][]) {
  const escapeCell = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map((cell) => escapeCell(cell)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

async function resolveWorkspaceId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .order("workspace_id", { ascending: true });

  return memberships?.[0]?.workspace_id ?? null;
}

export default function ReportsPage() {
  const pathname = usePathname();
  const supabase = createClient();
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  const [summary, setSummary] = useState<WorkspaceSummary>({
    workspaceName: "Due Horizon",
    workspaceType: "unknown",
    clientCount: 0,
  });
  const [filings, setFilings] = useState<DbFiling[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setFilings([]);
        setLoading(false);
        return;
      }

      const metadataWorkspaceId =
        typeof user.user_metadata?.workspace_id === "string" ? user.user_metadata.workspace_id : null;
      const workspaceId = metadataWorkspaceId || (await resolveWorkspaceId(supabase, user.id));

      if (!workspaceId) {
        setFilings([]);
        setLoading(false);
        return;
      }

      const [{ data: workspace }, { data: clients }, { data: organizations }, { data: filingsData }] = await Promise.all([
        supabase.from("workspaces").select("name, workspace_type").eq("id", workspaceId).single(),
        supabase.from("clients").select("id").eq("workspace_id", workspaceId),
        supabase.from("organizations").select("id").eq("workspace_id", workspaceId),
        supabase
          .from("filings")
          .select("id, filing_name, due_date, status, jurisdiction, frequency")
          .eq("workspace_id", workspaceId)
          .order("due_date", { ascending: true }),
      ]);

      setSummary({
        workspaceName: workspace?.name || "Due Horizon",
        workspaceType: workspace?.workspace_type || "unknown",
        clientCount:
          workspace?.workspace_type === "accounting_firm" ? (clients || []).length : (organizations || []).length,
      });
      setFilings((filingsData || []) as DbFiling[]);
      setLoading(false);
    }

    loadReports();
  }, [supabase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setExportMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const metrics = useMemo(() => {
    const overdue = filings.filter((filing) => filing.status !== "filed" && daysUntil(filing.due_date) < 0).length;
    const dueSoon = filings.filter((filing) => {
      const days = daysUntil(filing.due_date);
      return filing.status !== "filed" && days >= 0 && days <= 7;
    }).length;
    const ready = filings.filter((filing) => filing.status === "in_progress").length;
    const filed = filings.filter((filing) => filing.status === "filed").length;
    const active = filings.filter((filing) => filing.status !== "filed").length;
    const completionRate = filings.length === 0 ? 0 : Math.round((filed / filings.length) * 100);

    return { overdue, dueSoon, ready, filed, active, total: filings.length, completionRate };
  }, [filings]);

  const previousMetrics = useMemo(() => {
    const now = new Date();
    const dayMs = 1000 * 60 * 60 * 24;
    const currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    const previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 59);
    const previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

    const current = filings.filter((filing) => {
      const due = new Date(`${filing.due_date}T00:00:00`);
      return due >= currentStart && due <= now;
    });

    const previous = filings.filter((filing) => {
      const due = new Date(`${filing.due_date}T00:00:00`);
      return due >= previousStart && due <= previousEnd;
    });

    const currentTotal = current.length;
    const previousTotal = previous.length;
    const currentOverdue = current.filter((filing) => filing.status !== "filed" && daysUntil(filing.due_date) < 0).length;
    const previousOverdue = previous.filter((filing) => filing.status !== "filed" && daysUntil(filing.due_date) < 0).length;

    const currentFiled = current.filter((filing) => filing.status === "filed").length;
    const previousFiled = previous.filter((filing) => filing.status === "filed").length;

    const currentCompletionRate = currentTotal === 0 ? 0 : Math.round((currentFiled / currentTotal) * 100);
    const previousCompletionRate = previousTotal === 0 ? 0 : Math.round((previousFiled / previousTotal) * 100);

    return {
      currentTotal,
      previousTotal,
      currentOverdue,
      previousOverdue,
      currentCompletionRate,
      previousCompletionRate,
      totalDelta: currentTotal - previousTotal,
      overdueDelta: currentOverdue - previousOverdue,
      completionDelta: currentCompletionRate - previousCompletionRate,
      currentWindowLabel: "Last 30 days",
      previousWindowLabel: "Prior 30 days",
    };
  }, [filings]);

  const filingsByMonth = useMemo(() => {
    const groups = new Map<string, number>();
    for (const filing of filings) {
      const key = formatMonthKey(filing.due_date);
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).slice(-6);
  }, [filings]);

  const byFrequency = useMemo(() => {
    const groups = new Map<string, number>();
    for (const filing of filings) {
      const key = formatFrequency(filing.frequency);
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filings]);

  const byJurisdiction = useMemo(() => {
    const groups = new Map<string, number>();
    for (const filing of filings) {
      const key = filing.jurisdiction || "Unspecified";
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filings]);

  const oldestOutstanding = useMemo(
    () =>
      [...filings]
        .filter((filing) => filing.status !== "filed")
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
        .slice(0, 5),
    [filings]
  );

  const completionNarrative =
    metrics.completionRate >= 85
      ? "Completion rate is strong. Most of the workload is getting closed out."
      : metrics.completionRate >= 60
        ? "Completion rate is healthy, but there is still room to tighten closeout speed."
        : "Completion rate is low enough that reporting should focus on closing work faster.";

  const highestMonth = filingsByMonth.reduce<{ label: string; value: number } | null>((best, current) => {
    if (!best || current[1] > best.value) return { label: current[0], value: current[1] };
    return best;
  }, null);

  const topFrequency = byFrequency[0] ?? null;
  const topJurisdiction = byJurisdiction[0] ?? null;

  const volumeInsight =
    highestMonth
      ? `${highestMonth.label} is your heaviest due month with ${highestMonth.value} filing${highestMonth.value === 1 ? "" : "s"}.`
      : "No volume trend is available yet.";

  const frequencyInsight =
    topFrequency && metrics.total > 0
      ? `${topFrequency[0]} drives ${Math.round((topFrequency[1] / metrics.total) * 100)}% of filing volume.`
      : "No frequency concentration is available yet.";

  const jurisdictionInsight =
    topJurisdiction && metrics.total > 0
      ? `${topJurisdiction[0]} accounts for ${Math.round((topJurisdiction[1] / metrics.total) * 100)}% of filings.`
      : "No jurisdiction concentration is available yet.";

  const headlineInsight = (() => {
    if (metrics.overdue > 0) {
      return {
        title: `${metrics.overdue} filings need immediate attention`,
        body: "Your queue still has overdue work. Prioritize aged items first, then move into due-soon filings before risk builds further.",
        tone: "red" as const,
      };
    }
    if (highestMonth && highestMonth.value >= Math.max(metrics.total * 0.3, 5)) {
      return {
        title: `${highestMonth.label} is shaping up as your heaviest filing month`,
        body: "Workload is concentrated enough that this month should be treated as a preparation point, not just a reporting fact.",
        tone: "cyan" as const,
      };
    }
    if (metrics.completionRate >= 85) {
      return {
        title: "Your reporting operation is in a strong position",
        body: "Completion rate is high and there is no major visible bottleneck. The best next step is protecting that pace as volume rises.",
        tone: "green" as const,
      };
    }
    return {
      title: "The biggest opportunity is improving closeout speed",
      body: "There is enough active workload in the system that tightening completion habits would improve reporting quality fast.",
      tone: "yellow" as const,
    };
  })();

  function handleExport(option: ExportOption) {
    setExportMenuOpen(false);

    if (option === "register") {
      const rows: string[][] = [
        ["Filing Name", "Due Date", "Status", "Jurisdiction", "Frequency", "Days Until"],
        ...filings.map((filing) => [
          filing.filing_name,
          filing.due_date,
          formatStatus(filing.status, filing.due_date),
          filing.jurisdiction || "Unspecified",
          formatFrequency(filing.frequency),
          String(daysUntil(filing.due_date)),
        ]),
      ];
      downloadCsv("due-horizon-filing-register.csv", rows);
      return;
    }

    if (option === "overdue") {
      const urgentRows = [...filings]
        .filter((filing) => {
          const days = daysUntil(filing.due_date);
          return filing.status !== "filed" && (days < 0 || days <= 7);
        })
        .sort((a, b) => a.due_date.localeCompare(b.due_date));

      const rows: string[][] = [
        ["Filing Name", "Due Date", "Status", "Jurisdiction", "Frequency", "Days Until"],
        ...urgentRows.map((filing) => [
          filing.filing_name,
          filing.due_date,
          formatStatus(filing.status, filing.due_date),
          filing.jurisdiction || "Unspecified",
          formatFrequency(filing.frequency),
          String(daysUntil(filing.due_date)),
        ]),
      ];
      downloadCsv("due-horizon-overdue-and-risk-report.csv", rows);
      return;
    }

    const summaryRows: string[][] = [
      ["Metric", "Value"],
      ["Workspace", summary.workspaceName],
      ["Entities", String(summary.clientCount)],
      ["Total Filings", String(metrics.total)],
      ["Active Workload", String(metrics.active)],
      ["Filed", String(metrics.filed)],
      ["Ready to File", String(metrics.ready)],
      ["Due Soon", String(metrics.dueSoon)],
      ["Overdue", String(metrics.overdue)],
      ["Completion Rate", `${metrics.completionRate}%`],
      ["Current Window", previousMetrics.currentWindowLabel],
      ["Previous Window", previousMetrics.previousWindowLabel],
      ["Volume Delta", String(previousMetrics.totalDelta)],
      ["Overdue Delta", String(previousMetrics.overdueDelta)],
      ["Completion Delta", `${previousMetrics.completionDelta}%`],
      ["", ""],
      ["Filing Mix by Frequency", ""],
      ...byFrequency.map(([label, count]) => [label, String(count)]),
      ["", ""],
      ["Filing Mix by Jurisdiction", ""],
      ...byJurisdiction.map(([label, count]) => [label, String(count)]),
      ["", ""],
      ["Volume by Month", ""],
      ...filingsByMonth.map(([label, count]) => [label, String(count)]),
    ];
    downloadCsv("due-horizon-workload-summary.csv", summaryRows);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-6">
        <div className="rounded-[28px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_50px_rgba(34,211,238,0.06)] sm:p-4">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(7,17,31,0.94),rgba(2,6,23,0.98))]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%)] px-4 py-5 sm:px-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                    Reporting
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Reports</div>
                  <div className="mt-2 text-sm leading-7 text-slate-400">
                    Trends, workload concentration, and completion insight across your compliance operation. This page
                    is built to explain the business, not just restate statuses.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <TopNavLink href="/dashboard" label="Dashboard" pathname={pathname} icon={<LayoutDashboard size={15} />} />
                  <TopNavLink href="/filings" label="Filings" pathname={pathname} icon={<FileBarChart2 size={15} />} />
                  <TopNavLink href="/calendar" label="Calendar" pathname={pathname} icon={<CalendarRange size={15} />} />
                  <TopNavLink href="/reports" label="Reports" pathname={pathname} icon={<BarChart3 size={15} />} />
                </div>
              </div>
            </div>

            <div className="px-4 py-6 sm:px-6">
              <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">REPORTING OVERVIEW</div>
                  <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Reports that explain the operation, not just the queue
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    Use this page to understand completion rate, workload pressure, filing mix, and where future volume is building.
                  </div>
                </div>

                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <Download size={15} />
                    Export Report
                    <ChevronDown size={15} />
                  </button>

                  {exportMenuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
                      <ExportOptionButton
                        title="Filing Register"
                        subtitle="Full filing-level export"
                        onClick={() => handleExport("register")}
                      />
                      <ExportOptionButton
                        title="Overdue & Risk Report"
                        subtitle="Overdue plus next 7 days"
                        onClick={() => handleExport("overdue")}
                      />
                      <ExportOptionButton
                        title="Workload Summary"
                        subtitle="Metrics, mix, and monthly volume"
                        onClick={() => handleExport("summary")}
                      />
                    </div>
                  )}
                </div>
              </div>

              <InsightBanner
                title={headlineInsight.title}
                body={headlineInsight.body}
                tone={headlineInsight.tone}
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <HeroStatCard
                  label="Completion Rate"
                  value={`${metrics.completionRate}%`}
                  helper={completionNarrative}
                  icon={<CheckCircle2 size={18} />}
                />
                <HeroStatCard
                  label="Active Workload"
                  value={String(metrics.active)}
                  helper="Filings that still require action"
                  icon={<FileBarChart2 size={18} />}
                />
                <HeroStatCard
                  label="Peak Month"
                  value={highestMonth ? highestMonth.label : "—"}
                  helper={highestMonth ? `${highestMonth.value} filings due` : "No data yet"}
                  icon={<TrendingUp size={18} />}
                />
                <HeroStatCard
                  label="Workspace"
                  value={summary.workspaceName}
                  helper={
                    summary.workspaceType === "accounting_firm"
                      ? `${summary.clientCount} tracked clients`
                      : `${summary.clientCount} tracked organizations`
                  }
                  icon={<PieChart size={18} />}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Total filings" value={String(metrics.total)} accent="cyan" />
                <MetricCard label="Filed" value={String(metrics.filed)} accent="green" />
                <MetricCard label="Ready" value={String(metrics.ready)} accent="blue" />
                <MetricCard label="Due soon" value={String(metrics.dueSoon)} accent="yellow" />
                <MetricCard label="Overdue" value={String(metrics.overdue)} accent="red" />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-3">
                <TrendCard
                  label="Volume vs Prior 30 Days"
                  current={`${previousMetrics.currentTotal}`}
                  delta={previousMetrics.totalDelta}
                  positiveIsGood={false}
                  helper={`${previousMetrics.currentWindowLabel} vs ${previousMetrics.previousWindowLabel}`}
                />
                <TrendCard
                  label="Overdue vs Prior 30 Days"
                  current={`${previousMetrics.currentOverdue}`}
                  delta={previousMetrics.overdueDelta}
                  positiveIsGood={false}
                  helper={`${previousMetrics.currentWindowLabel} vs ${previousMetrics.previousWindowLabel}`}
                />
                <TrendCard
                  label="Completion Rate vs Prior 30 Days"
                  current={`${previousMetrics.currentCompletionRate}%`}
                  delta={previousMetrics.completionDelta}
                  positiveIsGood={true}
                  helper={`${previousMetrics.currentWindowLabel} vs ${previousMetrics.previousWindowLabel}`}
                />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.14)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold text-white">Volume over time</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Filing volume by due month so you can spot heavy periods instead of reacting late.
                      </div>
                    </div>
                    <Link
                      href="/calendar"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                    >
                      View Calendar
                    </Link>
                  </div>

                  <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.05] px-4 py-3 text-sm text-slate-300">
                    {volumeInsight}
                  </div>

                  {loading ? (
                    <LoadingCard text="Loading report trends..." />
                  ) : filingsByMonth.length === 0 ? (
                    <EmptyCard text="No filing trend data yet." />
                  ) : (
                    <div className="mt-6 space-y-4">
                      {filingsByMonth.map(([label, count]) => {
                        const max = Math.max(...filingsByMonth.map((item) => item[1]), 1);
                        const width = `${Math.max((count / max) * 100, 8)}%`;

                        return (
                          <div key={label}>
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="text-slate-300">{label}</span>
                              <span className="text-white">{count}</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                                style={{ width }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.14)]">
                  <div className="text-lg font-semibold text-white">Oldest outstanding filings</div>
                  <div className="mt-1 text-sm text-slate-400">
                    A simple aging-style view of the next unresolved work in the queue.
                  </div>

                  {loading ? (
                    <LoadingCard text="Loading outstanding filings..." />
                  ) : oldestOutstanding.length === 0 ? (
                    <EmptyCard text="No active filings right now." />
                  ) : (
                    <div className="mt-6 space-y-3">
                      {oldestOutstanding.map((filing) => (
                        <div key={filing.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">{filing.filing_name}</div>
                              <div className="mt-1 text-sm text-slate-400">
                                {formatFriendlyDate(filing.due_date)} • {filing.jurisdiction || "—"} •{" "}
                                {formatFrequency(filing.frequency)}
                              </div>
                              <div className="mt-2 text-sm text-slate-300">
                                {formatStatus(filing.status, filing.due_date)}
                              </div>
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-slate-300">
                              {daysUntil(filing.due_date) < 0
                                ? `${Math.abs(daysUntil(filing.due_date))}d late`
                                : daysUntil(filing.due_date) === 0
                                  ? "Today"
                                  : `${daysUntil(filing.due_date)}d`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <ReportTableCard
                  title="Filing mix by frequency"
                  subtitle="See where recurring workload is concentrated."
                  insight={frequencyInsight}
                  loading={loading}
                  rows={byFrequency.map(([label, count]) => ({ label, value: String(count) }))}
                />
                <ReportTableCard
                  title="Filing mix by jurisdiction"
                  subtitle="See which states or jurisdictions drive the most volume."
                  insight={jurisdictionInsight}
                  loading={loading}
                  rows={byJurisdiction.map(([label, count]) => ({ label, value: String(count) }))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TopNavLink({
  href,
  label,
  pathname,
  icon,
}: {
  href: string;
  label: string;
  pathname: string;
  icon: React.ReactNode;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition ${
        active
          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function ExportOptionButton({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05]"
    >
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      </div>
      <Download size={14} className="mt-0.5 text-slate-400" />
    </button>
  );
}

function InsightBanner({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "red" | "yellow" | "green" | "cyan";
}) {
  const toneMap = {
    red: "border-red-400/20 bg-[linear-gradient(135deg,rgba(127,29,29,0.20),rgba(69,10,10,0.05))]",
    yellow: "border-yellow-300/20 bg-[linear-gradient(135deg,rgba(202,138,4,0.18),rgba(120,53,15,0.05))]",
    green: "border-emerald-400/20 bg-[linear-gradient(135deg,rgba(6,78,59,0.18),rgba(4,47,46,0.05))]",
    cyan: "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.18),rgba(15,23,42,0.05))]",
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] ${toneMap}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-cyan-200">
          <AlertTriangle size={18} />
        </div>
        <div>
          <div className="text-lg font-semibold text-white">{title}</div>
          <div className="mt-2 text-sm leading-7 text-slate-300">{body}</div>
        </div>
      </div>
    </div>
  );
}

function HeroStatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm leading-6 text-slate-400">{helper}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-cyan-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "cyan" | "red" | "yellow" | "green" | "blue";
}) {
  const accentMap = {
    cyan: "border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.05))]",
    red: "border-red-400/15 bg-[linear-gradient(180deg,rgba(127,29,29,0.18),rgba(69,10,10,0.05))]",
    yellow: "border-yellow-300/15 bg-[linear-gradient(180deg,rgba(202,138,4,0.16),rgba(120,53,15,0.05))]",
    green: "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(4,47,46,0.05))]",
    blue: "border-blue-400/15 bg-[linear-gradient(180deg,rgba(30,58,138,0.16),rgba(15,23,42,0.05))]",
  }[accent];

  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] ${accentMap}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TrendCard({
  label,
  current,
  delta,
  positiveIsGood,
  helper,
}: {
  label: string;
  current: string;
  delta: number;
  positiveIsGood: boolean;
  helper: string;
}) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  const goodDirection = positiveIsGood ? isPositive : delta < 0;

  const badgeClass = isNeutral
    ? "border-white/10 bg-white/5 text-slate-300"
    : goodDirection
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : "border-red-400/20 bg-red-500/10 text-red-200";

  const deltaLabel = isNeutral ? "No change" : `${delta > 0 ? "+" : ""}${delta}`;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold text-white">{current}</div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${badgeClass}`}>
          {deltaLabel}
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function ReportTableCard({
  title,
  subtitle,
  insight,
  rows,
  loading,
}: {
  title: string;
  subtitle: string;
  insight: string;
  rows: { label: string; value: string }[];
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.14)]">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
      <div className="mt-3 rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.05] px-4 py-3 text-sm text-slate-300">
        {insight}
      </div>

      {loading ? (
        <LoadingCard text="Loading report table..." />
      ) : rows.length === 0 ? (
        <EmptyCard text="No data yet." />
      ) : (
        <div className="mt-6 space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm"
            >
              <span className="text-slate-300">{row.label}</span>
              <span className="text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-sm text-slate-400">
      {text}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-sm text-slate-400">
      {text}
    </div>
  );
}
