"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

const navItems = [
  { label: "Platform", href: "#product" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Why It Wins", href: "#why-due-horizon" },
  { label: "Pricing", href: "#pricing" },
];

const LOGO_SRC = "/logo-final.png";

const featureCards = [
  {
    icon: CalendarClock,
    title: "Track every filing in one command center",
    body: "See payroll, sales tax, annual reports, and recurring compliance deadlines across clients, entities, and states in one live system.",
  },
  {
    icon: Workflow,
    title: "Turn deadlines into execution",
    body: "Attach workflow, ownership, status, and progress directly to each filing so work keeps moving before a due date becomes a fire drill.",
  },
  {
    icon: BellRing,
    title: "See risk before it becomes a problem",
    body: "Instantly surface what is overdue, due soon, blocked, or ready to file so your team can act early instead of reacting late.",
  },
  {
    icon: ShieldCheck,
    title: "Built for compliance, not generic tasks",
    body: "Due Horizon is purpose-built for recurring deadline-driven work, where one missed filing can create penalties, cleanup, and client risk.",
  },
];

const outcomeCards = [
  {
    title: "What teams are dealing with now",
    points: [
      "Deadlines spread across spreadsheets, calendars, inboxes, and memory",
      "No clean view across clients, entities, filings, and ownership",
      "Manual follow-up just to keep recurring work moving",
      "Too much operational risk tied to one missed date",
    ],
  },
  {
    title: "What Due Horizon changes",
    points: [
      "One dashboard for every filing and every status",
      "Workflow attached directly to the compliance deadline",
      "Real-time visibility across the entire workload",
      "Cleaner execution as filing volume and complexity grow",
    ],
  },
];

const steps = [
  {
    number: "01",
    title: "Add your clients or entities",
    body: "Set up the businesses you manage and bring your recurring compliance work into one structured system.",
  },
  {
    number: "02",
    title: "Choose jurisdictions and filing types",
    body: "Capture the states, entities, and filing frequencies that apply so the right deadlines are visible from the start.",
  },
  {
    number: "03",
    title: "Generate deadlines and workflows",
    body: "Turn recurring compliance requirements into trackable filings with ownership, steps, and status.",
  },
  {
    number: "04",
    title: "Run compliance with clarity",
    body: "See what is overdue, due soon, blocked, and ready to file before it turns into a scramble.",
  },
];

const proofStats = [
  { label: "Recurring filings tracked", value: "100+" },
  { label: "Operational visibility", value: "Real-time" },
  { label: "Goal for missed deadlines", value: "0" },
  { label: "Setup time", value: "Minutes" },
];

const valuePillars = [
  {
    icon: Layers3,
    title: "One place for every deadline",
    body: "Replace spreadsheet sprawl with one live operating layer for payroll, sales tax, annual reports, and recurring filings.",
  },
  {
    icon: FileCheck2,
    title: "Workflow attached to the filing",
    body: "Every due date can carry steps, status, ownership, and progress so your team is not rebuilding the process every cycle.",
  },
  {
    icon: Users,
    title: "Built for firms and businesses",
    body: "Manage compliance across clients, entities, and states with one operating view that scales as your workload grows.",
  },
];

const trustCards = [
  {
    icon: Building2,
    title: "Built around real filing pressure",
    body: "Designed for teams managing monthly, quarterly, and annual compliance work where missing one deadline has real consequences.",
  },
  {
    icon: Clock3,
    title: "Catch risk earlier",
    body: "See what is overdue, due soon, blocked, and ready to file before the deadline becomes a penalty, apology, or scramble.",
  },
  {
    icon: LockKeyhole,
    title: "Fast to adopt",
    body: "Clean setup, structured workflows, and one clear operating view make it easier for the whole team to work from the same system.",
  },
];

const logoPills = [
  "Built by accountants",
  "Compliance-first workflow",
  "For firms and businesses",
];

const urgencyPoints = [
  "Missed filings create penalties, cleanup work, and client trust issues",
  "Spreadsheets break as recurring compliance volume grows",
  "Manual follow-up wastes time every single cycle",
];

const roiPoints = [
  "Replace manual deadline tracking",
  "Reduce fire drills and last-minute follow-up",
  "Give the whole team one source of truth",
  "Create cleaner, more repeatable execution",
];

const testimonialCards = [
  {
    quote:
      "This is the first time our compliance workload actually feels visible. We can see every filing, every owner, and every risk point without piecing it together manually.",
    author: "Operations lead, multi-entity finance team",
  },
  {
    quote:
      "Instead of reacting to deadlines, the team can work ahead of them. That shift alone changes how scalable the operation feels.",
    author: "Owner, growing accounting firm",
  },
];

function getDefaultSignupHref(audience: "firm" | "business") {
  return audience === "firm"
    ? "/signup?plan=growth&type=firm"
    : "/signup?plan=operations&type=business";
}

function getPlanSignupHref(audience: "firm" | "business", planName: string) {
  const normalized = planName.toLowerCase();
  const type = audience === "firm" ? "firm" : "business";

  const planMap: Record<string, string> =
    audience === "firm"
      ? {
          starter: "starter",
          growth: "growth",
          scale: "scale",
        }
      : {
          core: "core",
          operations: "operations",
          enterprise: "enterprise",
        };

  const plan =
    planMap[normalized] || (audience === "firm" ? "growth" : "operations");
  return `/signup?plan=${plan}&type=${type}`;
}

function getPlanCtaHref(
  audience: "firm" | "business",
  planName: string,
  ctaLabel: string,
) {
  const normalizedCta = ctaLabel.toLowerCase();
  if (normalizedCta.includes("talk to sales")) {
    return "/demo";
  }
  return getPlanSignupHref(audience, planName);
}

function getPlanButtonLabel(planName: string, ctaLabel: string) {
  if (ctaLabel.toLowerCase().includes("talk to sales")) {
    return "Talk to Sales";
  }
  return `Choose ${planName}`;
}

const pricingPlans = {
  firm: [
    {
      name: "Starter",
      price: "$29",
      billingNote: "/month",
      subtitle:
        "For solo operators and smaller firms that need one clean place to run recurring filings.",
      eyebrow: "Best for getting started",
      cta: "Start Free Trial",
      featured: false,
      footnote: "Costs less than one preventable cleanup issue",
      features: [
        "Track recurring filings in one place",
        "See overdue, due soon, and ready items instantly",
        "Core workflow tracking tied to each filing",
        "A clean step up from spreadsheets and checklists",
      ],
    },
    {
      name: "Growth",
      price: "$59",
      billingNote: "/month",
      subtitle:
        "For growing firms that need stronger visibility, cleaner execution, and better team coordination.",
      eyebrow: "Most popular",
      cta: "Start Free Trial",
      featured: true,
      footnote: "Built for firms outgrowing spreadsheets",
      features: [
        "Everything in Starter",
        "Better visibility across deadlines and owners",
        "Stronger team coordination around recurring work",
        "A small monthly cost compared with one missed filing",
      ],
    },
    {
      name: "Scale",
      price: "$99",
      billingNote: "/month",
      subtitle:
        "For firms running larger, higher-volume, deadline-driven compliance operations.",
      eyebrow: "Best for larger teams",
      cta: "Start Free Trial",
      featured: false,
      footnote: "Best fit for heavier compliance volume",
      features: [
        "Everything in Growth",
        "More operational control across the team",
        "Better clarity across larger filing workloads",
        "Designed for more complex firm operations",
      ],
    },
  ],
  business: [
    {
      name: "Core",
      price: "$49",
      billingNote: "/month",
      subtitle:
        "For businesses that want one clean place to manage recurring compliance work without relying on memory and spreadsheets.",
      eyebrow: "Best for owner-operators",
      cta: "Start Free Trial",
      featured: false,
      footnote: "Built for one business",
      features: [
        "Track recurring compliance deadlines",
        "See overdue, due soon, and ready-to-file work",
        "Simple workflow tracking for each filing",
        "A cleaner operating layer for lean teams",
      ],
    },
    {
      name: "Operations",
      price: "$99",
      billingNote: "/month",
      subtitle:
        "For growing businesses with more entities, more filings, and more operational risk to manage.",
      eyebrow: "Most popular",
      cta: "Start Free Trial",
      featured: true,
      footnote: "Built for growing compliance volume",
      features: [
        "Everything in Core",
        "Better visibility across filings and entities",
        "Stronger control across recurring deadlines",
        "An easy yes compared with preventable filing risk",
      ],
    },
    {
      name: "Enterprise",
      price: "$199",
      billingNote: "/month",
      subtitle:
        "For larger businesses that need a stronger compliance operating layer across a more complex internal environment.",
      eyebrow: "Best for larger businesses",
      cta: "Talk to Sales",
      featured: false,
      footnote: "For more complex internal teams",
      features: [
        "Everything in Operations",
        "Built for more complex entity structures",
        "Clearer control across larger compliance workloads",
        "Designed for scaling internal teams",
      ],
    },
  ],
};

function SectionGlow() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />
    </>
  );
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <Image
        src={LOGO_SRC}
        alt="Due Horizon"
        width={compact ? 120 : 240}
        height={compact ? 24 : 48}
        className="h-auto w-auto object-contain"
        priority
      />
    </div>
  );
}

function Nav({ signupHref = "/signup" }: { signupHref?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center">
          <Image
            src={LOGO_SRC}
            alt="Due Horizon"
            width={200}
            height={40}
            className="h-auto w-auto object-contain"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.04] hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/15 hover:bg-white/10 sm:inline-flex"
          >
            Sign In
          </Link>
          <Link
            href={signupHref}
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:from-cyan-300 hover:to-blue-400"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-cyan-400/12 blur-3xl" />
      <div className="absolute -right-8 bottom-10 h-44 w-44 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="absolute inset-x-10 -bottom-10 h-24 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,34,0.98),rgba(6,12,24,0.98))] shadow-[0_60px_120px_rgba(0,0,0,0.62)] transition duration-300 hover:-translate-y-1">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%)]" />

        <div className="relative border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BrandLockup compact />
              <div>
                <div className="text-sm font-semibold text-white">
                  Due Horizon
                </div>
                <div className="text-xs text-slate-400">
                  Compliance command center
                </div>
              </div>
            </div>
            <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-cyan-200">
              LIVE VISIBILITY
            </div>
          </div>
        </div>

        <div className="relative grid gap-4 p-4 sm:p-5 xl:grid-cols-[168px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
            <div className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-slate-500">
              NAVIGATION
            </div>
            <div className="space-y-2">
              {[
                [LayoutDashboard, "Dashboard", "Operational overview", true],
                [ClipboardCheck, "Filings", "128 active", false],
                [CalendarClock, "Calendar", "12 due this month", false],
                [BarChart3, "Reports", "Workload visibility", false],
              ].map(([Icon, label, meta, active]) => (
                <div
                  key={label as string}
                  className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 transition-all duration-200 ${
                    active
                      ? "border-cyan-300/20 bg-cyan-400/10 shadow-[0_8px_24px_rgba(34,211,238,0.08)]"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                        active
                          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-200"
                          : "border-white/10 bg-white/[0.03] text-slate-300"
                      }`}
                    >
                      {React.createElement(Icon as React.ComponentType<any>, {
                        size: 15,
                      })}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-white">
                        {label as string}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {meta as string}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-4 text-[12px] text-slate-400">
              <div>
                <span className="font-semibold text-white">100+</span> filings
                tracked
              </div>
              <div>
                <span className="font-semibold text-white">3</span> overdue
                items surfaced
              </div>
              <div>
                <span className="font-semibold text-white">5</span> ready to
                file
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(59,130,246,0.09),rgba(255,255,255,0.02))] p-5">
              <div className="text-[11px] font-semibold tracking-[0.22em] text-cyan-300/80">
                TODAY'S RISK VIEW
              </div>
              <div className="mt-2 max-w-[320px] text-[34px] font-semibold leading-[1.02] tracking-tight text-white">
                <span className="text-cyan-300">8</span> filings need attention
                before they become a problem
              </div>
              <div className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                See what is overdue, due soon, blocked, and ready to file across
                your workload in one live dashboard.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-red-400/20 bg-red-500/10 p-4 transition-all duration-200 hover:-translate-y-0.5">
                <div className="text-[11px] font-semibold tracking-[0.22em] text-red-200">
                  OVERDUE
                </div>
                <div className="mt-2 text-4xl font-bold leading-none text-white">
                  3
                </div>
                <div className="mt-2 text-xs text-red-100/80">
                  Needs action now
                </div>
              </div>
              <div className="rounded-[26px] border border-yellow-400/20 bg-yellow-500/10 p-4 transition-all duration-200 hover:-translate-y-0.5">
                <div className="text-[11px] font-semibold tracking-[0.22em] text-yellow-200">
                  DUE SOON
                </div>
                <div className="mt-2 text-4xl font-bold leading-none text-white">
                  5
                </div>
                <div className="mt-2 text-xs text-yellow-100/80">This week</div>
              </div>
              <div className="rounded-[26px] border border-emerald-400/20 bg-emerald-500/10 p-4 transition-all duration-200 hover:-translate-y-0.5">
                <div className="text-[11px] font-semibold tracking-[0.22em] text-emerald-200">
                  READY TO FILE
                </div>
                <div className="mt-2 text-4xl font-bold leading-none text-white">
                  5
                </div>
                <div className="mt-2 text-xs text-emerald-100/80">
                  Prepared and waiting
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div className="text-sm font-semibold text-white">
                  Priority Filings
                </div>
                <div className="text-xs text-slate-400">Today</div>
              </div>
              <div className="space-y-2 p-3">
                {[
                  [
                    "NYS-45",
                    "Carr Accounting Solutions",
                    "Due in 2 days",
                    "text-yellow-300",
                  ],
                  [
                    "Sales Tax",
                    "Hudson Valley Plumbing",
                    "Past due",
                    "text-red-300",
                  ],
                  [
                    "941",
                    "North Ridge Holdings",
                    "Ready to file",
                    "text-emerald-300",
                  ],
                ].map(([title, company, status, color]) => (
                  <div
                    key={title as string}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-all duration-200 hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {title as string}
                      </div>
                      <div className="truncate text-xs text-slate-400">
                        {company as string}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 text-xs font-medium ${color as string}`}
                    >
                      {status as string}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>
    </div>
  );
}

function ProofStrip() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 xl:grid-cols-4">
        {proofStats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04]"
          >
            <div className="text-2xl font-semibold tracking-tight text-white">
              {item.value}
            </div>
            <div className="mt-1 text-sm text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RiskStrip() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="rounded-[30px] border border-red-400/15 bg-[linear-gradient(135deg,rgba(127,29,29,0.16),rgba(69,10,10,0.08),rgba(255,255,255,0.01))] p-6 sm:p-8">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-300/15 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100/90">
            <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
            The problem is not tracking tasks. The problem is missing deadlines.
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            One missed filing can create penalties, cleanup work, team stress,
            and client trust issues.
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {urgencyPoints.map((point) => (
              <div
                key={point}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate-200"
              >
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ValuePillars() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <SectionGlow />
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
          WHY IT FEELS DIFFERENT
        </div>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Purpose-built for recurring, deadline-driven compliance work.
        </h2>
        <p className="mt-4 text-lg text-slate-400">
          Due Horizon is designed around the reality of recurring filings,
          shifting due dates, and execution across clients, entities, and
          states.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {valuePillars.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-5 text-xl font-semibold text-white">
                {item.title}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-400">
                {item.body}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BreathingSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.015))] px-6 py-10 text-center sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
            A BETTER OPERATING FEEL
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Compliance should feel controlled, visible, and repeatable.
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-400 sm:text-lg">
            One operating view. One workflow. One clear picture of what is due,
            what is blocked, and what is ready to file.
          </p>
        </div>
      </div>
    </section>
  );
}

function TestimonialBand() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="grid gap-4 lg:grid-cols-2">
        {testimonialCards.map((item) => (
          <div
            key={item.quote}
            className="rounded-[32px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(59,130,246,0.06),rgba(255,255,255,0.02))] p-6 sm:p-8"
          >
            <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
              WHAT THIS SHOULD FEEL LIKE
            </div>
            <blockquote className="mt-5 text-2xl font-medium leading-tight text-white sm:text-3xl">
              “{item.quote}”
            </blockquote>
            <div className="mt-5 text-sm text-slate-400">{item.author}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustBand() {
  return (
    <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-8">
      <div className="rounded-[30px] border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(59,130,246,0.07),rgba(255,255,255,0.02))] p-6 sm:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-1.5 text-xs font-medium text-cyan-100/90">
              <Star className="h-3.5 w-3.5 text-cyan-300" />
              Built for modern firms and businesses
            </div>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Replace spreadsheet sprawl with one clear compliance operating
              layer.
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
              Bring deadlines, workflow, ownership, status, and visibility
              together so your team knows what is due, what is blocked, and what
              is ready before things slip.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
            {trustCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-slate-950/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-cyan-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="mt-4 text-sm font-semibold text-white">
                    {card.title}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    {card.body}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoiBand() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
      <div className="grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
        {roiPoints.map((point) => (
          <div
            key={point}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="h-4 w-4 text-cyan-300" />
              {point}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DueHorizonLandingPage() {
  const [pricingAudience, setPricingAudience] = useState<"firm" | "business">(
    "firm",
  );
  const activePricingPlans = pricingPlans[pricingAudience];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_30%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      <Nav signupHref="/signup" />

      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              {pricingAudience === "firm"
                ? "COMPLIANCE OS FOR ACCOUNTING FIRMS"
                : "COMPLIANCE OS FOR BUSINESSES"}
            </div>

            <div className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
              <button
                type="button"
                onClick={() => setPricingAudience("firm")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  pricingAudience === "firm"
                    ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Accounting Firm
              </button>
              <button
                type="button"
                onClick={() => setPricingAudience("business")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  pricingAudience === "business"
                    ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                Business
              </button>
            </div>

            <h1 className="mt-6 max-w-[760px] text-5xl font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-6xl lg:text-[74px]">
              Stop running compliance from spreadsheets, memory, and last-minute
              follow-up.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Track every filing across your business, entities, or clients.
              Attach workflow to every deadline. See what needs attention before
              it becomes a penalty, a scramble, or a missed obligation.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-slate-300">
              {pricingAudience === "firm"
                ? "Built for accounting firms managing recurring compliance across clients, entities, and states"
                : "Built for businesses managing recurring filings across entities and jurisdictions"}
            </div>

            <div className="mt-4 flex max-w-xl items-start gap-3 rounded-2xl border border-red-400/15 bg-red-500/8 px-4 py-3 text-sm text-red-100/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
              <span>
                One missed deadline can cost more than the software ever will.
              </span>
            </div>

            <div className="mt-3 max-w-xl text-sm text-slate-400">
              {pricingAudience === "firm"
                ? "As your book grows, spreadsheets, inboxes, and manual follow-up stop scaling."
                : "As filings, entities, and states grow, spreadsheets and manual tracking stop scaling."}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={getDefaultSignupHref(pricingAudience)}
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_12px_36px_rgba(34,211,238,0.26)] transition-all duration-200 hover:-translate-y-[1px] hover:from-cyan-300 hover:to-blue-400"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#pricing"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition-all duration-200 hover:bg-white/10"
              >
                View Pricing
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-100 transition-all duration-200 hover:border-cyan-300/30 hover:bg-cyan-400/15 hover:text-white"
              >
                Book a Demo
              </Link>
            </div>

            <div className="mt-3 space-y-2 text-xs text-slate-500">
              <div>No credit card required</div>
              <div className="text-slate-400">
                Built for teams managing recurring filings across clients,
                entities, and states
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              {logoPills.map((pill) => (
                <div
                  key={pill}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5"
                >
                  {pill}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center lg:justify-end">
            <HeroMock />
          </div>
        </div>
      </section>

      <ProofStrip />
      <RiskStrip />
      <ValuePillars />
      <BreathingSection />
      <TestimonialBand />

      <section
        id="why-due-horizon"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
            WHY TEAMS SWITCH
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Most tools track tasks. Due Horizon helps you run compliance.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Generic systems were not built for recurring filings, shifting due
            dates, and deadline-driven work across dozens or hundreds of
            entities.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/8 px-4 py-2 text-sm text-cyan-100/90">
            <ClipboardCheck className="h-4 w-4 text-cyan-300" />
            Due Horizon is purpose-built for compliance, not generic project
            management.
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {outcomeCards.map((card, index) => (
            <div
              key={card.title}
              className={`rounded-[28px] border p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)] ${
                index === 0
                  ? "border-red-400/15 bg-[linear-gradient(135deg,rgba(127,29,29,0.16),rgba(69,10,10,0.06),rgba(255,255,255,0.01))]"
                  : "border-cyan-300/15 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(59,130,246,0.08),rgba(255,255,255,0.01))]"
              }`}
            >
              <div className="text-xl font-semibold text-white">
                {card.title}
              </div>
              <div className="mt-5 space-y-3">
                {card.points.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <CheckCircle2
                      className={`mt-0.5 h-4 w-4 ${index === 0 ? "text-red-300" : "text-cyan-300"}`}
                    />
                    <span className="text-sm text-slate-200">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        id="product"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
            PRODUCT
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Everything your team needs to run compliance cleanly.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Organize deadlines, standardize execution, and see exactly where
            work stands without rebuilding the process every cycle.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-[26px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-xl font-semibold text-white">
                  {card.title}
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-400">
                  {card.body}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <TrustBand />

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6 sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
              HOW IT WORKS
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              From setup to execution, in one clear operating workflow.
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Due Horizon turns compliance from scattered deadlines into a
              system your team can actually run.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-4">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="text-sm font-semibold tracking-[0.18em] text-cyan-300/80">
                  {step.number}
                </div>
                <div className="mt-4 text-xl font-semibold text-white">
                  {step.title}
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-400">
                  {step.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RoiBand />

      <section
        id="pricing"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-18"
      >
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold tracking-[0.2em] text-cyan-300/80">
            PRICING
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Simple pricing that is cheap compared with one preventable miss.
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Choose the plan that fits, get set up before the next filing cycle, and stop running recurring filings from memory and spreadsheets.
          </p>

          <div className="mt-4 text-sm font-medium text-cyan-300">
            Most teams start before the next filing cycle turns into another scramble.
          </div>

          <div className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setPricingAudience("firm")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                pricingAudience === "firm"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.24)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Accounting Firm
            </button>
            <button
              type="button"
              onClick={() => setPricingAudience("business")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                pricingAudience === "business"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.24)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Business
            </button>
          </div>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-400/8 px-4 py-2 text-sm text-cyan-100/90">
            <Star className="h-4 w-4 text-cyan-300" />
            {pricingAudience === "firm"
              ? "Most firms start with Growth"
              : "Most businesses start with Operations"}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {activePricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={`group relative overflow-hidden rounded-[32px] border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(0,0,0,0.38)] ${
                plan.featured
                  ? "border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(59,130,246,0.10),rgba(255,255,255,0.02))]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_38%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className={`text-[11px] font-semibold tracking-[0.18em] ${plan.featured ? "text-cyan-200" : "text-slate-400"}`}
                    >
                      {plan.eyebrow.toUpperCase()}
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-white">
                      {plan.name}
                    </div>
                  </div>

                  {plan.featured && (
                    <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-cyan-200">
                      MOST POPULAR
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-end gap-2">
                  <div className="text-5xl font-semibold tracking-tight text-white">
                    {plan.price}
                  </div>
                  <div className="pb-1 text-sm text-slate-400">
                    {plan.billingNote}
                  </div>
                </div>

                <div className="mt-4 text-sm leading-7 text-slate-400">
                  {plan.subtitle}
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
                  {plan.footnote}
                </div>

                {plan.featured && (
                  <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-xs text-cyan-100">
                    {pricingAudience === "firm"
                      ? "Best fit for firms managing multiple clients and recurring filings"
                      : "Best fit for businesses managing multiple entities and recurring deadlines"}
                  </div>
                )}

                <Link
                  href={getPlanCtaHref(pricingAudience, plan.name, plan.cta)}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-[1px] ${
                    plan.featured
                      ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.24)] hover:from-cyan-300 hover:to-blue-400"
                      : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  }`}
                >
                  {getPlanButtonLabel(plan.name, plan.cta)}
                </Link>

                <div className="mt-2 text-center text-xs text-slate-400">
                  {plan.cta.toLowerCase().includes("trial")
                    ? `${plan.name} plan • Starts with a free trial`
                    : "Talk to us about enterprise needs"}
                </div>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-slate-300">
          Pick the plan that fits, set up your filings, and start running compliance from one system before the next cycle starts.
        </div>

        <div className="mt-3 text-center text-xs text-slate-500">
          {pricingAudience === "firm"
            ? "No credit card required for firm plans"
            : "No credit card required for business plans"}
        </div>
      </section>
    </main>
  );
}
