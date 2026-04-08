"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Panel, SaveBar, SettingsShell } from "../_shared";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
};

export default function ProfileSettingsPage() {
  const supabase = createClient();

  const [form, setForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, job_title")
        .eq("user_id", user.id)
        .maybeSingle();

      setForm({
        firstName: profile?.first_name || "",
        lastName: profile?.last_name || "",
        email: profile?.email || user.email || "",
        jobTitle: profile?.job_title || "",
      });

      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  async function saveProfile() {
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

    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      first_name: form.firstName,
      last_name: form.lastName,
      full_name: `${form.firstName} ${form.lastName}`.trim(),
      email: form.email,
      job_title: form.jobTitle,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setSaving(false);
      setMessage(error.message);
      return;
    }

    if (form.email && form.email !== user.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: form.email });
      if (authError) {
        setSaving(false);
        setMessage(authError.message);
        return;
      }
    }

    setSaving(false);
    setMessage("Profile saved.");
  }

  return (
    <SettingsShell
      title="Profile settings"
      description="Update your personal identity details, sign-in email, and account-facing profile information."
    >
      <Panel
        title="Personal details"
        description="These details appear across your account and help identify the owner of this workspace."
      >
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
            Loading profile...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name" value={form.firstName} onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))} />
              <Field label="Last name" value={form.lastName} onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))} />
              <Field label="Email address" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} />
              <Field label="Job title" value={form.jobTitle} onChange={(value) => setForm((prev) => ({ ...prev, jobTitle: value }))} />
            </div>
            {message && <div className="mt-4 text-sm text-slate-300">{message}</div>}
            <SaveBar primary="Save Profile" onPrimaryClick={saveProfile} saving={saving} />
          </>
        )}
      </Panel>
    </SettingsShell>
  );
}
