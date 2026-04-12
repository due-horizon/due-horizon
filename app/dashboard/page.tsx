"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  Settings,
  UserPlus,
  Users,
} from "lucide-react";

type FilingStatus = "upcoming" | "in_progress" | "filed" | "overdue" | "not_applicable";
type DashboardBucket = "OVERDUE" | "DUE SOON" | "READY TO FILE" | "UPCOMING" | "FILED";
type AlertTone = "red" | "yellow" | "green";
type MemberRole = "owner" | "admin" | "member" | "unknown";

type DbFiling = {
  id: string;
  filing_name: string;
  filing_code: string | null;
  jurisdiction: string | null;
  frequency: string | null;
  due_date: string;
  status: FilingStatus;
  priority: "low" | "medium" | "high";
  client_id: string | null;
  organization_id: string | null;
};

type Filing = {
  id: string;
  dbStatus: FilingStatus;
  bucket: DashboardBucket;
  title: string;
  company: string;
  subtitle: string;
  subtitleClass: string;
  icon: string;
  iconClass: string;
  primaryAction: string;
  primaryClass: string;
};

type WorkspaceSummary = {
  workspaceName: string;
  workspaceType: "accounting_firm" | "business_owner" | "unknown";
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  firmId: string | null;
  entityCount: number;
};

type MissingCoverageSummary = {
  entitiesWithoutFilings: number;
  entitiesWithFilings: number;
  message: string;
};

function formatPlanLabel(plan: string) {
  if (!plan) return "Starter";
  return plan
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function daysUntil(dateStr: string) {
  const today = new Date();
  const due = new Date(dateStr);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  return Math.round((dueUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function formatDaysSubtitle(days: number) {
  if (days < 0) return `Past Due: ${Math.abs(days)} Day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due Today";
  return `Due in ${days} Day${days === 1 ? "" : "s"}`;
}

function mapDbStatusToBucket(status: FilingStatus, dueDate: string): DashboardBucket {
  if (status === "filed") return "FILED";
  if (status === "in_progress") return "READY TO FILE";
  if (status === "overdue") return "OVERDUE";

  const days = daysUntil(dueDate);
  if (days < 0) return "OVERDUE";
  if (days <= 7) return "DUE SOON";
  return "UPCOMING";
}

function getDashboardPresentation(bucket: DashboardBucket) {
  switch (bucket) {
    case "OVERDUE":
      return {
        subtitleClass: "text-red-400",
        icon: "!",
        iconClass: "bg-red-500/15 text-red-400 border border-red-400/20",
        primaryAction: "Mark Filed",
        primaryClass:
          "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:to-blue-400",
      };
    case "DUE SOON":
      return {
        subtitleClass: "text-yellow-400",
        icon: "◔",
        iconClass: "bg-yellow-500/15 text-yellow-400 border border-yellow-400/20",
        primaryAction: "Mark Ready",
        primaryClass:
          "bg-yellow-400/15 text-yellow-300 border border-yellow-300/20 hover:bg-yellow-400/25",
      };
    case "READY TO FILE":
      return {
        subtitleClass: "text-emerald-400",
        icon: "✓",
        iconClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20",
        primaryAction: "Mark Filed",
        primaryClass:
          "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:to-blue-400",
      };
    case "UPCOMING":
      return {
        subtitleClass: "text-blue-400",
        icon: "→",
        iconClass: "bg-blue-500/15 text-blue-400 border border-blue-400/20",
        primaryAction: "Prepare",
        primaryClass: "bg-white/5 text-white border border-white/10 hover:bg-white/10",
      };
    case "FILED":
      return {
        subtitleClass: "text-slate-400",
        icon: "✓",
        iconClass: "bg-slate-500/10 text-slate-200 border border-white/10",
        primaryAction: "Filed",
        primaryClass: "bg-emerald-500/10 text-emerald-300 border border-emerald-400/20",
      };
  }
}

function buildDashboardFiling(filing: DbFiling, nameMap: Map<string, string>): Filing {
  const bucket = mapDbStatusToBucket(filing.status, filing.due_date);
  const ui = getDashboardPresentation(bucket);
  const entityName =
    (filing.client_id && nameMap.get(filing.client_id)) ||
    (filing.organization_id && nameMap.get(filing.organization_id)) ||
    "Workspace";

  const dayText = formatDaysSubtitle(daysUntil(filing.due_date));
  const subtitle =
    bucket === "READY TO FILE"
      ? "Prepared and ready to submit"
      : bucket === "FILED"
      ? "Filed successfully"
      : dayText;

  return {
    id: filing.id,
    dbStatus: filing.status,
    bucket,
    title: filing.filing_name,
    company: entityName,
    subtitle,
    subtitleClass: ui.subtitleClass,
    icon: ui.icon,
    iconClass: ui.iconClass,
    primaryAction: ui.primaryAction,
    primaryClass: ui.primaryClass,
  };
}

export default function DashboardPage() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const alertsRef = useRef<HTMLDivElement | null>(null);

  const [filings, setFilings] = useState<Filing[]>([]);
  const [workspaceSummary, setWorkspaceSummary] = useState<WorkspaceSummary>({
    workspaceName: "",
    workspaceType: "unknown",
    plan: "starter",
    subscriptionStatus: "inactive",
    stripeCustomerId: null,
    firmId: null,
    entityCount: 0,
  });
  const [userInitials, setUserInitials] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [memberRole, setMemberRole] = useState<MemberRole>("unknown");

  const businessNavLabel = workspaceSummary.workspaceType === "accounting_firm" ? "Clients" : "Businesses";
  const canManageTeam = memberRole === "owner" || memberRole === "admin";
  const formattedPlan = formatPlanLabel(workspaceSummary.plan);

  useEffect(() => {
    const saved = window.localStorage.getItem("dh-sidebar-collapsed");
    setIsSidebarCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("dh-sidebar-collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }

      if (alertsRef.current && !alertsRef.current.contains(target)) {
        setIsAlertsOpen(false);
      }

      if (!target.closest('[data-menu-root="true"]')) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function resolveFirmId(userId: string, preferredFirmId?: string | null) {
    const { data: memberships, error } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to resolve firm membership:", error);
      return preferredFirmId || null;
    }

    if (!memberships?.length) {
      return preferredFirmId || null;
    }

    const membershipIds = memberships.map((membership) => membership.firm_id);

    if (preferredFirmId && membershipIds.includes(preferredFirmId)) {
      return preferredFirmId;
    }

    return membershipIds[0] ?? null;
  }

  async function loadDashboard() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }


    const nameFromUser =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "";

    const initials = String(nameFromUser)
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    setUserInitials(initials || "");

    const resolvedWorkspaceId = await resolveFirmId(
      user.id,
      typeof user.user_metadata?.firm_id === "string"
        ? user.user_metadata.firm_id
        : typeof user.user_metadata?.workspace_id === "string"
          ? user.user_metadata.workspace_id
          : null
    );

    if (!resolvedWorkspaceId) {
      setFilings([]);
      setLoading(false);
      return;
    }

    const [
      { data: membership },
      { data: workspace },
      { data: firmBilling },
      { data: clients },
      { data: organizations },
      { data: filingsData, error: filingsError },
    ] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("member_role, role")
        .eq("workspace_id", resolvedWorkspaceId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("workspaces")
        .select("id, name, workspace_type")
        .eq("id", resolvedWorkspaceId)
        .single(),
      supabase
        .from("firms")
        .select("id, plan, subscription_status, stripe_customer_id, type")
        .eq("id", resolvedWorkspaceId)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("id, client_name")
        .eq("workspace_id", resolvedWorkspaceId),
      supabase
        .from("organizations")
        .select("id, legal_name, display_name")
        .eq("workspace_id", resolvedWorkspaceId),
      supabase
        .from("filings")
        .select("id, filing_name, filing_code, jurisdiction, frequency, due_date, status, priority, client_id, organization_id")
        .or(`workspace_id.eq.${resolvedWorkspaceId},firm_id.eq.${resolvedWorkspaceId}`)
        .order("due_date", { ascending: true }),
    ]);

    if (filingsError) {
      console.error(filingsError);
      setFilings([]);
      setLoading(false);
      return;
    }

    const roleValue = String(membership?.member_role || membership?.role || "unknown").toLowerCase();
    setMemberRole(
      roleValue === "owner" || roleValue === "admin" || roleValue === "member"
        ? (roleValue as MemberRole)
        : "unknown"
    );

    const nameMap = new Map<string, string>();
    (clients || []).forEach((client) => nameMap.set(client.id, client.client_name));
    (organizations || []).forEach((org) => nameMap.set(org.id, org.display_name || org.legal_name));

    const mapped = ((filingsData || []) as DbFiling[]).map((filing) =>
      buildDashboardFiling(filing, nameMap)
    );

    setFilings(mapped);
    const resolvedWorkspaceType =
      (firmBilling?.type as "accounting_firm" | "business_owner" | "unknown" | undefined) ||
      workspace?.workspace_type ||
      "unknown";

    setWorkspaceSummary({
      workspaceName: workspace?.name || "",
      workspaceType: resolvedWorkspaceType,
      plan:
        (typeof firmBilling?.plan === "string" && firmBilling.plan) ||
        (typeof user.user_metadata?.plan === "string" && user.user_metadata.plan) ||
        "starter",
      subscriptionStatus:
        (typeof firmBilling?.subscription_status === "string" && firmBilling.subscription_status) ||
        "inactive",
      stripeCustomerId:
        typeof firmBilling?.stripe_customer_id === "string" ? firmBilling.stripe_customer_id : null,
      firmId: resolvedWorkspaceId,
      entityCount:
        resolvedWorkspaceType === "accounting_firm"
          ? (clients || []).length
          : (organizations || []).length,
    });
    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function updateFilingStatus(id: string, nextStatus: FilingStatus) {
    const { error } = await supabase.from("filings").update({ status: nextStatus }).eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    await loadDashboard();
    setOpenMenuId(null);
  }

  async function handlePrimaryAction(filing: Filing) {
    if (filing.bucket === "OVERDUE" || filing.bucket === "READY TO FILE") {
      await updateFilingStatus(filing.id, "filed");
      return;
    }

    if (filing.bucket === "DUE SOON" || filing.bucket === "UPCOMING") {
      await updateFilingStatus(filing.id, "in_progress");
    }
  }

  async function markUnfiled(id: string) {
    await updateFilingStatus(id, "upcoming");
  }

  function handleMarkAllAlertsRead() {
    setIsAlertsOpen(false);
  }

  const alerts: { title: string; subtitle: string; tone: AlertTone }[] = useMemo(() => {
    const activeFilings = filings.filter((f) => f.bucket !== "FILED");

    const overdueAlerts = activeFilings
      .filter((f) => f.bucket === "OVERDUE")
      .map((f) => ({
        title: f.title,
        subtitle: `${f.company} • ${f.subtitle}`,
        tone: "red" as AlertTone,
      }));

    const dueSoonAlerts = activeFilings
      .filter((f) => f.bucket === "DUE SOON")
      .map((f) => ({
        title: f.title,
        subtitle: `${f.company} • ${f.subtitle}`,
        tone: "yellow" as AlertTone,
      }));

    const readyAlerts = activeFilings
      .filter((f) => f.bucket === "READY TO FILE")
      .map((f) => ({
        title: f.title,
        subtitle: `${f.company} • Ready to submit`,
        tone: "green" as AlertTone,
      }));

    return [...overdueAlerts, ...dueSoonAlerts, ...readyAlerts].slice(0, 6);
  }, [filings]);

  const activeFilings = filings.filter((f) => f.bucket !== "FILED");
  const filedFilings = filings.filter((f) => f.bucket === "FILED");

  const attentionCount = filings.filter(
    (f) => f.bucket === "OVERDUE" || f.bucket === "DUE SOON"
  ).length;

  const dueSoonCount = filings.filter((f) => f.bucket === "DUE SOON").length;
  const readyCount = filings.filter((f) => f.bucket === "READY TO FILE").length;
  const upcomingCount = filings.filter((f) => f.bucket === "UPCOMING").length;
  const overdueCount = filings.filter((f) => f.bucket === "OVERDUE").length;

  const topPriority =
    activeFilings.find((f) => f.bucket === "OVERDUE") ??
    activeFilings.find((f) => f.bucket === "DUE SOON") ??
    activeFilings.find((f) => f.bucket === "READY TO FILE") ??
    activeFilings.find((f) => f.bucket === "UPCOMING") ??
    null;

  const nextUpcoming = filings.find((f) => f.bucket === "UPCOMING") ?? null;

  const workspaceSummaryCards = [
    {
      label: "Entities",
      value: String(workspaceSummary.entityCount),
      helper: workspaceSummary.workspaceType === "accounting_firm" ? "Across clients" : "Tracked in workspace",
    },
    {
      label: "Attention",
      value: String(attentionCount),
      helper: attentionCount === 0 ? "All clear" : "Needs action now",
    },
    {
      label: "Next due",
      value: nextUpcoming ? nextUpcoming.subtitle.replace("Due in ", "") : "—",
      helper: nextUpcoming ? nextUpcoming.title : "No future filings yet",
    },
  ];

  const filingCoverageSummary: MissingCoverageSummary = useMemo(() => {
    const coveredEntities = new Set(
      filings
        .map((filing) => filing.company)
        .filter((company) => company && company !== "Workspace")
    );

    const entitiesWithFilings = coveredEntities.size;
    const entitiesWithoutFilings = Math.max(workspaceSummary.entityCount - entitiesWithFilings, 0);

    return {
      entitiesWithoutFilings,
      entitiesWithFilings,
      message:
        entitiesWithoutFilings > 0
          ? `${entitiesWithoutFilings} ${entitiesWithoutFilings === 1 ? "entity appears" : "entities appear"} to be missing filing coverage.`
          : "No obvious filing coverage gaps detected from the current filing list.",
    };
  }, [filings, workspaceSummary.entityCount]);

  const prioritizedActionItems = [
    ...filings.filter((f) => f.bucket === "OVERDUE").slice(0, 3),
    ...filings.filter((f) => f.bucket === "DUE SOON").slice(0, 3),
    ...filings.filter((f) => f.bucket === "READY TO FILE").slice(0, 3),
  ];

  const topCardStyle = topPriority ? getTopCardStyle(topPriority.bucket) : null;

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
                    <SidebarNavItem
                      href="/dashboard"
                      label="Dashboard"
                      icon={LayoutDashboard}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                      badge={attentionCount > 0 ? String(attentionCount) : undefined}
                    />
                    <SidebarNavItem
                      href="/filings"
                      label="Filings"
                      icon={FileText}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarNavItem
                      href="/calendar"
                      label="Calendar"
                      icon={Calendar}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarNavItem
                      href="/reports"
                      label="Reports"
                      icon={CheckCircle2}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                    <SidebarNavItem
                      href="/businesses"
                      label={businessNavLabel}
                      icon={Building2}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                    {canManageTeam && (
                      <SidebarNavItem
                        href="/team"
                        label="Team"
                        icon={Users}
                        pathname={pathname}
                        collapsed={isSidebarCollapsed}
                        badge={memberRole === "owner" ? "Owner" : "Admin"}
                      />
                    )}
                    <SidebarNavItem
                      href="/settings"
                      label="Settings"
                      icon={Settings}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                    />
                  </nav>

                  {!isSidebarCollapsed && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(15,23,42,0.4))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                            WORKSPACE
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">{workspaceSummary.workspaceName || "Your Workspace"}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {formattedPlan} Plan • {workspaceSummary.workspaceType === "accounting_firm" ? "Accounting firm" : workspaceSummary.workspaceType === "business_owner" ? "Business" : "Workspace"}
                          </div>
                        </div>
                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                          Live
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {workspaceSummaryCards.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-300">{item.label}</div>
                              <div className="mt-1 truncate text-[11px] text-slate-500">{item.helper}</div>
                            </div>
                            <div className="ml-4 text-sm font-semibold text-white">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${isSidebarCollapsed ? "p-3" : "p-4"} border-t border-white/10`}>
                  {!isSidebarCollapsed ? (
                    <div className="rounded-2xl border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                      <div className="text-sm font-semibold text-white">Need attention</div>
                      <div className="mt-1 text-xs leading-5 text-slate-300">
                        {attentionCount === 0
                          ? "You’re in a good spot right now."
                          : `${attentionCount} filing${attentionCount === 1 ? "" : "s"} need action.`}
                      </div>
                      <Link
                        href="/filings"
                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400"
                      >
                        Open Filings
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href="/filings"
                      className="flex h-12 w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/15"
                      title="Open Filings"
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
                          <div className="text-xs text-slate-400">Compliance OS</div>
                        </div>
                      </div>

                      <div className="hidden lg:block">
                        <div className="text-xs font-semibold tracking-[0.18em] text-cyan-300/80">
                          DASHBOARD
                        </div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                          Focus here — <span className="text-cyan-300">{attentionCount}</span>{" "}
                          {attentionCount === 1 ? "filing needs action" : "filings need action"}
                        </h1>
                        <p className="mt-2 text-slate-400">
                          Start with the highest-risk item, then work down your queue.
                        </p>
                        <div className="mt-2 text-sm text-slate-500">
                          {overdueCount} at risk • {dueSoonCount} due next • {readyCount} ready to file
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
                      {canManageTeam && (
                        <Link
                          href="/team"
                          className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                        >
                          <UserPlus size={16} />
                          Invite
                        </Link>
                      )}

                      <Link
                        href="/filings"
                        className="hidden sm:inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        View All Filings →
                      </Link>

                      <div className="relative" ref={alertsRef}>
                        <button
                          type="button"
                          onClick={() => setIsAlertsOpen((prev) => !prev)}
                          className={`relative flex h-10 w-10 items-center justify-center rounded-xl border text-sm text-slate-200 transition ${
                            isAlertsOpen
                              ? "border-cyan-300/40 bg-white/10 shadow-[0_0_18px_rgba(34,211,238,0.14)]"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <Bell size={18} className="text-slate-300" />

                          {alerts.length > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white/10 bg-slate-700 px-1 text-[9px] font-semibold text-white">
                              {alerts.length}
                            </span>
                          )}
                        </button>

                        {isAlertsOpen && (
                          <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                              <div>
                                <div className="text-sm font-semibold text-white">Alerts</div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {alerts.length} items need attention
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleMarkAllAlertsRead}
                                className="text-xs text-cyan-300 hover:text-cyan-200"
                              >
                                Mark all read
                              </button>
                            </div>

                            <div className="py-2">
                              {alerts.length > 0 ? (
                                alerts.map((alert, index) => (
                                  <AlertItem
                                    key={`${alert.title}-${index}`}
                                    title={alert.title}
                                    subtitle={alert.subtitle}
                                    tone={alert.tone}
                                  />
                                ))
                              ) : (
                                <div className="px-4 py-6 text-sm text-slate-400">
                                  No active alerts right now.
                                </div>
                              )}
                            </div>

                            <div className="border-t border-white/10 p-3">
                              <Link
                                href="/filings"
                                className="block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/10"
                              >
                                View all alerts
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="relative" ref={profileRef}>
                        <button
                          type="button"
                          onClick={() => setIsProfileOpen((prev) => !prev)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition hover:scale-[1.02] ${
                            isProfileOpen
                              ? "border-cyan-300/40 bg-white/10 shadow-[0_0_18px_rgba(34,211,238,0.14)]"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-semibold text-slate-950">
                            {userInitials}
                          </div>
                          <div className="hidden text-left leading-tight sm:block">
                            <div className="text-sm font-semibold">{userInitials}</div>
                            <div className="text-xs text-slate-400">{workspaceSummary.workspaceName || "Your Workspace"}</div>
                          </div>
                          <div className={`text-xs text-slate-400 transition ${isProfileOpen ? "rotate-180" : ""}`}>
                            ⌄
                          </div>
                        </button>

                        {isProfileOpen && (
                          <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <div className="border-b border-white/10 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-semibold text-slate-950">
                                  {userInitials}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-white">{workspaceSummary.workspaceName || "Your Workspace"}</div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {workspaceSummary.workspaceType === "accounting_firm"
                                      ? "Accounting firm"
                                      : workspaceSummary.workspaceType === "business_owner"
                                      ? "Business"
                                      : "Workspace"} • {memberRole !== "unknown" ? memberRole : "owner"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="py-2">
                              {canManageTeam && (
                                <DropdownItem href="/team" label="Team" icon={<Users size={15} />} />
                              )}
                              <DropdownItem href="/settings" label="Account Settings" icon={<Settings size={15} />} />
                            </div>

                            <div className="mx-3 h-px bg-white/10" />

                            <div className="py-2">
                              <DropdownItem href="/support" label="Help & Support" icon={<LifeBuoy size={15} />} />
                              <DropdownItem href="/logout" label="Logout" icon={<LogOut size={15} />} danger />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                    <MobileNavPill href="/dashboard" label="Dashboard" pathname={pathname} />
                    <MobileNavPill href="/filings" label="Filings" pathname={pathname} />
                    <MobileNavPill href="/calendar" label="Calendar" pathname={pathname} />
                    <MobileNavPill href="/reports" label="Reports" pathname={pathname} />
                    <MobileNavPill href="/businesses" label={businessNavLabel} pathname={pathname} />
                    {canManageTeam && <MobileNavPill href="/team" label="Team" pathname={pathname} />}
                    <MobileNavPill href="/settings" label="Settings" pathname={pathname} />
                  </div>

                  <div className="mt-4 lg:hidden">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      Focus here — <span className="text-cyan-300">{attentionCount}</span>{" "}
                      {attentionCount === 1 ? "filing needs action" : "filings need action"}
                    </h1>
                    <p className="mt-2 text-slate-400">
                      Start with the highest-risk item, then work down your queue.
                    </p>
                    <div className="mt-2 text-sm text-slate-500">
                      {overdueCount} at risk • {dueSoonCount} due next • {readyCount} ready to file
                    </div>
                  </div>
                </div>

                <div className="overflow-visible px-4 py-6 sm:px-6 sm:py-8">
                  <div className="mx-auto max-w-[1240px]">
                    <div className="mb-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>Plan</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">{formattedPlan}</span>
                      {canManageTeam && (
                        <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2 py-1 text-cyan-200">
                          {memberRole}
                        </span>
                      )}
                    </div>

                    <div className="grid items-stretch gap-8 md:grid-cols-2 xl:grid-cols-4">
                      <Link href="/filings?status=OVERDUE" className="block xl:scale-[1.04]">
                        <StatCard
                          label="AT RISK"
                          value={String(overdueCount)}
                          sub="Require immediate action"
                          icon={<AlertTriangle size={19} />}
                          accent="red"
                        />
                      </Link>

                      <Link href="/filings?status=DUE%20SOON" className="block transition-all duration-200 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                        <StatCard
                          label="DUE NEXT"
                          value={String(dueSoonCount)}
                          sub="Within 7 days"
                          icon={<Calendar size={19} />}
                          accent="yellow"
                        />
                      </Link>

                      <Link href="/filings?status=READY%20TO%20FILE" className="block transition-all duration-200 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                        <StatCard
                          label="READY"
                          value={String(readyCount)}
                          sub="Prepared and awaiting submission"
                          icon={<CheckCircle2 size={19} />}
                          accent="green"
                        />
                      </Link>

                      <Link href="/filings?status=UPCOMING" className="block transition-all duration-200 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                        <StatCard
                          label="LATER"
                          value={String(upcomingCount)}
                          sub="Future deadlines to watch"
                          icon={<ArrowRight size={19} />}
                          accent="blue"
                        />
                      </Link>
                    </div>

                    {!loading && (
                      <div className="mt-8 overflow-hidden rounded-[28px] border border-violet-400/15 bg-[linear-gradient(135deg,rgba(91,33,182,0.18),rgba(30,41,59,0.08),rgba(0,0,0,0))] shadow-[0_0_0_1px_rgba(168,85,247,0.05),0_20px_50px_rgba(91,33,182,0.12)]">
                        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.35fr)_260px]">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-[11px] font-semibold tracking-[0.18em] text-violet-200/80">
                                MISSING FILINGS DETECTED
                              </div>
                              <div className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-violet-200">
                                COVERAGE CHECK
                              </div>
                            </div>

                            <div className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                              {filingCoverageSummary.entitiesWithoutFilings > 0
                                ? `${filingCoverageSummary.entitiesWithoutFilings} ${filingCoverageSummary.entitiesWithoutFilings === 1 ? "entity may be missing filings" : "entities may be missing filings"}`
                                : "No obvious missing filing coverage"}
                            </div>

                            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                              {filingCoverageSummary.message} Use this as a fast dashboard signal, then confirm setup and missing compliance work from the filings page.
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                                {filingCoverageSummary.entitiesWithFilings} entities with filings
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                                {filingCoverageSummary.entitiesWithoutFilings} entities without visible filings
                              </span>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                              NEXT STEP
                            </div>

                            <div className="mt-4 space-y-3">
                              <PriorityMiniStat
                                label="Coverage"
                                value={
                                  filingCoverageSummary.entitiesWithoutFilings > 0
                                    ? "Needs review"
                                    : "Looks healthy"
                                }
                              />
                              <PriorityMiniStat
                                label="Entities"
                                value={`${filingCoverageSummary.entitiesWithFilings}/${workspaceSummary.entityCount || 0} tracked`}
                              />
                            </div>

                            <div className="mt-5 flex flex-col gap-3">
                              <Link
                                href="/filings"
                                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                              >
                                Review Filings
                              </Link>
                              <Link
                                href="/businesses"
                                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-400 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(168,85,247,0.18)] transition-all duration-150 hover:scale-[1.02] hover:from-violet-300 hover:to-cyan-300 active:scale-[0.98]"
                              >
                                Check Entity Setup
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {loading && (
                      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-400">
                        Loading your workspace...
                      </div>
                    )}

                    {!loading && topPriority && topCardStyle && (
                      <div className={`mt-10 overflow-hidden rounded-[32px] shadow-[0_0_40px_rgba(34,211,238,0.18)] ${topCardStyle.wrapper}`}>
                        <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1.45fr)_340px] lg:p-9">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                                START HERE
                              </div>
                              <div className="rounded-full border border-yellow-300/20 bg-yellow-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-yellow-300">
                                DO THIS NEXT
                              </div>
                            </div>

                            <div className="mt-5 flex items-start gap-4">
                              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border text-2xl ${topCardStyle.iconWrap}`}>
                                {topPriority.bucket === "OVERDUE"
                                  ? "⚠"
                                  : topPriority.bucket === "DUE SOON"
                                  ? "◔"
                                  : topPriority.bucket === "READY TO FILE"
                                  ? "✓"
                                  : "→"}
                              </div>

                              <div className="min-w-0">
                                <div className="text-3xl font-semibold tracking-tight text-white sm:text-[2.25rem]">
                                  {topPriority.title}
                                </div>
                                <div className="mt-2 text-sm text-slate-400 sm:text-base">{topPriority.company}</div>

                                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                                  <span className={topPriority.subtitleClass}>📅 {topPriority.subtitle}</span>
                                  <span className="text-slate-500">•</span>
                                  <span className="text-slate-300">
                                    {topPriority.bucket === "OVERDUE"
                                      ? "Penalty risk is highest here"
                                      : topPriority.bucket === "DUE SOON"
                                      ? "Best next action on the board"
                                      : topPriority.bucket === "READY TO FILE"
                                      ? "Prepared and ready to submit"
                                      : "Coming up next"}
                                  </span>
                                </div>
                                <div className="mt-3 inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-red-200">
                                  ⚠ HIGHEST RISK IF IGNORED
                                </div>

                                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                                  This is the filing most likely to create risk or require attention first. Use the dashboard to decide what to do next, then use the filings page for the full working list.
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">
                              PRIORITY SNAPSHOT
                            </div>

                            <div className="mt-4 grid gap-3">
                              <PriorityMiniStat label="Status" value={topPriority.bucket} />
                              <PriorityMiniStat label="Entity" value={topPriority.company} />
                              <PriorityMiniStat label="Timeline" value={topPriority.subtitle} />
                            </div>

                            <div className="mt-5 flex flex-col gap-3">
                              <Link
                                href="/filings"
                                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/10"
                              >
                                Open Filings
                              </Link>
                              <button
                                type="button"
                                onClick={() => handlePrimaryAction(topPriority)}
                                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition-all duration-150 hover:scale-[1.02] hover:from-cyan-300 hover:to-blue-400 active:scale-[0.98]"
                              >
                                {topPriority.primaryAction} →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {!loading && !topPriority && (
                      <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-400">
                        No filings yet. Finish onboarding or seed starter filings to populate the dashboard.
                      </div>
                    )}

                    <div className="mt-10 space-y-8">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-white">Work Queue</div>
                          <div className="mt-1 text-sm text-slate-400">
                            Work through these in order. This is your execution list.
                          </div>
                        </div>
                        <Link
                          href="/filings"
                          className="hidden sm:inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                        >
                          Open Full Filings →
                        </Link>
                      </div>

                      {prioritizedActionItems.length === 0 ? (
                        <div className="rounded-3xl border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(6,78,59,0.18),rgba(4,47,46,0.06),rgba(255,255,255,0.02))] px-6 py-6 shadow-[0_20px_60px_rgba(6,78,59,0.12)]">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/15 text-emerald-300">
                              <CheckCircle2 size={20} />
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-white">All clear</div>
                              <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                                Everything urgent is under control right now. Future deadlines stay on the filings page until they need attention.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                          <div className="border-b border-white/10 px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-sm font-semibold text-white">Prioritized queue</div>
                                <div className="mt-1 text-sm text-slate-400">
                                  Overdue first, then due soon, then ready to file.
                                </div>
                              </div>
                              <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-cyan-200">
                                {prioritizedActionItems.length} SHOWN
                              </div>
                            </div>
                          </div>

                          <div className="divide-y divide-white/5">
                            {prioritizedActionItems.map((row) => (
                              <div
                                key={row.id}
                                className="group relative flex flex-col gap-4 px-5 py-4 transition-all duration-200 hover:bg-white/[0.04] lg:flex-row lg:items-center lg:justify-between"
                              >
                                <div className="absolute left-0 top-0 h-full w-[2px] bg-cyan-400/40" />
                                <div className="flex min-w-0 items-start gap-4">
                                  <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${row.iconClass}`}>
                                    {row.icon}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <BucketPill bucket={row.bucket} />
                                      <div className="text-sm font-medium text-white sm:text-base">{row.title}</div>
                                    </div>

                                    <div className="mt-1 text-sm text-slate-400">{row.company}</div>
                                    <div className={`mt-2 text-sm ${row.subtitleClass}`}>{row.subtitle}</div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handlePrimaryAction(row)}
                                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${row.primaryClass}`}
                                  >
                                    {row.primaryAction}
                                  </button>

                                  <Link
                                    href="/filings"
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-150 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
                                  >
                                    View
                                  </Link>

                                  <RowActionMenu
                                    rowId={row.id}
                                    openMenuId={openMenuId}
                                    setOpenMenuId={setOpenMenuId}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setOpenMenuId(null)}
                                      className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                    >
                                      View details
                                    </button>

                                    {row.bucket === "DUE SOON" && (
                                      <button
                                        type="button"
                                        onClick={() => updateFilingStatus(row.id, "in_progress")}
                                        className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                      >
                                        Mark as Ready
                                      </button>
                                    )}

                                    {(row.bucket === "READY TO FILE" || row.bucket === "OVERDUE") && (
                                      <button
                                        type="button"
                                        onClick={() => updateFilingStatus(row.id, "filed")}
                                        className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                      >
                                        Mark as Filed
                                      </button>
                                    )}
                                  </RowActionMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {upcomingCount > 0 && (
                        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Coming Up</div>
                              <div className="mt-1 text-sm text-slate-400">
                                Not urgent yet — these will move into your queue soon.
                              </div>
                            </div>
                            <Link
                              href="/filings?status=UPCOMING"
                              className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                            >
                              View all upcoming →
                            </Link>
                          </div>

                          <div className="divide-y divide-white/5">
                            {filings
                              .filter((f) => f.bucket === "UPCOMING")
                              .slice(0, 3)
                              .map((row) => (
                                <div
                                  key={row.id}
                                  className="group relative flex flex-col gap-4 px-5 py-4 transition-all duration-200 hover:bg-white/[0.04] lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold ${row.iconClass}`}>
                                      {row.icon}
                                    </div>

                                    <div>
                                      <div className="text-sm font-medium text-white sm:text-base">
                                        {row.title} <span className="text-slate-400">— {row.company}</span>
                                      </div>
                                      <div className={`mt-1 text-sm ${row.subtitleClass}`}>{row.subtitle}</div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Link
                                      href="/filings"
                                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition-all duration-150 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
                                    >
                                      View
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => handlePrimaryAction(row)}
                                      className={`rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] ${row.primaryClass}`}
                                    >
                                      {row.primaryAction}
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {filedFilings.length > 0 && (
                      <div className="mt-10 overflow-visible rounded-3xl border border-white/10 bg-white/[0.02] opacity-80">
                        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                          <div className="text-sm font-semibold text-white">
                            Completed ({Math.min(filedFilings.length, 5)})
                          </div>
                          <div className="mt-1 text-sm text-slate-400">Recently completed work</div>
                        </div>

                        <div className="overflow-visible">
                          {filedFilings.slice(0, 5).map((row) => (
                            <div
                              key={row.id}
                              className="relative flex flex-col gap-4 overflow-visible border-t border-white/5 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                            >
                              <div className="flex items-start gap-4">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold ${row.iconClass}`}>
                                  {row.icon}
                                </div>

                                <div>
                                  <div className="text-sm font-medium text-white sm:text-base">
                                    {row.title} <span className="text-slate-400">— {row.company}</span>
                                  </div>
                                  <div className={`mt-1 text-sm ${row.subtitleClass}`}>{row.subtitle}</div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 overflow-visible">
                                <button
                                  type="button"
                                  className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300"
                                >
                                  Filed
                                </button>

                                <RowActionMenu
                                  rowId={row.id}
                                  openMenuId={openMenuId}
                                  setOpenMenuId={setOpenMenuId}
                                >
                                  <button
                                    type="button"
                                    onClick={() => markUnfiled(row.id)}
                                    className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                  >
                                    Mark as Unfiled
                                  </button>
                                </RowActionMenu>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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

function BucketPill({ bucket }: { bucket: DashboardBucket }) {
  const styles = {
    OVERDUE: "border-red-400/20 bg-red-500/10 text-red-200",
    "DUE SOON": "border-yellow-300/20 bg-yellow-400/10 text-yellow-200",
    "READY TO FILE": "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    UPCOMING: "border-blue-300/20 bg-blue-500/10 text-blue-200",
    FILED: "border-white/10 bg-white/5 text-slate-300",
  }[bucket];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${styles}`}>
      {bucket}
    </span>
  );
}

function PriorityMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function getTopCardStyle(status: DashboardBucket) {
  switch (status) {
    case "OVERDUE":
      return {
        wrapper:
          "border border-red-400/15 bg-[linear-gradient(135deg,rgba(127,29,29,0.18),rgba(69,10,10,0.08),rgba(0,0,0,0))] shadow-[0_0_0_1px_rgba(248,113,113,0.04),0_20px_50px_rgba(127,29,29,0.18)]",
        iconWrap: "border-red-400/20 bg-red-500/15 text-red-400",
      };
    case "DUE SOON":
      return {
        wrapper:
          "border border-yellow-300/15 bg-[linear-gradient(135deg,rgba(202,138,4,0.18),rgba(120,53,15,0.08),rgba(0,0,0,0))] shadow-[0_0_0_1px_rgba(253,224,71,0.04),0_20px_50px_rgba(120,53,15,0.14)]",
        iconWrap: "border-yellow-300/20 bg-yellow-400/15 text-yellow-300",
      };
    case "READY TO FILE":
      return {
        wrapper:
          "border border-emerald-400/15 bg-[linear-gradient(135deg,rgba(6,78,59,0.18),rgba(4,47,46,0.08),rgba(0,0,0,0))] shadow-[0_0_0_1px_rgba(52,211,153,0.04),0_20px_50px_rgba(6,78,59,0.16)]",
        iconWrap: "border-emerald-400/20 bg-emerald-500/15 text-emerald-400",
      };
    case "UPCOMING":
      return {
        wrapper:
          "border border-blue-400/15 bg-[linear-gradient(135deg,rgba(30,58,138,0.18),rgba(15,23,42,0.08),rgba(0,0,0,0))] shadow-[0_0_0_1px_rgba(96,165,250,0.04),0_20px_50px_rgba(30,58,138,0.14)]",
        iconWrap: "border-blue-400/20 bg-blue-500/15 text-blue-300",
      };
    case "FILED":
      return {
        wrapper:
          "border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.4),rgba(2,6,23,0.2),rgba(0,0,0,0))]",
        iconWrap: "border-white/10 bg-white/5 text-slate-300",
      };
  }
}

function RowActionMenu({
  rowId,
  openMenuId,
  setOpenMenuId,
  children,
}: {
  rowId: string;
  openMenuId: string | null;
  setOpenMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  children: ReactNode;
}) {
  const isOpen = openMenuId === rowId;

  return (
    <div className="relative" data-menu-root="true">
      <button
        type="button"
        onClick={() => setOpenMenuId((prev) => (prev === rowId ? null : rowId))}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
      >
        <MoreHorizontal size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[999] mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          {children}
        </div>
      )}
    </div>
  );
}

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  pathname: string;
  collapsed: boolean;
  badge?: string;
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

      {!collapsed && (
        <>
          <span className="flex-1 text-sm font-medium">{label}</span>
          {badge && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] ${
              isActive
                ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-slate-300"
            }`}>
              {badge}
            </span>
          )}
        </>
      )}

      {isActive && !collapsed && <div className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-cyan-300" />}
    </Link>
  );
}

function MobileNavPill({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm transition ${
        isActive
          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </Link>
  );
}

function DropdownItem({
  href,
  label,
  icon,
  danger = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 text-sm transition ${
        danger ? "text-red-300 hover:bg-red-500/10" : "text-slate-200 hover:bg-white/5"
      }`}
    >
      <span className={danger ? "text-red-300" : "text-slate-400"}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
  accent: "red" | "yellow" | "green" | "blue";
}) {
  const accentMap = {
    red: "border-red-400/15 bg-[linear-gradient(180deg,rgba(127,29,29,0.16),rgba(69,10,10,0.05))] text-red-200",
    yellow: "border-yellow-300/15 bg-[linear-gradient(180deg,rgba(202,138,4,0.14),rgba(120,53,15,0.05))] text-yellow-200",
    green: "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.14),rgba(4,47,46,0.05))] text-emerald-200",
    blue: "border-blue-400/15 bg-[linear-gradient(180deg,rgba(30,58,138,0.14),rgba(15,23,42,0.05))] text-blue-200",
  }[accent];

  return (
    <div className={`h-full rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition hover:-translate-y-[2px] ${accentMap}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-300">{sub}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white">
          {icon}
        </div>
      </div>
    </div>
  );
}

function AlertItem({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: AlertTone;
}) {
  const toneMap = {
    red: "border-l-red-400",
    yellow: "border-l-yellow-300",
    green: "border-l-emerald-400",
  }[tone];

  return (
    <div className={`border-l-2 ${toneMap} px-4 py-3`}>
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
    </div>
  );
}
