"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Server,
  Trash2,
  Network,
  Wifi,
  Globe,
  MoreHorizontal,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useAuth } from "@/lib/auth-context";
import { ServiceModal } from "@/components/service-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import {
  getServices,
  createService,
  deleteService,
  ApiClientError,
} from "@/lib/api-client";
import type { Service, CreateServicePayload } from "@/lib/types";

// Protocols that do NOT use a port (matches backend iptables rules)
const PORTLESS_PROTOCOLS = new Set(["all", "icmp", "esp", "gre", "igmp"]);

function protocolHasPort(svc: Service): boolean {
  return !PORTLESS_PROTOCOLS.has(svc.protocol.toLowerCase());
}

/* ────────────────────────────── helpers ────────────────────────────── */

function ServiceCardItem({
  svc,
  index,
  onDelete,
  userRole,
}: {
  svc: Service;
  index: number;
  onDelete: (svc: Service) => void;
  userRole: string | null;
}) {
  return (
    <div
      className="animate-fade-in"
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: "backwards",
      }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{svc.name}</CardTitle>
            <div className="flex items-center gap-1.5">
              {svc.isGlobal && (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20">
                  <Globe className="size-3 mr-1" />
                  Globale
                </Badge>
              )}
              <Badge variant="secondary">ID: {svc.id}</Badge>
            </div>
          </div>
          <CardDescription>Servizio di rete</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Globe className="size-4 text-zinc-500" />
            <span className="text-zinc-300 font-mono">{svc.targetIp}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Wifi className="size-4 text-zinc-500" />
            <span className="text-zinc-300">
              {protocolHasPort(svc) ? `Porta ${svc.port}` : 'Nessuna porta'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Network className="size-4 text-zinc-500" />
            <span className="text-zinc-300">{svc.protocol.toUpperCase()}</span>
          </div>

          {svc.domain && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Globe className="size-4 text-blue-400" />
              <span className="text-blue-300 font-mono text-xs">
                {svc.domain}
              </span>
            </div>
          )}

          {svc.tags && svc.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {svc.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white/90"
                  style={{
                    backgroundColor: tag.color + "25",
                    color: tag.color,
                    border: `1px solid ${tag.color}40`,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </CardContent>
        {userRole === "Admin" && (
          <CardFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(svc)}
            >
              <Trash2 className="size-3.5" />
              Elimina
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

function ServiceTableRow({
  svc,
  index,
  onDelete,
  userRole,
}: {
  svc: Service;
  index: number;
  onDelete: (svc: Service) => void;
  userRole: string | null;
}) {
  return (
    <TableRow
      className="animate-fade-in border-zinc-800 hover:bg-zinc-800/50 transition-colors"
      style={{
        animationDelay: `${index * 50}ms`,
        animationFillMode: "backwards",
      }}
    >
      <TableCell className="font-medium text-zinc-200">
        <div className="flex items-center gap-2">
          {svc.name}
          {svc.isGlobal && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/20 text-[11px] px-1.5 py-0">
              <Globe className="size-3 mr-0.5" />
              Globale
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono text-sm text-zinc-400">
        {svc.targetIp}
      </TableCell>
      <TableCell className="text-zinc-400">
        {protocolHasPort(svc) ? svc.port : <span className="text-zinc-600 italic">—</span>}
      </TableCell>
      <TableCell className="text-zinc-400">{svc.protocol.toUpperCase()}</TableCell>
      <TableCell className="font-mono text-sm text-zinc-400">
        {svc.domain ? (
          <span className="text-blue-300">{svc.domain}</span>
        ) : (
          <span className="text-zinc-600 italic">—</span>
        )}
      </TableCell>
      <TableCell className="w-[1%] whitespace-nowrap">
        <div className="flex items-center gap-1">
          {svc.tags && svc.tags.length > 0 ? (
            <>
              {svc.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                    border: `1px solid ${tag.color}35`,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              ))}
              {svc.tags.length > 2 && (
                <span className="inline-flex items-center justify-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-zinc-700/50">
                  +{svc.tags.length - 2}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-zinc-600 italic">—</span>
          )}
        </div>
      </TableCell>
      {userRole === "Admin" && (
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400"
                onClick={() => onDelete(svc)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      )}
    </TableRow>
  );
}

/* ────────────────────────── section headers ───────────────────────── */

function SectionHeader({
  icon: Icon,
  iconClassName,
  title,
  count,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80">
        <Icon className={`h-4 w-4 ${iconClassName}`} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          <span className="inline-flex items-center justify-center rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
            {count}
          </span>
        </div>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── table shell ──────────────────────────── */

function ServiceTableShell({ children, userRole }: { children: React.ReactNode, userRole: string | null }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">Nome</TableHead>
            <TableHead className="text-zinc-400">IP Destinazione</TableHead>
            <TableHead className="text-zinc-400">Porta</TableHead>
            <TableHead className="text-zinc-400">Protocollo</TableHead>
            <TableHead className="text-zinc-400">Dominio</TableHead>
            <TableHead className="text-zinc-400 w-[1%] whitespace-nowrap">
              Tags
            </TableHead>
            {userRole === "Admin" && (
              <TableHead className="w-14 text-right text-zinc-400">
                Azioni
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

/* ══════════════════════════════ PAGE ══════════════════════════════════ */

export default function ServicesPage() {
  const { userRole } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wm-view-services');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'grid';
  });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  /* derived lists */
  const globalServices = useMemo(
    () => services.filter((s) => s.isGlobal),
    [services],
  );
  const localServices = useMemo(
    () => services.filter((s) => !s.isGlobal),
    [services],
  );

  const fetchData = useCallback(async () => {
    try {
      const servicesData = await getServices();
      setServices(servicesData);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Errore caricamento dati";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCreateService(data: CreateServicePayload) {
    try {
      await createService(data);
      toast.success("Servizio creato");
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Errore creazione servizio";
      toast.error(message);
      throw err;
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteService(deleteTarget.id);
      toast.success("Servizio eliminato");
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Errore eliminazione servizio";
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
              Servizi
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Gestisci le regole di rete e i servizi
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <ViewToggle value={viewMode} onChange={(m) => { setViewMode(m); localStorage.setItem('wm-view-services', m); }} />
            {userRole === "Admin" && (
              <Button
                id="add-service-btn"
                onClick={() => setModalOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 flex-1 sm:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Servizio
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 border-b border-zinc-800 p-4 last:border-b-0"
                  >
                    <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-16 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
                    <div className="ml-auto h-4 w-8 animate-pulse rounded bg-zinc-800" />
                  </div>
                ))}
              </div>
            </div>
          )
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <Server className="h-12 w-12 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">
              Nessun servizio configurato
            </p>
            {userRole === "Admin" && (
              <Button
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={() => setModalOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea il primo servizio
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* ───────────── GRID VIEW ───────────── */
          <div className="space-y-8">
            {/* Global services */}
            {globalServices.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={Globe}
                  iconClassName="text-amber-400"
                  title="Servizi Globali"
                  count={globalServices.length}
                  description="Aggiunti automaticamente al firewall di tutti i peer"
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {globalServices.map((svc, index) => (
                    <ServiceCardItem
                      key={svc.id}
                      svc={svc}
                      index={index}
                      onDelete={setDeleteTarget}
                      userRole={userRole}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Local services */}
            {localServices.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={ShieldCheck}
                  iconClassName="text-blue-400"
                  title="Servizi Locali"
                  count={localServices.length}
                  description="Assegnati tramite tag e policy ai singoli peer"
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {localServices.map((svc, index) => (
                    <ServiceCardItem
                      key={svc.id}
                      svc={svc}
                      index={index}
                      onDelete={setDeleteTarget}
                      userRole={userRole}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ───────────── LIST VIEW ───────────── */
          <div className="space-y-8">
            {/* Global services */}
            {globalServices.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={Globe}
                  iconClassName="text-amber-400"
                  title="Servizi Globali"
                  count={globalServices.length}
                  description="Aggiunti automaticamente al firewall di tutti i peer"
                />
                <ServiceTableShell userRole={userRole}>
                  {globalServices.map((svc, index) => (
                    <ServiceTableRow
                      key={svc.id}
                      svc={svc}
                      index={index}
                      onDelete={setDeleteTarget}
                      userRole={userRole}
                    />
                  ))}
                </ServiceTableShell>
              </div>
            )}

            {/* Local services */}
            {localServices.length > 0 && (
              <div className="space-y-4">
                <SectionHeader
                  icon={ShieldCheck}
                  iconClassName="text-blue-400"
                  title="Servizi Locali"
                  count={localServices.length}
                  description="Assegnati tramite tag e policy ai singoli peer"
                />
                <ServiceTableShell userRole={userRole}>
                  {localServices.map((svc, index) => (
                    <ServiceTableRow
                      key={svc.id}
                      svc={svc}
                      index={index}
                      onDelete={setDeleteTarget}
                      userRole={userRole}
                    />
                  ))}
                </ServiceTableShell>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <ServiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleCreateService}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Elimina Servizio"
        description={`Sei sicuro di voler eliminare il servizio "${deleteTarget?.name ?? ""}"? Questa azione è irreversibile.`}
        confirmLabel="Elimina"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </AuthenticatedLayout>
  );
}
