"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Panel, SaveBar, SettingsShell } from "../_shared";

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
};

type MessageTone = "success" | "error" | "info";

const emptyForm: ProfileForm = {
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "",
};

function normalizeForm(form: ProfileForm): ProfileForm {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    jobTitle: form.jobTitle.trim(),
  };
}

function formsEqual(a: ProfileForm, b: ProfileForm) {
  const left = normalizeForm(a);
  const right = normalizeForm(b);

  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.email.toLowerCase() === right.email.toLowerCase() &&
    left.jobTitle === right.jobTitle
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function ProfileSettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});

  const normalizedForm = useMemo(() => normalizeForm(form), [form]);
  const isDirty = useMemo(() => !formsEqual(form, initialForm), [form, initialForm]);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setMessage("");
      setErrors({});

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setMessageTone("error");
          setMessage("You must be signed in.");
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, job_title")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        const loadedForm: ProfileForm = {
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          email: profile?.email || user.email || "",
          jobTitle: profile?.job_title || "",
        };

        setForm(loadedForm);
        setInitialForm(loadedForm);
      } catch (error) {
        const nextMessage =
          error instanceof Error ? error.message : "Could not load your profile.";
        setMessageTone("error");
        setMessage(nextMessage);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase]);

  function updateField<K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (message) {
      setMessage("");
    }
  }

  function validateForm(nextForm: ProfileForm) {
    const nextErrors: Partial<Record<keyof ProfileForm, string>> = {};

    if (!nextForm.firstName.trim()) {
      nextErrors.firstName = "First name is required.";
    }

    if (!nextForm.lastName.trim()) {
      nextErrors.lastName = "Last name is required.";
    }

    if (!nextForm.email.trim()) {
      nextErrors.email = "Email address is required.";
    } else if (!isValidEmail(nextForm.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    return nextErrors;
  }

  async function saveProfile() {
    const cleaned = normalizeForm(form);
    const validationErrors = validateForm(cleaned);
    setErrors(validationErrors);
    setMessage("");

    if (Object.keys(validationErrors).length > 0) {
      setMessageTone("error");
      setMessage("Please fix the highlighted fields.");
      return;
    }

    if (!isDirty) {
      setMessageTone("info");
      setMessage("No changes to save.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in.");
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: user.id,
        first_name: cleaned.firstName,
        last_name: cleaned.lastName,
        full_name: `${cleaned.firstName} ${cleaned.lastName}`.trim(),
        email: cleaned.email,
        job_title: cleaned.jobTitle,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        throw profileError;
      }

      let nextMessage = "Profile saved.";

      if (cleaned.email.toLowerCase() !== (user.email || "").toLowerCase()) {
        const { error: authError } = await supabase.auth.updateUser({
          email: cleaned.email,
        });

        if (authError) {
          throw new Error(
            `Your profile was saved, but your sign-in email could not be updated: ${authError.message}`
          );
        }

        nextMessage =
          "Profile saved. Check your inbox to confirm your new email address if confirmation is required.";
      }

      setForm(cleaned);
      setInitialForm(cleaned);
      setMessageTone("success");
      setMessage(nextMessage);
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Could not save your profile.";
      setMessageTone("error");
      setMessage(nextMessage);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell
      title="Profile settings"
      description="Update your identity details, sign-in email, and account-facing profile information."
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
              <div>
                <Field
                  label="First name"
                  value={form.firstName}
                  onChange={(value) => updateField("firstName", value)}
                />
                {errors.firstName && (
                  <div className="mt-2 text-sm text-red-300">{errors.firstName}</div>
                )}
              </div>

              <div>
                <Field
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) => updateField("lastName", value)}
                />
                {errors.lastName && (
                  <div className="mt-2 text-sm text-red-300">{errors.lastName}</div>
                )}
              </div>

              <div>
                <Field
                  label="Email address"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                />
                {errors.email && (
                  <div className="mt-2 text-sm text-red-300">{errors.email}</div>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  Changing your sign-in email may require email confirmation before it takes effect.
                </div>
              </div>

              <div>
                <Field
                  label="Job title"
                  value={form.jobTitle}
                  onChange={(value) => updateField("jobTitle", value)}
                />
              </div>
            </div>

            {message ? (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  messageTone === "success"
                    ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    : messageTone === "error"
                      ? "border-red-400/20 bg-red-500/10 text-red-200"
                      : "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
                }`}
              >
                {message}
              </div>
            ) : null}

            <SaveBar
  primary="Save Profile"
  onPrimaryClick={saveProfile}
  saving={saving}
  disabled={saving || !isDirty}
/>
          </>
        )}
      </Panel>
    </SettingsShell>
  );
}
