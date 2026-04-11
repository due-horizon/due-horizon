"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

type NotificationForm = {
  dueSoonReminders: boolean;
  overdueAlerts: boolean;
  workspaceActivityEmails: boolean;
  weeklySummaryDigest: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return (
      (typeof e.message === "string" && e.message) ||
      (typeof e.details === "string" && e.details) ||
      (typeof e.hint === "string" && e.hint) ||
      fallback
    );
  }

  return fallback;
}

export default function NotificationSettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<NotificationForm>({
    dueSoonReminders: true,
    overdueAlerts: true,
    workspaceActivityEmails: false,
    weeklySummaryDigest: true,
  });

  const [initialForm, setInitialForm] = useState<NotificationForm | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isDirty =
    initialForm &&
    JSON.stringify(form) !== JSON.stringify(initialForm);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase
          .from("user_notification_settings")
          .select(
            "due_soon_reminders, overdue_alerts, workspace_activity_emails, weekly_summary_digest"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        const nextForm: NotificationForm = {
          dueSoonReminders: data?.due_soon_reminders ?? true,
          overdueAlerts: data?.overdue_alerts ?? true,
          workspaceActivityEmails: data?.workspace_activity_emails ?? false,
          weeklySummaryDigest: data?.weekly_summary_digest ?? true,
        };

        if (!cancelled) {
          setForm(nextForm);
          setInitialForm(nextForm);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Failed to load settings."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function saveNotifications() {
    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in.");

      const { error } = await supabase
        .from("user_notification_settings")
        .upsert({
          user_id: user.id,
          due_soon_reminders: form.dueSoonReminders,
          overdue_alerts: form.overdueAlerts,
          workspace_activity_emails: form.workspaceActivityEmails,
          weekly_summary_digest: form.weeklySummaryDigest,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setInitialForm(form);
      setMessage("Notification settings saved.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  }

  function resetChanges() {
    if (initialForm) {
      setForm(initialForm);
      setMessage("Changes reverted.");
    }
  }

  return (
    <SettingsShell
      title="Notification settings"
      description="Choose when and how you want to be notified about filing activity, reminders, and workspace events."
    >
      <Panel
        title="Reminder preferences"
        description="Control the alerts that keep your team ahead of deadlines."
      >
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
            Loading notification settings...
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <ToggleRow
                title="Due soon reminders"
                description="Email reminders for filings due in the next 7 days."
                enabled={form.dueSoonReminders}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, dueSoonReminders: next }))
                }
              />

              <ToggleRow
                title="Overdue alerts"
                description="Immediate alerts when filings become overdue."
                enabled={form.overdueAlerts}
                onChange={(next) =>
                  setForm((prev) => ({ ...prev, overdueAlerts: next }))
                }
              />

              <ToggleRow
                title="Workspace activity emails"
                description="Notifications for major team activity."
                enabled={form.workspaceActivityEmails}
                onChange={(next) =>
                  setForm((prev) => ({
                    ...prev,
                    workspaceActivityEmails: next,
                  }))
                }
              />

              <ToggleRow
                title="Weekly summary digest"
                description="Weekly rollup of filings and activity."
                enabled={form.weeklySummaryDigest}
                onChange={(next) =>
                  setForm((prev) => ({
                    ...prev,
                    weeklySummaryDigest: next,
                  }))
                }
              />
            </div>

            {message && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            )}

            <SaveBar
              primary="Save Notification Preferences"
              onPrimaryClick={isDirty ? saveNotifications : undefined}
              saving={saving}
              disabled={!isDirty}
            />

            {isDirty && (
              <button
                onClick={resetChanges}
                className="mt-3 text-sm text-cyan-300 hover:text-cyan-200"
              >
                Reset changes
              </button>
            )}
          </>
        )}
      </Panel>
    </SettingsShell>
  );
}