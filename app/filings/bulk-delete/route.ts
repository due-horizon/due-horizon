import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normalizeWorkspaceType(value: string | null | undefined): "firm" | "business" {
  const normalized = (value || "").toLowerCase();
  return normalized === "business" || normalized === "business_owner" ? "business" : "firm";
}

function hasBulkWorkflowAccess(workspaceType: string | null | undefined, plan: string | null | undefined) {
  const type = normalizeWorkspaceType(workspaceType);
  const normalizedPlan = (plan || "").toLowerCase();

  if (type === "business") {
    return normalizedPlan === "operations" || normalizedPlan === "enterprise";
  }

  return normalizedPlan === "growth" || normalizedPlan === "scale";
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { firmId, filingIds } = (await req.json()) as {
      firmId?: string;
      filingIds?: string[];
    };

    if (!firmId || !Array.isArray(filingIds) || filingIds.length === 0) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("id, type, plan")
      .eq("id", firmId)
      .maybeSingle();

    if (firmError || !firm) {
      return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
    }

    if (!hasBulkWorkflowAccess(firm.type, firm.plan)) {
      return NextResponse.json(
        { error: "Your current plan does not include bulk workflows." },
        { status: 403 }
      );
    }

    const { error: tasksError } = await supabase
      .from("tasks")
      .delete()
      .in("filing_id", filingIds);

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    const { error: filingsError } = await supabase
      .from("filings")
      .delete()
      .in("id", filingIds)
      .or(`firm_id.eq.${firmId},workspace_id.eq.${firmId}`);

    if (filingsError) {
      return NextResponse.json({ error: filingsError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk delete failed." },
      { status: 500 }
    );
  }
}