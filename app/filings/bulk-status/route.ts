import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type FilingStatus = "upcoming" | "in_progress" | "filed" | "overdue";

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
    const { firmId, filingIds, nextStatus } = (await req.json()) as {
      firmId?: string;
      filingIds?: string[];
      nextStatus?: FilingStatus;
    };

    if (!firmId || !Array.isArray(filingIds) || filingIds.length === 0 || !nextStatus) {
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

    const { error } = await supabase
      .from("filings")
      .update({ status: nextStatus })
      .in("id", filingIds)
      .or(`firm_id.eq.${firmId},workspace_id.eq.${firmId}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk update failed." },
      { status: 500 }
    );
  }
}