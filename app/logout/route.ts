import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  url.searchParams.set("message", "signed_out");

  return NextResponse.redirect(url);
}