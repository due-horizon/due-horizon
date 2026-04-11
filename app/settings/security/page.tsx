"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, Panel, SaveBar, SettingsShell, ToggleRow } from "../_shared";

type SecurityControlsForm = {
  twoFactorAuthentication: boolean;
  emailSignInAlerts: boolean;
  sessionProtection: boolean;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

type MfaFactorLite = {
  id: string;
  factor_type?: string;
  status?: string;
  friendly_name?: string;
};

const MFA_FRIENDLY_NAME = "Due Horizon";

const defaultSecurityControls: SecurityControlsForm = {
  twoFactorAuthentication: false,
  emailSignInAlerts: true,
  sessionProtection: true,
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const maybeError = error as Record<string, unknown>;
    return (
      (typeof maybeError.message === "string" && maybeError.message) ||
      (typeof maybeError.details === "string" && maybeError.details) ||
      (typeof maybeError.hint === "string" && maybeError.hint) ||
      fallback
    );
  }

  return fallback;
}

function getPasswordValidation(form: PasswordForm) {
  if (!form.currentPassword.trim()) return "Enter your current password.";
  if (!form.newPassword.trim()) return "Enter a new password.";
  if (form.newPassword.length < 8) return "New password must be at least 8 characters.";
  if (form.newPassword === form.currentPassword) {
    return "New password must be different from your current password.";
  }
  if (!/[A-Z]/.test(form.newPassword)) {
    return "Include at least one uppercase letter in your new password.";
  }
  if (!/[a-z]/.test(form.newPassword)) {
    return "Include at least one lowercase letter in your new password.";
  }
  if (!/[0-9]/.test(form.newPassword)) {
    return "Include at least one number in your new password.";
  }
  if (form.confirmNewPassword !== form.newPassword) {
    return "Your new password confirmation does not match.";
  }
  return "";
}

function normalizeMfaCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function buildUniqueFriendlyName() {
  return `${MFA_FRIENDLY_NAME} ${new Date().toISOString()}`;
}

export default function SecuritySettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [securityControls, setSecurityControls] =
    useState<SecurityControlsForm>(defaultSecurityControls);
  const [initialSecurityControls, setInitialSecurityControls] =
    useState<SecurityControlsForm>(defaultSecurityControls);

  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [controlsMessage, setControlsMessage] = useState("");

  const [showMfaModal, setShowMfaModal] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaQrSvg, setMfaQrSvg] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState("");
  const [mfaCopied, setMfaCopied] = useState(false);
  const [hasVerifiedMfaFactor, setHasVerifiedMfaFactor] = useState(false);

  const passwordValidationMessage = getPasswordValidation(passwordForm);
  const canSavePassword = !passwordValidationMessage && !savingPassword;
  const controlsDirty =
    JSON.stringify(securityControls) !== JSON.stringify(initialSecurityControls);
  const mfaReadyToVerify = Boolean(mfaFactorId) && mfaCode.length === 6 && !mfaLoading;

  async function refreshMfaStateFromAccount() {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = [...(data?.totp ?? [])] as MfaFactorLite[];
      const verifiedTotp = totpFactors.find((factor) => factor.status === "verified") || null;

      setHasVerifiedMfaFactor(Boolean(verifiedTotp));

      setSecurityControls((prev) => ({
        ...prev,
        twoFactorAuthentication: Boolean(verifiedTotp),
      }));

      setInitialSecurityControls((prev) => ({
        ...prev,
        twoFactorAuthentication: Boolean(verifiedTotp),
      }));
    } catch {
      // Keep page usable even if factor lookup fails.
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadSecuritySettings() {
      setLoading(true);
      setPasswordMessage("");
      setControlsMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          if (!cancelled) {
            setControlsMessage("You must be signed in to manage security settings.");
            setLoading(false);
          }
          return;
        }

        const metadataSettings =
          user.user_metadata &&
          typeof user.user_metadata === "object" &&
          user.user_metadata.security_controls &&
          typeof user.user_metadata.security_controls === "object"
            ? (user.user_metadata.security_controls as Partial<SecurityControlsForm>)
            : null;

        const nextControls: SecurityControlsForm = {
          twoFactorAuthentication:
            metadataSettings?.twoFactorAuthentication ?? defaultSecurityControls.twoFactorAuthentication,
          emailSignInAlerts:
            metadataSettings?.emailSignInAlerts ?? defaultSecurityControls.emailSignInAlerts,
          sessionProtection:
            metadataSettings?.sessionProtection ?? defaultSecurityControls.sessionProtection,
        };

        if (!cancelled) {
          setSecurityControls(nextControls);
          setInitialSecurityControls(nextControls);
        }

        await refreshMfaStateFromAccount();
      } catch (error) {
        if (!cancelled) {
          setControlsMessage(getErrorMessage(error, "Failed to load security settings."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSecuritySettings();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!mfaCopied) return;
    const timer = window.setTimeout(() => setMfaCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [mfaCopied]);

  async function updatePassword() {
    setPasswordMessage("");

    if (passwordValidationMessage) {
      setPasswordMessage(passwordValidationMessage);
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
        current_password: passwordForm.currentPassword,
      });

      if (error) throw error;

      setPasswordForm(emptyPasswordForm);
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordMessage(getErrorMessage(error, "Failed to update password."));
    } finally {
      setSavingPassword(false);
    }
  }

  async function saveSecurityControls() {
    setControlsMessage("");
    setSavingControls(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          security_controls: securityControls,
        },
      });

      if (error) throw error;

      setInitialSecurityControls(securityControls);
      setControlsMessage("Security preferences saved.");
    } catch (error) {
      setControlsMessage(getErrorMessage(error, "Failed to save security preferences."));
    } finally {
      setSavingControls(false);
    }
  }

  function resetSecurityControls() {
    setSecurityControls(initialSecurityControls);
    setControlsMessage("Security preference changes reverted.");
  }

  function resetMfaEnrollmentUi() {
    setShowMfaModal(false);
    setMfaFactorId(null);
    setMfaQrSvg(null);
    setMfaSecret("");
    setMfaCode("");
    setMfaMessage("");
    setMfaLoading(false);
    setMfaCopied(false);
  }

  async function copyMfaSecret() {
    if (!mfaSecret) return;

    try {
      await navigator.clipboard.writeText(mfaSecret);
      setMfaCopied(true);
    } catch {
      setMfaMessage("Unable to copy the setup code automatically. You can still copy it manually.");
    }
  }

  async function enrollTotp(friendlyName: string) {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });

    if (error) throw error;

    setMfaFactorId(data.id);
    setMfaQrSvg(data.totp.qr_code);
    setMfaSecret(data.totp.secret);
  }

  async function startMfaEnrollment() {
    setMfaLoading(true);
    setMfaMessage("");
    setMfaFactorId(null);
    setMfaQrSvg(null);
    setMfaSecret("");
    setMfaCode("");

    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;

      const totpFactors = [...(factors?.totp ?? [])] as MfaFactorLite[];

      const verifiedFactor = totpFactors.find((factor) => factor.status === "verified");
      if (verifiedFactor) {
        setHasVerifiedMfaFactor(true);
        setSecurityControls((prev) => ({
          ...prev,
          twoFactorAuthentication: true,
        }));
        setInitialSecurityControls((prev) => ({
          ...prev,
          twoFactorAuthentication: true,
        }));
        setMfaMessage("Two-factor authentication is already enabled.");
        return;
      }

      for (const factor of totpFactors) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });

        if (cleanupError) {
          throw cleanupError;
        }
      }

      await sleep(600);

      try {
        await enrollTotp(MFA_FRIENDLY_NAME);
      } catch (error) {
        const message = getErrorMessage(error, "Failed to start MFA enrollment.");
        if (!message.toLowerCase().includes("friendly name")) {
          throw error;
        }

        await sleep(400);
        await enrollTotp(buildUniqueFriendlyName());
      }
    } catch (error) {
      setMfaMessage(getErrorMessage(error, "Failed to start MFA enrollment."));
    } finally {
      setMfaLoading(false);
    }
  }

  async function verifyMfaEnrollment() {
    if (!mfaFactorId) {
      setMfaMessage("MFA enrollment has not started yet.");
      return;
    }

    if (!mfaCode.trim()) {
      setMfaMessage("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setMfaLoading(true);
    setMfaMessage("");

    try {
      const challenge = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });

      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code: mfaCode.trim(),
      });

      if (verify.error) throw verify.error;

      const nextControls = {
        ...securityControls,
        twoFactorAuthentication: true,
      };

      setHasVerifiedMfaFactor(true);
      setSecurityControls(nextControls);

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          security_controls: nextControls,
        },
      });

      if (metadataError) throw metadataError;

      setInitialSecurityControls(nextControls);
      setControlsMessage("Two-factor authentication enabled.");
      resetMfaEnrollmentUi();
    } catch (error) {
      setMfaMessage(getErrorMessage(error, "Failed to verify MFA code."));
    } finally {
      setMfaLoading(false);
    }
  }

  async function disableMfa() {
    setControlsMessage("");
    setMfaLoading(true);

    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactors = [...(data?.totp ?? [])] as MfaFactorLite[];
      const verifiedFactor = totpFactors.find((factor) => factor.status === "verified");

      if (!verifiedFactor?.id) {
        throw new Error(
          "No verified MFA factor was found for this account. If MFA was already removed, refresh the page."
        );
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });

      if (unenrollError) throw unenrollError;

      const nextControls = {
        ...securityControls,
        twoFactorAuthentication: false,
      };

      setHasVerifiedMfaFactor(false);
      setSecurityControls(nextControls);

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          security_controls: nextControls,
        },
      });

      if (metadataError) throw metadataError;

      setInitialSecurityControls(nextControls);
      setControlsMessage("Two-factor authentication disabled.");
    } catch (error) {
      setControlsMessage(getErrorMessage(error, "Failed to disable MFA."));
    } finally {
      setMfaLoading(false);
    }
  }

  return (
    <SettingsShell
      title="Security settings"
      description="Control passwords, authentication preferences, and the overall security posture of your account."
    >
      <div className="space-y-6">
        <Panel
          title="Password & authentication"
          description="Keep your account secure with stronger sign-in credentials and a clean password update flow."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading security settings...
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                <Field
                  label="Current password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: value }))
                  }
                />
                <Field
                  label="New password"
                  type="password"
                  helper="Use at least 8 characters with uppercase, lowercase, and a number."
                  placeholder="••••••••"
                  value={passwordForm.newPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: value }))
                  }
                />
                <Field
                  label="Confirm new password"
                  type="password"
                  placeholder="••••••••"
                  value={passwordForm.confirmNewPassword}
                  onChange={(value) =>
                    setPasswordForm((prev) => ({ ...prev, confirmNewPassword: value }))
                  }
                />
              </div>

              {(passwordMessage || passwordValidationMessage) && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {passwordMessage || passwordValidationMessage}
                </div>
              )}

              <SaveBar
                primary="Update Password"
                onPrimaryClick={canSavePassword ? updatePassword : undefined}
                saving={savingPassword}
                disabled={!canSavePassword}
              />
            </>
          )}
        </Panel>

        <Panel
          title="Security controls"
          description="Save your security preferences now so this page is ready for deeper enforcement flows as Due Horizon evolves."
        >
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-sm text-slate-400">
              Loading security controls...
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <ToggleRow
                  title="Two-factor authentication"
                  description="Enroll a real authenticator app factor and require a second code during sign-in."
                  enabled={hasVerifiedMfaFactor || securityControls.twoFactorAuthentication}
                  disabled={mfaLoading}
                  onChange={(next) => {
                    if (next) {
                      setShowMfaModal(true);
                      void startMfaEnrollment();
                      return;
                    }

                    void disableMfa();
                  }}
                />
                <ToggleRow
                  title="Email sign-in alerts"
                  description="Keep alerts enabled for sign-ins and suspicious account access events."
                  enabled={securityControls.emailSignInAlerts}
                  onChange={(next) =>
                    setSecurityControls((prev) => ({
                      ...prev,
                      emailSignInAlerts: next,
                    }))
                  }
                />
                <ToggleRow
                  title="Session protection"
                  description="Mark your account to require stronger confirmation for sensitive actions later."
                  enabled={securityControls.sessionProtection}
                  onChange={(next) =>
                    setSecurityControls((prev) => ({
                      ...prev,
                      sessionProtection: next,
                    }))
                  }
                />
              </div>

              <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 px-4 py-3 text-sm leading-7 text-slate-300">
                Two-factor authentication now uses a real Supabase TOTP enrollment flow. Email sign-in alerts and session protection are still saved as account preferences for later enforcement.
              </div>

              {controlsMessage && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {controlsMessage}
                </div>
              )}

              <SaveBar
                primary="Save Security Controls"
                onPrimaryClick={controlsDirty ? saveSecurityControls : undefined}
                saving={savingControls}
                disabled={!controlsDirty}
              />

              {controlsDirty && (
                <button
                  type="button"
                  onClick={resetSecurityControls}
                  className="mt-3 text-sm text-cyan-300 transition hover:text-cyan-200"
                >
                  Reset changes
                </button>
              )}
            </>
          )}
        </Panel>
      </div>

      {showMfaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/95 px-4 backdrop-blur-xl">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#081122,#020617)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/75">
                  Two-factor setup
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Connect your authenticator app
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Scan the QR code with Microsoft Authenticator, Google Authenticator,
                  1Password, Authy, or another TOTP app, then enter the 6-digit code
                  to finish enabling MFA.
                </p>
              </div>

              <button
                type="button"
                onClick={resetMfaEnrollmentUi}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                {mfaLoading && !mfaQrSvg ? (
                  <div className="text-sm text-slate-400">Preparing your QR code...</div>
                ) : mfaQrSvg ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-full flex justify-center">
                      <div className="w-[320px] h-[320px] rounded-[24px] border border-white/10 bg-white p-[6px] shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
                        <div
                          className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
                          dangerouslySetInnerHTML={{ __html: mfaQrSvg }}
                        />
                      </div>
                    </div>

                    <div className="w-full rounded-2xl border border-white/10 bg-[#020617] px-4 py-3 text-xs text-slate-300">
                      <div className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Manual setup code
                      </div>
                      <div className="break-all font-mono text-[13px]">
                        {mfaSecret || "Unavailable"}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={copyMfaSecret}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10 hover:text-white"
                    >
                      {mfaCopied ? "Copied" : "Copy setup code"}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    {mfaMessage || "Preparing your MFA setup..."}
                  </div>
                )}
              </div>

              <Field
                label="Verification code"
                helper="Enter the current 6-digit code from your authenticator app."
                placeholder="Enter 6-digit code"
                value={mfaCode}
                onChange={(value) => setMfaCode(normalizeMfaCode(value))}
              />

              {mfaMessage && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                  {mfaMessage}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={verifyMfaEnrollment}
                  disabled={!mfaReadyToVerify}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {mfaLoading ? "Verifying..." : "Verify & Enable"}
                </button>

                <button
                  type="button"
                  onClick={resetMfaEnrollmentUi}
                  disabled={mfaLoading}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SettingsShell>
  );
}
