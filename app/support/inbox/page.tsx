"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Inbox,
  LifeBuoy,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

type SupportStatus = "open" | "in_progress" | "resolved";

type SupportRequest = {
  id: string;
  request_type: string;
  issue_type: string;
  name: string | null;
  email: string | null;
  page_url: string | null;
  browser_info: string | null;
  expected: string | null;
  actual: string;
  status: SupportStatus;
  created_at: string;
};

const STATUS_OPTIONS: SupportStatus[] = ["open", "in_progress", "resolved"];

function formatStatusLabel(status: SupportStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
  }
}

function formatIssueType(value: string | null | undefined) {
  if (!value) return "Bug report";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeAgo(value: string) {
  const now = Date.now();
  const then = new Date(value).getTime();
  const diffMs = Math.max(0, now - then);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function statusClasses(status: SupportStatus) {
  switch (status) {
    case "open":
      return "border-red-400/20 bg-red-500/10 text-red-200";
    case "in_progress":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "resolved":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }
}

export default function SupportInboxPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tickets, setTickets] = useState<SupportRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SupportStatus>("all");
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadTickets(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const { data, error } = await supabase
        .from("support_requests")
        .select(
          "id, request_type, issue_type, name, email, page_url, browser_info, expected, actual, status, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as SupportRequest[];
      setTickets(rows);

      if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0].id);
      }

      if (selectedId && !rows.some((row) => row.id === selectedId)) {
        setSelectedId(rows[0]?.id || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load support inbox.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "all" ? true : ticket.status === statusFilter;

      const haystack = [
        ticket.issue_type,
        ticket.name || "",
        ticket.email || "",
        ticket.page_url || "",
        ticket.actual || "",
        ticket.expected || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = q ? haystack.includes(q) : true;

      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedId) ||
    tickets.find((ticket) => ticket.id === selectedId) ||
    null;

  const counts = useMemo(() => {
    const open = tickets.filter((t) => t.status === "open").length;
    const inProgress = tickets.filter((t) => t.status === "in_progress").length;
    const resolved = tickets.filter((t) => t.status === "resolved").length;

    return {
      all: tickets.length,
      open,
      in_progress: inProgress,
      resolved,
    };
  }, [tickets]);

  async function updateStatus(id: string, status: SupportStatus) {
    setUpdatingId(id);
    setError("");

    try {
      const { error } = await supabase
        .from("support_requests")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setTickets((prev) =>
        prev.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="overflow-hidden rounded-[30px] border border-cyan-400/10 bg-[linear-gradient(to_bottom,rgba(8,15,28,0.94),rgba(3,8,20,0.98))] shadow-[0_0_60px_rgba(34,211,238,0.06),0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <Link
                  href="/support"
                  className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-200"
                >
                  <ArrowLeft size={16} />
                  Back to Support
                </Link>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <LifeBuoy size={14} />
                  Support Inbox
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Internal support queue
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Review bug reports, update statuses, and keep support work organized in one place.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="All" value={String(counts.all)} icon={<Inbox size={16} />} />
                <StatCard label="Open" value={String(counts.open)} icon={<Bug size={16} />} />
                <StatCard
                  label="In Progress"
                  value={String(counts.in_progress)}
                  icon={<Clock3 size={16} />}
                />
                <StatCard
                  label="Resolved"
                  value={String(counts.resolved)}
                  icon={<CheckCircle2 size={16} />}
                />
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <div className="relative w-full sm:max-w-md">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by issue, name, email, URL, or details"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/15 focus:border-cyan-300/30 focus:bg-white/[0.05]"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | SupportStatus)
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition hover:border-white/15 focus:border-cyan-300/30 focus:bg-white/[0.05]"
                >
                  <option value="all" className="bg-slate-900">
                    All statuses
                  </option>
                  <option value="open" className="bg-slate-900">
                    Open
                  </option>
                  <option value="in_progress" className="bg-slate-900">
                    In Progress
                  </option>
                  <option value="resolved" className="bg-slate-900">
                    Resolved
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadTickets(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.08]"
              >
                <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {error ? (
              <div className="mb-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-10 text-sm text-slate-400">
                Loading support inbox...
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
                  <div className="border-b border-white/10 px-5 py-4">
                    <div className="text-sm font-semibold text-white">Tickets</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {filteredTickets.length} shown
                    </div>
                  </div>

                  <div className="max-h-[900px] overflow-y-auto">
                    {filteredTickets.length === 0 ? (
                      <div className="px-5 py-10 text-sm text-slate-400">
                        No support tickets match your filters.
                      </div>
                    ) : (
                      filteredTickets.map((ticket) => {
                        const isSelected = selectedId === ticket.id;

                        return (
                          <button
                            key={ticket.id}
                            type="button"
                            onClick={() => setSelectedId(ticket.id)}
                            className={`block w-full border-b border-white/5 px-5 py-4 text-left transition ${
                              isSelected
                                ? "bg-cyan-400/10"
                                : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses(
                                      ticket.status
                                    )}`}
                                  >
                                    {formatStatusLabel(ticket.status)}
                                  </span>

                                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    {formatIssueType(ticket.issue_type)}
                                  </span>
                                </div>

                                <div className="mt-3 text-sm font-medium text-white">
                                  {ticket.name || ticket.email || "Unknown reporter"}
                                </div>

                                <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">
                                  {ticket.actual}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>{timeAgo(ticket.created_at)}</span>
                                  <span>•</span>
                                  <span className="truncate">
                                    {ticket.page_url || "No page URL"}
                                  </span>
                                </div>
                              </div>

                              <ChevronRight
                                size={18}
                                className={`shrink-0 transition ${
                                  isSelected ? "text-cyan-200" : "text-slate-500"
                                }`}
                              />
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/[0.03]">
                  {!selectedTicket ? (
                    <div className="px-6 py-10 text-sm text-slate-400">
                      Select a support ticket to see details.
                    </div>
                  ) : (
                    <div>
                      <div className="border-b border-white/10 px-6 py-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusClasses(
                                  selectedTicket.status
                                )}`}
                              >
                                {formatStatusLabel(selectedTicket.status)}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                                {formatIssueType(selectedTicket.issue_type)}
                              </span>
                            </div>

                            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                              {selectedTicket.name || selectedTicket.email || "Support ticket"}
                            </h2>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                              <span>{formatDate(selectedTicket.created_at)}</span>
                              <span>•</span>
                              <span>{selectedTicket.id}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {STATUS_OPTIONS.map((status) => {
                              const active = selectedTicket.status === status;

                              return (
                                <button
                                  key={status}
                                  type="button"
                                  onClick={() => updateStatus(selectedTicket.id, status)}
                                  disabled={updatingId === selectedTicket.id || active}
                                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                                    active
                                      ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
                                      : "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]"
                                  } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                  {updatingId === selectedTicket.id && !active ? (
                                    <span className="inline-flex items-center gap-2">
                                      <Loader2 size={14} className="animate-spin" />
                                      Updating...
                                    </span>
                                  ) : (
                                    formatStatusLabel(status)
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-6 px-6 py-6 2xl:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-5">
                          <DetailCard title="What actually happened" accent="red">
                            {selectedTicket.actual || "—"}
                          </DetailCard>

                          <DetailCard title="What should have happened" accent="amber">
                            {selectedTicket.expected || "—"}
                          </DetailCard>

                          <DetailCard title="Browser info">
                            {selectedTicket.browser_info || "—"}
                          </DetailCard>
                        </div>

                        <div className="space-y-5">
                          <MetaCard
                            label="Reporter"
                            value={selectedTicket.name || "—"}
                          />
                          <MetaCard
                            label="Email"
                            value={selectedTicket.email || "—"}
                          />
                          <MetaCard
                            label="Page URL"
                            value={selectedTicket.page_url || "—"}
                            href={selectedTicket.page_url || undefined}
                          />
                          <MetaCard
                            label="Request type"
                            value={formatIssueType(selectedTicket.request_type)}
                          />
                          <MetaCard
                            label="Issue type"
                            value={formatIssueType(selectedTicket.issue_type)}
                          />

                          <div className="rounded-[24px] border border-cyan-300/12 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(59,130,246,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_50px_rgba(34,211,238,0.08)]">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                              Quick actions
                            </div>

                            <div className="mt-4 flex flex-col gap-3">
                              {selectedTicket.email ? (
                                <a
                                  href={`mailto:${selectedTicket.email}`}
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-slate-100 transition hover:bg-white/[0.08]"
                                >
                                  Email reporter
                                </a>
                              ) : null}

                              {selectedTicket.page_url ? (
                                <a
                                  href={selectedTicket.page_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400"
                                >
                                  Open affected page
                                  <ExternalLink size={15} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <div className="text-slate-400">{icon}</div>
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function DetailCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent?: "red" | "amber";
}) {
  const accentClasses =
    accent === "red"
      ? "border-red-400/15 bg-red-500/[0.05]"
      : accent === "amber"
      ? "border-amber-400/15 bg-amber-500/[0.05]"
      : "border-white/10 bg-white/[0.03]";

  return (
    <div className={`rounded-[24px] border p-5 ${accentClasses}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
        {children}
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 break-all text-sm leading-7 text-cyan-200 transition hover:text-cyan-100"
        >
          {value}
          <ExternalLink size={14} />
        </a>
      ) : (
        <div className="mt-3 break-all text-sm leading-7 text-slate-200">{value}</div>
      )}
    </div>
  );
}