"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock3,
  MessageSquare,
  ShieldCheck,
  Upload,
  AlertTriangle,
  Sparkles,
  Inbox,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  client_id?: string | null;
  filings?: {
    filing_name?: string | null;
  } | null;
};

type PortalContext = {
  workspaceId: string | null;
  clientId: string | null;
  companyName: string;
  workspaceName: string;
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

function relativeLabel(value?: string | null) {
  if (!value) return "No due date";

  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diff = Math.round((target.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return `${Math.abs(diff)} day${Math.abs(diff) === 1 ? "" : "s"} overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff} days`;
  return `Due ${formatDate(value)}`;
}

function isOverdue(value?: string | null) {
  if (!value) return false;
  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target < todayOnly;
}

function isDueSoon(value?: string | null) {
  if (!value) return false;
  const target = new Date(`${value.slice(0, 10)}T00:00:00`);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 3;
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
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
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
    default:
      return "border-slate-300/15 bg-white/5 text-slate-300";
  }
}

function sortRequests(items: PortalRequest[]) {
  return [...items].sort((a, b) => {
    const aOpen = a.status !== "complete" ? 0 : 1;
    const bOpen = b.status !== "complete" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;

    const aOverdue = isOverdue(a.due_date) && a.status !== "complete" ? 0 : 1;
    const bOverdue = isOverdue(b.due_date) && b.status !== "complete" ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    const aAwaiting = a.status === "awaiting_client" ? 0 : 1;
    const bAwaiting = b.status === "awaiting_client" ? 0 : 1;
    if (aAwaiting !== bAwaiting) return aAwaiting - bAwaiting;

    const priorityRank = { high: 0, medium: 1, low: 2 };
    const priorityCompare = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityCompare !== 0) return priorityCompare;

    const aDue = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

function cardTone(request: PortalRequest) {
  const overdue = isOverdue(request.due_date) && request.status !== "complete";
  const dueSoon = isDueSoon(request.due_date) && request.status !== "complete";
  const awaiting = request.status === "awaiting_client";

  if (overdue) {
    return "border-red-400/30 bg-[linear-gradient(180deg,rgba(127,29,29,0.24),rgba(255,255,255,0.03))] shadow-[0_0_32px_rgba(239,68,68,0.16)]";
  }

  if (awaiting || dueSoon) {
    return "border-amber-300/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.11),rgba(255,255,255,0.03))] shadow-[0_0_24px_rgba(251,191,36,0.08)]";
  }

  if (request.status === "complete") {
    return "border-white/8 bg-white/[0.02] opacity-75";
  }

  return "border-white/10 bg-white/[0.03]";
}

function RequestCard({
  request,
  updatingRequestId,
  onMarkReceived,
  subdued = false,
}: {
  request: PortalRequest;
  updatingRequestId: string | null;
  onMarkReceived: (requestId: string) => void;
  subdued?: boolean;
}) {
  const router = useRouter();
  const overdue = isOverdue(request.due_date) && request.status !== "complete";
  const dueSoon = isDueSoon(request.due_date) && request.status !== "complete";
  const isUpdating = updatingRequestId === request.id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/portal/messages?requestId=${request.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/portal/messages?requestId=${request.id}`);
        }
      }}
      className={`group cursor-pointer rounded-[26px] border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${cardTone(request)} ${subdued ? "hover:opacity-90" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold text-white transition group-hover:text-cyan-100">
              {request.title}
            </div>

            {overdue ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-300/25 bg-red-400/12 px-2.5 py-1 text-xs text-red-100">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overdue
              </span>
            ) : dueSoon ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/12 px-2.5 py-1 text-xs text-amber-100">
                <Clock3 className="h-3.5 w-3.5" />
                Due soon
              </span>
            ) : null}
          </div>

          <div className="mt-1 text-sm leading-6 text-slate-400">
            {request.description || "No description provided for this request."}
          </div>

          {request.filings?.filing_name ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
              Related filing: {request.filings.filing_name}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          {relativeLabel(request.due_date)}
        </div>
        <div>Due: {formatDate(request.due_date)}</div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
        {request.status !== "complete" ? (
          <>
            <Link
              href={`/portal/upload?requestId=${request.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition-all hover:bg-cyan-400/15 hover:text-white"
            >
              <Upload className="h-4 w-4" />
              Upload for request
            </Link>

            <Link
              href={`/portal/messages?requestId=${request.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition-all hover:bg-white/[0.07] hover:text-white"
            >
              <MessageSquare className="h-4 w-4" />
              Reply
            </Link>
          </>
        ) : (
          <Link
            href={`/portal/messages?requestId=${request.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white"
          >
            <MessageSquare className="h-4 w-4" />
            View thread
          </Link>
        )}

        {request.status === "awaiting_client" ? (
          <button
            type="button"
            onClick={() => onMarkReceived(request.id)}
            disabled={isUpdating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-all hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isUpdating ? "Updating..." : "Mark received"}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-400">
            <ArrowRight className="h-4 w-4" />
            {request.status === "complete" ? "Completed" : "In progress"}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalRequestsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [context, setContext] = useState<PortalContext>({
    workspaceId: null,
    clientId: null,
    companyName: "Client Portal",
    workspaceName: "Due Horizon",
  });
  const [error, setError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const sortedRequests = useMemo(() => sortRequests(requests), [requests]);
  const openItems = useMemo(() => sortedRequests.filter((request) => request.status !== "complete"), [sortedRequests]);
  const completedItems = useMemo(() => sortedRequests.filter((request) => request.status === "complete"), [sortedRequests]);

  const openCount = openItems.length;
  const awaitingCount = openItems.filter((request) => request.status === "awaiting_client").length;
  const overdueCount = openItems.filter((request) => isOverdue(request.due_date)).length;
  const completeCount = completedItems.length;

  const needsAttention = useMemo(
    () =>
      openItems.filter(
        (request) =>
          request.status === "awaiting_client" || isOverdue(request.due_date) || isDueSoon(request.due_date)
      ),
    [openItems]
  );

  const inProgress = useMemo(
    () => openItems.filter((request) => !needsAttention.some((attentionItem) => attentionItem.id === request.id)),
    [openItems, needsAttention]
  );

  async function resolvePortalContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return null;

    const [
      { data: clientMemberships, error: clientMembershipsError },
      { data: firmMemberships, error: firmMembershipsError },
    ] = await Promise.all([
      supabase
        .from("client_members")
        .select("firm_id, client_id, clients(client_name)")
        .eq("user_id", user.id),
      supabase.from("firm_members").select("firm_id").eq("user_id", user.id).limit(1),
    ]);

    if (clientMembershipsError) throw clientMembershipsError;
    if (firmMembershipsError) throw firmMembershipsError;

    const clientMembership = clientMemberships?.[0] || null;
    const firmMembership = firmMemberships?.[0] || null;

    const workspaceId = clientMembership?.firm_id || firmMembership?.firm_id || null;
    const clientId = clientMembership?.client_id || null;

    if (!workspaceId) {
      return {
        workspaceId: null,
        clientId: null,
        companyName: "Client Portal",
        workspaceName: "Due Horizon",
      };
    }

    const { data: firm } = await supabase
      .from("firms")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();

    return {
      workspaceId,
      clientId,
      companyName:
        clientMembership?.clients?.[0]?.client_name ||
        user.user_metadata?.company_name ||
        user.user_metadata?.business_name ||
        "Client Portal",
      workspaceName: firm?.name || "Due Horizon",
    };
  }

  async function loadRequests() {
    setLoading(true);
    setError(null);

    try {
      const resolvedContext = await resolvePortalContext();

      if (!resolvedContext?.workspaceId) {
        setError("No portal workspace was found for this user.");
        setRequests([]);
        setLoading(false);
        return;
      }

      setContext(resolvedContext);

      let query = supabase
        .from("requests")
        .select(
          "id, title, description, status, priority, due_date, created_at, filing_id, client_id, filings(filing_name)"
        )
        .eq("firm_id", resolvedContext.workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50);

      if (resolvedContext.clientId) {
        query = query.eq("client_id", resolvedContext.clientId);
      }

      const { data, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      setRequests((data || []) as PortalRequest[]);
    } catch (err) {
      console.error("Failed to load portal requests:", err);
      setError(err instanceof Error ? err.message : "Failed to load requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [supabase]);

  async function markRequestReceived(requestId: string) {
    try {
      setUpdatingRequestId(requestId);

      let updateQuery = supabase
        .from("requests")
        .update({ status: "received" })
        .eq("id", requestId);

      if (context.clientId) {
        updateQuery = updateQuery.eq("client_id", context.clientId);
      }

      const { error: updateError } = await updateQuery;

      if (updateError) throw updateError;

      await loadRequests();
    } catch (err) {
      console.error("Failed to update request:", err);
      setError(err instanceof Error ? err.message : "Failed to update request.");
    } finally {
      setUpdatingRequestId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Portal Requests
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {context.companyName}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Review requests, upload supporting documents, and reply in context.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                Client View
              </div>

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

          <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Open requests</div>
              <div className="mt-2 text-3xl font-semibold text-white">{openCount}</div>
              <div className="mt-1 text-xs text-slate-400">Requests that still need action</div>
            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Awaiting you</div>
              <div className="mt-2 text-3xl font-semibold text-white">{awaitingCount}</div>
              <div className="mt-1 text-xs text-amber-100/70">Top priority items for your next step</div>
            </div>

            <div className="rounded-2xl border border-red-300/15 bg-red-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-red-100/80">Overdue</div>
              <div className="mt-2 text-3xl font-semibold text-white">{overdueCount}</div>
              <div className="mt-1 text-xs text-red-100/70">Requests that need attention first</div>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Completed</div>
              <div className="mt-2 text-3xl font-semibold text-white">{completeCount}</div>
              <div className="mt-1 text-xs text-cyan-100/70">Finished items and resolved history</div>
            </div>
          </div>

          {error ? (
            <div className="px-6 py-5">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          <div className="px-6 py-6">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="h-5 w-48 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-72 rounded bg-white/5" />
                    <div className="mt-5 h-10 w-full rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            ) : sortedRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Inbox className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="mt-4 text-base font-medium text-white">You are all set</div>
                <div className="mt-2 text-sm text-slate-400">
                  No open requests right now. You can still upload documents anytime or check messages for updates from {context.workspaceName}.
                </div>
                <div className="mt-5">
                  <Link
                    href="/portal/upload"
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    <Upload className="h-4 w-4" />
                    Upload documents
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                        Focus now
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        Items that need attention first
                      </div>
                    </div>
                    <div className="rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                      {needsAttention.length} active priority item{needsAttention.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  {needsAttention.length ? (
                    <div className="space-y-4">
                      {needsAttention.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          updatingRequestId={updatingRequestId}
                          onMarkReceived={markRequestReceived}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-emerald-300/15 bg-emerald-400/5 p-6 text-sm text-emerald-100/90">
                      Nothing urgent right now. You are caught up on overdue, due soon, and awaiting-client requests.
                    </div>
                  )}
                </section>

                {inProgress.length ? (
                  <section className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                        In progress
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">
                        Remaining active requests
                      </div>
                    </div>

                    <div className="space-y-4">
                      {inProgress.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          updatingRequestId={updatingRequestId}
                          onMarkReceived={markRequestReceived}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {completedItems.length ? (
                  <section className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/55">
                        Completed
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white/90">
                        Finished request history
                      </div>
                    </div>

                    <div className="space-y-4">
                      {completedItems.map((request) => (
                        <RequestCard
                          key={request.id}
                          request={request}
                          updatingRequestId={updatingRequestId}
                          onMarkReceived={markRequestReceived}
                          subdued
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
