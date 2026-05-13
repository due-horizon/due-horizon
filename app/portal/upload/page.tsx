"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalRequest = {
  id: string;
  title: string;
  description: string | null;
  filing_id: string | null;
  filings?: {
    filing_name?: string | null;
  } | null;
};

type PortalContext = {
  workspaceId: string | null;
  clientId: string | null;
  companyName: string;
  workspaceName: string;
  mode: "client";
  userId: string | null;
};

function getRequestIdFromUrl() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("requestId") || "";
}


function normalizePortalDisplayName(value?: string | null) {
  const cleaned = (value || "").trim();
  if (!cleaned) return null;

  const normalized = cleaned.toLowerCase();
  const blocked = new Set([
    "the",
    "a",
    "an",
    "client",
    "client portal",
    "portal",
    "workspace",
    "firm",
    "company",
  ]);

  if (blocked.has(normalized)) return null;
  if (cleaned.length < 3) return null;

  return cleaned;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function PortalUploadPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [category, setCategory] = useState("Supporting Document");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext>({
    workspaceId: null,
    clientId: null,
    companyName: "Client Workspace",
    workspaceName: "Due Horizon",
    mode: "client",
    userId: null,
  });

  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;

  async function resolvePortalContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return null;

    const [
      { data: clientMemberships, error: clientMembershipsError },
      { data: firmMemberships, error: firmMembershipsError },
    ] = await Promise.all([
      supabase
        .from("client_members")
        .select("firm_id, client_id, clients(client_name)")
        .eq("user_id", user.id),
      supabase.from("firm_members").select("firm_id").eq("user_id", user.id).limit(1),
    ]);

    if (clientMembershipsError) throw clientMembershipsError;
    if (firmMembershipsError) throw firmMembershipsError;

    const clientMembership = clientMemberships?.[0] || null;
    const firmMembership = firmMemberships?.[0] || null;

    const workspaceId = clientMembership?.firm_id || firmMembership?.firm_id || null;
    const clientId = clientMembership?.client_id || null;

    if (!workspaceId) {
      return {
        workspaceId: null,
        clientId: null,
        companyName: "Client Portal",
        workspaceName: "Client Portal",
        mode: "client" as const,
        userId: user.id,
      };
    }

    const clientName = normalizePortalDisplayName(
      clientMembership?.clients?.client_name ||
      user.user_metadata?.company_name ||
      user.user_metadata?.business_name ||
      null
    );

    return {
      workspaceId,
      clientId,
      companyName: clientName || "Client Portal",
      workspaceName: clientName || "Client Portal",
      mode: "client" as const,
      userId: user.id,
    };
  }

  async function loadUploadContext() {
    setLoading(true);
    setError(null);

    try {
      const resolvedContext = await resolvePortalContext();

      if (!resolvedContext?.workspaceId) {
        setError("No portal workspace was found for this user.");
        setLoading(false);
        return;
      }

      setContext(resolvedContext);

      let query = supabase
        .from("requests")
        .select("id, title, description, filing_id, filings(filing_name)")
        .eq("firm_id", resolvedContext.workspaceId)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (resolvedContext.clientId) {
        query = query.eq("client_id", resolvedContext.clientId);
      }

      const { data, error: requestsError } = await query;

      if (requestsError) throw requestsError;

      const requestList = (data || []) as PortalRequest[];
      setRequests(requestList);

      const requestIdFromUrl = getRequestIdFromUrl();
      if (requestIdFromUrl && requestList.some((request) => request.id == requestIdFromUrl)) {
        setSelectedRequestId(requestIdFromUrl);
      } else if (requestList.length > 0) {
        setSelectedRequestId(requestList[0].id);
      }
    } catch (err) {
      console.error("Failed to load upload context:", err);
      setError(err instanceof Error ? err.message : "Failed to load upload form.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUploadContext();
  }, [supabase]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files || []);
    setSelectedFiles((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}`));
      const deduped = nextFiles.filter((file) => !existingKeys.has(`${file.name}-${file.size}`));
      return [...current, ...deduped];
    });
    setSuccessMessage("");
  }

  function removeFile(index: number) {
    setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleUpload() {
    if (!context.workspaceId || !context.userId || selectedFiles.length === 0) {
      setError("Choose at least one file before uploading.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage("");

    try {
      const uploadResults: string[] = [];

      for (const file of selectedFiles) {
        const safeName = file.name.replace(/\s+/g, "-");
        const storagePath = `${context.workspaceId}/${selectedRequestId || "general"}/${Date.now()}-${safeName}`;

        const { error: storageError } = await supabase.storage
          .from("portal-files")
          .upload(storagePath, file, { upsert: false });

        if (storageError) throw storageError;

        const insertPayload = {
          firm_id: context.workspaceId,
          client_id: context.clientId,
          request_id: selectedRequestId || null,
          filing_id: selectedRequest?.filing_id || null,
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
          category,
          uploaded_by_user_id: context.userId,
        };

        const { error: insertError } = await supabase.from("files").insert(insertPayload);

        if (insertError) throw insertError;

        uploadResults.push(file.name);
      }

      setSelectedFiles([]);
      setSuccessMessage(
        uploadResults.length === 1
          ? `${uploadResults[0]} uploaded successfully.`
          : `${uploadResults.length} files uploaded successfully.`
      );
    } catch (err) {
      console.error("Failed to upload files:", err);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                Portal Upload
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {context.companyName}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Upload documents directly into the right request so your firm has everything in one place.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex">
                <ShieldCheck className="h-4 w-4" />
                Secure workspace
              </div>

              <Link
                href="/portal/requests"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to requests
              </Link>
            </div>
          </div>

          {error ? (
            <div className="px-6 pt-5">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          {successMessage ? (
            <div className="px-6 pt-5">
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                <div>{successMessage}</div>
                <div className="mt-1 text-emerald-100/80">
                  Your firm can now review these documents in the portal. You can upload more files or return to requests.
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="space-y-6">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Step 1
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Choose the request</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  Attach your files to the right request when one is available, or upload general documents to the portal.
                </div>

                <div className="mt-4">
                  <select
                    value={selectedRequestId}
                    onChange={(e) => setSelectedRequestId(e.target.value)}
                    disabled={loading || requests.length === 0}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 disabled:opacity-60"
                    style={{ colorScheme: "dark" }}
                  >
                    {requests.length === 0 ? (
                      <option value="">No request selected — upload as a general document</option>
                    ) : null}

                    {requests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.title}
                      </option>
                    ))}
                  </select>

                  {selectedRequest?.filings?.filing_name ? (
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                      <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
                      Related filing: {selectedRequest.filings.filing_name}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Step 2
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Choose files</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  Select one or more files to upload into the portal.
                </div>

                <div className="mt-4">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-cyan-300/20 bg-cyan-400/10 px-6 py-10 text-center transition hover:bg-cyan-400/15">
                    <Upload className="h-8 w-8 text-cyan-100" />
                    <div className="mt-4 text-base font-medium text-white">Drop files here or click to browse</div>
                    <div className="mt-2 text-sm text-cyan-100/80">
                      PDF, Excel, images, and supporting documents
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                {selectedFiles.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-2 text-cyan-100">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{file.name}</div>
                            <div className="mt-1 text-xs text-slate-400">{formatBytes(file.size)}</div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Step 3
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Category</div>
                <div className="mt-1 text-sm leading-6 text-slate-400">
                  Help your firm understand what kind of document you are sending.
                </div>

                <div className="mt-4">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                    style={{ colorScheme: "dark" }}
                  >
                    <option value="Supporting Document">Supporting Document</option>
                    <option value="Tax Document">Tax Document</option>
                    <option value="Payroll Backup">Payroll Backup</option>
                    <option value="Bank Statement">Bank Statement</option>
                    <option value="Identity Document">Identity Document</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-[26px] border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                  Upload summary
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Ready to send</div>

                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Portal</div>
                    <div className="mt-1 text-white">{context.companyName || "Client Portal"}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Request</div>
                    <div className="mt-1 text-white">{selectedRequest?.title || "No request selected"}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Files</div>
                    <div className="mt-1 text-white">{selectedFiles.length} selected</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Category</div>
                    <div className="mt-1 text-white">{category}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || selectedFiles.length === 0}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading..." : "Submit documents"}
                </button>

                <div className="mt-3 text-xs leading-6 text-slate-400">
                  Files are uploaded to your portal storage and then recorded in the portal files table for request tracking.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
