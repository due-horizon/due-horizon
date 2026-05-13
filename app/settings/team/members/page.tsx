"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Panel, SettingsShell } from "../../_shared";

type MemberRole = "owner" | "admin" | "member" | "client" | "unknown";

type TeamMember = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: MemberRole;
  joinedAt: string | null;
};

type TeamInvite = {
  id: string;
  email: string;
  role: Exclude<MemberRole, "client" | "unknown">;
  status: string;
  createdAt: string | null;
};

type TeamSettings = {
  allowInvites: boolean;
  requireRoleApproval: boolean;
};

type FirmRecord = {
  name?: string | null;
  settings?: {
    allowInvites?: boolean;
    requireRoleApproval?: boolean;
  } | null;
};

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initialsFrom(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "DH";
  return cleaned
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function roleBadge(role: MemberRole) {
  switch (role) {
    case "owner":
      return "border-yellow-300/20 bg-yellow-400/10 text-yellow-200";
    case "admin":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
    case "member":
      return "border-white/10 bg-white/5 text-slate-300";
    case "client":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return (
      (typeof maybeError.message === "string" && maybeError.message) ||
      (typeof maybeError.details === "string" && maybeError.details) ||
      (typeof maybeError.hint === "string" && maybeError.hint) ||
      fallback
    );
  }
  return fallback;
}

function canCurrentUserInviteRole(currentRole: MemberRole, inviteRole: "member" | "admin") {
  if (currentRole === "owner") return true;
  if (currentRole === "admin") return inviteRole === "member";
  return false;
}

function normalizeMemberRole(role: string | null | undefined): MemberRole {
  if (role === "owner" || role === "admin" || role === "member" || role === "client") return role;
  if (role === "staff") return "member";
  return "unknown";
}

function getProfileLabel(profile: { full_name?: string | null; email?: string | null } | undefined, userId: string) {
  const name = profile?.full_name?.trim();
  if (name) return name;
  const email = profile?.email?.trim();
  if (email) return email;
  return userId;
}

function pickActiveMembership(
  rows: Array<{ firm_id: string; role: string | null; created_at?: string | null }>,
  metadataFirmId: string | null
) {
  if (!rows.length) return null;

  if (metadataFirmId) {
    const metadataMatch = rows.find((row) => row.firm_id === metadataFirmId);
    if (metadataMatch) return metadataMatch;
  }

  return (
    rows.find((row) => row.role === "owner") ||
    rows.find((row) => row.role === "admin") ||
    rows[0]
  );
}

function TeamMembersContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [firmName, setFirmName] = useState("Workspace");
  const [firmId, setFirmId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<MemberRole>("unknown");
  const [settings, setSettings] = useState<TeamSettings>({
    allowInvites: true,
    requireRoleApproval: true,
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [search, setSearch] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const canManage = currentRole === "owner" || currentRole === "admin";
  const canInvite = canManage && settings.allowInvites;
  const owners = members.filter((member) => member.role === "owner").length;
  const admins = members.filter((member) => member.role === "admin").length;

  useEffect(() => {
    if (searchParams.get("invite") === "true") {
      setIsInviteOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) {
          router.replace("/login");
          return;
        }

        const metadataFirmId =
          typeof user.user_metadata?.firm_id === "string"
            ? user.user_metadata.firm_id
            : typeof user.user_metadata?.workspace_id === "string"
              ? user.user_metadata.workspace_id
              : null;

        const { data: memberships, error: membershipError } = await supabase
          .from("firm_members")
          .select("firm_id, role, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (membershipError) throw membershipError;

        const membership = pickActiveMembership(
          (memberships ?? []) as Array<{ firm_id: string; role: string | null; created_at?: string | null }>,
          metadataFirmId
        );

        if (!membership) {
          if (!cancelled) {
            setMessage("No workspace membership found for this user.");
            setLoading(false);
          }
          return;
        }

        const activeFirmId = membership.firm_id;
        const safeCurrentRole = normalizeMemberRole(membership.role);

        const [firmResult, membersResult] = await Promise.all([
          supabase.from("firms").select("name, settings").eq("id", activeFirmId).single<FirmRecord>(),
          supabase
            .from("firm_members")
            .select("id, user_id, role, created_at")
            .eq("firm_id", activeFirmId)
            .order("created_at", { ascending: true }),
        ]);

        if (firmResult.error) throw firmResult.error;
        if (membersResult.error) throw membersResult.error;

        const memberRows = (membersResult.data ?? []) as Array<{
          id: string;
          user_id: string;
          role: string | null;
          created_at: string | null;
        }>;

        const userIds = Array.from(new Set(memberRows.map((row) => row.user_id).filter(Boolean)));
        let profileMap = new Map<string, { full_name?: string | null; email?: string | null }>();

        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", userIds);

          if (profilesError && profilesError.code !== "PGRST205" && profilesError.code !== "42P01") {
            throw profilesError;
          }

          profileMap = new Map(
            ((profilesData ?? []) as Array<{ user_id: string; full_name?: string | null; email?: string | null }>).map((profile) => [
              profile.user_id,
              { full_name: profile.full_name, email: profile.email },
            ])
          );
        }

        let inviteRows: Array<{
          id: string;
          email: string;
          role: "owner" | "admin" | "member";
          status?: string | null;
          created_at: string | null;
        }> = [];

        const invitesWithStatus = await supabase
          .from("team_invites")
          .select("id, email, role, status, created_at")
          .eq("firm_id", activeFirmId)
          .in("status", ["pending", "sent"])
          .order("created_at", { ascending: false });

        if (!invitesWithStatus.error) {
          inviteRows = (invitesWithStatus.data ?? []) as typeof inviteRows;
        } else if (invitesWithStatus.error.code === "PGRST205" || invitesWithStatus.error.code === "42P01") {
          inviteRows = [];
        } else if (
          invitesWithStatus.error.code === "42703" ||
          String(invitesWithStatus.error.message || "").toLowerCase().includes("status")
        ) {
          const invitesWithoutStatus = await supabase
            .from("team_invites")
            .select("id, email, role, created_at")
            .eq("firm_id", activeFirmId)
            .order("created_at", { ascending: false });

          if (invitesWithoutStatus.error && invitesWithoutStatus.error.code !== "PGRST205" && invitesWithoutStatus.error.code !== "42P01") {
            throw invitesWithoutStatus.error;
          }

          inviteRows = ((invitesWithoutStatus.data ?? []) as Array<{
            id: string;
            email: string;
            role: "owner" | "admin" | "member";
            created_at: string | null;
          }>).map((row) => ({ ...row, status: "pending" }));
        } else {
          throw invitesWithStatus.error;
        }

        if (!cancelled) {
          setFirmId(activeFirmId);
          setCurrentRole(safeCurrentRole);
          setFirmName(firmResult.data?.name || "Workspace");
          setSettings({
            allowInvites: firmResult.data?.settings?.allowInvites ?? true,
            requireRoleApproval: firmResult.data?.settings?.requireRoleApproval ?? true,
          });

          setMembers(
            memberRows.map((row) => {
              const profile = profileMap.get(row.user_id);
              return {
                id: row.id,
                userId: row.user_id,
                displayName: getProfileLabel(profile, row.user_id),
                email: profile?.email || "",
                role: normalizeMemberRole(row.role),
                joinedAt: row.created_at,
              };
            })
          );

          setPendingInvites(
            inviteRows.map((row) => ({
              id: row.id,
              email: row.email,
              role: row.role === "owner" ? "admin" : row.role,
              status: row.status || "pending",
              createdAt: row.created_at,
            }))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Failed to load team members."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsInviteOpen(false);
        setMenuId(null);
        setMenuPosition(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleMemberMenu(memberId: string, button: HTMLButtonElement) {
    if (menuId === memberId) {
      setMenuId(null);
      setMenuPosition(null);
      return;
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 224;
    const viewportPadding = 16;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - 180);

    setMenuId(memberId);
    setMenuPosition({ top, left });
  }

  async function submitInvite() {
    const email = inviteEmail.trim().toLowerCase();
    setMessage("");

    if (!firmId) {
      setMessage("No workspace found for this user.");
      return;
    }

    if (!canInvite) {
      setMessage("You do not have permission to send invites.");
      return;
    }

    if (!settings.allowInvites) {
      setMessage("Invites are currently disabled in team settings.");
      return;
    }

    if (!email) {
      setMessage("Enter an email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address.");
      return;
    }

    if (!canCurrentUserInviteRole(currentRole, inviteRole)) {
      setMessage("Only owners can invite admins. Admins can invite members only.");
      return;
    }

    if (pendingInvites.some((invite) => invite.email.toLowerCase() === email)) {
      setMessage("That email already has a pending invite.");
      return;
    }

    setInviteSubmitting(true);

    try {
      let createdInvite: {
        id: string;
        email: string;
        role: "admin" | "member";
        status?: string | null;
        created_at: string | null;
      } | null = null;

      const withStatus = await supabase
        .from("team_invites")
        .insert({
          firm_id: firmId,
          email,
          role: inviteRole,
          status: "pending",
        })
        .select("id, email, role, status, created_at")
        .single();

      if (!withStatus.error) {
        createdInvite = withStatus.data;
      } else if (
        withStatus.error.code === "42703" ||
        String(withStatus.error.message || "").toLowerCase().includes("status")
      ) {
        const withoutStatus = await supabase
          .from("team_invites")
          .insert({
            firm_id: firmId,
            email,
            role: inviteRole,
          })
          .select("id, email, role, created_at")
          .single();

        if (withoutStatus.error) throw withoutStatus.error;
        createdInvite = { ...withoutStatus.data, status: "pending" };
      } else {
        throw withStatus.error;
      }

      if (!createdInvite) throw new Error("Failed to create invite.");

      setPendingInvites((prev) => [
        {
          id: createdInvite.id,
          email: createdInvite.email,
          role: createdInvite.role,
          status: createdInvite.status || "pending",
          createdAt: createdInvite.created_at,
        },
        ...prev,
      ]);
      setInviteEmail("");
      setInviteRole("member");
      setIsInviteOpen(false);
      setMessage("Invite created. Next step is wiring email delivery to your invite backend.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to create invite."));
    } finally {
      setInviteSubmitting(false);
    }
  }

  const filteredMembers = members.filter((member) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      member.userId.toLowerCase().includes(q) ||
      member.displayName.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q)
    );
  });

  return (
    <SettingsShell
      title="Team members"
      description="Invite teammates, review roles, and keep workspace access clean."
    >
      <div className="space-y-6">
        <Panel
          title="Members workspace"
          description="Use this page for active members, pending invites, and role visibility."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">Workspace</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{firmName}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    Owners manage everything. Admins can help run the workspace. Members work inside their assigned areas.
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/settings/team"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    <ArrowLeft size={16} />
                    Back to settings
                  </Link>

                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(true)}
                    disabled={!canInvite}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserPlus size={16} />
                    Invite teammate
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <SummaryCard label="Members" value={String(members.length)} helper="Active workspace users" icon={<Users size={16} />} />
                <SummaryCard label="Owners / Admins" value={`${owners} / ${admins}`} helper="Elevated access" icon={<ShieldCheck size={16} />} />
                <SummaryCard label="Pending" value={String(pendingInvites.length)} helper="Outstanding invites" icon={<Mail size={16} />} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current permissions</div>
              <div className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] ${roleBadge(currentRole)}`}>
                {titleCase(currentRole)}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-300">
                {currentRole === "owner"
                  ? "You can invite members and admins, review roles, and handle future ownership workflows."
                  : currentRole === "admin"
                  ? "You can invite members when invites are enabled, but only owners should elevate roles."
                  : "You can view team access, but you do not have invite or role management permissions."}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                Invite setting: <span className="text-white">{settings.allowInvites ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>
        </Panel>

        {message && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">{message}</div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Panel
            title="Active members"
            description="Review who currently has workspace access."
          >
            <div className="space-y-4">
              <div className="relative max-w-md">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Search size={16} />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or role..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.055] py-3 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.07]"
                />
              </div>

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
                  Loading members...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
                  No members match your search.
                </div>
              ) : (
                <div className="divide-y divide-white/5 overflow-visible rounded-2xl border border-white/10 bg-white/[0.02]">
                  {filteredMembers.map((member) => {
                    const canChangeThisRole = currentRole === "owner" && member.role !== "owner";
                    return (
                      <div key={member.id} className="relative flex flex-col gap-4 overflow-visible px-4 py-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-semibold text-slate-950">
                            {initialsFrom(member.displayName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-medium text-white sm:text-base">{member.displayName}</div>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${roleBadge(member.role)}`}>
                                {titleCase(member.role)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{member.email || member.userId} • Joined {formatDate(member.joinedAt)}</div>
                          </div>
                        </div>

                        <div className="relative self-start md:self-auto">
                          <button
                            type="button"
                            onClick={(event) => toggleMemberMenu(member.id, event.currentTarget)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08]"
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {menuId === member.id && menuPosition && (
                            <div
                              className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#08101d] shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
                              style={{ top: menuPosition.top, left: menuPosition.left }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuId(null);
                                  setMenuPosition(null);
                                }}
                                className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                              >
                                View member
                              </button>
                              {canChangeThisRole ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuId(null);
                                    setMenuPosition(null);
                                    setMessage("Wire this menu to updateTeamMemberRole in /settings/team/_actions/team-role-actions.ts.");
                                  }}
                                  className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                >
                                  Change role
                                </button>
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500">
                                  {member.role === "owner" ? "Ownership is protected." : "Only owners can change roles."}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="Pending invites"
            description="Track invites that have not been accepted yet."
          >
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
                Loading invites...
              </div>
            ) : pendingInvites.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
                No pending invites yet.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{invite.email}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold tracking-[0.16em] ${roleBadge(invite.role)}`}>
                            {titleCase(invite.role)}
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{titleCase(invite.status)}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Created {formatDate(invite.createdAt)}</div>
                      </div>
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-100">
                        <CheckCircle2 size={15} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-cyan-300/80">INVITE TEAMMATE</div>
                <div className="mt-2 text-xl font-semibold text-white">Add someone to {firmName}</div>
                <div className="mt-2 text-sm text-slate-400">
                  Owners can invite admins or members. Admins can invite members only.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label="Close invite modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {!canInvite && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  {settings.allowInvites
                    ? "You do not have permission to send invites."
                    : "Invites are currently disabled in team settings."}
                </div>
              )}

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Email</div>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.07]"
                />
              </div>

              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Role</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["member", "admin"] as const).map((role) => {
                    const selected = inviteRole === role;
                    const allowed = canCurrentUserInviteRole(currentRole, role);
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => allowed && setInviteRole(role)}
                        disabled={!allowed}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.10)]"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                        } ${!allowed ? "cursor-not-allowed opacity-50" : ""}`}
                      >
                        <div className="text-sm font-semibold text-white">{titleCase(role)}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">
                          {role === "admin" ? "Manage team and workflow" : "Work inside assigned areas"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-slate-300">
                This page creates the invite record now. Your next step is wiring email delivery or an edge function to send the actual invite message.
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitInvite}
                disabled={inviteSubmitting || !canInvite}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {inviteSubmitting ? "Creating..." : "Create invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}

function SummaryCard({
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-400">{helper}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-white">{icon}</div>
      </div>
    </div>
  );
}


export default function TeamMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020617] text-sm text-slate-400">
          Loading team members...
        </div>
      }
    >
      <TeamMembersContent />
    </Suspense>
  );
}
