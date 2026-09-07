"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/lib/auth-context";
import { getSetupStatus } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupDone, setSetupDone] = useState(true);

  // First: check if setup is completed
  useEffect(() => {
    async function check() {
      try {
        const status = await getSetupStatus();
        setSetupDone(status.isSetupCompleted);
      } catch {
        // If backend is unreachable, assume setup is done and let other pages handle errors
        setSetupDone(true);
      } finally {
        setSetupChecked(true);
      }
    }
    check();
  }, []);

  // Second: once setup status is known, decide where to redirect
  useEffect(() => {
    if (!setupChecked) return;

    if (!setupDone) {
      router.replace("/setup");
      return;
    }

    if (isLoading) return;
    if (isAuthenticated) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [setupChecked, setupDone, isAuthenticated, isLoading, router]);

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  );
}
