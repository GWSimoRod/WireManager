"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "@/i18n/routing";
import {
  Shield,
  User,
  Lock,
  Loader2,
  Container,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getSetupStatus, submitSetup } from "@/lib/api-client";
import { useTranslations } from "next-intl";

export default function SetupPage() {
  const router = useRouter();
  const tSetup = useTranslations("Setup");
  const tAuth = useTranslations("Auth");

  // Loading / redirect state
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  // Form fields
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [containerName, setContainerName] = useState("wg_server");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if setup is already completed
  useEffect(() => {
    async function check() {
      try {
        const status = await getSetupStatus();
        if (status.isSetupCompleted) {
          router.replace("/");
          return;
        }
      } catch {
        // Backend may be unreachable, show setup page anyway
      } finally {
        setIsCheckingStatus(false);
      }
    }
    check();
  }, [router]);

  function validate(): boolean {
    if (adminUsername.trim().length < 3) {
      toast.error(tSetup("usernameLengthError"));
      return false;
    }
    if (adminPassword.length < 6) {
      toast.error(tSetup("passwordLengthError"));
      return false;
    }
    if (adminPassword !== confirmPassword) {
      toast.error(tSetup("passwordMismatch"));
      return false;
    }
    if (!containerName.trim()) {
      toast.error(tSetup("containerNameRequired"));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await submitSetup({
        AdminUsername: adminUsername.trim(),
        AdminPassword: adminPassword,
        ExecutionMode: true,
        ContainerWireguardName: containerName.trim(),
      });
      toast.success(tSetup("setupComplete"));
      router.replace("/login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tSetup("setupError");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-emerald-600/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-blue-600/3 blur-3xl" />
      </div>

      <div className="animate-fade-in relative w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="animate-pulse-glow flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-blue-500/20">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {tSetup("title")}
            </h1>
            <p className="text-center text-sm text-zinc-400">
              {tSetup("subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ─── Admin Credentials Section ─── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <User className="h-4 w-4 text-blue-400" />
                {tSetup("adminCredentials")}
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                <div>
                  <Label htmlFor="setup-username" className="text-xs text-zinc-400 mb-1.5 block">
                    {tAuth("username")}
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="setup-username"
                      type="text"
                      placeholder="admin"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      className="pl-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                      autoComplete="username"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="setup-password" className="text-xs text-zinc-400 mb-1.5 block">
                    {tAuth("password")}
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="setup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={tSetup("minPasswordLength")}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="pl-10 pr-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="setup-confirm-password" className="text-xs text-zinc-400 mb-1.5 block">
                    {tSetup("confirmPassword")}
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="setup-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder={tSetup("repeatPassword")}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && adminPassword && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {adminPassword === confirmPassword ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-xs text-emerald-400">{tSetup("passwordsMatch")}</span>
                        </>
                      ) : (
                        <span className="text-xs text-red-400">{tSetup("passwordMismatch")}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Docker Container Section ─── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Container className="h-4 w-4 text-blue-400" />
                {tSetup("dockerContainer")}
              </div>

              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                <div>
                  <Label htmlFor="setup-container-name" className="text-xs text-zinc-400 mb-1.5 block">
                    {tSetup("containerName")}
                  </Label>
                  <div className="relative">
                    <Container className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <Input
                      id="setup-container-name"
                      type="text"
                      placeholder="wg_server"
                      value={containerName}
                      onChange={(e) => setContainerName(e.target.value)}
                      className="pl-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                      disabled={isSubmitting}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {tSetup("containerHint")}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Submit ─── */}
            <Button
              id="setup-submit"
              type="submit"
              className="w-full cursor-pointer bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-500 hover:to-blue-500 shadow-lg shadow-blue-600/20 transition-all duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tSetup("configuring")}
                </>
              ) : (
                tSetup("completeSetup")
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-zinc-600">
          {tSetup("footer")}
        </p>
      </div>
    </div>
  );
}
