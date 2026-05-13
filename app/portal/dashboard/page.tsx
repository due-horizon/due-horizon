"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  MessageSquare,
  Upload,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Sparkles,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalRequestStatus = "awaiting_client" | "received" | "in_review" | "complete";
type PortalPriority = "low" | "medium" | "high";

type PortalRequest = {
  id: string;
  title: string;
  description: string | null;
  status: PortalRequestStatus;
  priority: PortalPriority;
  due_date: string | null;
  created_at: string;
  filing_id: string | null;
  filings?: {
    filing_name?: string | null;
  } | null;
};

type PortalFile = {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
  request_id: string | null;
  filing_id: string | null;
  requests?: {
    title?: string | null;
  } | null;
};

type PortalMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  is_from_client: boolean | null;
  request_id: string | null;
};

type WorkspaceSummary = {
  workspaceName: string;
  companyName: string;
};

type ActivePortalContext = {
  workspaceId: string | null;
  clientId: string | null;
  companyName: string;
  mode: "client" | null;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueMeta(value?: string | null) {
  if (!value) {
    return {
      diff: null,
      label: "No due date",
      tone: "neutral" as const,
      badgeClass: "border-white/10 bg-white/[0.04] text-slate-300",
      cardClass:
        "border-white/10 bg-white/[0.04] hover:border-white/15 hover:bg-white/[0.05]",
      accentClass: "from-slate-400/0 via-slate-400/0 to-slate-400/0",
    };
  }

  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      diff,
      label: `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`,
      tone: "overdue" as const,
      badgeClass: "border-red-300/20 bg-red-500/10 text-red-100",
      cardClass:
        "border-red-400/20 bg-[linear-gradient(180deg,rgba(239,68,68,0.10),rgba(255,255,255,0.03))] hover:border-red-300/30 hover:bg-[linear-gradient(180deg,rgba(239,68,68,0.14),rgba(255,255,255,0.04))]",
      accentClass: "from-red-400/40 via-red-300/10 to-transparent",
    };
  }

  if (diff === 0) {
    return {
      diff,
      label: "Due today",
      tone: "today" as const,
      badgeClass: "border-orange-300/20 bg-orange-500/10 text-orange-100",
      cardClass:
        "border-orange-300/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.10),rgba(255,255,255,0.03))] hover:border-orange-300/30 hover:bg-[linear-gradient(180deg,rgba(249,115,22,0.14),rgba(255,255,255,0.04))]",
      accentClass: "from-orange-300/40 via-orange-200/10 to-transparent",
    };
  }

  if (diff <= 3) {
    return {
      diff,
      label: diff === 1 ? "Due tomorrow" : `Due in ${diff} days`,
      tone: "soon" as const,
      badgeClass: "border-amber-300/20 bg-amber-500/10 text-amber-100",
      cardClass:
        "border-amber-300/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.08),rgba(255,255,255,0.03))] hover:border-amber-300/25 hover:bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(255,255,255,0.04))]",
      accentClass: "from-amber-300/35 via-amber-200/10 to-transparent",
    };
  }

  return {
    diff,
    label: `Due in ${diff} days`,
    tone: "upcoming" as const,
    badgeClass: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100",
    cardClass:
      "border-white/10 bg-white/[0.04] hover:border-cyan-300/20 hover:bg-white/[0.05]",
    accentClass: "from-cyan-300/20 via-cyan-200/5 to-transparent",
  };
}

function statusPill(status: PortalRequestStatus) {
  switch (status) {
    case "awaiting_client":
      return "border-amber-300/20 bg-amber-400/10 text-amber-100";
    case "received":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
    case "in_review":
      return "border-blue-300/20 bg-blue-400/10 text-blue-100";
    case "complete":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }
}

function priorityPill(priority: PortalPriority) {
  switch (priority) {
    case "high":
      return "border-red-300/20 bg-red-400/10 text-red-100";
    case "medium":
      return "border-amber-300/20 bg-amber-400/10 text-amber-100";
    case "low":
      return "border-slate-300/15 bg-white/5 text-slate-300";
  }
}

function requestSortValue(request: PortalRequest) {
  const dueMeta = getDueMeta(request.due_date);
  const statusWeight =
    request.status === "awaiting_client"
      ? 0
      : request.status === "received"
        ? 1
        : request.status === "in_review"
          ? 2
          : 3;
  const priorityWeight =
    request.priority === "high" ? 0 : request.priority === "medium" ? 1 : 2;
  const dueWeight = dueMeta.diff === null ? 9999 : dueMeta.diff;

  return statusWeight * 10000 + priorityWeight * 1000 + dueWeight;
}

export default function ClientPortalDashboardPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WorkspaceSummary>({
    workspaceName: "Due Horizon",
    companyName: "Client Portal",
  });
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<ActivePortalContext>({
    workspaceId: null,
    clientId: null,
    companyName: "Client Portal",
    mode: null,
  });
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const activeRequests = requests.filter((item) => item.status !== "complete");
  const awaitingItems = requests.filter((item) => item.status === "awaiting_client");
  const unreadFirmMessages = messages.filter((message) => !message.is_from_client).length;
  const recentFiles = files.slice(0, 6);
  const recentMessages = messages.slice(0, 4);
  const prioritizedRequests = [...activeRequests].sort(
    (a, b) => requestSortValue(a) - requestSortValue(b),
  );
  const topPriorityRequest = prioritizedRequests[0] ?? null;
  const overdueCount = activeRequests.filter((request) => {
    const diff = getDueMeta(request.due_date).diff;
    return typeof diff === "number" && diff < 0;
  }).length;

  async function resolvePortalContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) {
      return null;
    }

    const { data: clientMemberships, error: clientMembershipsError } = await supabase
      .from("client_members")
      .select("firm_id, client_id, clients(client_name)")
      .eq("user_id", user.id)
      .limit(1);

    if (clientMembershipsError) throw clientMembershipsError;

    const clientMembership = clientMemberships?.[0] || null;

    if (!clientMembership?.firm_id || !clientMembership?.client_id) {
      return {
        user,
        workspaceId: null,
        clientId: null,
        companyName: "Client Portal",
        mode: null,
      };
    }

    return {
      user,
      workspaceId: clientMembership.firm_id as string,
      clientId: clientMembership.client_id as string,
      companyName:
        clientMembership?.clients?.[0]?.client_name ||
        user.user_metadata?.company_name ||
        user.user_metadata?.business_name ||
        "Client Portal",
      mode: "client" as const,
    };
  }

  async function loadPortal() {
    setLoading(true);
    setError(null);

    try {
      const context = await resolvePortalContext();

      if (!context) {
        setError("Please log in to view the client portal.");
        setLoading(false);
        return;
      }

      if (!context.workspaceId || !context.clientId) {
        setActiveContext({
          workspaceId: null,
          clientId: null,
          companyName: "Client Portal",
          mode: null,
        });
        setSummary({
          workspaceName: "Due Horizon",
          companyName: "Client Portal",
        });
        setRequests([]);
        setFiles([]);
        setMessages([]);
        setError("This page is client-only. Sign in with a client portal account to view requests, files, and messages.");
        setLoading(false);
        return;
      }

      setActiveContext({
        workspaceId: context.workspaceId,
        clientId: context.clientId,
        companyName: context.companyName,
        mode: "client",
      });

      const { data: firm } = await supabase
        .from("firms")
        .select("name")
        .eq("id", context.workspaceId)
        .maybeSingle();

      setSummary({
        workspaceName: firm?.name || "Due Horizon",
        companyName: context.companyName,
      });

      const requestsQuery = supabase
        .from("requests")
        .select(
          "id, title, description, status, priority, due_date, created_at, filing_id, filings(filing_name)",
        )
        .eq("firm_id", context.workspaceId)
        .eq("client_id", context.clientId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(12);

      const filesQuery = supabase
        .from("files")
        .select("id, file_name, category, created_at, request_id, filing_id, requests(title)")
        .eq("firm_id", context.workspaceId)
        .eq("client_id", context.clientId)
        .order("created_at", { ascending: false })
        .limit(12);

      const messagesQuery = supabase
        .from("messages")
        .select("id, body, created_at, sender_name, is_from_client, request_id")
        .eq("firm_id", context.workspaceId)
        .eq("client_id", context.clientId)
        .order("created_at", { ascending: false })
        .limit(8);

      const [
        { data: portalRequests, error: requestsError },
        { data: portalFiles, error: filesError },
        { data: portalMessages, error: messagesError },
      ] = await Promise.all([requestsQuery, filesQuery, messagesQuery]);

      if (requestsError) throw requestsError;
      if (filesError) throw filesError;
      if (messagesError) throw messagesError;

      setRequests((portalRequests || []) as PortalRequest[]);
      setFiles((portalFiles || []) as PortalFile[]);
      setMessages((portalMessages || []) as PortalMessage[]);
    } catch (err) {
      console.error("Failed to load client portal:", err);
      setError(err instanceof Error ? err.message : "Failed to load portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPortal();
  }, [supabase]);

  async function markRequestReceived(requestId: string) {
    try {
      setUpdatingRequestId(requestId);
      const { error: updateError } = await supabase
        .from("requests")
        .update({ status: "received" })
        .eq("id", requestId)
        .eq("client_id", activeContext.clientId);

      if (updateError) throw updateError;
      await loadPortal();
    } catch (err) {
      console.error("Failed to update request:", err);
      setError(err instanceof Error ? err.message : "Failed to update request.");
    } finally {
      setUpdatingRequestId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_24%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_rgba(0,0,0,0.34)] backdrop-blur-sm">
          <div className="relative border-b border-white/10 px-6 py-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_28%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                    Client Portal
                  </div>
                  {!loading && activeContext.mode === "client" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      <Building2 className="h-3.5 w-3.5 text-cyan-200" />
                      Client View
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {summary.companyName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Securely send files, respond to open requests, and stay aligned with {summary.workspaceName}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex">
                  <ShieldCheck className="h-4 w-4" />
                  Secure workspace
                </div>

                <Link
                  href="/portal/upload"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400"
                >
                  <Upload className="h-4 w-4" />
                  Upload files
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Open requests</div>
              <div className="mt-2 text-3xl font-semibold text-white">{activeRequests.length}</div>
              <div className="mt-1 text-xs text-slate-400">Active items that still need progress</div>
            </div>

            <div className="rounded-2xl border border-amber-300/20 bg-[linear-gradient(180deg,rgba(245,158,11,0.14),rgba(255,255,255,0.04))] p-4 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Awaiting you</div>
              <div className="mt-2 text-3xl font-semibold text-white">{awaitingItems.length}</div>
              <div className="mt-1 text-xs text-amber-100/70">Top priority items for your next step</div>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Recent files</div>
              <div className="mt-2 text-3xl font-semibold text-white">{recentFiles.length}</div>
              <div className="mt-1 text-xs text-cyan-100/70">Most recent uploads in your portal</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Unread firm messages</div>
              <div className="mt-2 text-3xl font-semibold text-white">{unreadFirmMessages}</div>
              <div className="mt-1 text-xs text-slate-400">Recent updates waiting for your review</div>
            </div>
          </div>

          {error ? (
            <div className="px-6 py-5">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.12fr_0.88fr]">
            <section className="space-y-6">
              <div className="rounded-[26px] border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.03))] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                      <Sparkles className="h-4 w-4" />
                      Focus now
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">Your next best action</div>
                    <div className="mt-1 text-sm text-slate-400">
                      Start with the item most likely to unblock progress.
                    </div>
                  </div>

                  <Link
                    href="/portal/requests"
                    className="inline-flex items-center gap-2 text-sm text-cyan-200 transition hover:text-white"
                  >
                    View all requests
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {loading ? (
                  <div className="mt-5 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="h-4 w-36 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-72 rounded bg-white/5" />
                    <div className="mt-6 h-10 w-52 rounded bg-white/5" />
                  </div>
                ) : topPriorityRequest ? (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${statusPill(topPriorityRequest.status)}`}>
                            {topPriorityRequest.status.replaceAll("_", " ")}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${priorityPill(topPriorityRequest.priority)}`}>
                            {topPriorityRequest.priority} priority
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${getDueMeta(topPriorityRequest.due_date).badgeClass}`}>
                            {getDueMeta(topPriorityRequest.due_date).label}
                          </span>
                        </div>

                        <div className="mt-4 text-xl font-semibold text-white">{topPriorityRequest.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-300">
                          {topPriorityRequest.description ||
                            "Your firm added a new request to the portal and is waiting on your response."}
                        </div>

                        {topPriorityRequest.filings?.filing_name ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                            <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
                            Related filing: {topPriorityRequest.filings.filing_name}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        Due: {formatDate(topPriorityRequest.due_date)}
                      </div>
                      <div>Created: {formatDate(topPriorityRequest.created_at)}</div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Link
                        href={`/portal/upload?requestId=${topPriorityRequest.id}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-3.5 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400"
                      >
                        <Upload className="h-4 w-4" />
                        Upload for request
                      </Link>

                      <Link
                        href={`/portal/messages?requestId=${topPriorityRequest.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Reply
                      </Link>

                      {topPriorityRequest.status === "awaiting_client" ? (
                        <button
                          type="button"
                          onClick={() => markRequestReceived(topPriorityRequest.id)}
                          disabled={updatingRequestId === topPriorityRequest.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3.5 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-400/15 disabled:opacity-60"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {updatingRequestId === topPriorityRequest.id ? "Updating..." : "Mark received"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <CheckCircle2 className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div className="mt-4 text-base font-medium text-white">You are all caught up</div>
                    <div className="mt-2 text-sm text-slate-400">
                      No urgent portal items right now. You can still upload documents or check messages anytime.
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                      Requests
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">Items your firm needs from you</div>
                  </div>

                  <Link
                    href="/portal/requests"
                    className="inline-flex items-center gap-2 text-sm text-cyan-200 transition hover:text-white"
                  >
                    View all
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {overdueCount > 0 && !loading ? (
                  <div className="mt-5 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    <AlertTriangle className="h-4 w-4" />
                    {overdueCount} request{overdueCount === 1 ? " is" : "s are"} overdue and should be handled first.
                  </div>
                ) : null}

                <div className="mt-5 space-y-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="h-4 w-40 rounded bg-white/10" />
                        <div className="mt-3 h-3 w-64 rounded bg-white/5" />
                      </div>
                    ))
                  ) : prioritizedRequests.length ? (
                    prioritizedRequests.slice(0, 6).map((request) => {
                      const dueMeta = getDueMeta(request.due_date);

                      return (
                        <div
                          key={request.id}
                          className={`group relative overflow-hidden rounded-2xl border p-4 transition duration-200 ${dueMeta.cardClass}`}
                        >
                          <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${dueMeta.accentClass}`} />

                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/portal/requests?requestId=${request.id}`}
                                className="inline-flex max-w-full items-center gap-2 text-base font-semibold text-white transition group-hover:text-cyan-100"
                              >
                                <span className="truncate">{request.title}</span>
                                <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition group-hover:opacity-100" />
                              </Link>

                              <div className="mt-1 text-sm leading-6 text-slate-400">
                                {request.description || "Your firm added a new request to the portal."}
                              </div>

                              {request.filings?.filing_name ? (
                                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                                  <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
                                  Related filing: {request.filings.filing_name}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-1 text-xs ${dueMeta.badgeClass}`}>
                                {dueMeta.label}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs ${statusPill(request.status)}`}>
                                {request.status.replaceAll("_", " ")}
                              </span>
                              <span className={`rounded-full border px-2.5 py-1 text-xs ${priorityPill(request.priority)}`}>
                                {request.priority} priority
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
                            <div className="inline-flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-slate-500" />
                              Due: {formatDate(request.due_date)}
                            </div>
                            <div>Created: {formatDate(request.created_at)}</div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link
                              href={`/portal/upload?requestId=${request.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                            >
                              <Upload className="h-4 w-4" />
                              Upload for request
                            </Link>

                            <Link
                              href={`/portal/messages?requestId=${request.id}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.07]"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Reply
                            </Link>

                            {request.status === "awaiting_client" ? (
                              <button
                                type="button"
                                onClick={() => markRequestReceived(request.id)}
                                disabled={updatingRequestId === request.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                {updatingRequestId === request.id ? "Updating..." : "Mark received"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <CheckCircle2 className="h-5 w-5 text-cyan-200" />
                      </div>
                      <div className="mt-4 text-base font-medium text-white">No open requests</div>
                      <div className="mt-2 text-sm text-slate-400">
                        You are all caught up for now. New requests will appear here as soon as your firm posts them.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                      Files
                    </div>
                    <div className="mt-2 text-lg font-semibold text-white">Recent uploads and documents</div>
                  </div>

                  <Link
                    href="/portal/files"
                    className="inline-flex items-center gap-2 text-sm text-cyan-200 transition hover:text-white"
                  >
                    Open files
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="h-4 w-32 rounded bg-white/10" />
                        <div className="mt-3 h-3 w-24 rounded bg-white/5" />
                      </div>
                    ))
                  ) : recentFiles.length ? (
                    recentFiles.map((file) => (
                      <Link
                        key={file.id}
                        href={file.request_id ? `/portal/files?requestId=${file.request_id}` : "/portal/files"}
                        className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-2.5 text-cyan-100">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="truncate text-sm font-semibold text-white group-hover:text-cyan-100">
                                {file.file_name}
                              </div>
                              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-cyan-200" />
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {file.category || "General document"} · {formatDate(file.created_at)}
                            </div>
                            {file.requests?.title ? (
                              <div className="mt-2 text-xs text-cyan-200">For request: {file.requests.title}</div>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                      <div className="text-base font-medium text-white">No files uploaded yet</div>
                      <div className="mt-2 text-sm text-slate-400">
                        Upload tax documents, supporting files, or anything your firm requested.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  <Bell className="h-4 w-4" />
                  Activity
                </div>
                <div className="mt-3 text-lg font-semibold text-white">Latest messages from your firm</div>

                <div className="mt-5 space-y-3">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="h-4 w-20 rounded bg-white/10" />
                        <div className="mt-3 h-3 w-full rounded bg-white/5" />
                      </div>
                    ))
                  ) : recentMessages.length ? (
                    recentMessages.map((message) => (
                      <Link
                        key={message.id}
                        href={message.request_id ? `/portal/messages?requestId=${message.request_id}` : "/portal/messages"}
                        className="group block rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <MessageSquare className="h-3.5 w-3.5 text-cyan-200" />
                          <span>{message.sender_name || summary.workspaceName}</span>
                          <span>·</span>
                          <span>{formatDate(message.created_at)}</span>
                        </div>
                        <div className="mt-2 line-clamp-4 text-sm leading-6 text-slate-200 group-hover:text-white">
                          {message.body}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                      No recent messages yet. When your firm sends an update, it will appear here.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Quick actions
                </div>
                <div className="mt-4 grid gap-3">
                  <Link
                    href="/portal/requests"
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]"
                  >
                    <span className="text-sm text-white">Respond to requests</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    href="/portal/upload"
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]"
                  >
                    <span className="text-sm text-white">Upload documents</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                  <Link
                    href="/portal/messages"
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]"
                  >
                    <span className="text-sm text-white">Open messages</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
