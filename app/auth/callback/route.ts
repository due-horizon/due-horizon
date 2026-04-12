import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safePath(value: string | null, fallback = "/dashboard") {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value === "/") return fallback;
  if (value === "/login" || value === "/signup") return fallback;
  return value;
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

type WorkspaceType = "firm" | "business" | null;
type WorkspacePlan =
  | "starter"
  | "growth"
  | "scale"
  | "core"
  | "operations"
  | "enterprise";

function normalizeAccountType(value: string | null): WorkspaceType {
  if (value === "firm" || value === "business") return value;
  return null;
}

function inferAccountTypeFromPlan(value: string | null): WorkspaceType {
  const plan = (value || "").toLowerCase();
  if (plan === "starter" || plan === "growth" || plan === "scale") return "firm";
  if (plan === "core" || plan === "operations" || plan === "enterprise") return "business";
  return null;
}

function normalizePlan(value: string | null, accountType: WorkspaceType): WorkspacePlan {
  const plan = (value || "").toLowerCase();

  if (accountType === "business") {
    if (plan === "core" || plan === "operations" || plan === "enterprise") {
      return plan;
    }
    return "operations";
  }

  if (accountType === "firm") {
    if (plan === "starter" || plan === "growth" || plan === "scale") {
      return plan;
    }
    return "growth";
  }

  const inferredType = inferAccountTypeFromPlan(value);
  if (inferredType === "business") return normalizePlan(value, "business");
  return normalizePlan(value, "firm");
}

function buildRedirectUrl(
  origin: string,
  pathname: string,
  options?: {
    next?: string | null;
    plan?: string | null;
    type?: string | null;
    workspace?: string | null;
    invite?: string | null;
  }
) {
  const url = new URL(pathname, origin);

  if (options?.next) url.searchParams.set("next", options.next);
  if (options?.plan) url.searchParams.set("plan", options.plan);
  if (options?.type) url.searchParams.set("type", options.type);
  if (options?.workspace) url.searchParams.set("workspace", options.workspace);
  if (options?.invite) url.searchParams.set("invite", options.invite);

  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const code = searchParams.get("code");
  const next = safePath(searchParams.get("next"), "/dashboard");

  const planFromUrl = searchParams.get("plan");
  const typeFromUrl = searchParams.get("type");
  const workspaceFromUrl = searchParams.get("workspace");
  const inviteTokenFromUrl = searchParams.get("invite");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Missing+auth+code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=Auth+failed`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=Could+not+load+user`);
  }

  const pendingPlanRaw =
    planFromUrl ||
    (typeof user.user_metadata?.pending_plan === "string"
      ? user.user_metadata.pending_plan
      : null);

  const pendingAccountType =
    typeFromUrl ||
    (typeof user.user_metadata?.pending_account_type === "string"
      ? user.user_metadata.pending_account_type
      : null);

  const pendingWorkspaceName =
    workspaceFromUrl ||
    (typeof user.user_metadata?.pending_workspace_name === "string"
      ? user.user_metadata.pending_workspace_name
      : null);

  const pendingInviteToken =
    inviteTokenFromUrl ||
    (typeof user.user_metadata?.pending_invite_token === "string"
      ? user.user_metadata.pending_invite_token
      : null);

  const normalizedType =
    normalizeAccountType(pendingAccountType) || inferAccountTypeFromPlan(pendingPlanRaw);
  const normalizedPlan = normalizePlan(pendingPlanRaw, normalizedType);

  const preferredFirmId =
    typeof user.user_metadata?.firm_id === "string"
      ? user.user_metadata.firm_id
      : typeof user.user_metadata?.workspace_id === "string"
        ? user.user_metadata.workspace_id
        : null;

  const { data: memberships, error: membershipError } = await supabase
    .from("firm_members")
    .select("firm_id, role")
    .eq("user_id", user.id);

  if (membershipError) {
    return NextResponse.redirect(`${origin}/login?error=Could+not+load+memberships`);
  }

  let resolvedFirmId =
    memberships?.find((m) => m.firm_id === preferredFirmId)?.firm_id ||
    memberships?.[0]?.firm_id ||
    preferredFirmId ||
    null;

  if (pendingInviteToken && !resolvedFirmId) {
    const { data: invite, error: inviteError } = await supabase
      .from("invites")
      .select("id, firm_id, email, role, accepted, expires_at")
      .eq("token", pendingInviteToken)
      .maybeSingle();

    if (!inviteError && invite) {
      const emailMatches = invite.email?.toLowerCase() === user.email?.toLowerCase();
      const notExpired =
        !invite.expires_at || new Date(invite.expires_at).getTime() >= Date.now();

      if (!invite.accepted && emailMatches && notExpired) {
        const { data: existingMembership } = await supabase
          .from("firm_members")
          .select("id")
          .eq("firm_id", invite.firm_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existingMembership) {
          await supabase.from("firm_members").insert({
            firm_id: invite.firm_id,
            user_id: user.id,
            role: invite.role || "staff",
          });
        }

        await supabase.from("invites").update({ accepted: true }).eq("id", invite.id);
        resolvedFirmId = invite.firm_id;
      }
    }
  }

  if (!resolvedFirmId && normalizedType && pendingWorkspaceName) {
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .insert({
        owner_user_id: user.id,
        name: pendingWorkspaceName,
        slug: createSlug(pendingWorkspaceName),
        type: normalizedType,
        plan: normalizedPlan,
        subscription_status: "trial",
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        onboarding_completed: false,
      })
      .select("id")
      .single();

    if (!firmError && firm) {
      await supabase.from("firm_members").insert({
        firm_id: firm.id,
        user_id: user.id,
        role: "owner",
      });

      resolvedFirmId = firm.id;
    }
  }

  const metadataUpdate: Record<string, unknown> = {
    ...(resolvedFirmId ? { firm_id: resolvedFirmId, workspace_id: resolvedFirmId } : {}),
    ...(pendingPlanRaw ? { pending_plan: normalizedPlan } : {}),
    ...(normalizedType ? { pending_account_type: normalizedType } : {}),
    ...(pendingWorkspaceName ? { pending_workspace_name: pendingWorkspaceName } : {}),
    ...(pendingInviteToken ? { pending_invite_token: pendingInviteToken } : {}),
  };

  await supabase.auth.updateUser({
    data: metadataUpdate,
  });

  if (resolvedFirmId) {
    const { data: firm } = await supabase
      .from("firms")
      .select("onboarding_completed")
      .eq("id", resolvedFirmId)
      .maybeSingle();

    if (firm?.onboarding_completed) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }

      const finalNext =
    next === "/" || next === "/login" || next === "/signup"
      ? "/dashboard"
      : next;

  return NextResponse.redirect(
    buildRedirectUrl(origin, finalNext, {
      plan: finalNext === "/onboarding" ? (pendingPlanRaw ? normalizedPlan : null) : null,
      type: finalNext === "/onboarding" ? normalizedType : null,
      workspace: finalNext === "/onboarding" ? pendingWorkspaceName : null,
      invite: finalNext === "/onboarding" ? pendingInviteToken : null,
    })
  );
  }

  if (next === "/onboarding") {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/onboarding", {
        next: "/dashboard",
        plan: pendingPlanRaw ? normalizedPlan : null,
        type: normalizedType,
        workspace: pendingWorkspaceName,
        invite: pendingInviteToken,
      })
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(origin, next, {
      plan: next === "/onboarding" ? (pendingPlanRaw ? normalizedPlan : null) : null,
      type: next === "/onboarding" ? normalizedType : null,
      workspace: next === "/onboarding" ? pendingWorkspaceName : null,
      invite: next === "/onboarding" ? pendingInviteToken : null,
    })
  );
}