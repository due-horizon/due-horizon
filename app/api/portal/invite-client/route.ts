import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { firmId, clientId, email, contactName, invitedByUserId } = await req.json();

    if (!firmId || !clientId || !email || !invitedByUserId) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const normalizedEmail = String(email).trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Save/update invite record
    const { data: inviteRecord, error: inviteError } = await admin
      .from("client_portal_invites")
      .upsert(
        {
          firm_id: firmId,
          client_id: clientId,
          email: normalizedEmail,
          contact_name: contactName || null,
          invited_by_user_id: invitedByUserId,
          status: "pending",
          expires_at: expiresAt,
        },
        {
          onConflict: "client_id,email",
        }
      )
      .select("id")
      .single();

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // Send real Supabase auth invite
    const { error: authError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: {
          firm_id: firmId,
          client_id: clientId,
          role: "client",
          portal_invite_id: inviteRecord?.id ?? null,
        },
        ...(siteUrl
          ? { redirectTo: `${siteUrl}/portal/dashboard` }
          : {}),
      }
    );

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}