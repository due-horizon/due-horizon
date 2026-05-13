export type WorkspaceType = "firm" | "business";
export type FirmPlan = "starter" | "growth" | "scale";
export type BusinessPlan = "core" | "operations" | "enterprise";
export type Plan = FirmPlan | BusinessPlan;

export type FeatureKey =
  | "team"
  | "reports"
  | "calendar"
  | "client_portal"
  | "advanced_reports"
  | "bulk_workflows"
  | "multi_entity"
  | "priority_support"
  | "custom_roles";

type FeatureMatrix = Record<FeatureKey, boolean>;

const firmPlanFeatures: Record<FirmPlan, FeatureMatrix> = {
  starter: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: false,
    advanced_reports: false,
    bulk_workflows: false,
    multi_entity: true,
    priority_support: false,
    custom_roles: false,
  },
  growth: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: true,
    advanced_reports: true,
    bulk_workflows: true,
    multi_entity: true,
    priority_support: false,
    custom_roles: true,
  },
  scale: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: true,
    advanced_reports: true,
    bulk_workflows: true,
    multi_entity: true,
    priority_support: true,
    custom_roles: true,
  },
};

const businessPlanFeatures: Record<BusinessPlan, FeatureMatrix> = {
  core: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: false,
    advanced_reports: false,
    bulk_workflows: false,
    multi_entity: false,
    priority_support: false,
    custom_roles: false,
  },
  operations: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: false,
    advanced_reports: true,
    bulk_workflows: true,
    multi_entity: true,
    priority_support: false,
    custom_roles: true,
  },
  enterprise: {
    team: true,
    reports: true,
    calendar: true,
    client_portal: true,
    advanced_reports: true,
    bulk_workflows: true,
    multi_entity: true,
    priority_support: true,
    custom_roles: true,
  },
};

export function normalizeWorkspaceType(value: string | null | undefined): WorkspaceType {
  const normalized = (value || "").toLowerCase();

  if (normalized === "business" || normalized === "business_owner") {
    return "business";
  }

  return "firm";
}

export function normalizePlan(
  workspaceType: WorkspaceType,
  value: string | null | undefined
): Plan {
  const normalized = (value || "").toLowerCase();

  if (workspaceType === "business") {
    if (normalized === "enterprise" || normalized === "operations" || normalized === "core") {
      return normalized;
    }

    return "operations";
  }

  if (normalized === "scale" || normalized === "growth" || normalized === "starter") {
    return normalized;
  }

  return "growth";
}

export function getPlanFeatures(
  workspaceType: WorkspaceType,
  plan: string | null | undefined
): FeatureMatrix {
  const normalizedPlan = normalizePlan(workspaceType, plan);

  if (workspaceType === "business") {
    return businessPlanFeatures[normalizedPlan as BusinessPlan];
  }

  return firmPlanFeatures[normalizedPlan as FirmPlan];
}

export function hasFeatureAccess(args: {
  workspaceType: string | null | undefined;
  plan: string | null | undefined;
  feature: FeatureKey;
}) {
  const normalizedType = normalizeWorkspaceType(args.workspaceType);
  const features = getPlanFeatures(normalizedType, args.plan);
  return features[args.feature];
}

export function getUpgradeTarget(args: {
  workspaceType: string | null | undefined;
  feature: FeatureKey;
}) {
  const normalizedType = normalizeWorkspaceType(args.workspaceType);

  const orderedPlans: Plan[] =
    normalizedType === "business"
      ? ["core", "operations", "enterprise"]
      : ["starter", "growth", "scale"];

  for (const plan of orderedPlans) {
    if (hasFeatureAccess({ workspaceType: normalizedType, plan, feature: args.feature })) {
      return plan;
    }
  }

  return orderedPlans[orderedPlans.length - 1];
}

export function formatPlanName(plan: string | null | undefined) {
  const normalized = (plan || "").toLowerCase();

  const map: Record<string, string> = {
    starter: "Starter",
    growth: "Growth",
    scale: "Scale",
    core: "Core",
    operations: "Operations",
    enterprise: "Enterprise",
  };

  return map[normalized] || "Current plan";
}
