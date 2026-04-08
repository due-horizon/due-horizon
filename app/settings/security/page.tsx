"use client";

import { useState } from "react";
import { Field, Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  return (
    <SettingsShell
      title="Security settings"
      description="Control passwords, authentication, and the security posture of your account."
    >
      <div className="space-y-6">
        <Panel
          title="Password & authentication"
          description="Keep your account secure with stronger sign-in and authentication controls."
        >
          <div className="grid gap-4">
            <Field
              label="Current password"
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <Field
              label="New password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={setNewPassword}
            />
            <Field
              label="Confirm new password"
              type="password"
              placeholder="••••••••"
              value={confirmNewPassword}
              onChange={setConfirmNewPassword}
            />
          </div>
          <SaveBar primary="Update Password" />
        </Panel>

        <Panel
          title="Security controls"
          description="These controls are ideal placeholders now and can later connect to real auth flows."
        >
          <div className="space-y-3">
            <ToggleRow title="Two-factor authentication" description="Add a second layer of protection for sign-in." />
            <ToggleRow title="Email sign-in alerts" description="Notify you when a new sign-in occurs." enabled />
            <ToggleRow title="Session protection" description="Require re-authentication for sensitive actions." enabled />
          </div>
          <SaveBar primary="Save Security Controls" />
        </Panel>
      </div>
    </SettingsShell>
  );
}
