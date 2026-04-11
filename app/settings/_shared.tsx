"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const navItems = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/workspace", label: "Workspace" },
  { href: "/settings/team", label: "Team & Access" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/billing", label: "Billing" },
];

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-[30px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_60px_rgba(34,211,238,0.07)] sm:p-4">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(11,21,38,0.96),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_42%)] px-5 py-6 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/75">
                    Settings
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{description}</p>
                </div>

                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                >
                  Back to Settings
                  <ChevronRight size={15} />
                </Link>
              </div>
            </div>

            <div className="grid gap-6 px-5 py-6 lg:grid-cols-[270px_minmax(0,1fr)] sm:px-6">
              <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.14)]">
                <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Settings Navigation
                </div>
                <nav className="space-y-2">
                  {navItems.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-sm transition ${
                          active
                            ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100"
                            : "border-transparent bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronRight size={15} className={active ? "text-cyan-200" : "text-slate-500"} />
                      </Link>
                    );
                  })}
                </nav>
              </aside>

              <section className="min-w-0">{children}</section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function Field({
  label,
  helper,
  placeholder,
  type = "text",
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  helper?: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-slate-400 placeholder:text-slate-600"
            : "border-white/10 bg-white/[0.04] text-white placeholder:text-slate-500 focus:border-cyan-300/35 focus:bg-white/[0.06]"
        }`}
      />
      {helper && <div className="mt-2 text-sm text-slate-400">{helper}</div>}
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  enabled = false,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  enabled?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return;
        onChange?.(!enabled);
      }}
      disabled={disabled}
      className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left transition ${
        disabled
          ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-60"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{description}</div>
      </div>
      <div className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-cyan-400/80" : "bg-white/10"}`}>
        <div className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} />
      </div>
    </button>
  );
}

export function SaveBar({
  primary = "Save Changes",
  onPrimaryClick,
  saving = false,
  disabled = false,
}: {
  primary?: string;
  onPrimaryClick?: () => void;
  saving?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onPrimaryClick}
        disabled={saving || disabled}
        className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? "Saving..." : primary}
      </button>
      <button
        type="button"
        disabled={saving}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
      <div className="mb-5">
        <div className="text-xl font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm leading-7 text-slate-400">{description}</div>
      </div>
      {children}
    </div>
  );
}
