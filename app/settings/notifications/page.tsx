"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

type NotificationForm = {
  dueSoonReminders: boolean;
  overdueAlerts: boolean;
  workspaceActivityEmails: boolean;
  weeklySummaryDigest: boolean;
};

export default function NotificationSettingsPage() {
  const supabase = createClient();

  const [form, setForm] = useState<NotificationForm>({
    dueSoonReminders: true,
    overdueAlerts: true,
    workspaceActivityEmails: false,
    weeklySummaryDigest: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_notification_settings")
        .select("due_soon_reminders, overdue_alerts, workspace_activity_emails, weekly_summary_digest")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        setLoading(false);
        setMessage(error.message);
        return;
      }

      setForm({
        dueSoonReminders: data?.due_soon_reminders ?? true,
        overdueAlerts: data?.overdue_alerts ?? true,
        workspaceActivityEmails: data?.workspace_activity_emails ?? false,
        weeklySummaryDigest: data?.weekly_summary_digest ?? true,
      });

      setLoading(false);
    }

    loadNotifications();
  }, [supabase]);

  async function saveNotifications() {
    setSaving(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      setMessage("You must be signed in.");
      return;
    }

    const { error } = await supabase.from("user_notification_settings").upsert({
      user_id: user.id,
      due_soon_reminders: form.dueSoonReminders,
      overdue_alerts: form.overdueAlerts,
      workspace_activity_emails: form.workspaceActivityEmails,
      weekly_summary_digest: form.weeklySummaryDigest,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Notification settings saved.");
  }

  return (
    <SettingsShell
      title="Notification settings"
      description="Choose when and how you want to be notified about filing activity, reminders, and workspace events."
    >
      <Panel
        title="Reminder preferences"
        description="Control the alerts that keep your team ahead of upcoming deadlines and changes."
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
                onChange={(next) => setForm((prev) => ({ ...prev, dueSoonReminders: next }))}
              />
              <ToggleRow
                title="Overdue alerts"
                description="Immediate alerts when filings move into overdue status."
                enabled={form.overdueAlerts}
                onChange={(next) => setForm((prev) => ({ ...prev, overdueAlerts: next }))}
              />
              <ToggleRow
                title="Workspace activity emails"
                description="Notifications for major changes made by other team members."
                enabled={form.workspaceActivityEmails}
                onChange={(next) => setForm((prev) => ({ ...prev, workspaceActivityEmails: next }))}
              />
              <ToggleRow
                title="Weekly summary digest"
                description="A rollup of the week’s filings, completions, and overdue items."
                enabled={form.weeklySummaryDigest}
                onChange={(next) => setForm((prev) => ({ ...prev, weeklySummaryDigest: next }))}
              />
            </div>
            {message && <div className="mt-4 text-sm text-slate-300">{message}</div>}
            <SaveBar primary="Save Notification Preferences" onPrimaryClick={saveNotifications} saving={saving} />
          </>
        )}
      </Panel>
    </SettingsShell>
  );
}
