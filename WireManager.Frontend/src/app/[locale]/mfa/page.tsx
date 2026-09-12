"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, KeyRound, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function MFAForm() {
  const router = useRouter();
  const { isAuthenticated, isLoading, userRole, verifyMfa, checkSession } = useAuth();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tAuth = useTranslations("Auth");

  // If already fully authenticated (not MFA intermediate), redirect away
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
    const cleanCode = code.trim();
    if (!cleanCode) {
      toast.error(tAuth("mfaCodeRequired"));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      let storedToken: string | undefined;
      try {
        storedToken = sessionStorage.getItem("wm_mfa_token") || undefined;
      } catch {
        // ignore
      }

      const res = await verifyMfa(cleanCode, storedToken);

      try {
        sessionStorage.removeItem("wm_mfa_token");
      } catch {
        // ignore
      }

      await checkSession();

      const effectiveRole = res?.role?.toLowerCase();
      if (effectiveRole === "admin") {
        router.replace("/dashboard");
      } else {
        router.replace("/peers");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : tAuth("invalidMfaCode");
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToLogin() {
    try {
      sessionStorage.removeItem("wm_mfa_token");
    } catch {
      // ignore
    }
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

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
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="animate-pulse-glow flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {tAuth("mfaTitle")}
            </h1>
            <p className="text-sm text-zinc-400 max-w-sm">
              {tAuth("mfaSubtitle")}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-xs text-red-300 font-medium leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="mfa-code" className="text-xs font-medium text-zinc-300">
                {tAuth("mfaCode")}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder={tAuth("mfaCodePlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="pl-10 font-mono tracking-widest text-center text-lg bg-zinc-800/50 border-zinc-700 placeholder:text-zinc-600 focus:border-blue-500 focus:ring-blue-500/20"
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button
              id="mfa-submit"
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200 cursor-pointer"
              disabled={isSubmitting || !code.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tAuth("verifying")}
                </>
              ) : (
                tAuth("verifyCode")
              )}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {tAuth("backToLogin")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function MFAPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      }
    >
      <MFAForm />
    </Suspense>
  );
}
