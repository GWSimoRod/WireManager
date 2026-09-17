"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  Settings,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Globe,
  Key,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Database,
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useAuth } from "@/lib/auth-context";
import {
  getSSOConfiguration,
  updateSSOConfiguration,
  getMfaStatus,
  enableMfa,
  disableMfa,
  createBackup,
  restoreBackup,
  configureAutomaticBackup,
  getAutomaticBackup,
  ApiClientError,
} from "@/lib/api-client";
import { MfaSetupDialog } from "@/components/mfa-setup-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { MfaSetupResponse, AutomaticBackupResponse } from "@/lib/types";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const tSettings = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { userRole, isIdentity: isAuthIdentity, isLoading: isAuthLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // MFA State
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [isIdentity, setIsIdentity] = useState(false);
  const [isTogglingMfa, setIsTogglingMfa] = useState(false);
  const [isMfaDialogOpen, setIsMfaDialogOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);

  // SSO State (Admin only)
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcAuthority, setOidcAuthority] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Backup State (Admin only)
  const [backupPassword, setBackupPassword] = useState("");
  const [backupPasswordConfirm, setBackupPasswordConfirm] = useState("");
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const [showBackupPasswordConfirm, setShowBackupPasswordConfirm] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [showRestorePassword, setShowRestorePassword] = useState(false);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);

  // Automatic Backup State (Admin only)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupSchedule, setAutoBackupSchedule] = useState("03:00");
  const [autoBackupRetention, setAutoBackupRetention] = useState<number>(7);
  const [autoBackupPassword, setAutoBackupPassword] = useState("");
  const [autoBackupPasswordConfirm, setAutoBackupPasswordConfirm] = useState("");
  const [showAutoBackupPassword, setShowAutoBackupPassword] = useState(false);
  const [showAutoBackupPasswordConfirm, setShowAutoBackupPasswordConfirm] = useState(false);
  const [isSavingAutoBackup, setIsSavingAutoBackup] = useState(false);
  const [activeAutoBackupConf, setActiveAutoBackupConf] = useState<AutomaticBackupResponse | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch MFA status (available to Admin and Operator)
      try {
        const mfaStatus = await getMfaStatus();
        setMfaEnabled(Boolean(mfaStatus.isEnabled));
        setIsIdentity(Boolean(mfaStatus.isIdentity));
      } catch (err) {
        console.error("Failed to load MFA status:", err);
      }

      // Fetch SSO configuration (Admin only)
      if (userRole === "Admin") {
        try {
          const config = await getSSOConfiguration();
          if (config) {
            const isEnabled = Boolean(config.oidcEnabled);
            setOidcEnabled(isEnabled);
            if (!isEnabled) {
              setOidcAuthority("");
              setOidcClientId("");
              setOidcClientSecret("");
            } else {
              setOidcAuthority(config.oidcAuthority || "");
              setOidcClientId(config.oidcClientId || "");
              setOidcClientSecret(config.oidcClientSecret || "");
            }
          } else {
            setOidcEnabled(false);
            setOidcAuthority("");
            setOidcClientId("");
            setOidcClientSecret("");
          }
        } catch (err) {
          const message =
            err instanceof ApiClientError ? err.message : tSettings("loadError");
          toast.error(message);
        }

        // Fetch Automatic Backup configuration (Admin only)
        try {
          const autoBackupConf = await getAutomaticBackup();
          if (autoBackupConf) {
            setActiveAutoBackupConf(autoBackupConf);
            const isEnabled = Boolean(autoBackupConf.Enabled ?? autoBackupConf.enabled);
            setAutoBackupEnabled(isEnabled);
            if (autoBackupConf.retention) {
              setAutoBackupRetention(autoBackupConf.retention);
            }
            const sched = autoBackupConf.Schedule ?? autoBackupConf.schedule;
            if (sched) {
              setAutoBackupSchedule(sched.slice(0, 5));
            }
          } else {
            setActiveAutoBackupConf(null);
          }
        } catch (err) {
          console.error("Failed to load automatic backup configuration:", err);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [userRole, tSettings]);

  useEffect(() => {
    if (userRole === "Admin" || userRole === "Operator") {
      loadData();
    } else if (!isAuthLoading) {
      setIsLoading(false);
    }
  }, [userRole, isAuthLoading, loadData]);

  async function handleToggleMfa(checked: boolean) {
    setIsTogglingMfa(true);
    try {
      if (checked) {
        const setupData = await enableMfa();
        setMfaEnabled(true);
        setMfaSetupData(setupData);
        setIsMfaDialogOpen(true);
        toast.success(tSettings("mfaEnabledSuccess"));
      } else {
        await disableMfa();
        setMfaEnabled(false);
        setMfaSetupData(null);
        toast.success(tSettings("mfaDisabledSuccess"));
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tSettings("mfaToggleError");
      toast.error(message);
      // Revert state if needed
      try {
        const current = await getMfaStatus();
        setMfaEnabled(Boolean(current.isEnabled));
        setIsIdentity(Boolean(current.isIdentity));
      } catch {
        // ignore
      }
    } finally {
      setIsTogglingMfa(false);
    }
  }

  async function handleSSOSubmit(e: FormEvent) {
    e.preventDefault();

    if (oidcEnabled) {
      if (
        !oidcAuthority.trim() ||
        !oidcClientId.trim() ||
        !oidcClientSecret.trim()
      ) {
        toast.error(tSettings("validationRequired"));
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateSSOConfiguration({
        OidcEnabled: oidcEnabled,
        OidcAuthority: oidcEnabled ? oidcAuthority.trim() : null,
        OidcClientId: oidcEnabled ? oidcClientId.trim() : null,
        OidcClientSecret: oidcEnabled ? oidcClientSecret.trim() : null,
      });
      if (!oidcEnabled) {
        setOidcAuthority("");
        setOidcClientId("");
        setOidcClientSecret("");
      }
      toast.success(tSettings("saveSuccess"));
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tSettings("saveError");
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateBackup(e: FormEvent) {
    e.preventDefault();

    if (!backupPassword.trim()) {
      toast.error(tSettings("backupPasswordRequired"));
      return;
    }

    if (backupPassword !== backupPasswordConfirm) {
      toast.error(tSettings("backupPasswordMismatch"));
      return;
    }

    setIsCreatingBackup(true);
    try {
      const blob = await createBackup(backupPassword);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      a.download = `wiremanager-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setBackupPassword("");
      setBackupPasswordConfirm("");
      toast.success(tSettings("backupCreateSuccess"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tSettings("backupCreateError");
      toast.error(message);
    } finally {
      setIsCreatingBackup(false);
    }
  }

  function handleRestoreSubmit(e: FormEvent) {
    e.preventDefault();

    if (!restoreFile) {
      toast.error(tSettings("backupFileRequired"));
      return;
    }

    if (!restorePassword.trim()) {
      toast.error(tSettings("backupPasswordRequired"));
      return;
    }

    setIsConfirmRestoreOpen(true);
  }

  async function handleConfirmRestore() {
    if (!restoreFile || !restorePassword.trim()) return;

    setIsRestoringBackup(true);
    try {
      await restoreBackup(restoreFile, restorePassword);
      toast.success(tSettings("backupRestoreSuccess"));
      setRestoreFile(null);
      setRestorePassword("");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tSettings("backupRestoreError");
      toast.error(message);
    } finally {
      setIsRestoringBackup(false);
    }
  }

  async function handleAutoBackupSubmit(e: FormEvent) {
    e.preventDefault();

    if (autoBackupEnabled) {
      if (!autoBackupPassword.trim()) {
        toast.error(tSettings("autoBackupPasswordRequired"));
        return;
      }
      if (autoBackupPassword !== autoBackupPasswordConfirm) {
        toast.error(tSettings("autoBackupPasswordMismatch"));
        return;
      }
      if (!autoBackupSchedule) {
        toast.error(tSettings("autoBackupScheduleRequired"));
        return;
      }
      if (!autoBackupRetention || autoBackupRetention < 1) {
        toast.error(tSettings("autoBackupRetentionInvalid"));
        return;
      }
    }

    setIsSavingAutoBackup(true);
    try {
      const scheduleFormatted =
        autoBackupSchedule.length === 5
          ? `${autoBackupSchedule}:00`
          : autoBackupSchedule;

      await configureAutomaticBackup({
        Enabled: autoBackupEnabled,
        Password: autoBackupPassword,
        retention: Number(autoBackupRetention),
        Schedule: scheduleFormatted,
      });

      setActiveAutoBackupConf({
        Enabled: autoBackupEnabled,
        retention: Number(autoBackupRetention),
        Schedule: scheduleFormatted,
      });

      toast.success(tSettings("autoBackupSaveSuccess"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tSettings("autoBackupSaveError");
      toast.error(message);
    } finally {
      setIsSavingAutoBackup(false);
    }
  }

  const effectiveIsIdentity = isIdentity || isAuthIdentity;
  const isAllowedRole =
    (userRole === "Admin" || userRole === "Operator") &&
    !(userRole === "Operator" && effectiveIsIdentity);

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {tSettings("title")}
            </h1>
            <p className="text-xs text-zinc-400">{tSettings("subtitle")}</p>
          </div>
        </div>

        {isAuthLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : !isAllowedRole ? (
          /* ─── Access Denied ─── */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              {tCommon("accessDenied")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {tSettings("adminOnly")}
            </p>
          </div>
        ) : isLoading ? (
          /* ─── Data Loading ─── */
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="max-w-4xl space-y-6">
            {/* ─── MFA Settings Card (Admin and Operator, hidden for SSO users) ─── */}
            {!effectiveIsIdentity && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 shadow-xl backdrop-blur-xl">
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-blue-400 shadow-inner">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {tSettings("mfaTitle")}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tSettings("mfaSubtitle")}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ${
                    mfaEnabled
                      ? "border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10"
                      : "border-zinc-800 bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {mfaEnabled ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="mfa-toggle"
                          className="cursor-pointer font-medium text-zinc-100 text-sm"
                        >
                          {tSettings("enableMFA")}
                        </Label>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 ${
                            mfaEnabled
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {mfaEnabled
                            ? tSettings("statusActive")
                            : tSettings("statusInactive")}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {tSettings("enableMFADesc")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    {isTogglingMfa ? (
                      <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mr-2" />
                    ) : (
                      <Switch
                        id="mfa-toggle"
                        checked={mfaEnabled}
                        onCheckedChange={handleToggleMfa}
                        disabled={isTogglingMfa}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ─── SSO Settings Card (ADMIN ONLY - Hidden from Operator) ─── */}
            {userRole === "Admin" && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 shadow-xl backdrop-blur-xl">
                {/* Section Header */}
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-blue-400 shadow-inner">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {tSettings("ssoTitle")}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tSettings("ssoSubtitle")}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSSOSubmit} className="space-y-6">
                  {/* Switch activation card */}
                  <div
                    className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ${
                      oidcEnabled
                        ? "border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10"
                        : "border-zinc-800 bg-zinc-800/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {oidcEnabled ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="sso-toggle"
                            className="cursor-pointer font-medium text-zinc-100 text-sm"
                          >
                            {tSettings("enableSSO")}
                          </Label>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 ${
                              oidcEnabled
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {oidcEnabled
                              ? tSettings("statusActive")
                              : tSettings("statusInactive")}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {tSettings("enableSSODesc")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <Switch
                        id="sso-toggle"
                        checked={oidcEnabled}
                        onCheckedChange={(checked) => {
                          setOidcEnabled(checked);
                          if (!checked) {
                            setOidcAuthority("");
                            setOidcClientId("");
                            setOidcClientSecret("");
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Form fields section with dimmed / "grigino" look when disabled */}
                  <div
                    className={`space-y-5 rounded-xl border p-5 transition-all duration-200 ${
                      oidcEnabled
                        ? "border-zinc-800 bg-zinc-900/40"
                        : "border-zinc-800/60 bg-zinc-950/40 opacity-70"
                    }`}
                  >
                    {!oidcEnabled && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                        <Info className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span>{tSettings("disabledNotice")}</span>
                      </div>
                    )}

                    {/* OIDC Authority */}
                    <div>
                      <Label
                        htmlFor="sso-authority"
                        className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                      >
                        <Globe className="h-3.5 w-3.5 text-zinc-400" />
                        {tSettings("authority")}
                      </Label>
                      <Input
                        id="sso-authority"
                        type="text"
                        placeholder={tSettings("authorityPlaceholder")}
                        value={oidcAuthority}
                        onChange={(e) => setOidcAuthority(e.target.value)}
                        disabled={isSaving || !oidcEnabled}
                        className={`font-mono text-sm transition-colors ${
                          oidcEnabled
                            ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                        }`}
                        autoComplete="off"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {tSettings("authorityHint")}
                      </p>
                    </div>

                    {/* OIDC Client ID */}
                    <div>
                      <Label
                        htmlFor="sso-client-id"
                        className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                      >
                        <Key className="h-3.5 w-3.5 text-zinc-400" />
                        {tSettings("clientId")}
                      </Label>
                      <Input
                        id="sso-client-id"
                        type="text"
                        placeholder={tSettings("clientIdPlaceholder")}
                        value={oidcClientId}
                        onChange={(e) => setOidcClientId(e.target.value)}
                        disabled={isSaving || !oidcEnabled}
                        className={`font-mono text-sm transition-colors ${
                          oidcEnabled
                            ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                        }`}
                        autoComplete="off"
                      />
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {tSettings("clientIdHint")}
                      </p>
                    </div>

                    {/* OIDC Client Secret */}
                    <div>
                      <Label
                        htmlFor="sso-client-secret"
                        className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5 text-zinc-400" />
                        {tSettings("clientSecret")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="sso-client-secret"
                          type={showSecret ? "text" : "password"}
                          placeholder={tSettings("clientSecretPlaceholder")}
                          value={oidcClientSecret}
                          onChange={(e) => setOidcClientSecret(e.target.value)}
                          disabled={isSaving || !oidcEnabled}
                          className={`pr-10 font-mono text-sm transition-colors ${
                            oidcEnabled
                              ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                          }`}
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          disabled={isSaving || !oidcEnabled}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            showSecret
                              ? tSettings("hideSecret")
                              : tSettings("showSecret")
                          }
                          tabIndex={-1}
                        >
                          {showSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {tSettings("clientSecretHint")}
                      </p>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      id="sso-save-button"
                      type="submit"
                      disabled={isSaving}
                      className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200 px-6"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {tSettings("saving")}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {tSettings("save")}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* ─── Backup & Restore Card (ADMIN ONLY) ─── */}
            {userRole === "Admin" && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 shadow-xl backdrop-blur-xl">
                {/* Section Header */}
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-blue-400 shadow-inner">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {tSettings("backupTitle")}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tSettings("backupSubtitle")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* ─── Create & Download Backup ─── */}
                  <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <Download className="h-4 w-4 text-blue-400" />
                        <span>{tSettings("backupCreateSection")}</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {tSettings("backupCreateDesc")}
                      </p>

                      <form onSubmit={handleCreateBackup} className="space-y-4">
                        <div>
                          <Label
                            htmlFor="backup-password"
                            className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                          >
                            <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            {tSettings("backupPassword")}
                          </Label>
                          <div className="relative">
                            <Input
                              id="backup-password"
                              type={showBackupPassword ? "text" : "password"}
                              placeholder={tSettings("backupPasswordPlaceholder")}
                              value={backupPassword}
                              onChange={(e) => setBackupPassword(e.target.value)}
                              disabled={isCreatingBackup}
                              className="pr-10 font-mono text-sm bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowBackupPassword(!showBackupPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                              tabIndex={-1}
                            >
                              {showBackupPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <Label
                            htmlFor="backup-password-confirm"
                            className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                          >
                            <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            {tSettings("backupPasswordConfirm")}
                          </Label>
                          <div className="relative">
                            <Input
                              id="backup-password-confirm"
                              type={showBackupPasswordConfirm ? "text" : "password"}
                              placeholder={tSettings("backupPasswordConfirmPlaceholder")}
                              value={backupPasswordConfirm}
                              onChange={(e) => setBackupPasswordConfirm(e.target.value)}
                              disabled={isCreatingBackup}
                              className="pr-10 font-mono text-sm bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              autoComplete="new-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowBackupPasswordConfirm(!showBackupPasswordConfirm)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                              tabIndex={-1}
                            >
                              {showBackupPasswordConfirm ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button
                            id="backup-download-button"
                            type="submit"
                            disabled={isCreatingBackup}
                            className="w-full cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/20 transition-all duration-200"
                          >
                            {isCreatingBackup ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {tSettings("backupDownloading")}
                              </>
                            ) : (
                              <>
                                <Download className="mr-2 h-4 w-4" />
                                {tSettings("backupDownload")}
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>

                  {/* ─── Restore Backup ─── */}
                  <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <RotateCcw className="h-4 w-4 text-amber-400" />
                        <span>{tSettings("backupRestoreSection")}</span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        {tSettings("backupRestoreDesc")}
                      </p>

                      {/* Warning notice */}
                      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                        <span>{tSettings("backupRestoreWarning")}</span>
                      </div>

                      <form onSubmit={handleRestoreSubmit} className="space-y-4">
                        {/* File selector */}
                        <div>
                          <Label className="text-xs text-zinc-300 mb-1.5 block">
                            {tSettings("backupSelectFile")}
                          </Label>
                          <input
                            id="backup-file-input"
                            type="file"
                            accept=".json,application/json,application/octet-stream"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setRestoreFile(file);
                              e.target.value = "";
                            }}
                          />
                          {restoreFile ? (
                            <div className="flex items-center justify-between rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2.5">
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <FileJson className="h-5 w-5 shrink-0 text-blue-400" />
                                <div className="truncate">
                                  <p className="truncate text-xs font-medium text-zinc-200">
                                    {restoreFile.name}
                                  </p>
                                  <p className="text-[11px] text-zinc-400">
                                    {(restoreFile.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setRestoreFile(null)}
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <label
                              htmlFor="backup-file-input"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files?.[0];
                                if (file) setRestoreFile(file);
                              }}
                              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-4 text-center transition-colors hover:border-zinc-500 hover:bg-zinc-800/50"
                            >
                              <Upload className="h-5 w-5 text-zinc-400 mb-1" />
                              <span className="text-xs text-zinc-400">
                                {tSettings("backupDropFileHere")}
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Decryption Password */}
                        <div>
                          <Label
                            htmlFor="restore-password"
                            className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                          >
                            <Lock className="h-3.5 w-3.5 text-zinc-400" />
                            {tSettings("backupDecryptPassword")}
                          </Label>
                          <div className="relative">
                            <Input
                              id="restore-password"
                              type={showRestorePassword ? "text" : "password"}
                              placeholder={tSettings("backupDecryptPasswordPlaceholder")}
                              value={restorePassword}
                              onChange={(e) => setRestorePassword(e.target.value)}
                              disabled={isRestoringBackup}
                              className="pr-10 font-mono text-sm bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-amber-500 focus:ring-amber-500/20"
                              autoComplete="current-password"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRestorePassword(!showRestorePassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                              tabIndex={-1}
                            >
                              {showRestorePassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button
                            id="backup-restore-button"
                            type="submit"
                            disabled={isRestoringBackup || !restoreFile || !restorePassword.trim()}
                            className="w-full cursor-pointer bg-gradient-to-r from-amber-600 to-red-600 text-white hover:from-amber-500 hover:to-red-500 shadow-lg shadow-amber-600/20 transition-all duration-200"
                          >
                            {isRestoringBackup ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {tSettings("backupRestoring")}
                              </>
                            ) : (
                              <>
                                <RotateCcw className="mr-2 h-4 w-4" />
                                {tSettings("backupRestoreButton")}
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Automatic Backup Card (ADMIN ONLY) ─── */}
            {userRole === "Admin" && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 md:p-8 shadow-xl backdrop-blur-xl">
                {/* Section Header */}
                <div className="mb-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-blue-400 shadow-inner">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">
                      {tSettings("autoBackupTitle")}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tSettings("autoBackupSubtitle")}
                    </p>
                  </div>
                </div>

                {/* Currently Active Configuration Banner */}
                {activeAutoBackupConf ? (
                  <div className="mb-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 shadow-sm shadow-blue-500/5">
                    <div className="flex items-center justify-between gap-2 border-b border-blue-500/15 pb-2.5 mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                          {tSettings("autoBackupActiveConfigTitle")}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 ${
                          Boolean(activeAutoBackupConf.Enabled ?? activeAutoBackupConf.enabled)
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {Boolean(activeAutoBackupConf.Enabled ?? activeAutoBackupConf.enabled)
                          ? tSettings("statusActive")
                          : tSettings("statusInactive")}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <span className="text-zinc-500">{tSettings("autoBackupScheduleLabel")}</span>
                        <span className="font-mono font-medium text-zinc-200">
                          {tSettings("autoBackupDailyAt", {
                            time: (activeAutoBackupConf.Schedule ?? activeAutoBackupConf.schedule ?? "03:00").slice(0, 5),
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <span className="text-zinc-500">{tSettings("autoBackupRetentionLabel")}</span>
                        <span className="font-mono font-medium text-zinc-200">
                          {tSettings("autoBackupRetentionValue", {
                            days: activeAutoBackupConf.retention ?? 7,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 flex items-center gap-2.5 text-xs text-zinc-400">
                    <Info className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span>{tSettings("autoBackupActiveConfigNone")}</span>
                  </div>
                )}

                <form onSubmit={handleAutoBackupSubmit} className="space-y-6">
                  {/* Switch activation card */}
                  <div
                    className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ${
                      autoBackupEnabled
                        ? "border-blue-500/30 bg-blue-500/5 shadow-sm shadow-blue-500/10"
                        : "border-zinc-800 bg-zinc-800/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {autoBackupEnabled ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="auto-backup-toggle"
                            className="cursor-pointer font-medium text-zinc-100 text-sm"
                          >
                            {tSettings("enableAutoBackup")}
                          </Label>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-2 py-0.5 ${
                              autoBackupEnabled
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}
                          >
                            {autoBackupEnabled
                              ? tSettings("statusActive")
                              : tSettings("statusInactive")}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                          {tSettings("enableAutoBackupDesc")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <Switch
                        id="auto-backup-toggle"
                        checked={autoBackupEnabled}
                        onCheckedChange={(checked) => setAutoBackupEnabled(checked)}
                      />
                    </div>
                  </div>

                  {/* Form fields section with dimmed look when disabled */}
                  <div
                    className={`space-y-5 rounded-xl border p-5 transition-all duration-200 ${
                      autoBackupEnabled
                        ? "border-zinc-800 bg-zinc-900/40"
                        : "border-zinc-800/60 bg-zinc-950/40 opacity-70"
                    }`}
                  >
                    {!autoBackupEnabled && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                        <Info className="h-4 w-4 shrink-0 text-zinc-500" />
                        <span>{tSettings("autoBackupDisabledNotice")}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {/* Schedule Time */}
                      <div>
                        <Label
                          htmlFor="auto-backup-schedule"
                          className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                        >
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                          {tSettings("autoBackupSchedule")}
                        </Label>
                        <Input
                          id="auto-backup-schedule"
                          type="time"
                          step="60"
                          value={autoBackupSchedule}
                          onChange={(e) => setAutoBackupSchedule(e.target.value)}
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className={`font-mono text-sm transition-colors ${
                            autoBackupEnabled
                              ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                          }`}
                        />
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {tSettings("autoBackupScheduleHint")}
                        </p>
                      </div>

                      {/* Retention in days */}
                      <div>
                        <Label
                          htmlFor="auto-backup-retention"
                          className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                        >
                          <Database className="h-3.5 w-3.5 text-zinc-400" />
                          {tSettings("autoBackupRetention")}
                        </Label>
                        <Input
                          id="auto-backup-retention"
                          type="number"
                          min={1}
                          max={365}
                          placeholder={tSettings("autoBackupRetentionPlaceholder")}
                          value={autoBackupRetention}
                          onChange={(e) =>
                            setAutoBackupRetention(Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className={`font-mono text-sm transition-colors ${
                            autoBackupEnabled
                              ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                          }`}
                        />
                        <p className="mt-1 text-[11px] text-zinc-500">
                          {tSettings("autoBackupRetentionHint")}
                        </p>
                      </div>
                    </div>

                    {/* Encryption Password */}
                    <div>
                      <Label
                        htmlFor="auto-backup-password"
                        className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5 text-zinc-400" />
                        {tSettings("autoBackupPassword")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="auto-backup-password"
                          type={showAutoBackupPassword ? "text" : "password"}
                          placeholder={tSettings("autoBackupPasswordPlaceholder")}
                          value={autoBackupPassword}
                          onChange={(e) => setAutoBackupPassword(e.target.value)}
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className={`pr-10 font-mono text-sm transition-colors ${
                            autoBackupEnabled
                              ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                          }`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAutoBackupPassword(!showAutoBackupPassword)}
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          tabIndex={-1}
                        >
                          {showAutoBackupPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        {tSettings("autoBackupPasswordHint")}
                      </p>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <Label
                        htmlFor="auto-backup-password-confirm"
                        className="text-xs text-zinc-300 mb-1.5 flex items-center gap-1.5"
                      >
                        <Lock className="h-3.5 w-3.5 text-zinc-400" />
                        {tSettings("autoBackupPasswordConfirm")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="auto-backup-password-confirm"
                          type={showAutoBackupPasswordConfirm ? "text" : "password"}
                          placeholder={tSettings("autoBackupPasswordConfirmPlaceholder")}
                          value={autoBackupPasswordConfirm}
                          onChange={(e) => setAutoBackupPasswordConfirm(e.target.value)}
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className={`pr-10 font-mono text-sm transition-colors ${
                            autoBackupEnabled
                              ? "bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-zinc-900/50 border-zinc-800 text-zinc-500 placeholder:text-zinc-700 cursor-not-allowed"
                          }`}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowAutoBackupPasswordConfirm(!showAutoBackupPasswordConfirm)
                          }
                          disabled={isSavingAutoBackup || !autoBackupEnabled}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          tabIndex={-1}
                        >
                          {showAutoBackupPasswordConfirm ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      id="auto-backup-save-button"
                      type="submit"
                      disabled={isSavingAutoBackup}
                      className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200 px-6"
                    >
                      {isSavingAutoBackup ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {tSettings("autoBackupSaving")}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {tSettings("autoBackupSave")}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── MFA Setup Dialog Modal ─── */}
      <MfaSetupDialog
        open={isMfaDialogOpen}
        onOpenChange={setIsMfaDialogOpen}
        secret={mfaSetupData?.secret || ""}
        otpauthUri={mfaSetupData?.otpauthUri || ""}
      />

      {/* ─── Backup Restore Confirmation Dialog ─── */}
      <ConfirmDialog
        open={isConfirmRestoreOpen}
        onOpenChange={setIsConfirmRestoreOpen}
        title={tSettings("backupConfirmTitle")}
        description={tSettings("backupConfirmDescription")}
        confirmLabel={tSettings("backupConfirmButton")}
        variant="destructive"
        loading={isRestoringBackup}
        onConfirm={handleConfirmRestore}
      />
    </AuthenticatedLayout>
  );
}
