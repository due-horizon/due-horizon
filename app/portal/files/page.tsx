"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Clock3,
  Download,
  FileText,
  FileSpreadsheet,
  Filter,
  ImageIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalFile = {
  id: string;
  file_name: string;
  category: string | null;
  created_at: string;
  request_id: string | null;
  filing_id: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  requests?: {
    title?: string | null;
  } | null;
  filings?: {
    filing_name?: string | null;
  } | null;
};

type PortalContext = {
  workspaceId: string | null;
  clientId: string | null;
  companyName: string;
  workspaceName: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function relativeDateLabel(value?: string | null) {
  if (!value) return "Unknown upload date";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "Unknown upload date";

  const now = new Date();
  const diff = Math.floor((now.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diff <= 0) return "Uploaded today";
  if (diff === 1) return "Uploaded yesterday";
  if (diff <= 7) return `Uploaded ${diff} days ago`;
  return `Uploaded ${formatDate(value)}`;
}

function fileVisual(file: PortalFile) {
  const extension = file.file_name.split(".").pop()?.toLowerCase() || "";
  const mime = file.mime_type?.toLowerCase() || "";
  const category = (file.category || "").toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension) || mime.startsWith("image/")) {
    return {
      icon: ImageIcon,
      badge: "Image",
      iconWrap:
        "border-fuchsia-300/15 bg-fuchsia-400/10 text-fuchsia-100",
      cardTone:
        "border-fuchsia-300/12 bg-[linear-gradient(180deg,rgba(217,70,239,0.08),rgba(255,255,255,0.03))] hover:border-fuchsia-300/20 hover:bg-[linear-gradient(180deg,rgba(217,70,239,0.12),rgba(255,255,255,0.04))]",
    };
  }

  if (
    ["xls", "xlsx", "csv"].includes(extension) ||
    mime.includes("spreadsheet") ||
    category.includes("payroll") ||
    category.includes("report")
  ) {
    return {
      icon: FileSpreadsheet,
      badge: "Spreadsheet",
      iconWrap:
        "border-emerald-300/15 bg-emerald-400/10 text-emerald-100",
      cardTone:
        "border-emerald-300/12 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.03))] hover:border-emerald-300/20 hover:bg-[linear-gradient(180deg,rgba(16,185,129,0.12),rgba(255,255,255,0.04))]",
    };
  }

  return {
    icon: FileText,
    badge: "Document",
    iconWrap: "border-cyan-300/15 bg-cyan-400/10 text-cyan-100",
    cardTone:
      "border-white/10 bg-white/[0.03] hover:border-cyan-300/20 hover:bg-white/[0.05]",
  };
}

export default function PortalFilesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<PortalContext>({
    workspaceId: null,
    clientId: null,
    companyName: "Client Portal",
    workspaceName: "Due Horizon",
  });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(files.map((file) => file.category).filter(Boolean))) as string[];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [files]);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return files.filter((file) => {
      const matchesSearch =
        !query ||
        file.file_name.toLowerCase().includes(query) ||
        (file.requests?.title || "").toLowerCase().includes(query) ||
        (file.filings?.filing_name || "").toLowerCase().includes(query) ||
        (file.category || "").toLowerCase().includes(query);

      const matchesCategory = categoryFilter === "all" || (file.category || "Uncategorized") === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [files, search, categoryFilter]);

  const requestedFiles = useMemo(
    () => filteredFiles.filter((file) => Boolean(file.request_id)),
    [filteredFiles]
  );
  const recentUploads = useMemo(() => filteredFiles.slice(0, 3), [filteredFiles]);
  const everythingElse = useMemo(
    () => filteredFiles.filter((file) => !recentUploads.some((recent) => recent.id === file.id)),
    [filteredFiles, recentUploads]
  );

  async function resolvePortalContext() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) throw userError;
    if (!user) return null;

    const [{ data: clientMemberships, error: clientMembershipsError }, { data: firmMemberships, error: firmMembershipsError }] =
      await Promise.all([
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
        workspaceName: "Due Horizon",
      };
    }

    const { data: firm } = await supabase
      .from("firms")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();

    return {
      workspaceId,
      clientId,
      companyName:
        clientMembership?.clients?.client_name ||
        user.user_metadata?.company_name ||
        user.user_metadata?.business_name ||
        "Client Portal",
      workspaceName: firm?.name || "Due Horizon",
    };
  }

  async function loadFiles() {
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
        .from("files")
        .select(
          "id, file_name, category, created_at, request_id, filing_id, storage_path, mime_type, size_bytes, requests(title), filings(filing_name)"
        )
        .eq("firm_id", resolvedContext.workspaceId)
        .order("created_at", { ascending: false });

      if (resolvedContext.clientId) {
        query = query.eq("client_id", resolvedContext.clientId);
      }

      const { data, error: filesError } = await query;

      if (filesError) throw filesError;

      setFiles((data || []) as PortalFile[]);
    } catch (err) {
      console.error("Failed to load portal files:", err);
      setError(err instanceof Error ? err.message : "Failed to load files.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, [supabase]);

  async function handleDownload(file: PortalFile) {
    try {
      setDownloadingId(file.id);
      const { data, error: signedUrlError } = await supabase.storage
        .from("portal-files")
        .createSignedUrl(file.storage_path, 60);

      if (signedUrlError) throw signedUrlError;
      if (!data?.signedUrl) throw new Error("No download URL returned.");

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to download file:", err);
      setError(err instanceof Error ? err.message : "Failed to download file.");
    } finally {
      setDownloadingId(null);
    }
  }

  function FileCard({ file, compact = false }: { file: PortalFile; compact?: boolean }) {
    const visual = fileVisual(file);
    const Icon = visual.icon;

    return (
      <div
        className={`group rounded-[26px] border p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${visual.cardTone}`}
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-2xl border p-2.5 ${visual.iconWrap}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-white group-hover:text-cyan-100">
                  {file.file_name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300">
                    {visual.badge}
                  </span>
                  <span>{file.category || "Uncategorized"}</span>
                  <span>•</span>
                  <span>{formatBytes(file.size_bytes)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDownload(file)}
                disabled={downloadingId === file.id}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:from-cyan-300 hover:to-blue-400 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloadingId === file.id ? "Preparing..." : compact ? "Open" : "Download"}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <div className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-slate-500" />
                {relativeDateLabel(file.created_at)}
              </div>
              <div>{formatDate(file.created_at)}</div>
            </div>

            {file.requests?.title ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                Requested for: <span className="font-medium text-white">{file.requests.title}</span>
              </div>
            ) : null}

            {file.filings?.filing_name ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                <Briefcase className="h-3.5 w-3.5 text-cyan-200" />
                Related filing: {file.filings.filing_name}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {file.request_id ? (
                <Link
                  href={`/portal/messages?requestId=${file.request_id}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.07] hover:text-white"
                >
                  View thread
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_26%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_rgba(0,0,0,0.34)]">
          <div className="relative border-b border-white/10 px-6 py-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_28%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300/80">
                    Portal Files
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                    Client View
                  </span>
                </div>

                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {context.companyName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Review every document already uploaded to your portal, download what you need, and stay aligned with {context.workspaceName}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden items-center gap-2 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 md:flex">
                  <ShieldCheck className="h-4 w-4" />
                  Secure workspace
                </div>

                <Link
                  href="/portal/upload"
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400"
                >
                  <Upload className="h-4 w-4" />
                  Upload more
                </Link>

                <Link
                  href="/portal/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.07]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to portal
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total files</div>
              <div className="mt-2 text-3xl font-semibold text-white">{files.length}</div>
              <div className="mt-1 text-xs text-slate-400">All uploaded documents in this portal</div>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/80">Visible now</div>
              <div className="mt-2 text-3xl font-semibold text-white">{filteredFiles.length}</div>
              <div className="mt-1 text-xs text-cyan-100/70">Results after your current filters</div>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Requested docs</div>
              <div className="mt-2 text-3xl font-semibold text-white">{files.filter((file) => Boolean(file.request_id)).length}</div>
              <div className="mt-1 text-xs text-amber-100/70">Files tied to a specific request</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Categories</div>
              <div className="mt-2 text-3xl font-semibold text-white">{categories.length || 1}</div>
              <div className="mt-1 text-xs text-slate-400">Different document groups in this portal</div>
            </div>
          </div>

          {error ? (
            <div className="px-6 pt-5">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            </div>
          ) : null}

          <div className="border-b border-white/10 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files, requests, filings, or categories..."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/30 focus:bg-white/[0.06]"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950 py-3 pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-300/30"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="all">All categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="h-5 w-40 rounded bg-white/10" />
                    <div className="mt-3 h-3 w-24 rounded bg-white/5" />
                    <div className="mt-5 h-10 w-full rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <FileText className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="mt-4 text-base font-medium text-white">No files found</div>
                <div className="mt-2 text-sm text-slate-400">
                  Try clearing your search or upload a new document to keep work moving.
                </div>
                <div className="mt-5">
                  <Link
                    href="/portal/upload"
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 transition hover:bg-cyan-400/15"
                  >
                    <Upload className="h-4 w-4" />
                    Upload document
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                        <Sparkles className="h-4 w-4" />
                        Recent uploads
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">The latest files in your portal</div>
                    </div>
                    <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                      {recentUploads.length} file{recentUploads.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {recentUploads.map((file) => (
                      <FileCard key={file.id} file={file} compact />
                    ))}
                  </div>
                </section>

                {requestedFiles.length ? (
                  <section className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                        Requested documents
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">Files tied to a request or conversation</div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {requestedFiles.map((file) => (
                        <FileCard key={file.id} file={file} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {everythingElse.length ? (
                  <section className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                        Everything else
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">Additional documents in your portal history</div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {everythingElse.map((file) => (
                        <FileCard key={file.id} file={file} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
