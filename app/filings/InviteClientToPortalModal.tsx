"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send, UserPlus, X, Clock3, CheckCircle2, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ClientOption = {
  id: string;
  client_name: string;
};

type ExistingInvite = {
  id: string;
  email: string;
  contact_name: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
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

function statusPill(status: ExistingInvite["status"]) {
  switch (status) {
    case "pending":
      return "border-amber-300/20 bg-amber-400/10 text-amber-100";
    case "accepted":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    case "revoked":
      return "border-red-300/20 bg-red-400/10 text-red-100";
    case "expired":
      return "border-slate-300/15 bg-white/5 text-slate-300";
    default:
      return "border-slate-300/15 bg-white/5 text-slate-300";
  }
}


function statusLabel(status: ExistingInvite["status"]) {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}


function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function InviteClientToPortalModal({
  isOpen,
  onClose,
  firmId,
  currentUserId,
  clients,
  onInviteCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  firmId: string;
  currentUserId: string;
  clients: ClientOption[];
  onInviteCreated?: () => Promise<void> | void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [invites, setInvites] = useState<ExistingInvite[]>([]);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedClientId("");
      setContactName("");
      setEmail("");
      setError(null);
      setSuccess(null);
      setInvites([]);
      setLoadingInvites(false);
      setRevokingInviteId(null);
      setSending(false);
    }
  }, [isOpen]);

  const selectedClient = clients.find((client) => client.id === selectedClientId) || null;
  const pendingInviteCount = invites.filter((invite) => invite.status === "pending").length;
  const acceptedInviteCount = invites.filter((invite) => invite.status === "accepted").length;

  async function loadInvites(clientId: string) {
    if (!clientId) {
      setInvites([]);
      return;
    }

    setLoadingInvites(true);
    try {
      const { data, error: invitesError } = await supabase
        .from("client_portal_invites")
        .select("id, email, contact_name, status, created_at, expires_at")
        .eq("firm_id", firmId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (invitesError) throw invitesError;
      setInvites((data || []) as ExistingInvite[]);
    } catch (err) {
      console.error("Failed to load invites:", err);
      setError(err instanceof Error ? err.message : "Failed to load invites.");
    } finally {
      setLoadingInvites(false);
    }
  }

  async function handleClientChange(clientId: string) {
    setSelectedClientId(clientId);
    setError(null);
    setSuccess(null);
    await loadInvites(clientId);
  }

  async function handleCreateInvite() {
  setError(null);
  setSuccess(null);

  if (!selectedClientId) {
    setError("Choose a client first.");
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    setError("Enter an email address.");
    return;
  }

  if (!isValidEmail(normalizedEmail)) {
    setError("Enter a valid email address.");
    return;
  }

  const alreadyPending = invites.some(
    (invite) => invite.email.trim().toLowerCase() === normalizedEmail && invite.status === "pending"
  );

  if (alreadyPending) {
    setError("An active invite already exists for this email.");
    return;
  }

  setSending(true);

  try {
    const response = await fetch("/api/portal/invite-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firmId,
        clientId: selectedClientId,
        email: normalizedEmail,
        contactName: contactName.trim() || null,
        invitedByUserId: currentUserId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || "Failed to send invite.");
    }

    setSuccess("Portal invite sent. The client can now use the invite email to access the portal.");
    setEmail("");
    setContactName("");
    await loadInvites(selectedClientId);
    await onInviteCreated?.();
    emailInputRef.current?.focus();
  } catch (err) {
    console.error("Failed to create invite:", err);
    setError(err instanceof Error ? err.message : "Failed to create invite.");
  } finally {
    setSending(false);
  }
}


  async function handleVoidInvite(inviteId: string) {
    setError(null);
    setSuccess(null);
    setRevokingInviteId(inviteId);

    try {
      const { error: revokeError } = await supabase
        .from("client_portal_invites")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: currentUserId,
        })
        .eq("id", inviteId);

      if (revokeError) throw revokeError;

      setSuccess("Portal invite voided. The invite record is now marked as revoked.");
      await loadInvites(selectedClientId);
      await onInviteCreated?.();
    } catch (err) {
      console.error("Failed to void invite:", err);
      setError(err instanceof Error ? err.message : "Failed to void invite.");
    } finally {
      setRevokingInviteId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-5xl rounded-[30px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(10,18,32,0.985),rgba(6,12,23,0.995))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
              Client Portal
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">Invite Client</div>
            <div className="mt-2 text-sm leading-7 text-slate-400">
              Connect a real client contact to the portal so requests, files, and messages are scoped correctly.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
            aria-label="Close invite client modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected client</div>
            <div className="mt-2 text-lg font-semibold text-white">{selectedClient?.client_name || "None selected"}</div>
            <div className="mt-1 text-xs text-slate-400">Portal access will be scoped to this client</div>
          </div>

          <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Pending invites</div>
            <div className="mt-2 text-3xl font-semibold text-white">{pendingInviteCount}</div>
            <div className="mt-1 text-xs text-amber-100/70">Invites still waiting on acceptance</div>
          </div>

          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/80">Accepted</div>
            <div className="mt-2 text-3xl font-semibold text-white">{acceptedInviteCount}</div>
            <div className="mt-1 text-xs text-emerald-100/70">Contacts already active in the portal</div>
          </div>

          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Portal channel</div>
            <div className="mt-2 text-lg font-semibold text-white">Client Access</div>
            <div className="mt-1 text-xs text-cyan-100/70">Invites go to the live client portal experience</div>
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                Step 1
              </div>
              <div className="mt-2 text-lg font-semibold text-white">Choose the client workspace</div>

              <div className="mt-4">
                <select
                  value={selectedClientId}
                  onChange={(e) => void handleClientChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Select a client...</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.client_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                Step 2
              </div>
              <div className="mt-2 text-lg font-semibold text-white">Client login contact</div>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Contact name
                  </label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Optional contact name"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30 focus:bg-white/[0.06]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="client@example.com"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30 focus:bg-white/[0.06]"
                    />
                  </div>
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                  <div>{success}</div>
                  <div className="mt-1 text-emerald-100/80">
                    The client can use the invite email to create or access their portal login.
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleCreateInvite}
                disabled={sending}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? "Sending invite..." : "Send Invite"}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                What happens next
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <UserPlus className="mt-0.5 h-4 w-4 text-cyan-200" />
                  <div>A portal invite record is saved and tied to the selected client.</div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <Mail className="mt-0.5 h-4 w-4 text-cyan-200" />
                  <div>A real portal auth invite is sent to the email address above.</div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-200" />
                  <div>On first login, the client can access requests, files, uploads, and messages in the portal.</div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                Recent invites
              </div>

              <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-400/10 px-4 py-3 text-xs leading-6 text-amber-100/85">
                Voiding an invite marks this portal invite as revoked, but it does not delete an already-created Supabase auth account for that email.
              </div>

              <div className="mt-4 space-y-3">
                {loadingInvites ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="h-4 w-40 rounded bg-white/10" />
                      <div className="mt-3 h-3 w-24 rounded bg-white/5" />
                    </div>
                  ))
                ) : invites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
                    No invites yet — send the first one to grant portal access.
                  </div>
                ) : (
                  invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{invite.email}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {invite.contact_name || "No contact name"}
                          </div>
                        </div>

                        <span className={`rounded-full border px-2.5 py-1 text-xs ${statusPill(invite.status)}`}>
                          {statusLabel(invite.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Invited {formatDate(invite.created_at)}
                        </span>
                        <span>Expires {formatDate(invite.expires_at)}</span>
                      </div>

                      {invite.status === "pending" ? (
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => void handleVoidInvite(invite.id)}
                            disabled={revokingInviteId === invite.id || sending}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/15 disabled:opacity-60"
                          >
                            <Ban className="h-4 w-4" />
                            {revokingInviteId === invite.id ? "Voiding..." : "Void invite"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
