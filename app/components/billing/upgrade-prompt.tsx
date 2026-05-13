"use client";

import Link from "next/link";
import {
  FeatureKey,
  formatPlanName,
  getUpgradeTarget,
} from "@/lib/billing/plan-access";

const featureCopy: Record<
  FeatureKey,
  { title: string; description: string }
> = {
  team: {
    title: "Team access",
    description: "Add and manage more users with the right workspace permissions.",
  },
  reports: {
    title: "Reports",
    description: "Unlock reporting views and operational visibility for your workspace.",
  },
  calendar: {
    title: "Calendar",
    description: "Keep due dates, filings, and compliance events visible in one place.",
  },
  client_portal: {
    title: "Client portal",
    description: "Share documents, requests, and status updates through a dedicated portal.",
  },
  advanced_reports: {
    title: "Advanced reports",
    description: "Go deeper with higher-value reporting and workspace insights.",
  },
  bulk_workflows: {
    title: "Bulk workflows",
    description: "Run workflow actions across more filings and clients with less manual work.",
  },
  multi_entity: {
    title: "Multi-entity support",
    description: "Manage multiple entities with cleaner organization and oversight.",
  },
  priority_support: {
    title: "Priority support",
    description: "Get faster support when your workspace needs immediate help.",
  },
  custom_roles: {
    title: "Custom roles",
    description: "Control access with more flexible permissions and team structure.",
  },
};

export function UpgradePrompt({
  workspaceType,
  currentPlan,
  feature,
  compact = false,
}: {
  workspaceType: string | null | undefined;
  currentPlan: string | null | undefined;
  feature: FeatureKey;
  compact?: boolean;
}) {
  const targetPlan = getUpgradeTarget({
    workspaceType,
    feature,
  });

  const copy = featureCopy[feature];
  const targetPlanLabel = formatPlanName(targetPlan);
  const currentPlanLabel = formatPlanName(currentPlan);

  return (
    <div
      className={`rounded-2xl border border-cyan-400/20 bg-cyan-400/10 ${
        compact ? "px-4 py-4" : "px-5 py-5"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/85">
        Upgrade required
      </div>
      <div className="mt-2 text-lg font-semibold text-white">{copy.title}</div>
      <div className="mt-2 text-sm leading-7 text-slate-300">
        {copy.description} You are currently on {currentPlanLabel}. Upgrade to{" "}
        {targetPlanLabel} to unlock this feature.
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/settings/billing"
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.3)] transition hover:scale-[1.01]"
        >
          Upgrade plan
        </Link>

        <span className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-300">
          Unlock with {targetPlanLabel}
        </span>
      </div>
    </div>
  );
}