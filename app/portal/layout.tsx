"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, FileText, LayoutDashboard, LogOut, MessageSquare, ShieldCheck, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalAccessType = "client" | "none";


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


export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [accessType, setAccessType] = useState<PortalAccessType>("none");
  const [workspaceName, setWorkspaceName] = useState("Client Portal");

  useEffect(() => {
    async function verifyPortalAccess() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: clientMemberships }, { data: firmMemberships }, { data: workspaceMemberships }] =
        await Promise.all([
          supabase.from("client_members").select("firm_id, client_id, clients(client_name)").eq("user_id", user.id).limit(1),
          supabase.from("firm_members").select("firm_id").eq("user_id", user.id).limit(1),
          supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1),
        ]);

      const clientWorkspaceId = clientMemberships?.[0]?.firm_id || null;
      const internalWorkspaceId =
        firmMemberships?.[0]?.firm_id ||
        workspaceMemberships?.[0]?.workspace_id ||
        null;

      // Temporary testing behavior:
      // allow either a real client member or an internal firm/workspace user in,
      // but always render the portal as the client experience.
      const resolvedWorkspaceId = clientWorkspaceId || internalWorkspaceId;

      if (!resolvedWorkspaceId) {
        router.replace("/dashboard");
        return;
      }

      const clientName = normalizePortalDisplayName(
        clientMemberships?.[0]?.clients?.client_name ||
        user.user_metadata?.company_name ||
        user.user_metadata?.business_name ||
        null
      );

      setWorkspaceName(clientName || "Client Portal");
      setAccessType("client");
      setLoading(false);
    }

    verifyPortalAccess();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
            <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl border border-cyan-300/20 bg-cyan-400/10" />
            <div className="mt-4 text-lg font-semibold text-white">Loading portal</div>
            <div className="mt-2 text-sm text-slate-400">Checking portal access and preparing the client experience.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="border-b border-white/10 bg-[linear-gradient(to_bottom,rgba(10,18,32,0.96),rgba(6,12,23,0.98))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
              Client View
            </div>
            <div className="mt-1 text-lg font-semibold text-white">{workspaceName || "Client Portal"}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Secure portal
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
          <PortalNavItem href="/portal/dashboard" label="Dashboard" pathname={pathname} icon={<LayoutDashboard className="h-4 w-4" />} />
          <PortalNavItem href="/portal/requests" label="Requests" pathname={pathname} icon={<Bell className="h-4 w-4" />} />
          <PortalNavItem href="/portal/files" label="Files" pathname={pathname} icon={<FileText className="h-4 w-4" />} />
          <PortalNavItem href="/portal/upload" label="Upload" pathname={pathname} icon={<Upload className="h-4 w-4" />} />
          <PortalNavItem href="/portal/messages" label="Messages" pathname={pathname} icon={<MessageSquare className="h-4 w-4" />} />
          <PortalNavItem href="/logout" label="Logout" pathname={pathname} icon={<LogOut className="h-4 w-4" />} />
        </div>
      </div>

      {children}
    </div>
  );
}

function PortalNavItem({
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
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm transition ${
        active
          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
