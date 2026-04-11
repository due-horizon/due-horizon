"use server";

import { createClient } from "@/lib/supabase/server";

type AccountType = "business_owner" | "accounting_firm";
type IntakeMethod = "manual" | "csv" | "later";
type FirmType = "firm" | "business";
type FirmRole = "owner" | "admin" | "staff" | "client";
type FirmPlan = "starter" | "growth" | "scale" | "core" | "operations" | "enterprise";

type SeedOnboardingInput = {
  accountType: AccountType;
  firmName?: string;
  clientCount?: number;
  intakeMethod: IntakeMethod;
};

type SeedOnboardingResult = {
  workspaceId: string;
  firmId: string;
  businessOrganizationId: string | null;
  firmOrganizationId: string | null;
};

function toFirmType(accountType: AccountType): FirmType {
  return accountType === "accounting_firm" ? "firm" : "business";
}

function toProfileRole(accountType: AccountType) {
  return accountType;
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function createUniqueSlug(value: string) {
  const base = createSlug(value) || "workspace";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

function normalizeRole(role: string | null | undefined): FirmRole {
  if (role === "owner" || role === "admin" || role === "staff" || role === "client") {
    return role;
  }
  return "staff";
}

function normalizePlanForAccountType(
  plan: string | null | undefined,
  accountType: AccountType
): FirmPlan {
  const normalized = String(plan || "").trim().toLowerCase();

  if (accountType === "business_owner") {
    if (normalized === "core" || normalized === "operations" || normalized === "enterprise") {
      return normalized;
    }
    return "operations";
  }

  if (normalized === "starter" || normalized === "growth" || normalized === "scale") {
    return normalized;
  }

  return "starter";
}

function throwSupabaseError(context: string, error: unknown): never {
  console.error(`${context}:`, error);

  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    const message =
      (typeof maybeError.message === "string" && maybeError.message) ||
      (typeof maybeError.details === "string" && maybeError.details) ||
      (typeof maybeError.hint === "string" && maybeError.hint) ||
      `${context} failed`;

    throw new Error(message);
  }

  throw new Error(`${context} failed`);
}

export async function seedWorkspaceFromOnboarding(
  input: SeedOnboardingInput
): Promise<SeedOnboardingResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  const workspaceName =
    input.accountType === "accounting_firm"
      ? input.firmName?.trim() || "My Firm"
      : input.firmName?.trim() || "My Business";

  const pendingInviteToken =
    typeof user.user_metadata?.pending_invite_token === "string"
      ? user.user_metadata.pending_invite_token
      : null;

  const metadataFirmId =
    typeof user.user_metadata?.firm_id === "string"
      ? user.user_metadata.firm_id
      : typeof user.user_metadata?.workspace_id === "string"
        ? user.user_metadata.workspace_id
        : null;

  let firmId: string | null = null;
  let businessOrganizationId: string | null = null;
  let firmOrganizationId: string | null = null;

  if (pendingInviteToken && metadataFirmId) {
    const { data: existingFirmRow, error: existingFirmLookupError } = await supabase
      .from("firms")
      .select("id")
      .eq("id", metadataFirmId)
      .maybeSingle();

    if (existingFirmLookupError) {
      throwSupabaseError("Existing firm lookup", existingFirmLookupError);
    }

    firmId = existingFirmRow?.id ?? null;
  }

  if (pendingInviteToken && !firmId) {
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, firm_id, email, role, accepted, expires_at")
      .eq("token", pendingInviteToken)
      .maybeSingle();

    if (inviteError) {
      throwSupabaseError("Invite lookup", inviteError);
    }

    if (!invite) {
      throw new Error("This invite is invalid or no longer exists.");
    }

    if (invite.accepted) {
      throw new Error("This invite has already been accepted.");
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      throw new Error("This invite has expired.");
    }

    if (invite.email?.toLowerCase() !== user.email?.toLowerCase()) {
      throw new Error("This invite email does not match the signed-in user.");
    }

    const role = normalizeRole(invite.role);

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from("firm_members")
      .select("id")
      .eq("firm_id", invite.firm_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembershipError) {
      throwSupabaseError("Existing membership lookup", existingMembershipError);
    }

    if (!existingMembership) {
      const { error: membershipError } = await supabase.from("firm_members").insert({
        firm_id: invite.firm_id,
        user_id: user.id,
        role,
      });

      if (membershipError) {
        throwSupabaseError("Insert invited membership", membershipError);
      }
    }

    const { error: inviteUpdateError } = await supabase
      .from("invites")
      .update({ accepted: true })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      throwSupabaseError("Invite update", inviteUpdateError);
    }

    firmId = invite.firm_id;
  }

  if (firmId) {
    const { error: updateFirmError } = await supabase
      .from("firms")
      .update({
        name: workspaceName,
        slug: createUniqueSlug(workspaceName),
        type: toFirmType(input.accountType),
      })
      .eq("id", firmId);

    if (updateFirmError) {
      throwSupabaseError("Firm update", updateFirmError);
    }
  } else {
    const pendingPlan = normalizePlanForAccountType(
      typeof user.user_metadata?.pending_plan === "string"
        ? user.user_metadata.pending_plan
        : null,
      input.accountType
    );

    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .insert({
        owner_user_id: user.id,
        name: workspaceName,
        slug: createUniqueSlug(workspaceName),
        type: toFirmType(input.accountType),
        plan: pendingPlan,
        subscription_status: "trial",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        onboarding_completed: false,
      })
      .select("id")
      .single();

    if (firmError || !firm) {
      throw new Error(firmError?.message || "Failed to create firm");
    }

    firmId = firm.id;

    const { error: memberError } = await supabase.from("firm_members").insert({
      firm_id: firmId,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      throwSupabaseError("Insert owner membership", memberError);
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    role: toProfileRole(input.accountType),
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
  });

  if (profileError) {
    throwSupabaseError("Profile upsert", profileError);
  }

  if (input.accountType === "business_owner") {
    const businessName = input.firmName?.trim() || "My Business";

    const { data: existingBusinessOrg, error: existingBusinessOrgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("firm_id", firmId)
      .eq("organization_type", "business")
      .maybeSingle();

    if (existingBusinessOrgError) {
      throwSupabaseError("Business organization lookup", existingBusinessOrgError);
    }

    if (!existingBusinessOrg) {
      const { data: insertedBusinessOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          firm_id: firmId,
          organization_type: "business",
          legal_name: businessName,
          display_name: businessName,
        })
        .select("id")
        .single();

      if (orgError || !insertedBusinessOrg) {
        throwSupabaseError("Business organization insert", orgError);
      }

      businessOrganizationId = insertedBusinessOrg.id;
    } else {
      const { error: orgUpdateError } = await supabase
        .from("organizations")
        .update({
          legal_name: businessName,
          display_name: businessName,
        })
        .eq("id", existingBusinessOrg.id);

      if (orgUpdateError) {
        throwSupabaseError("Business organization update", orgUpdateError);
      }

      businessOrganizationId = existingBusinessOrg.id;
    }
  }

  if (input.accountType === "accounting_firm") {
    const firmName = input.firmName?.trim() || "My Firm";

    const { data: existingFirmOrg, error: existingFirmOrgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("firm_id", firmId)
      .eq("organization_type", "firm")
      .maybeSingle();

    if (existingFirmOrgError) {
      throwSupabaseError("Firm organization lookup", existingFirmOrgError);
    }

    if (!existingFirmOrg) {
      const { data: insertedFirmOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          firm_id: firmId,
          organization_type: "firm",
          legal_name: firmName,
          display_name: firmName,
        })
        .select("id")
        .single();

      if (orgError || !insertedFirmOrg) {
        throwSupabaseError("Firm organization insert", orgError);
      }

      firmOrganizationId = insertedFirmOrg.id;
    } else {
      const { error: orgUpdateError } = await supabase
        .from("organizations")
        .update({
          legal_name: firmName,
          display_name: firmName,
        })
        .eq("id", existingFirmOrg.id);

      if (orgUpdateError) {
        throwSupabaseError("Firm organization update", orgUpdateError);
      }

      firmOrganizationId = existingFirmOrg.id;
    }
  }

  const { error: completeFirmError } = await supabase
    .from("firms")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", firmId);

  if (completeFirmError) {
    throwSupabaseError("Complete firm onboarding", completeFirmError);
  }

  const { error: authUpdateError } = await supabase.auth.updateUser({
    data: {
      role: input.accountType,
      onboarded: true,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      firm_id: firmId,
      workspace_id: firmId,
      intake_method: input.intakeMethod,
      firm_name: input.accountType === "accounting_firm" ? input.firmName?.trim() || null : null,
      client_count: input.accountType === "accounting_firm" ? input.clientCount || 0 : null,
      pending_plan: null,
      pending_account_type: null,
      pending_workspace_name: null,
      pending_invite_token: null,
    },
  });

  if (authUpdateError) {
    throwSupabaseError("Auth user update", authUpdateError);
  }

if (!firmId) {
  throw new Error("Missing firmId");
}

  return {
    workspaceId: firmId,
    firmId,
    businessOrganizationId,
    firmOrganizationId,
  };
}
