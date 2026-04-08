"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type MemberRole = "owner" | "admin" | "member" | "unknown";

type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  joinedAt: string | null;
  status: "active";
};

type PendingInvite = {
  id: string;
  email: string;
  role: Exclude<MemberRole, "unknown">;
  sentAt: string;
  status: "Pending";
};

type FirmSummary = {
  firmName: string;
  firmType: "firm" | "business" | "unknown";
  plan: string;
  entityCount: number;
};

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
};

const roleOptions: Exclude<MemberRole, "unknown">[] = ["owner", "admin", "member"];

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

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roleBadge(role: MemberRole) {
  switch (role) {
    case "owner":
      return "border-yellow-300/20 bg-yellow-400/10 text-yellow-200";
    case "admin":
      return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
    case "member":
      return "border-white/10 bg-white/5 text-slate-300";
    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

function initialsFrom(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "DH";
  return cleaned
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function niceMemberName(userId: string, email?: string | null) {
  if (email) {
    const local = email.split("@")[0] || "";
    return local
      .split(/[._-]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return `Member ${userId.slice(0, 6)}`;
}

export default function TeamPage() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const [firmSummary, setFirmSummary] = useState<FirmSummary>({
    firmName: "",
    firmType: "unknown",
    plan: "starter",
    entityCount: 0,
  });
  const [memberRole, setMemberRole] = useState<MemberRole>("unknown");
  const [userInitials, setUserInitials] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [search, setSearch] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, "unknown">>("member");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const canManageTeam = memberRole === "owner" || memberRole === "admin";
  const businessNavLabel = firmSummary.firmType === "firm" ? "Clients" : "Businesses";

  function showToast(tone: ToastTone, title: string, body?: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, title, body }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

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

      if (!target.closest('[data-menu-root="true"]')) {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isInviteModalOpen) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isInviteModalOpen]);

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

  async function loadTeamPage() {
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

    setUserInitials(initialsFrom(nameFromUser));

    const resolvedFirmId = await resolveFirmId(
      user.id,
      typeof user.user_metadata?.firm_id === "string"
        ? user.user_metadata.firm_id
        : typeof user.user_metadata?.workspace_id === "string"
          ? user.user_metadata.workspace_id
          : null
    );

    if (!resolvedFirmId) {
      setLoading(false);
      return;
    }

    const [
      { data: membership },
      { data: firm },
      { data: clients },
      { data: organizations },
      { data: firmMembers, error: membersError },
    ] = await Promise.all([
      supabase
        .from("firm_members")
        .select("role")
        .eq("firm_id", resolvedFirmId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("firms")
        .select("id, name, type, plan")
        .eq("id", resolvedFirmId)
        .single(),
      supabase
        .from("clients")
        .select("id")
        .eq("firm_id", resolvedFirmId),
      supabase
        .from("organizations")
        .select("id")
        .eq("firm_id", resolvedFirmId),
      supabase
        .from("firm_members")
        .select("id, user_id, role, created_at")
        .eq("firm_id", resolvedFirmId)
        .order("created_at", { ascending: true }),
    ]);

    if (membersError) {
      console.error(membersError);
      showToast("error", "Couldn’t load team members");
      setLoading(false);
      return;
    }

    const roleValue = String(membership?.role || "unknown").toLowerCase();
    setMemberRole(
      roleValue === "owner" || roleValue === "admin" || roleValue === "member"
        ? (roleValue as MemberRole)
        : "unknown"
    );

    const mappedMembers: TeamMember[] = ((firmMembers || []) as Array<{
      id: string;
      user_id: string;
      role: string | null;
      created_at: string | null;
    }>).map((memberRow) => {
      const derivedRole = String(memberRow.role || "member").toLowerCase();
      const safeRole =
        derivedRole === "owner" || derivedRole === "admin" || derivedRole === "member"
          ? (derivedRole as MemberRole)
          : "member";

      return {
        id: memberRow.id,
        userId: memberRow.user_id,
        name: niceMemberName(memberRow.user_id),
        email: `${memberRow.user_id.slice(0, 8)}@workspace.member`,
        role: safeRole,
        joinedAt: memberRow.created_at,
        status: "active",
      };
    });

    setMembers(mappedMembers);
    setFirmSummary({
      firmName: firm?.name || "",
      firmType: firm?.type || "unknown",
      plan: firm?.plan || "starter",
      entityCount:
        firm?.type === "firm"
          ? (clients || []).length
          : (organizations || []).length,
    });
    setLoading(false);
  }

  useEffect(() => {
    loadTeamPage();
  }, []);

  async function submitInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      showToast("error", "Email is required");
      return;
    }

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      showToast("error", "Enter a valid email address");
      return;
    }

    if (!canManageTeam) {
      showToast("error", "You do not have permission to invite members");
      return;
    }

    setInviteSubmitting(true);

    const duplicateInvite = pendingInvites.some((invite) => invite.email === email);
    if (duplicateInvite) {
      showToast("info", "Invite already staged", "That email is already in the pending list.");
      setInviteSubmitting(false);
      return;
    }

    const duplicateMember = members.some((member) => member.email === email);
    if (duplicateMember) {
      showToast("info", "Already on this workspace", "That person is already a member.");
      setInviteSubmitting(false);
      return;
    }

    const newInvite: PendingInvite = {
      id: `${Date.now()}`,
      email,
      role: inviteRole,
      sentAt: new Date().toISOString(),
      status: "Pending",
    };

    setPendingInvites((prev) => [newInvite, ...prev]);
    setInviteEmail("");
    setInviteRole("member");
    setInviteSubmitting(false);
    setIsInviteModalOpen(false);
    showToast(
      "success",
      "Invite staged",
      "This UI is ready. Wire the submit action to your real invite backend next."
    );
  }

  function removePendingInvite(id: string) {
    setPendingInvites((prev) => prev.filter((invite) => invite.id !== id));
    setOpenMenuId(null);
    showToast("success", "Pending invite removed");
  }

  const filteredMembers = members.filter((member) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      member.name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q)
    );
  });

  const owners = members.filter((member) => member.role === "owner").length;
  const admins = members.filter((member) => member.role === "admin").length;
  const totalSeatsShown = members.length + pendingInvites.length;

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
                          <div className="mt-1 truncate whitespace-nowrap text-[11px] text-slate-400">Compliance OS</div>
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
                    <SidebarNavItem href="/calendar" label="Calendar" icon={Calendar} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem href="/reports" label="Reports" icon={CheckCircle2} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem href="/businesses" label={businessNavLabel} icon={Building2} pathname={pathname} collapsed={isSidebarCollapsed} />
                    <SidebarNavItem
                      href="/team"
                      label="Team"
                      icon={Users}
                      pathname={pathname}
                      collapsed={isSidebarCollapsed}
                      badge={memberRole === "owner" ? "Owner" : memberRole === "admin" ? "Admin" : undefined}
                    />
                    <SidebarNavItem href="/settings" label="Settings" icon={Settings} pathname={pathname} collapsed={isSidebarCollapsed} />
                  </nav>

                  {!isSidebarCollapsed && (
                    <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(15,23,42,0.4))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">WORKSPACE</div>
                          <div className="mt-2 text-sm font-semibold text-white">{firmSummary.firmName || "Due Horizon"}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {firmSummary.plan} plan • {firmSummary.firmType === "firm" ? "Accounting firm" : firmSummary.firmType === "business" ? "Business" : "Workspace"}
                          </div>
                        </div>
                        <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                          Live
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <WorkspaceStat label="Members" value={String(members.length)} helper="Active workspace users" />
                        <WorkspaceStat label="Pending" value={String(pendingInvites.length)} helper="Invites waiting to be accepted" />
                        <WorkspaceStat label="Entities" value={String(firmSummary.entityCount)} helper="Tracked in workspace" />
                      </div>
                    </div>
                  )}
                </div>

                <div className={`${isSidebarCollapsed ? "p-3" : "p-4"} border-t border-white/10`}>
                  {!isSidebarCollapsed ? (
                    <div className="rounded-2xl border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                      <div className="text-sm font-semibold text-white">Need another seat?</div>
                      <div className="mt-1 text-xs leading-5 text-slate-300">
                        Team management belongs here. Keep invites, roles, and access clean and visible.
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsInviteModalOpen(true)}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400"
                      >
                        Invite Member
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(true)}
                      className="flex h-12 w-full items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/15"
                      title="Invite Member"
                    >
                      <UserPlus size={18} />
                    </button>
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
                        <div className="text-xs font-semibold tracking-[0.18em] text-cyan-300/80">TEAM</div>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                          Manage everyone in this workspace
                        </h1>
                        <p className="mt-2 text-slate-400">
                          Invite staff, manage roles, and keep workspace access clean as you grow.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 self-start xl:self-auto">
                      <button
                        type="button"
                        onClick={() => setIsInviteModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                      >
                        <UserPlus size={16} />
                        Invite Member
                      </button>

                      <Link
                        href="/settings"
                        className="hidden sm:inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                      >
                        Workspace Settings →
                      </Link>

                      <button
                        type="button"
                        className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                      >
                        <Bell size={18} />
                      </button>

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
                            <div className="text-xs text-slate-400">{firmSummary.firmName}</div>
                          </div>
                          <div className={`text-xs text-slate-400 transition ${isProfileOpen ? "rotate-180" : ""}`}>⌄</div>
                        </button>

                        {isProfileOpen && (
                          <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <div className="border-b border-white/10 px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-semibold text-slate-950">
                                  {userInitials}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-white">{firmSummary.firmName}</div>
                                  <div className="mt-1 text-xs text-slate-400">
                                    {firmSummary.firmType === "firm"
                                      ? "Accounting firm"
                                      : firmSummary.firmType === "business"
                                      ? "Business"
                                      : "Workspace"} • {memberRole}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="py-2">
                              <DropdownItem href="/team" label="Manage Team" icon={<Users size={15} />} />
                              <DropdownItem href="/settings/account" label="Account Settings" icon={<Settings size={15} />} />
                            </div>

                            <div className="mx-3 h-px bg-white/10" />

                            <div className="py-2">
                              <DropdownItem href="/support" label="Help / Support" icon={<LifeBuoy size={15} />} />
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
                    <MobileNavPill href="/team" label="Team" pathname={pathname} />
                    <MobileNavPill href="/settings" label="Settings" pathname={pathname} />
                  </div>
                </div>

                <div className="px-4 py-6 sm:px-6 sm:py-8">
                  <div className="mx-auto max-w-[1280px]">
                    <div className="mb-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <span>Plan</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-slate-300">{firmSummary.plan}</span>
                      <span className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-2 py-1 text-cyan-200">{memberRole}</span>
                    </div>

                    <div className="grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
                      <TeamStatCard label="ACTIVE MEMBERS" value={String(members.length)} sub="People with workspace access" icon={<Users size={19} />} accent="cyan" />
                      <TeamStatCard label="OWNERS" value={String(owners)} sub="Full workspace control" icon={<Crown size={19} />} accent="yellow" />
                      <TeamStatCard label="ADMINS" value={String(admins)} sub="Can manage team and workflow" icon={<ShieldCheck size={19} />} accent="green" />
                      <TeamStatCard label="TOTAL SHOWN" value={String(totalSeatsShown)} sub="Members plus pending invites" icon={<Mail size={19} />} accent="blue" />
                    </div>

                    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
                      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                        <div className="border-b border-white/10 px-5 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <div className="text-sm font-semibold text-white">Workspace members</div>
                              <div className="mt-1 text-sm text-slate-400">
                                Owners can manage billing and roles. Admins can help run the workspace.
                              </div>
                            </div>

                            <div className="relative w-full max-w-sm">
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
                          </div>
                        </div>

                        {loading ? (
                          <div className="px-5 py-8 text-sm text-slate-400">Loading team members...</div>
                        ) : filteredMembers.length === 0 ? (
                          <div className="px-5 py-8 text-sm text-slate-400">No members match your search.</div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {filteredMembers.map((member) => (
                              <div
                                key={member.id}
                                className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                              >
                                <div className="flex min-w-0 items-center gap-4">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-semibold text-slate-950">
                                    {initialsFrom(member.name)}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-medium text-white sm:text-base">{member.name}</div>
                                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] ${roleBadge(member.role)}`}>
                                        {titleCase(member.role)}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-sm text-slate-400">{member.email}</div>
                                    <div className="mt-1 text-xs text-slate-500">Joined {formatDate(member.joinedAt)}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                                  >
                                    {member.role === "owner" ? "Owner" : "Role"}
                                  </button>

                                  <TeamMenu rowId={member.id} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}>
                                    <button
                                      type="button"
                                      onClick={() => setOpenMenuId(null)}
                                      className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                    >
                                      View member
                                    </button>
                                    {member.role !== "owner" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          showToast("info", "Role changes next", "Wire these actions to your permissions backend when ready.");
                                        }}
                                        className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                      >
                                        Change role
                                      </button>
                                    )}
                                    {member.role !== "owner" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          showToast("info", "Remove member next", "Hook this action to your workspace membership delete flow.");
                                        }}
                                        className="block w-full px-4 py-3 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                                      >
                                        Remove from workspace
                                      </button>
                                    )}
                                  </TeamMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">INVITE FLOW</div>
                              <div className="mt-2 text-lg font-semibold text-white">Add staff fast</div>
                              <div className="mt-2 text-sm leading-7 text-slate-300">
                                This page gives the owner a clear home for invites and role management instead of burying it in settings.
                              </div>
                            </div>
                            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-3 text-cyan-200">
                              <UserPlus size={20} />
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => setIsInviteModalOpen(true)}
                              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400"
                            >
                              Invite Team Member
                            </button>
                            <Link
                              href="/settings"
                              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
                            >
                              Workspace Settings
                            </Link>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                          <div className="border-b border-white/10 px-5 py-4">
                            <div className="text-sm font-semibold text-white">Pending invites</div>
                            <div className="mt-1 text-sm text-slate-400">These are staged in the UI and ready for your real invite backend hookup.</div>
                          </div>

                          {pendingInvites.length === 0 ? (
                            <div className="px-5 py-8 text-sm text-slate-400">No pending invites yet.</div>
                          ) : (
                            <div className="divide-y divide-white/5">
                              {pendingInvites.map((invite) => (
                                <div key={invite.id} className="flex flex-col gap-4 px-5 py-4">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-white">{invite.email}</div>
                                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold tracking-[0.16em] ${roleBadge(invite.role)}`}>
                                          {titleCase(invite.role)}
                                        </span>
                                        <span className="text-slate-500">•</span>
                                        <span className="text-slate-400">Sent {formatDate(invite.sentAt)}</span>
                                      </div>
                                    </div>

                                    <TeamMenu rowId={invite.id} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuId(null);
                                          showToast("info", "Resend next", "Wire resend to your invite email backend.");
                                        }}
                                        className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
                                      >
                                        Resend invite
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removePendingInvite(invite.id)}
                                        className="block w-full px-4 py-3 text-left text-sm text-red-300 transition hover:bg-red-500/10"
                                      >
                                        Cancel invite
                                      </button>
                                    </TeamMenu>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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

      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
              <div>
                <div className="text-xs font-semibold tracking-[0.18em] text-cyan-300/80">INVITE MEMBER</div>
                <div className="mt-2 text-xl font-semibold text-white">Add someone to the workspace</div>
                <div className="mt-2 text-sm text-slate-400">
                  This modal is ready for your real invite backend. Right now it stages pending invites in the UI.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label="Close invite modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
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
                <div className="grid gap-3 sm:grid-cols-3">
                  {roleOptions.map((role) => {
                    const selected = inviteRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setInviteRole(role)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          selected
                            ? "border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.10)]"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="text-sm font-semibold text-white">{titleCase(role)}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-400">
                          {role === "owner"
                            ? "Full workspace control"
                            : role === "admin"
                            ? "Manage team and workflow"
                            : "Work inside assigned areas"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">NEXT BACKEND STEP</div>
                <div className="mt-2 text-sm leading-7 text-slate-300">
                  Hook this submit action to your real invite flow, such as an invites table plus email delivery or an edge function that creates and sends the invite.
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitInvite}
                disabled={inviteSubmitting}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {inviteSubmitting ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </main>
  );
}

function WorkspaceStat({
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

function TeamStatCard({
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
  accent: "cyan" | "yellow" | "green" | "blue";
}) {
  const accentMap = {
    cyan: "border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,47,73,0.18),rgba(15,23,42,0.06))] text-cyan-200",
    yellow: "border-yellow-300/15 bg-[linear-gradient(180deg,rgba(202,138,4,0.16),rgba(120,53,15,0.05))] text-yellow-200",
    green: "border-emerald-400/15 bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(4,47,46,0.05))] text-emerald-200",
    blue: "border-blue-400/15 bg-[linear-gradient(180deg,rgba(30,58,138,0.16),rgba(15,23,42,0.05))] text-blue-200",
  }[accent];

  return (
    <div className={`h-full rounded-3xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)] transition hover:-translate-y-[2px] ${accentMap}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-3 text-4xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-300">{sub}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 text-white">{icon}</div>
      </div>
    </div>
  );
}

function TeamMenu({
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
        <div className="absolute right-0 top-full z-[999] mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(12,21,37,0.98),rgba(8,15,28,0.98))] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
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
