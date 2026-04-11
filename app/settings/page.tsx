"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronRight,
  CreditCard,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  User2,
  Users,
} from "lucide-react";

const settingSections = [
  {
    title: "Profile",
    description: "Name, email, and personal account details.",
    icon: User2,
    items: ["Update profile info", "Change email", "Manage account identity"],
    accent: "cyan",
    href: "/settings/profile",
  },
  {
    title: "Workspace",
    description: "Manage your firm or business settings and defaults.",
    icon: Building2,
    items: ["Workspace details", "Entity preferences", "Operational defaults"],
    accent: "blue",
    href: "/settings/workspace",
  },
  {
    title: "Team & Access",
    description: "Control who can access the workspace and what they can do.",
    icon: Users,
    items: ["Invite team members", "Permissions", "Role management"],
    accent: "emerald",
    href: "/settings/team",
  },
  {
    title: "Notifications",
    description: "Choose how you want to be notified about filing activity.",
    icon: Bell,
    items: ["Email alerts", "Due date reminders", "Workspace activity"],
    accent: "yellow",
    href: "/settings/notifications",
  },
  {
    title: "Security",
    description: "Protect your account with stronger authentication controls.",
    icon: ShieldCheck,
    items: ["Password settings", "Two-factor auth", "Session security"],
    accent: "red",
    href: "/settings/security",
  },
  {
    title: "Billing",
    description: "Manage your plan, invoices, and billing information.",
    icon: CreditCard,
    items: ["Plan details", "Payment method", "Billing history"],
    accent: "violet",
    href: "/settings/billing",
  },
];

function accentClasses(accent: string) {
  switch (accent) {
    case "cyan":
      return {
        border: "border-cyan-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(8,47,73,0.16),rgba(15,23,42,0.04))]",
        icon: "text-cyan-200 bg-cyan-400/10 border-cyan-300/15",
      };
    case "blue":
      return {
        border: "border-blue-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(30,58,138,0.16),rgba(15,23,42,0.04))]",
        icon: "text-blue-200 bg-blue-400/10 border-blue-300/15",
      };
    case "emerald":
      return {
        border: "border-emerald-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(6,78,59,0.16),rgba(15,23,42,0.04))]",
        icon: "text-emerald-200 bg-emerald-400/10 border-emerald-300/15",
      };
    case "yellow":
      return {
        border: "border-yellow-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(161,98,7,0.16),rgba(15,23,42,0.04))]",
        icon: "text-yellow-100 bg-yellow-400/10 border-yellow-300/15",
      };
    case "red":
      return {
        border: "border-red-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(127,29,29,0.16),rgba(15,23,42,0.04))]",
        icon: "text-red-200 bg-red-400/10 border-red-300/15",
      };
    default:
      return {
        border: "border-violet-300/15",
        bg: "bg-[linear-gradient(180deg,rgba(91,33,182,0.16),rgba(15,23,42,0.04))]",
        icon: "text-violet-200 bg-violet-400/10 border-violet-300/15",
      };
  }
}

function QuickStat({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <div className="mt-2 text-sm text-slate-400">{helper}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-cyan-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs uppercase tracking-[0.16em]">{title}</span>
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-[30px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_60px_rgba(34,211,238,0.07)] sm:p-4">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(11,21,38,0.96),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%)] px-5 py-6 sm:px-6">
              <div className="mb-5">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-300/20 hover:bg-cyan-400/10 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back to Dashboard
                </Link>
              </div>

              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                    Settings
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Account & workspace settings
                  </h1>
                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    Manage your account, workspace preferences, team access,
                    notifications, and security from one clean control center.
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
                  Built for quick admin changes without clutter
                </div>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <QuickStat
                  label="Profile"
                  value="Account"
                  helper="Identity and login details"
                  icon={<User2 size={18} />}
                />
                <QuickStat
                  label="Workspace"
                  value="Admin"
                  helper="Business and firm settings"
                  icon={<Building2 size={18} />}
                />
                <QuickStat
                  label="Security"
                  value="Protected"
                  helper="Access and account safety"
                  icon={<Lock size={18} />}
                />
                <QuickStat
                  label="Notifications"
                  value="Live"
                  helper="Alerts and reminder preferences"
                  icon={<Mail size={18} />}
                />
              </div>

              <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      CONTROL CENTER
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      Everything important in one place
                    </div>
                    <div className="mt-2 text-sm leading-7 text-slate-300">
                      Each section below routes to its own dedicated settings page
                      so the hub stays clean while the actual controls scale the
                      right way.
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniCard
                      title="Security posture"
                      value="Strong"
                      icon={<KeyRound size={16} />}
                    />
                    <MiniCard
                      title="Workspace controls"
                      value="Ready"
                      icon={<SlidersHorizontal size={16} />}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {settingSections.map((section) => {
                  const Icon = section.icon;
                  const styles = accentClasses(section.accent);

                  return (
                    <Link
                      key={section.title}
                      href={section.href}
                      className={`group rounded-[28px] border ${styles.border} ${styles.bg} p-5 text-left shadow-[0_22px_60px_rgba(0,0,0,0.14)] transition-all duration-200 hover:-translate-y-[2px] hover:border-white/15`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-2xl border p-3 ${styles.icon}`}>
                              <Icon size={18} />
                            </div>
                            <div>
                              <div className="text-lg font-semibold text-white">
                                {section.title}
                              </div>
                              <div className="mt-1 text-sm text-slate-400">
                                {section.description}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {section.items.map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition group-hover:text-white">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}