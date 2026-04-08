"use client";

import { Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

export default function TeamSettingsPage() {
  return (
    <SettingsShell
      title="Team & access"
      description="Manage teammates, role permissions, and the way users access your workspace."
    >
      <div className="space-y-6">
        <Panel
          title="Team access controls"
          description="As your workspace grows, permissions and role clarity become more important."
        >
          <div className="space-y-3">
            <ToggleRow
              title="Allow team invites"
              description="Workspace owners can invite new teammates."
              enabled
            />
            <ToggleRow
              title="Require admin approval for role changes"
              description="Prevent accidental permission escalations."
              enabled
            />
            <ToggleRow
              title="Allow staff to manage filings"
              description="Let non-admin staff update filings and statuses."
              enabled
            />
          </div>
          <SaveBar primary="Save Access Controls" />
        </Panel>

        <Panel
          title="Next step"
          description="This page is the perfect place to later add real team members, role tables, and invite workflows."
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
            For now, this page gives you the right structure for team management.
            Later you can plug in real member rows, pending invites, workspace
            roles, and user-level access controls.
          </div>
        </Panel>
      </div>
    </SettingsShell>
  );
}