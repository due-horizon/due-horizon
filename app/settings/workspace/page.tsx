"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Panel, SaveBar, SettingsShell } from "../_shared";

type WorkspaceForm = {
  name: string;
  workspaceType: "firm" | "business" | "";
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string;
  onboardingCompleted: boolean;
};

type FirmRow = {
  id: string;
  name: string | null;
  type: "firm" | "business" | null;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  onboarding_completed: boolean | null;
};

function normalizeDateForInput(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDatePretty(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSubscriptionTone(status: string, trialEndsAt: string) {
  const normalized = (status || "").trim().toLowerCase();

  if (normalized === "active") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (normalized === "trial") {
    if (trialEndsAt) {
      const trialEnd = new Date(`${trialEndsAt}T23:59:59`);
      const now = new Date();

      if (!Number.isNaN(trialEnd.getTime()) && trialEnd < now) {
        return "border-red-400/20 bg-red-400/10 text-red-100";
      }
    }

    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-100";
  }

  if (
    normalized === "past_due" ||
    normalized === "canceled" ||
    normalized === "cancelled" ||
    normalized === "expired"
  ) {
    return "border-red-400/20 bg-red-400/10 text-red-100";
  }

  if (normalized) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-300";
}

async function resolveFirmId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  metadataFirmId: string | null
) {
  if (metadataFirmId) {
    const { data: membership } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId)
      .eq("firm_id", metadataFirmId)
      .maybeSingle();

    if (membership?.firm_id) {
      return membership.firm_id;
    }
  }

  const { data: memberships } = await supabase
    .from("firm_members")
    .select("firm_id, role")
    .eq("user_id", userId);

  if (!memberships?.length) return null;

  const ownerLike =
    memberships.find((membership) => membership.role === "owner") ||
    memberships.find((membership) => membership.role === "admin");

  return ownerLike?.firm_id || memberships[0]?.firm_id || null;
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

function workspaceTypeLabel(value: WorkspaceForm["workspaceType"]) {
  if (value === "firm") return "Firm";
  if (value === "business") return "Business";
  return "Not set";
}

export default function WorkspaceSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkspaceForm>({
    name: "",
    workspaceType: "",
    plan: "",
    subscriptionStatus: "",
    trialEndsAt: "",
    onboardingCompleted: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
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
            setMessage("You must be signed in to manage workspace settings.");
            setLoading(false);
          }
          return;
        }

        const metadataFirmId =
          typeof user.user_metadata?.firm_id === "string"
            ? user.user_metadata.firm_id
            : typeof user.user_metadata?.workspace_id === "string"
              ? user.user_metadata.workspace_id
              : null;

        const resolvedFirmId = await resolveFirmId(supabase, user.id, metadataFirmId);

        if (!resolvedFirmId) {
          if (!cancelled) {
            setMessage("No workspace found for this account.");
            setLoading(false);
          }
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("firm_members")
          .select("role")
          .eq("firm_id", resolvedFirmId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        const { data: firm, error: firmError } = await supabase
          .from("firms")
          .select("id, name, type, plan, subscription_status, trial_ends_at, onboarding_completed")
          .eq("id", resolvedFirmId)
          .single<FirmRow>();

        if (firmError) {
          throw firmError;
        }

        if (cancelled) return;

        setFirmId(firm.id);
        setCanEdit(membership?.role === "owner" || membership?.role === "admin");
        setForm({
          name: firm.name || "",
          workspaceType: firm.type || "",
          plan: firm.plan || "",
          subscriptionStatus: firm.subscription_status || "",
          trialEndsAt: normalizeDateForInput(firm.trial_ends_at),
          onboardingCompleted: Boolean(firm.onboarding_completed),
        });
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Failed to load workspace settings."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function saveWorkspace() {
    if (!firmId || !canEdit) return;

    setSaving(true);
    setMessage("");

    try {
      const payload = {
        name: form.name.trim(),
      };

      const { error } = await supabase.from("firms").update(payload).eq("id", firmId);

      if (error) {
        throw error;
      }

      setMessage("Workspace settings saved.");
    } catch (error) {
      setMessage(getErrorMessage(error, "Failed to save workspace settings."));
    } finally {
      setSaving(false);
    }
  }

  const statusTone = getSubscriptionTone(form.subscriptionStatus, form.trialEndsAt);

  return (
    <SettingsShell
      title="Workspace settings"
      description="Manage your firm or business identity, review subscription status, and keep the workspace aligned with how Due Horizon is actually structured."
    >
      <div className="space-y-6">
        <Panel
          title="Workspace details"
          description="These values come from your active firm record and drive core behavior across the app."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading workspace...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Workspace name"
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                />

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Workspace type
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                    {workspaceTypeLabel(form.workspaceType)}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Workspace type is set during onboarding and can’t be edited here.
                  </p>
                </div>
              </div>

              {!canEdit && (
                <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                  You have read-only access to this workspace. Only owners and admins can make changes.
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {message}
                </div>
              )}

              <SaveBar
                primary="Save Workspace Settings"
                onPrimaryClick={saveWorkspace}
                saving={saving}
              />
            </>
          )}
        </Panel>

        <Panel
          title="Workspace health"
          description="Live values from the firm record so you can quickly verify the workspace is in the right state."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading workspace health...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Plan
                </div>
                <div className="mt-2 text-lg text-white">
                  {formatLabel(form.plan) || "Not set"}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${statusTone}`}>
                <div className="text-xs uppercase tracking-[0.18em] opacity-70">
                  Subscription
                </div>
                <div className="mt-2 text-lg">
                  {formatLabel(form.subscriptionStatus) || "Unknown"}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Trial Ends
                </div>
                <div className="mt-2 text-lg text-white">
                  {formatDatePretty(form.trialEndsAt)}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Onboarding
                </div>
                <div className="mt-2 text-lg text-white">
                  {form.onboardingCompleted ? "Completed" : "In progress"}
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </SettingsShell>
  );
}
