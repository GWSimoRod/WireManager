"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  Settings,
  ShieldAlert,
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
  ApiClientError,
} from "@/lib/api-client";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const tSettings = useTranslations("Settings");
  const tCommon = useTranslations("Common");
  const { userRole, isLoading: isAuthLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcAuthority, setOidcAuthority] = useState("");
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const fetchSSO = useCallback(async () => {
    try {
      setIsLoading(true);
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
        // 404 or empty configuration: default to disabled
        setOidcEnabled(false);
        setOidcAuthority("");
        setOidcClientId("");
        setOidcClientSecret("");
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tSettings("loadError");
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [tSettings]);

  useEffect(() => {
    if (userRole === "Admin") {
      fetchSSO();
    } else if (!isAuthLoading) {
      setIsLoading(false);
    }
  }, [userRole, isAuthLoading, fetchSSO]);

  async function handleSubmit(e: FormEvent) {
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
        ) : userRole !== "Admin" ? (
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
          /* ─── Admin Settings Form ─── */
          <div className="max-w-4xl space-y-6">
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

              <form onSubmit={handleSubmit} className="space-y-6">
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
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
