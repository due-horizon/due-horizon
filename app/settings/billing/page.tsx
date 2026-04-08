"use client";

import { Field, Panel, SaveBar, SettingsShell } from "../_shared";

export default function BillingSettingsPage() {
  return (
    <SettingsShell
      title="Billing settings"
      description="Manage your subscription, payment details, and billing records from one place."
    >
      <div className="space-y-6">
        <Panel
          title="Plan details"
          description="Use this section for current plan details, upgrade paths, and future billing controls."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Current plan" defaultValue="Growth" />
            <Field label="Billing cycle" defaultValue="Monthly" />
            <Field label="Billing contact" type="email" defaultValue="billing@example.com" />
            <Field label="Card ending in" defaultValue="4242" />
          </div>
          <SaveBar primary="Save Billing Settings" />
        </Panel>

        <Panel
          title="Billing history"
          description="Later, this section can show invoices, receipts, renewal dates, and downloadable billing records."
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
            Billing history will look best here as a clean table with invoice date, amount, status, and a receipt download action.
          </div>
        </Panel>
      </div>
    </SettingsShell>
  );
}