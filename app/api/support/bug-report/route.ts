import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

type BugReportPayload = {
  name?: string;
  email?: string;
  pageUrl?: string;
  browserInfo?: string;
  issueType?: string;
  expected?: string;
  actual?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Bug report API is live. Use POST to submit.",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BugReportPayload;

    const issueType = (body.issueType || "Bug report").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const pageUrl = (body.pageUrl || "").trim();
    const browserInfo = (body.browserInfo || "").trim();
    const expected = (body.expected || "").trim();
    const actual = (body.actual || "").trim();

    if (!actual) {
      return NextResponse.json(
        { error: "Please describe what actually happened." },
        { status: 400 }
      );
    }

    if (email && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase.from("support_requests").insert({
      request_type: "bug_report",
      issue_type: issueType,
      name: name || null,
      email: email || null,
      page_url: pageUrl || null,
      browser_info: browserInfo || null,
      expected: expected || null,
      actual,
      status: "open",
    });

    if (error) {
      console.error("Bug report insert failed:", error);
      return NextResponse.json(
        {
          error: "Could not submit bug report.",
          details: error.message,
          code: error.code,
        },
        { status: 500 }
      );
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is missing. Bug report saved, but email was not sent.");

      return NextResponse.json({
        success: true,
        emailSent: false,
        warning: "Bug report was saved, but email notifications are not configured.",
      });
    }

    const resend = new Resend(resendApiKey);

    const safeIssueType = escapeHtml(issueType || "-");
    const safeName = escapeHtml(name || "-");
    const safeEmail = escapeHtml(email || "-");
    const safePageUrl = escapeHtml(pageUrl || "-");
    const safeBrowserInfo = escapeHtml(browserInfo || "-");
    const safeExpected = escapeHtml(expected || "-");
    const safeActual = escapeHtml(actual || "-");

    const emailResult = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "robert.carr29@gmail.com",
      subject: `Bug Report - ${issueType}`,
      html: `
        <div style="margin:0;padding:0;background:#020617;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
          <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
            <div style="
              overflow:hidden;
              border:1px solid rgba(34,211,238,0.14);
              border-radius:24px;
              background:linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98));
              box-shadow:0 20px 60px rgba(0,0,0,0.35);
            ">
              <div style="
                padding:24px 28px;
                border-bottom:1px solid rgba(255,255,255,0.08);
                background:
                  radial-gradient(circle at top right, rgba(34,211,238,0.12), transparent 35%),
                  linear-gradient(180deg, rgba(8,15,28,0.98), rgba(3,8,20,0.98));
              ">
                <div style="
                  display:inline-block;
                  padding:6px 10px;
                  border-radius:999px;
                  border:1px solid rgba(34,211,238,0.18);
                  background:rgba(34,211,238,0.10);
                  color:#a5f3fc;
                  font-size:11px;
                  font-weight:700;
                  letter-spacing:0.14em;
                  text-transform:uppercase;
                ">
                  Due Horizon Support
                </div>

                <h1 style="
                  margin:16px 0 8px 0;
                  font-size:28px;
                  line-height:1.1;
                  color:#ffffff;
                  font-weight:700;
                ">
                  New bug report submitted
                </h1>

                <p style="
                  margin:0;
                  color:#94a3b8;
                  font-size:14px;
                  line-height:1.7;
                ">
                  A new issue was submitted from the in-app support form.
                </p>
              </div>

              <div style="padding:28px;">
                <div style="
                  display:grid;
                  grid-template-columns:1fr 1fr;
                  gap:12px;
                  margin-bottom:20px;
                ">
                  <div style="
                    border:1px solid rgba(255,255,255,0.08);
                    border-radius:18px;
                    background:rgba(255,255,255,0.03);
                    padding:14px 16px;
                  ">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                      Issue type
                    </div>
                    <div style="margin-top:6px;font-size:15px;color:#ffffff;font-weight:600;">
                      ${safeIssueType}
                    </div>
                  </div>

                  <div style="
                    border:1px solid rgba(255,255,255,0.08);
                    border-radius:18px;
                    background:rgba(255,255,255,0.03);
                    padding:14px 16px;
                  ">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                      Submitted by
                    </div>
                    <div style="margin-top:6px;font-size:15px;color:#ffffff;font-weight:600;">
                      ${safeName}
                    </div>
                  </div>

                  <div style="
                    border:1px solid rgba(255,255,255,0.08);
                    border-radius:18px;
                    background:rgba(255,255,255,0.03);
                    padding:14px 16px;
                  ">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                      Email
                    </div>
                    <div style="margin-top:6px;font-size:15px;color:#ffffff;font-weight:600;word-break:break-word;">
                      ${safeEmail}
                    </div>
                  </div>

                  <div style="
                    border:1px solid rgba(255,255,255,0.08);
                    border-radius:18px;
                    background:rgba(255,255,255,0.03);
                    padding:14px 16px;
                  ">
                    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                      Status
                    </div>
                    <div style="margin-top:6px;font-size:15px;color:#22d3ee;font-weight:600;">
                      Open
                    </div>
                  </div>
                </div>

                <div style="
                  border:1px solid rgba(255,255,255,0.08);
                  border-radius:20px;
                  background:rgba(255,255,255,0.03);
                  padding:16px 18px;
                  margin-bottom:14px;
                ">
                  <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                    Page URL
                  </div>
                  <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#e2e8f0;word-break:break-word;">
                    ${safePageUrl}
                  </div>
                </div>

                <div style="
                  border:1px solid rgba(255,255,255,0.08);
                  border-radius:20px;
                  background:rgba(255,255,255,0.03);
                  padding:16px 18px;
                  margin-bottom:14px;
                ">
                  <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700;">
                    Browser info
                  </div>
                  <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#cbd5e1;word-break:break-word;">
                    ${safeBrowserInfo}
                  </div>
                </div>

                <div style="
                  border:1px solid rgba(251,191,36,0.14);
                  border-radius:20px;
                  background:linear-gradient(180deg, rgba(251,191,36,0.08), rgba(255,255,255,0.02));
                  padding:18px;
                  margin-bottom:14px;
                ">
                  <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#fcd34d;font-weight:700;">
                    Expected
                  </div>
                  <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#f8fafc;white-space:pre-wrap;">
                    ${safeExpected}
                  </div>
                </div>

                <div style="
                  border:1px solid rgba(239,68,68,0.14);
                  border-radius:20px;
                  background:linear-gradient(180deg, rgba(239,68,68,0.08), rgba(255,255,255,0.02));
                  padding:18px;
                ">
                  <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#fca5a5;font-weight:700;">
                    Actual
                  </div>
                  <div style="margin-top:10px;font-size:14px;line-height:1.8;color:#f8fafc;white-space:pre-wrap;">
                    ${safeActual}
                  </div>
                </div>
              </div>

              <div style="
                padding:18px 28px 24px 28px;
                border-top:1px solid rgba(255,255,255,0.08);
                color:#64748b;
                font-size:12px;
                line-height:1.7;
              ">
                Submitted from the Due Horizon support workflow.
              </div>
            </div>
          </div>
        </div>
      `,
      text: [
        "A new bug report was submitted.",
        "",
        `Issue Type: ${issueType || "-"}`,
        `Name: ${name || "-"}`,
        `Email: ${email || "-"}`,
        `Page URL: ${pageUrl || "-"}`,
        `Browser Info: ${browserInfo || "-"}`,
        "",
        "Expected:",
        expected || "-",
        "",
        "Actual:",
        actual || "-",
      ].join("\n"),
    });

    console.log("Resend response:", emailResult);

    return NextResponse.json({
      success: true,
      emailSent: !emailResult.error,
      resend: emailResult,
    });
  } catch (err) {
    console.error("Bug report API error:", err);

    return NextResponse.json(
      {
        error: "Unexpected server error.",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}