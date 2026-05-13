"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Settings2, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

type TeamSettings = {
  allowInvites: boolean;
  requireRoleApproval: boolean;
  allowStaffFilings: boolean;
};

type FirmSettingsRow = {
  settings?: {
    allowInvites?: boolean;
    requireRoleApproval?: boolean;
    allowStaffFilings?: boolean;
  } | null;
};

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

export default function TeamSettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [firmId, setFirmId] = useState<string | null>(null);
  const [settings, setSettings] = useState<TeamSettings>({
    allowInvites: true,
    requireRoleApproval: true,
    allowStaffFilings: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [message, setMessage] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

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
          if (!cancelled) {
            setMessage("You must be signed in to manage team settings.");
            setLoading(false);
          }
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("firm_members")
          .select("firm_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (membershipError) throw membershipError;

        if (!membership) {
          if (!cancelled) {
            setMessage("No workspace membership found for this user.");
            setLoading(false);
          }
          return;
        }

        setFirmId(membership.firm_id);
        setCanEdit(membership.role === "owner" || membership.role === "admin");

        const [firmResult, memberCountResult, inviteCountResult] = await Promise.all([
          supabase.from("firms").select("settings").eq("id", membership.firm_id).single<FirmSettingsRow>(),
          supabase
            .from("firm_members")
            .select("id", { count: "exact", head: true })
            .eq("firm_id", membership.firm_id),
          supabase
            .from("team_invites")
            .select("id", { count: "exact", head: true })
            .eq("firm_id", membership.firm_id)
            .in("status", ["pending", "sent"]),
        ]);

        if (firmResult.error) throw firmResult.error;

        const inviteCountError = inviteCountResult.error;
        if (inviteCountError && inviteCountError.code !== "PGRST205" && inviteCountError.code !== "42P01") {
          throw inviteCountError;
        }

        if (!cancelled) {
          if (firmResult.data?.settings) {
            setSettings({
              allowInvites: firmResult.data.settings.allowInvites ?? true,
              requireRoleApproval: firmResult.data.settings.requireRoleApproval ?? true,
              allowStaffFilings: firmResult.data.settings.allowStaffFilings ?? true,
            });
          }

          setMemberCount(memberCountResult.count ?? 0);
          setPendingInviteCount(inviteCountResult.count ?? 0);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Failed to load team settings."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function save() {
    if (!firmId || !canEdit) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("firms").update({ settings }).eq("id", firmId);
      if (error) throw error;
      setMessage("Access controls saved.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell
      title="Team & access"
      description="Manage teammates, role permissions, and how users interact with your workspace."
    >
      <div className="space-y-6">
        <Panel
          title="Team management"
          description="Open the dedicated team workspace to invite people, review roles, and manage access."
        >
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-cyan-100">
                  <Users size={18} />
                </div>
                <div>
                  <div className="text-base font-semibold text-white">Dedicated team workspace</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">
                    Use the members page for invites, role badges, membership review, and future ownership actions.
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/settings/team/members"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.18)] transition hover:from-cyan-300 hover:to-blue-400"
                >
                  Manage team
                  <ArrowRight size={16} />
                </Link>

                <Link
                  href="/settings/team/members?invite=true"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08]"
                >
                  <UserPlus size={16} />
                  Invite teammate
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Members</div>
                <div className="mt-3 text-3xl font-semibold text-white">{loading ? "—" : memberCount}</div>
                <div className="mt-2 text-sm text-slate-400">Users with workspace access</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pending invites</div>
                <div className="mt-3 text-3xl font-semibold text-white">{loading ? "—" : pendingInviteCount}</div>
                <div className="mt-2 text-sm text-slate-400">Outstanding invite records</div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Team access controls"
          description="As your workspace grows, permissions and role clarity become critical."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading team settings...
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
                Invite people and manage member roles from the members page. These toggles control the overall workspace behavior.
              </div>

              <div className="space-y-3">
                <ToggleRow
                  title="Allow team invites"
                  description="Workspace owners and approved admins can invite new teammates."
                  enabled={settings.allowInvites}
                  disabled={!canEdit}
                  onChange={(val) => setSettings((prev) => ({ ...prev, allowInvites: val }))}
                />

                <ToggleRow
                  title="Require admin approval for role changes"
                  description="Prevent accidental permission escalation."
                  enabled={settings.requireRoleApproval}
                  disabled={!canEdit}
                  onChange={(val) =>
                    setSettings((prev) => ({
                      ...prev,
                      requireRoleApproval: val,
                    }))
                  }
                />

                <ToggleRow
                  title="Allow staff to manage filings"
                  description="Let non-admin staff update filings."
                  enabled={settings.allowStaffFilings}
                  disabled={!canEdit}
                  onChange={(val) =>
                    setSettings((prev) => ({
                      ...prev,
                      allowStaffFilings: val,
                    }))
                  }
                />
              </div>

              {!canEdit && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  You do not have permission to edit these settings.
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {message}
                </div>
              )}

              <SaveBar
                primary="Save Access Controls"
                onPrimaryClick={canEdit ? save : undefined}
                saving={saving}
                disabled={!canEdit}
              />
            </>
          )}
        </Panel>

        <Panel
          title="How this works"
          description="These settings control workspace-level access behavior and are stored on the firm record."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
              Owners and admins can update workspace-level team access controls. Staff and clients can view the current settings,
              but they cannot change them.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
              Only the members page should handle invite actions, role review, and future ownership transfer flows so the settings page stays clean.
            </div>
          </div>
        </Panel>
      </div>
    </SettingsShell>
  );
}
