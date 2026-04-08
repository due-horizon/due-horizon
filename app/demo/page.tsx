"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const LOGO_SRC = "/logo-final.png";
const CALENDLY_URL = "https://calendly.com/hello-duehorizon/30min";

const benefits = [
  "See the dashboard, filings workflow, and onboarding path in one walkthrough",
  "Get the right setup path whether you run a firm or a business",
  "Ask live questions about pricing, workflows, and implementation",
];

const highlights = [
  {
    icon: Clock3,
    title: "30-minute walkthrough",
    body: "A focused demo of the platform and exactly how it fits into your current workflow.",
  },
  {
    icon: Users,
    title: "Built around your setup",
    body: "Relevant whether you manage client compliance or internal filings.",
  },
  {
    icon: ShieldCheck,
    title: "Clear next steps",
    body: "Leave knowing exactly how to implement Due Horizon in your workflow.",
  },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_30%),linear-gradient(to_bottom,#020617,#020617,#07111f)] text-white">
      
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/home" className="flex items-center">
            <Image src={LOGO_SRC} alt="Due Horizon" width={200} height={40} />
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/15 hover:bg-white/10 sm:inline-flex"
            >
              Sign In
            </Link>

            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:from-cyan-300 hover:to-blue-400"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.96fr_1.04fr] lg:px-8 lg:py-24">
          
          {/* LEFT SIDE */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold tracking-[0.18em] text-cyan-200">
              <Sparkles className="h-4 w-4" />
              LIVE WALKTHROUGH
            </div>

            <h1 className="mt-6 max-w-[680px] text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-6xl lg:text-[64px]">
              See how your compliance workflow should actually run.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              In this live demo, we’ll show you how Due Horizon tracks filings, eliminates manual follow-up,
              and gives you full visibility across everything due — before it becomes a problem.
            </p>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">What you’ll see on the demo</div>

              <div className="mt-4 space-y-3">
                {benefits.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-cyan-300" />
                    <span className="text-sm text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_12px_36px_rgba(34,211,238,0.26)] transition-all duration-200 hover:-translate-y-[1px] hover:from-cyan-300 hover:to-blue-400"
              >
                Pick a Time
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>

              <Link
                href="/signup"
                className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-slate-100 transition-all duration-200 hover:bg-white/10"
              >
                Start Free Instead
              </Link>
            </div>

            <div className="mt-4 text-sm text-slate-400">
              No pressure — just a clean walkthrough and clear next steps.
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.05]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="mt-4 text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-400">{item.body}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="relative z-10">
            <div className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">Book your demo</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Choose a time below and we’ll walk you through everything live.
                  </div>
                </div>

                <div className="hidden rounded-full border border-cyan-300/15 bg-cyan-400/8 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-cyan-200 sm:inline-flex">
                  LIVE SCHEDULING
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/40 p-3">
                
                <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Schedule with Due Horizon</div>
                    <div className="text-sm text-slate-400">
                      Pick a time that works for you — we’ll take it from there.
                    </div>
                  </div>
                </div>

                <iframe
                  src={CALENDLY_URL}
                  width="100%"
                  height="720"
                  className="rounded-2xl bg-white"
                  title="Schedule a Due Horizon demo"
                />
              </div>

            </div>
          </div>

        </div>
      </section>
    </main>
  );
}