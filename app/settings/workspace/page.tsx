"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

type WorkspaceForm = {
  name: string;
  workspaceType: string;
  defaultState: string;
  supportEmail: string;
  autoCreateOnboardingDefaults: boolean;
  showFilingReminders: boolean;
  requireBulkConfirmations: boolean;
};

async function resolveWorkspaceId(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1);

  return memberships?.[0]?.workspace_id ?? null;
}

export default function WorkspaceSettingsPage() {
  const supabase = createClient();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkspaceForm>({
    name: "",
    workspaceType: "",
    defaultState: "",
    supportEmail: "",
    autoCreateOnboardingDefaults: true,
    showFilingReminders: true,
    requireBulkConfirmations: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadWorkspace() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const metadataWorkspaceId =
        typeof user.user_metadata?.workspace_id === "string" ? user.user_metadata.workspace_id : null;

      const resolvedWorkspaceId = metadataWorkspaceId || (await resolveWorkspaceId(supabase, user.id));

      if (!resolvedWorkspaceId) {
        setLoading(false);
        setMessage("No workspace found.");
        return;
      }

      setWorkspaceId(resolvedWorkspaceId);

      const { data: workspace, error } = await supabase
        .from("workspaces")
        .select("name, workspace_type, default_state, support_email, auto_create_onboarding_defaults, show_filing_reminders, require_bulk_confirmations")
        .eq("id", resolvedWorkspaceId)
        .single();

      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }

      setForm({
        name: workspace?.name || "",
        workspaceType: workspace?.workspace_type || "",
        defaultState: workspace?.default_state || "",
        supportEmail: workspace?.support_email || "",
        autoCreateOnboardingDefaults: workspace?.auto_create_onboarding_defaults ?? true,
        showFilingReminders: workspace?.show_filing_reminders ?? true,
        requireBulkConfirmations: workspace?.require_bulk_confirmations ?? false,
      });

      setLoading(false);
    }

    loadWorkspace();
  }, [supabase]);

  async function saveWorkspace() {
    if (!workspaceId) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("workspaces")
      .update({
        name: form.name,
        default_state: form.defaultState,
        support_email: form.supportEmail,
        auto_create_onboarding_defaults: form.autoCreateOnboardingDefaults,
        show_filing_reminders: form.showFilingReminders,
        require_bulk_confirmations: form.requireBulkConfirmations,
      })
      .eq("id", workspaceId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Workspace settings saved.");
  }

  return (
    <SettingsShell
      title="Workspace settings"
      description="Manage your firm or business identity, default preferences, and workspace-level operating controls."
    >
      <div className="space-y-6">
        <Panel
          title="Workspace details"
          description="This is the core identity of your workspace and the foundation for firm-wide settings."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading workspace...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Workspace name" value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} />
                <Field label="Workspace type" value={form.workspaceType} onChange={(value) => setForm((prev) => ({ ...prev, workspaceType: value }))} />
                <Field label="Default state" value={form.defaultState} onChange={(value) => setForm((prev) => ({ ...prev, defaultState: value }))} />
                <Field label="Support email" type="email" value={form.supportEmail} onChange={(value) => setForm((prev) => ({ ...prev, supportEmail: value }))} />
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Operational defaults"
          description="Choose workspace-wide defaults that shape how the rest of the app behaves."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading defaults...
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <ToggleRow
                  title="Auto-create onboarding defaults"
                  description="Create sensible default settings for newly added entities."
                  enabled={form.autoCreateOnboardingDefaults}
                  onChange={(next) => setForm((prev) => ({ ...prev, autoCreateOnboardingDefaults: next }))}
                />
                <ToggleRow
                  title="Show filing reminders"
                  description="Enable workspace-wide reminders for upcoming due dates."
                  enabled={form.showFilingReminders}
                  onChange={(next) => setForm((prev) => ({ ...prev, showFilingReminders: next }))}
                />
                <ToggleRow
                  title="Require confirmation before bulk changes"
                  description="Reduce accidental mass updates in filings and team settings."
                  enabled={form.requireBulkConfirmations}
                  onChange={(next) => setForm((prev) => ({ ...prev, requireBulkConfirmations: next }))}
                />
              </div>
              {message && <div className="mt-4 text-sm text-slate-300">{message}</div>}
              <SaveBar primary="Save Workspace Settings" onPrimaryClick={saveWorkspace} saving={saving} />
            </>
          )}
        </Panel>
      </div>
    </SettingsShell>
  );
}
