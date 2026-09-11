"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth-context";
import { Shield, User, Lock, Loader2, KeyRound, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getSSOStatus } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const { isAuthenticated, isLoading, login, userRole } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSSOSubmitting, setIsSSOSubmitting] = useState(false);
  const [isSSOEnabled, setIsSSOEnabled] = useState(false);
  const tAuth = useTranslations("Auth");

  useEffect(() => {
    let isMounted = true;
    getSSOStatus().then((res) => {
      if (isMounted) setIsSSOEnabled(Boolean(res.enabled));
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (errorParam === "account_disabled") {
      toast.error(tAuth("accountDisabledDesc"), { duration: 7000 });
    } else if (errorParam === "sso_failed") {
      toast.error(tAuth("ssoLoginError"));
    }
  }, [errorParam, tAuth]);

  function handleSSOLogin() {
    setIsSSOSubmitting(true);
    const backendUrl = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
    const targetUrl = backendUrl
      ? `${backendUrl}/api/Auth/sso/login`
      : "/api/Auth/sso/login";
    window.location.href = targetUrl;
  }

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (userRole === "Admin") {
        router.replace("/dashboard");
      } else {
        router.replace("/peers");
      }
    }
  }, [isAuthenticated, isLoading, userRole, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error(tAuth("missingCredentials"));
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username, password);
      // Redirection handled by role check useEffect
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tAuth("loginError");
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="animate-fade-in relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
          {/* Branding */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="animate-pulse-glow flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              WireManager
            </h1>
            <p className="text-sm text-zinc-400">
              {tAuth("subtitle")}
            </p>
          </div>

          {/* Account Disabled Banner */}
          {errorParam === "account_disabled" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div>
                <p className="font-semibold text-sm text-amber-300">
                  {tAuth("accountDisabledTitle")}
                </p>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  {tAuth("accountDisabledDesc")}
                </p>
              </div>
            </div>
          )}

          {/* General SSO Error Banner */}
          {errorParam === "sso_failed" && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-semibold text-sm text-red-300">
                  {tAuth("ssoLoginError")}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="login-username"
                type="text"
                placeholder={tAuth("username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-blue-500/20"
                autoComplete="username"
                disabled={isSubmitting || isSSOSubmitting}
              />
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                id="login-password"
                type="password"
                placeholder={tAuth("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-500 focus:border-blue-500 focus:ring-blue-500/20"
                autoComplete="current-password"
                disabled={isSubmitting || isSSOSubmitting}
              />
            </div>

            <Button
              id="login-submit"
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200 cursor-pointer"
              disabled={isSubmitting || isSSOSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tAuth("loggingIn")}
                </>
              ) : (
                tAuth("login")
              )}
            </Button>

            {isSSOEnabled && (
              <>
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-800" />
                  </div>
                  <span className="relative bg-zinc-900/90 px-3 text-xs uppercase text-zinc-500 font-medium">
                    {tAuth("or")}
                  </span>
                </div>

                <Button
                  id="sso-login-button"
                  type="button"
                  variant="outline"
                  onClick={handleSSOLogin}
                  disabled={isSubmitting || isSSOSubmitting}
                  className="w-full border-zinc-700/80 bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all duration-200 cursor-pointer shadow-sm"
                >
                  {isSSOSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tAuth("redirectingSSO")}
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4 text-blue-400" />
                      {tAuth("loginWithSSO")}
                    </>
                  )}
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
