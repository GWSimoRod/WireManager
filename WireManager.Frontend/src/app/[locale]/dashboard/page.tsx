"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Server, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { ServerCard } from "@/components/server-card";
import { ServerDialog } from "@/components/server-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  getServers,
  createServer,
  updateServer,
  deleteServer,
  syncServer,
  ApiClientError,
} from "@/lib/api-client";
import type { ConfServer, ServerRequestDTO } from "@/lib/types";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const { userRole } = useAuth();
  const tDashboard = useTranslations("Dashboard");
  const tServers = useTranslations("Servers");
  const tCommon = useTranslations("Common");

  const [servers, setServers] = useState<ConfServer[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ConfServer | null>(null);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState<ConfServer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      const data = await getServers();
      setServers(data);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tServers("loadError");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [tServers]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // ─── Create / Edit ────────────────────────────────────────────────────
  function handleOpenCreate() {
    setEditingServer(null);
    setDialogOpen(true);
  }

  function handleOpenEdit(server: ConfServer) {
    setEditingServer(server);
    setDialogOpen(true);
  }

  async function handleSave(data: ServerRequestDTO) {
    try {
      if (editingServer) {
        await updateServer(editingServer.id, data);
        toast.success(tServers("updated"));
      } else {
        await createServer(data);
        toast.success(tServers("created"));
      }
      setDialogOpen(false);
      setEditingServer(null);
      await fetchServers();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tServers("saveError");
      toast.error(message);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteServer(deleteTarget.id);
      toast.success(tServers("deleted"));
      setDeleteTarget(null);
      await fetchServers();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tServers("deleteError");
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  // ─── Sync ─────────────────────────────────────────────────────────────
  async function handleSync(server: ConfServer) {
    try {
      await syncServer(server.id);
      toast.success(tServers("synced", { endpoint: server.endPoint }));
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tServers("syncError");
      toast.error(message);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {tDashboard("title")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {tDashboard("subtitle")}
            </p>
          </div>
          {userRole === "Admin" && (
            <Button
              id="add-server-btn"
              onClick={handleOpenCreate}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {tDashboard("addServer")}
            </Button>
          )}
        </div>

        {userRole !== "Admin" ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-100">{tCommon("accessDenied")}</h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-sm text-center">
              {tCommon("noPermissions")}
            </p>
          </div>
        ) : (
          <>
            {/* Content */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
                  />
                ))}
              </div>
            ) : servers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
                <Server className="h-12 w-12 text-zinc-700" />
                <p className="mt-4 text-sm text-zinc-500">
                  {tDashboard("noServers")}
                </p>
                <Button
                  variant="outline"
                  className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  onClick={handleOpenCreate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {tDashboard("addFirstServer")}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {servers.map((server, index) => (
                  <div
                    key={server.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
                  >
                    <ServerCard
                      server={server}
                      onEdit={() => handleOpenEdit(server)}
                      onDelete={() => setDeleteTarget(server)}
                      onSync={() => handleSync(server)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <ServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        server={editingServer}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tServers("deleteTitle")}
        description={tServers("deleteConfirm", { endpoint: deleteTarget?.endPoint ?? "" })}
        confirmLabel={tCommon("delete")}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </AuthenticatedLayout>
  );
}
