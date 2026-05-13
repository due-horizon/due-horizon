"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type InviteRole = "admin" | "member";
type AssignableRole = "admin" | "member";

type ActionResult = {
  ok: boolean;
  message: string;
};

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be signed in.");
  }

  const preferredFirmId =
    typeof user.user_metadata?.firm_id === "string"
      ? user.user_metadata.firm_id
      : typeof user.user_metadata?.workspace_id === "string"
        ? user.user_metadata.workspace_id
        : null;

  let firmId = preferredFirmId;

  if (!firmId) {
    const { data: membership, error: membershipError } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw new Error(membershipError.message || "Unable to resolve your workspace.");
    }

    firmId = membership?.firm_id ?? null;
  }

  if (!firmId) {
    throw new Error("No workspace found for this user.");
  }

  return { supabase, user, firmId };
}

export async function bootstrapFirmOwnerMembership(firmId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthedContext();

  const { error } = await supabase.rpc("add_firm_member_bootstrap_owner", {
    p_firm_id: firmId,
    p_user_id: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Could not create firm membership.",
    };
  }

  revalidatePath("/team");
  revalidatePath("/settings/team");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Workspace membership created.",
  };
}

export async function createTeamInvite(input: {
  email: string;
  role: InviteRole;
}): Promise<ActionResult> {
  const { supabase, user, firmId } = await getAuthedContext();

  const email = input.email.trim().toLowerCase();
  const role = input.role;

  if (!email) {
    return { ok: false, message: "Email is required." };
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const { error } = await supabase.rpc("create_team_invite", {
    p_firm_id: firmId,
    p_email: email,
    p_role: role,
    p_invited_by: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Could not create invite.",
    };
  }

  revalidatePath("/team");
  revalidatePath("/settings/team");

  return {
    ok: true,
    message: `Invite created for ${email}.`,
  };
}

export async function updateTeamMemberRole(input: {
  targetUserId: string;
  role: AssignableRole;
}): Promise<ActionResult> {
  const { supabase, user, firmId } = await getAuthedContext();

  if (!input.targetUserId) {
    return { ok: false, message: "Missing team member." };
  }

  const { error } = await supabase.rpc("update_firm_member_role", {
    p_firm_id: firmId,
    p_target_user_id: input.targetUserId,
    p_new_role: input.role,
    p_actor_user_id: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Could not update team member role.",
    };
  }

  revalidatePath("/team");
  revalidatePath("/settings/team");

  return {
    ok: true,
    message: "Role updated.",
  };
}

export async function transferOwnership(input: {
  newOwnerUserId: string;
}): Promise<ActionResult> {
  const { supabase, user, firmId } = await getAuthedContext();

  if (!input.newOwnerUserId) {
    return { ok: false, message: "Missing new owner." };
  }

  const { error } = await supabase.rpc("transfer_firm_ownership", {
    p_firm_id: firmId,
    p_new_owner_user_id: input.newOwnerUserId,
    p_actor_user_id: user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || "Could not transfer ownership.",
    };
  }

  revalidatePath("/team");
  revalidatePath("/settings/team");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Ownership transferred.",
  };
}
