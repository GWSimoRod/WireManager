"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth-context";
import { getSetupStatus } from "@/lib/api-client";
import { Shield, User, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, login, userRole } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tAuth = useTranslations("Auth");

  // Setup check is now handled globally in AuthProvider

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
      // Let the useEffect handle the redirection based on role
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>

            <Button
              id="login-submit"
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-200"
              disabled={isSubmitting}
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
          </form>
        </div>
      </div>
    </div>
  );
}
