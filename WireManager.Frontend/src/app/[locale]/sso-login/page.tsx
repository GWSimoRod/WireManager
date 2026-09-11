"use client";

import { useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth-context";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function SSOLoginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { checkSession } = useAuth();
  const tAuth = useTranslations("Auth");
  const hasExchanged = useRef(false);

  useEffect(() => {
    if (hasExchanged.current) return;

    if (!token) {
      toast.error(tAuth("ssoLoginError"));
      router.replace("/login?error=sso_failed");
      return;
    }

    hasExchanged.current = true;

    async function performExchange() {
      try {
        const res = await fetch("/api/auth/sso/exchange", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 403) {
          router.replace("/login?error=account_disabled");
          return;
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          if (errorData?.error === "account_disabled") {
            router.replace("/login?error=account_disabled");
            return;
          }
          toast.error(tAuth("ssoLoginError"));
          router.replace("/login?error=sso_failed");
          return;
        }

        const data = await res.json();

        if (data?.error === "account_disabled" || data?.role?.toLowerCase() === "disabled") {
          router.replace("/login?error=account_disabled");
          return;
        }

        // Refresh authentication context state
        await checkSession();

        const role = data?.role?.toLowerCase();
        if (role === "admin") {
          router.replace("/dashboard");
        } else {
          router.replace("/peers");
        }
      } catch (err) {
        console.error("SSO token exchange failed:", err);
        toast.error(tAuth("ssoLoginError"));
        router.replace("/login?error=sso_failed");
      }
    }

    performExchange();
  }, [token, router, checkSession, tAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="animate-fade-in relative w-full max-w-md">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl text-center">
          {/* Branding */}
          <div className="mb-6 flex flex-col items-center gap-3">
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

          <div className="my-8 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
            <div className="space-y-1">
              <p className="text-base font-medium text-zinc-200">
                {tAuth("completingSSO")}
              </p>
              <p className="text-xs text-zinc-400">
                {tAuth("completingSSODesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SSOLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      }
    >
      <SSOLoginHandler />
    </Suspense>
  );
}
