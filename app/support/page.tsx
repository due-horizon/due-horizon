"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Bug,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  FileText,
  LifeBuoy,
  Mail,
  MessageSquareMore,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const SUPPORT_EMAIL = "support@duehorizon.com";
const SALES_EMAIL = "hello@duehorizon.com";
const DEMO_LINK = "/demo";

type SupportCardProps = {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  external?: boolean;
};

type BugForm = {
  name: string;
  email: string;
  pageUrl: string;
  browserInfo: string;
  issueType: string;
  expected: string;
  actual: string;
};

function SupportCard({
  icon,
  eyebrow,
  title,
  description,
  href,
  cta,
  external = false,
}: SupportCardProps) {
  const sharedClassName =
    "group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.92))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_50px_rgba(0,0,0,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/20 hover:shadow-[0_0_30px_rgba(34,211,238,0.12)]";

  const content = (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.09),transparent_35%)] opacity-80" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
            {icon}
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </div>
        </div>

        <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-7 text-slate-300">{description}</p>

        <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition group-hover:text-cyan-100">
          {cta}
          <ArrowRight size={16} />
        </div>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        className={sharedClassName}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={sharedClassName}>
      {content}
    </Link>
  );
}

function ResourceRow({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]"
    >
      <div className="flex min-w-0 items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="mt-1 text-sm text-slate-400">{description}</div>
        </div>
      </div>

      <ChevronRight
        className="shrink-0 text-slate-500 transition group-hover:text-cyan-200"
        size={18}
      />
    </Link>
  );
}

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-sm font-medium text-white">{question}</div>
      <p className="mt-2 text-sm leading-7 text-slate-400">{answer}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
  rows = 4,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-200">{label}</div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/15 focus:border-cyan-300/30 focus:bg-white/[0.05]"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/15 focus:border-cyan-300/30 focus:bg-white/[0.05]"
        />
      )}
    </label>
  );
}

function isValidEmail(value: string) {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SupportPage() {
  const [bugForm, setBugForm] = useState<BugForm>({
    name: "",
    email: "",
    pageUrl: "",
    browserInfo: "",
    issueType: "Bug report",
    expected: "",
    actual: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    setBugForm((prev) => ({
      ...prev,
      pageUrl: window.location.href,
      browserInfo: navigator.userAgent,
    }));
  }, []);

  function updateBugField<K extends keyof BugForm>(field: K, value: BugForm[K]) {
    setBugForm((prev) => ({ ...prev, [field]: value }));
    if (submitError) setSubmitError("");
    if (submitSuccess) setSubmitSuccess("");
  }

  async function handleBugSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitError("");
    setSubmitSuccess("");

    if (!bugForm.actual.trim()) {
      setSubmitError("Please describe what actually happened.");
      return;
    }

    if (bugForm.email.trim() && !isValidEmail(bugForm.email)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/support/bug-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bugForm),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Could not submit bug report.");
      }

      setSubmitSuccess("Bug report submitted. Thanks — we’ve got it.");

      setBugForm((prev) => ({
        ...prev,
        name: "",
        email: "",
        issueType: "Bug report",
        expected: "",
        actual: "",
      }));
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not submit bug report."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="overflow-hidden rounded-[30px] border border-cyan-400/10 bg-[linear-gradient(to_bottom,rgba(8,15,28,0.94),rgba(3,8,20,0.98))] shadow-[0_0_60px_rgba(34,211,238,0.06),0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <LifeBuoy size={14} />
                  Help & Support
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Get unstuck fast
                </h1>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                  Reach support, report bugs, request features, and find the next
                  best resource without digging through settings.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/15"
                >
                  <Mail size={16} />
                  Email support
                </a>

                <Link
                  href={DEMO_LINK}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)] transition hover:from-cyan-300 hover:to-blue-400"
                >
                  <CalendarDays size={16} />
                  Book a demo
                </Link>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px]">
              <section className="overflow-hidden rounded-[28px] border border-cyan-300/12 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_60px_rgba(34,211,238,0.08)]">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-cyan-300/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Support hub
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Outside settings
                  </div>
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                  Everything help-related in one place
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  This page should feel operational, not like a generic contact
                  form. The goal is to move users toward the right next action:
                  solve it themselves, contact you, report a bug, or ask for a
                  feature.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Best for
                    </div>
                    <div className="mt-2 text-sm text-white">
                      Questions and setup help
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Fast path
                    </div>
                    <div className="mt-2 text-sm text-white">
                      Email or book a call
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Product input
                    </div>
                    <div className="mt-2 text-sm text-white">
                      Bug reports and feature requests
                    </div>
                  </div>
                </div>
              </section>

              <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Quick contact
                </div>

                <div className="mt-4 space-y-3">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        Support email
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-400">
                        {SUPPORT_EMAIL}
                      </div>
                    </div>
                    <Mail size={16} className="text-cyan-200" />
                  </a>

                  <a
                    href={`mailto:${SALES_EMAIL}`}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-cyan-300/20 hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">
                        General inbox
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-400">
                        {SALES_EMAIL}
                      </div>
                    </div>
                    <MessageSquareMore size={16} className="text-cyan-200" />
                  </a>

                  <Link
                    href={DEMO_LINK}
                    className="flex items-center justify-between rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-4 transition hover:bg-cyan-400/15"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">
                        Book a call
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        Walk through setup, workflows, or questions live
                      </div>
                    </div>
                    <CalendarDays size={16} className="text-cyan-100" />
                  </Link>
                </div>
              </aside>
            </div>

            <section className="mt-8">
              <div>
                <div className="text-sm font-semibold text-white">
                  Choose the right path
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Direct users to the right action instead of making every request
                  look the same.
                </div>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <SupportCard
                  icon={<Mail size={20} />}
                  eyebrow="Contact"
                  title="Email support"
                  description="For account questions, setup help, and workflow issues that need a real answer."
                  href={`mailto:${SUPPORT_EMAIL}`}
                  cta="Open email"
                  external
                />

                <SupportCard
                  icon={<Bug size={20} />}
                  eyebrow="Bug report"
                  title="Report a bug"
                  description="Share what broke, what you expected, and what page you were on so it can be fixed quickly."
                  href="#bug-report"
                  cta="Open form"
                />

                <SupportCard
                  icon={<Sparkles size={20} />}
                  eyebrow="Feedback"
                  title="Request a feature"
                  description="Suggest new workflows, filing logic, dashboards, or client-facing improvements."
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Feature request")}`}
                  cta="Send request"
                  external
                />

                <SupportCard
                  icon={<CalendarDays size={20} />}
                  eyebrow="Live help"
                  title="Book a walkthrough"
                  description="Best for onboarding help, process questions, and seeing how the product should be used."
                  href={DEMO_LINK}
                  cta="Book now"
                />
              </div>
            </section>

            <section
              id="bug-report"
              className="mt-8 overflow-hidden rounded-[28px] border border-amber-400/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.10),rgba(15,23,42,0.18),rgba(255,255,255,0.02))] shadow-[0_0_0_1px_rgba(251,191,36,0.04),0_20px_50px_rgba(0,0,0,0.25)]"
            >
              <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                    <Bug size={14} />
                    Built-in bug report
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                    Report an issue with context already included
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                    This makes support faster because the page URL and browser
                    details are already attached. The user just explains what
                    should have happened and what actually happened.
                  </p>

                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-sm font-medium text-white">
                        What gets prefilled
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-400">
                        Current page URL, browser user agent, issue type, and the
                        user’s written description.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="text-sm font-medium text-white">
                        Best use
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-400">
                        Broken buttons, page errors, layout problems, incorrect
                        filing behavior, and unexpected redirects.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.92))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div className="text-sm font-semibold text-white">
                    Quick bug report
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Submit the issue directly without leaving the app.
                  </div>

                  <form onSubmit={handleBugSubmit} className="mt-5 space-y-4">
                    <Field
                      label="Your name"
                      value={bugForm.name}
                      onChange={(value) => updateBugField("name", value)}
                      placeholder="Rob Carr"
                    />

                    <Field
                      label="Your email"
                      type="email"
                      value={bugForm.email}
                      onChange={(value) => updateBugField("email", value)}
                      placeholder="you@company.com"
                    />

                    <label className="block">
                      <div className="mb-2 text-sm font-medium text-slate-200">
                        Issue type
                      </div>
                      <select
                        value={bugForm.issueType}
                        onChange={(e) => updateBugField("issueType", e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition hover:border-white/15 focus:border-cyan-300/30 focus:bg-white/[0.05]"
                      >
                        <option value="Bug report" className="bg-slate-900">
                          Bug report
                        </option>
                        <option value="UI issue" className="bg-slate-900">
                          UI issue
                        </option>
                        <option value="Data issue" className="bg-slate-900">
                          Data issue
                        </option>
                        <option value="Workflow issue" className="bg-slate-900">
                          Workflow issue
                        </option>
                      </select>
                    </label>

                    <Field
                      label="Page URL"
                      value={bugForm.pageUrl}
                      onChange={(value) => updateBugField("pageUrl", value)}
                      placeholder="Auto-filled from current page"
                    />

                    <Field
                      label="Browser info"
                      value={bugForm.browserInfo}
                      onChange={(value) => updateBugField("browserInfo", value)}
                      placeholder="Auto-filled from browser"
                    />

                    <Field
                      label="What did you expect to happen?"
                      value={bugForm.expected}
                      onChange={(value) => updateBugField("expected", value)}
                      placeholder="Example: Clicking Save should update the filing status."
                      textarea
                      rows={4}
                    />

                    <Field
                      label="What actually happened?"
                      value={bugForm.actual}
                      onChange={(value) => updateBugField("actual", value)}
                      placeholder="Example: Nothing happened and the page stayed the same."
                      textarea
                      rows={5}
                    />

                    {submitError ? (
                      <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {submitError}
                      </div>
                    ) : null}

                    {submitSuccess ? (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                        {submitSuccess}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.14)] transition hover:from-amber-200 hover:to-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send size={16} />
                      {submitting ? "Submitting..." : "Send bug report"}
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_420px]">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BookOpen size={17} className="text-cyan-200" />
                  Self-serve resources
                </div>

                <div className="mt-5 space-y-3">
                  <ResourceRow
                    icon={<Rocket size={18} />}
                    title="Getting started"
                    description="Point new users to onboarding, setup flow, and first actions."
                    href="/dashboard"
                  />
                  <ResourceRow
                    icon={<FileText size={18} />}
                    title="Filings overview"
                    description="Send users where they can review deadlines, statuses, and queue items."
                    href="/filings"
                  />
                  <ResourceRow
                    icon={<ShieldCheck size={18} />}
                    title="Security and account controls"
                    description="Send users to settings when they need passwords, notifications, or billing."
                    href="/settings"
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <CircleHelp size={17} className="text-cyan-200" />
                  Common questions
                </div>

                <div className="mt-5 space-y-3">
                  <FAQItem
                    question="Where do I manage my account settings?"
                    answer="Use the main settings area for profile, security, notifications, billing, team, and workspace controls."
                  />
                  <FAQItem
                    question="Where should I report product issues?"
                    answer="Use the bug report section on this page so the issue includes the page context and browser details."
                  />
                  <FAQItem
                    question="When should I book a call?"
                    answer="Book a call when the issue is process-related, setup-related, or easier to solve with a live walkthrough."
                  />
                </div>
              </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-[28px] border border-violet-400/15 bg-[linear-gradient(135deg,rgba(91,33,182,0.18),rgba(30,41,59,0.08),rgba(0,0,0,0))] p-6 shadow-[0_0_0_1px_rgba(168,85,247,0.05),0_20px_50px_rgba(91,33,182,0.12)]">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
                    Need a fast answer?
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
                    Start with support, not settings
                  </h2>

                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                    This gives your dropdown a real destination. It feels
                    intentional, brand-matched, and separate from account
                    configuration.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 transition hover:bg-white/10"
                  >
                    Contact support
                  </a>

                  <Link
                    href={DEMO_LINK}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-400 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-violet-300 hover:to-cyan-300"
                  >
                    Book a walkthrough
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}