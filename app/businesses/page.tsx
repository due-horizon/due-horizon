"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BusinessesPage() {
  const pathname = usePathname();

  return (
    <Shell pathname={pathname} title="My Businesses" description="View and manage your businesses here." />
  );
}

function Shell({
  pathname,
  title,
  description,
}: {
  pathname: string;
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_28%),linear-gradient(to_bottom,#07111f,#020617)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="rounded-[28px] border border-cyan-400/10 bg-white/[0.03] p-3 shadow-[0_0_50px_rgba(34,211,238,0.06)] sm:p-4">
          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(to_bottom,rgba(11,21,38,0.96),rgba(8,15,28,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 ring-1 ring-cyan-300/20">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-500 shadow-[0_0_18px_rgba(34,211,238,0.35)]" />
                  </div>
                  <div className="text-xl font-semibold tracking-tight">Due Horizon</div>
                </div>

                <div className="flex flex-wrap items-center gap-5 text-sm">
                  <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />
                  <NavLink href="/filings" label="Filings" pathname={pathname} />
                  <NavLink href="/calendar" label="Calendar" pathname={pathname} />
                  <NavLink href="/reports" label="Reports" pathname={pathname} />
                </div>
              </div>
            </div>

            <div className="px-6 py-16">
              <h1 className="text-3xl font-semibold">{title}</h1>
              <p className="mt-3 text-slate-400">{description}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function NavLink({
  href,
  label,
  pathname,
}: {
  href: string;
  label: string;
  pathname: string;
}) {
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`relative ${isActive ? "text-cyan-300" : "text-slate-300 hover:text-white"}`}
    >
      {label}
      {isActive && (
        <span className="absolute -bottom-2 left-0 h-[2px] w-full rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.7)]" />
      )}
    </Link>
  );
}