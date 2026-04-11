"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

        if (userError) {
          throw userError;
        }

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

        if (membershipError) {
          throw membershipError;
        }

        if (!membership) {
          if (!cancelled) {
            setMessage("No workspace membership found for this user.");
            setLoading(false);
          }
          return;
        }

        setFirmId(membership.firm_id);
        setCanEdit(membership.role === "owner" || membership.role === "admin");

        const { data: firm, error: firmError } = await supabase
          .from("firms")
          .select("settings")
          .eq("id", membership.firm_id)
          .single<FirmSettingsRow>();

        if (firmError) {
          throw firmError;
        }

        if (!cancelled && firm?.settings) {
          setSettings({
            allowInvites: firm.settings.allowInvites ?? true,
            requireRoleApproval: firm.settings.requireRoleApproval ?? true,
            allowStaffFilings: firm.settings.allowStaffFilings ?? true,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Failed to load team settings."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
      const { error } = await supabase
        .from("firms")
        .update({
          settings,
        })
        .eq("id", firmId);

      if (error) {
        throw error;
      }

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
          title="Team access controls"
          description="As your workspace grows, permissions and role clarity become critical."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading team settings...
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <ToggleRow
                  title="Allow team invites"
                  description="Workspace owners can invite new teammates."
                  enabled={settings.allowInvites}
                  disabled={!canEdit}
                  onChange={(val) =>
                    setSettings((prev) => ({ ...prev, allowInvites: val }))
                  }
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
            Owners and admins can update team access controls. Staff and clients can view the current settings,
            but they cannot change them.
          </div>
        </Panel>
      </div>
    </SettingsShell>
  );
}
