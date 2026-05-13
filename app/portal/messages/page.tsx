"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  MessageSquare,
  Send,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_name: string | null;
  sender_user_id: string | null;
  is_from_client: boolean | null;
  request_id: string | null;
};

type PortalRequest = {
  id: string;
  title: string;
  description: string | null;
  filing_id: string | null;
  filings?: {
    filing_name?: string | null;
  } | null;
};

type PortalContext = {
  workspaceId: string | null;
  clientId: string | null;
  companyName: string;
  workspaceName: string;
  mode: "client";
  userId: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


function normalizePortalDisplayName(value?: string | null) {
  const cleaned = (value || "").trim();
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  const blocked = new Set([
    "the",
    "a",
    "an",
    "client",
    "client portal",
    "portal",
    "workspace",
    "firm",
    "company",
  ]);

  if (blocked.has(normalized)) return null;
  if (cleaned.length < 3) return null;

  return cleaned;
}

function getRequestIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("requestId") || "";
}

export default function PortalMessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [draft, setDraft] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext>({
    workspaceId: null,
    clientId: null,
    companyName: "Client Workspace",
    workspaceName: "Due Horizon",
    mode: "client",
    userId: null,
  });

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;
  const filteredMessages = messages.filter((message) =>
    selectedRequestId ? message.request_id === selectedRequestId : true
  );

  const totalMessages = messages.length;
  const activeThreadCount = requests.filter((request) =>
    messages.some((message) => message.request_id === request.id)
  ).length;

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
        workspaceName: "Client Portal",
        mode: "client" as const,
        userId: user.id,
      };
    }

    const clientName = normalizePortalDisplayName(
      clientMembership?.clients?.[0]?.client_name ||
      user.user_metadata?.company_name ||
      user.user_metadata?.business_name ||
      null
    );

    return {
      workspaceId,
      clientId,
      companyName: clientName || "Client Portal",
      workspaceName: clientName || "Client Portal",
      mode: "client" as const,
      userId: user.id,
    };
  }

  async function loadMessages() {
    setLoading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const resolvedContext = await resolvePortalContext();

      if (!resolvedContext?.workspaceId) {
        setError("No portal workspace was found for this user.");
        setLoading(false);
        return;
      }

      setContext(resolvedContext);

      let requestsQuery = supabase
        .from("requests")
        .select("id, title, description, filing_id, filings(filing_name)")
        .eq("firm_id", resolvedContext.workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false });

      let messagesQuery = supabase
        .from("messages")
        .select("id, body, created_at, sender_name, sender_user_id, is_from_client, request_id")
        .eq("firm_id", resolvedContext.workspaceId)
        .order("created_at", { ascending: true });

      if (resolvedContext.clientId) {
        requestsQuery = requestsQuery.eq("client_id", resolvedContext.clientId);
        messagesQuery = messagesQuery.eq("client_id", resolvedContext.clientId);
      }

      const [
        { data: requestData, error: requestsError },
        { data: messageData, error: messagesError },
      ] = await Promise.all([requestsQuery, messagesQuery]);

      if (requestsError) throw requestsError;
      if (messagesError) throw messagesError;

      const requestList = (requestData || []) as PortalRequest[];
      const messageList = (messageData || []) as PortalMessage[];

      setRequests(requestList);
      setMessages(messageList);

      const requestIdFromUrl = getRequestIdFromUrl();
      if (requestIdFromUrl && requestList.some((request) => request.id === requestIdFromUrl)) {
        setSelectedRequestId(requestIdFromUrl);
      } else if (!selectedRequestId && requestList.length > 0) {
        setSelectedRequestId(requestList[0].id);
      }
    } catch (err) {
      console.error("Failed to load portal messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, [supabase]);

  async function sendMessage() {
    const trimmed = draft.trim();
    if (!trimmed || !context.workspaceId || !context.userId) return;

    try {
      setSending(true);
      setError(null);

      const payload = {
        firm_id: context.workspaceId,
        client_id: context.clientId,
        request_id: selectedRequestId || null,
        sender_user_id: context.userId,
        sender_name: context.companyName,
        is_from_client: context.mode === "client",
        body: trimmed,
      };

      const { error: insertError } = await supabase.from("messages").insert(payload);

      if (insertError) throw insertError;

      setDraft("");
      setSuccessMessage("Message sent successfully.");
      await loadMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Portal Messages
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {context.companyName}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Reply to your firm and keep each conversation attached to the right request.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex">
                <ShieldCheck className="h-4 w-4" />
                Secure workspace
              </div>

              <Link
                href="/portal/requests"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to requests
              </Link>
            </div>
          </div>

          {error ? (
            <div className="px-6 py-5">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          {successMessage ? (
            <div className="px-6 pb-0 pt-5">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                {successMessage}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total messages</div>
              <div className="mt-2 text-3xl font-semibold text-white">{totalMessages}</div>
              <div className="mt-1 text-xs text-slate-400">Messages in your portal history</div>
            </div>

            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Active threads</div>
              <div className="mt-2 text-3xl font-semibold text-white">{activeThreadCount}</div>
              <div className="mt-1 text-xs text-cyan-100/70">Request conversations with message activity</div>
            </div>

            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Selected thread</div>
              <div className="mt-2 text-lg font-semibold text-white">{selectedRequest?.title || "None selected"}</div>
              <div className="mt-1 text-xs text-amber-100/70">Choose a request to stay in context</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Your portal</div>
              <div className="mt-2 text-lg font-semibold text-white">{context.companyName || "Client Portal"}</div>
              <div className="mt-1 text-xs text-slate-400">Client-facing conversation workspace</div>
            </div>
          </div>

          <div className="grid min-h-[720px] lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-b border-white/10 lg:border-b-0 lg:border-r lg:border-white/10">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-sm font-semibold text-white">Request conversations</div>
                <div className="mt-1 text-sm text-slate-400">
                  Choose a request to view the full thread and reply in context.
                </div>
              </div>

              <div className="max-h-[620px] overflow-y-auto p-3">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="h-4 w-40 rounded bg-white/10" />
                        <div className="mt-3 h-3 w-24 rounded bg-white/5" />
                      </div>
                    ))}
                  </div>
                ) : requests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                    No request conversations yet. Once your firm opens a request thread, it will appear here.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {requests.map((request) => {
                      const active = request.id === selectedRequestId;
                      const threadMessages = messages.filter((message) => message.request_id === request.id);
                      const threadCount = threadMessages.length;
                      const lastMessage = threadMessages[threadMessages.length - 1] || null;

                      return (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => setSelectedRequestId(request.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? "border-cyan-300/20 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="text-sm font-semibold text-white">{request.title}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {request.filings?.filing_name || "General request"}
                          </div>
                          <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                            {lastMessage?.body || "No messages yet for this request."}
                          </div>
                          <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                            <MessageSquare className="h-3.5 w-3.5 text-cyan-200" />
                            {threadCount} message{threadCount === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>

            <section className="flex min-h-[720px] flex-col">
              <div className="border-b border-white/10 px-6 py-5">
                {selectedRequest ? (
                  <>
                    <div className="text-lg font-semibold text-white">{selectedRequest.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      {selectedRequest.filings?.filing_name ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                          <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
                          Related filing: {selectedRequest.filings.filing_name}
                        </span>
                      ) : null}
                      <Link
                        href={`/portal/upload?requestId=${selectedRequest.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload for this request
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-400">Select a request conversation to view messages and reply.</div>
                )}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="h-4 w-24 rounded bg-white/10" />
                      <div className="mt-3 h-3 w-full rounded bg-white/5" />
                    </div>
                  ))
                ) : filteredMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <MessageSquare className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div className="mt-4 text-base font-medium text-white">No messages yet</div>
                    <div className="mt-2 text-sm text-slate-400">
                      Send the first message below to get this request moving.
                    </div>
                  </div>
                ) : (
                  filteredMessages.map((message) => {
                    const mine = Boolean(message.is_from_client);

                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-2xl rounded-[24px] border px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.14)] ${
                            mine
                              ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-50"
                              : "border-white/10 bg-white/[0.04] text-slate-100"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>{message.sender_name || "Portal user"}</span>
                            <span>·</span>
                            <span>{formatDateTime(message.created_at)}</span>
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-6">
                            {message.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-white/10 px-6 py-5">
                <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    New message
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={selectedRequest ? "Write your reply..." : "Select a request to reply..."}
                    disabled={!selectedRequest || sending}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30 focus:bg-white/[0.06] disabled:opacity-60"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {selectedRequest
                        ? "Your message will stay attached to this request thread."
                        : "Choose a request conversation first."}
                    </div>

                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!selectedRequest || !draft.trim() || sending}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
