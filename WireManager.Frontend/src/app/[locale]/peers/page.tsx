"use client";
import { useTranslations } from "next-intl";


import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Users,
  Download,
  QrCode,
  Pencil,
  Copy,
  Trash2,
  MoreHorizontal,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ViewToggle, type ViewMode } from "@/components/view-toggle";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { PeerModal } from "@/components/peer-modal";
import { PeerDetailDialog } from "@/components/peer-detail-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { QrCodeDialog } from "@/components/qr-code-dialog";
import {
  getServers,
  getPeers,
  createPeer,
  updatePeer,
  deletePeer,
  getPeerConf,
  getPeerQrCodeUrl,
  getTags,
  addPeerPolicy,
  removePeerPolicy,
  togglePeer,
  ApiClientError,
} from "@/lib/api-client";
import type { ConfServer, ConfPeer, PeerRequestDTO, Tag, PeerPolicy } from "@/lib/types";

// Expiration urgency helper for the table indicator
function getExpireUrgency(expireAt: string): { color: string; label: string } {
  const t = expireAt.endsWith('Z') ? expireAt : expireAt + 'Z';
  const diffMs = new Date(t).getTime() - Date.now();
  if (diffMs <= 0) return { color: 'text-red-400', label: 'Scaduto' };
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return { color: 'text-orange-400', label: `Scade tra ${diffDays === 0 ? 'poche ore' : diffDays + 'g'}` };
  if (diffDays <= 7) return { color: 'text-amber-400', label: `Scade tra ${diffDays}g` };
  return { color: 'text-zinc-500', label: `Scade tra ${diffDays}g` };
}

export default function PeersPage() {
  const tPeers = useTranslations("Peers");
  const tCommon = useTranslations("Common");

  const [peers, setPeers] = useState<ConfPeer[]>([]);
  const [servers, setServers] = useState<ConfServer[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterServerId, setFilterServerId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wm-view-peers');
      if (saved === 'grid' || saved === 'list') return saved;
    }
    return 'grid'; // Defaulting to grid for peers can be nice, or 'list'
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Peer modal state
  const [peerModalOpen, setPeerModalOpen] = useState(false);
  const [editingPeer, setEditingPeer] = useState<ConfPeer | null>(null);
  const [duplicatePeer, setDuplicatePeer] = useState<ConfPeer | null>(null);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState<ConfPeer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // {tPeers("qrCode")} dialog state
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrPeerName, setQrPeerName] = useState("");

  // Peer detail dialog state
  const [detailPeerId, setDetailPeerId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearchTerm !== searchTerm) {
        setDebouncedSearchTerm(searchTerm);
        setCurrentPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearchTerm]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      const [peersRes, serversData, tagsData] = await Promise.all([
        getPeers(start, end, debouncedSearchTerm),
        getServers(),
        getTags(),
      ]);
      setPeers(peersRes.data);
      setTotalCount(peersRes.totalCount);
      setServers(serversData);
      setTags(tagsData);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Errore caricamento dati";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleFilterServerChange(v: string | null) {
    setFilterServerId(v ?? "all");
    setCurrentPage(1);
  }



  function handlePageSizeChange(size: string | null) {
    if (size) setPageSize(Number(size));
    setCurrentPage(1);
  }

  // Server lookup map
  const serverMap = useMemo(() => {
    const map = new Map<number, ConfServer>();
    servers.forEach((s) => map.set(s.id, s));
    return map;
  }, [servers]);

  // Filtered peers
  const filteredPeers = useMemo(() => {
    let list = peers;
    if (filterServerId !== "all") {
      const id = Number(filterServerId);
      list = list.filter((p) => p.confServerId === id);
    }
    return list;
  }, [peers, filterServerId]);

  // Get tag IDs currently associated with a peer
  function getPeerTagIds(peer: ConfPeer): number[] {
    return peer.peerTags?.map((pt) => pt.tagId) || [];
  }

  // Get tag objects for a peer (for badge rendering)
  function getPeerTags(peer: ConfPeer): Tag[] {
    const tagIds = getPeerTagIds(peer);
    return tags.filter((t) => tagIds.includes(t.id));
  }

  // ─── Create / Edit / Duplicate ───────────────────────────────────────
  function handleOpenCreate() {
    setEditingPeer(null);
    setDuplicatePeer(null);
    setPeerModalOpen(true);
  }

  function handleOpenEdit(peer: ConfPeer) {
    setEditingPeer(peer);
    setDuplicatePeer(null);
    setPeerModalOpen(true);
  }

  function handleOpenDuplicate(peer: ConfPeer) {
    setEditingPeer(null);
    setDuplicatePeer(peer);
    setPeerModalOpen(true);
  }

  async function handleTogglePeer(peer: ConfPeer, newActiveState: boolean) {
    try {
      await togglePeer(peer.id, newActiveState);
      setPeers((prev) =>
        prev.map((p) => (p.id === peer.id ? { ...p, isActive: newActiveState } : p))
      );
      toast.success(
        `Peer ${peer.clientName} ${newActiveState ? "attivato" : "disattivato"} con successo.`
      );
    } catch (error) {
      toast.error(
        `Errore durante l'aggiornamento dello stato: ${
          error instanceof ApiClientError ? error.message : tPeers("unknownError")
        }`
      );
    }
  }

  async function handleSavePeer(data: PeerRequestDTO, selectedTagIds: number[]) {
    try {
      if (editingPeer) {
        await updatePeer(editingPeer.id, data);

        // Sync tag/policy associations
        const currentTagIds = getPeerTagIds(editingPeer);
        const toAdd = selectedTagIds.filter((id) => !currentTagIds.includes(id));
        const toRemove = currentTagIds.filter((id) => !selectedTagIds.includes(id));

        // Find policy IDs to add/remove
        for (const tagId of toAdd) {
          try {
            await addPeerPolicy(editingPeer.id, tagId);
          } catch {
            // May fail if policy doesn't exist yet
          }
        }
        for (const tagId of toRemove) {
          try {
            await removePeerPolicy(editingPeer.id, tagId);
          } catch {
            // Ignore removal failures
          }
        }

        toast.success("Peer aggiornato");
      } else {
        const newPeer = await createPeer(data);

        // Associate tags with the new peer
        for (const tagId of selectedTagIds) {
          try {
            await addPeerPolicy(newPeer.id, tagId);
          } catch {
            // May fail if policy doesn't exist
          }
        }

        toast.success("Peer creato");
      }
      setPeerModalOpen(false);
      setEditingPeer(null);
      setDuplicatePeer(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tPeers("saveError");
      toast.error(message);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deletePeer(deleteTarget.id);
      toast.success("Peer eliminato");
      setDeleteTarget(null);
      await fetchData();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : tPeers("deleteError");
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  // ─── Download .conf ───────────────────────────────────────────────────
  async function handleDownloadConf(peer: ConfPeer) {
    try {
      const confText = await getPeerConf(peer.id);
      const blob = new Blob([confText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${peer.clientName.replace(/ /g, "-")}.conf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(tPeers("confDownloaded"));
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tPeers("confDownloadError");
      toast.error(message);
    }
  }

  // ─── {tPeers("qrCode")} ──────────────────────────────────────────────────────────
  async function handleShowQrCode(peer: ConfPeer) {
    try {
      const url = await getPeerQrCodeUrl(peer.id);
      setQrCodeUrl(url);
      setQrPeerName(peer.clientName);
      setQrDialogOpen(true);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : tPeers("qrCodeError");
      toast.error(message);
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Peers
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {tPeers("manageClients")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative w-full sm:w-[250px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder={tPeers("searchPeer")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-zinc-700 bg-zinc-800/50 w-full"
              />
            </div>
            <Select value={filterServerId} onValueChange={handleFilterServerChange}>
              <SelectTrigger
                id="peer-filter-server"
                className="w-full sm:w-[200px] border-zinc-700 bg-zinc-800/50"
              >
                <SelectValue placeholder={tPeers("filterByServer")}>
                  {filterServerId === "all"
                    ? tPeers("allServers")
                    : servers.find((s) => String(s.id) === filterServerId)?.endPoint || tPeers("filterByServer")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tPeers("allServers")}</SelectItem>
                {servers.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.endPoint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ViewToggle value={viewMode} onChange={(m) => { setViewMode(m); localStorage.setItem('wm-view-peers', m); }} />
            <Button
              id="add-peer-btn"
              onClick={handleOpenCreate}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-600/20 w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {tPeers("addPeer")}
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-800 p-4 last:border-b-0"
                >
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                  <div className="ml-auto h-4 w-8 animate-pulse rounded bg-zinc-800" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredPeers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <Users className="h-12 w-12 text-zinc-700" />
            <p className="mt-4 text-sm text-zinc-500">
              {peers.length === 0
                ? tPeers("noPeersConfigured")
                : tPeers("noPeersForServer")}
            </p>
            {peers.length === 0 && (
              <Button
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                onClick={handleOpenCreate}
              >
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi il primo peer
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredPeers.map((peer, index) => {
                  const server = serverMap.get(peer.confServerId);
                  const peerTags = getPeerTags(peer);
                  const urgency = peer.expireAt ? getExpireUrgency(peer.expireAt) : null;
                  return (
                    <div
                      key={peer.id}
                      className="animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
                    >
                      <Card className="h-full flex flex-col cursor-pointer hover:border-zinc-700 transition-colors bg-zinc-900/50" onClick={() => setDetailPeerId(peer.id)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-1 min-w-0 pr-2">
                              <CardTitle className="text-base flex items-center gap-2 truncate">
                                <span className="truncate">{peer.clientName}</span>
                                {urgency && (
                                  <CalendarClock className={`h-4 w-4 shrink-0 ${urgency.color}`} />
                                )}
                              </CardTitle>
                              <div className="text-sm font-mono text-zinc-400">{peer.address}</div>
                            </div>
                            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                              <Switch
                                checked={peer.isActive}
                                onCheckedChange={(checked) => handleTogglePeer(peer, checked)}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4 pb-3">
                          <div className="grid grid-cols-2 gap-2 text-sm text-zinc-400 bg-zinc-800/30 p-2.5 rounded-lg border border-zinc-800/50">
                            <div className="min-w-0">
                              <span className="block text-xs text-zinc-500 mb-0.5">{tPeers("dns")}</span>
                              <span className="font-mono text-zinc-300 truncate block">{peer.dnsAddress}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="block text-xs text-zinc-500 mb-0.5">{tPeers("server")}</span>
                              <span className="text-zinc-300 truncate block">{server?.endPoint ?? "—"}</span>
                            </div>
                          </div>
                          <div>
                            <span className="block text-xs text-zinc-500 mb-1.5">{tPeers("tags")}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {peerTags.length > 0 ? (
                                peerTags.map(tag => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                    style={{
                                      backgroundColor: tag.color + '20',
                                      color: tag.color,
                                      border: `1px solid ${tag.color}35`,
                                    }}
                                  >
                                    <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                    <span className="truncate max-w-[120px]">{tag.name}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-zinc-600 italic">—</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-3 border-t border-zinc-800/50 flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="icon-sm" className="bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700" onClick={() => handleDownloadConf(peer)} title="Download .conf">
                            <Download className="h-4 w-4 text-zinc-400" />
                          </Button>
                          <Button variant="outline" size="icon-sm" className="bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700" onClick={() => handleShowQrCode(peer)} title={tPeers("qrCode")}>
                            <QrCode className="h-4 w-4 text-zinc-400" />
                          </Button>
                          <Button variant="outline" size="icon-sm" className="bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700" onClick={() => handleOpenDuplicate(peer)} title={tCommon("duplicate")}>
                            <Copy className="h-4 w-4 text-zinc-400" />
                          </Button>
                          <Button variant="outline" size="icon-sm" className="bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700" onClick={() => handleOpenEdit(peer)} title={tCommon("edit")}>
                            <Pencil className="h-4 w-4 text-zinc-400" />
                          </Button>
                          <Button variant="outline" size="icon-sm" className="bg-zinc-800/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 border-zinc-700" onClick={() => setDeleteTarget(peer)} title={tCommon("delete")}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">{tPeers("clientName")}</TableHead>
                    <TableHead className="text-zinc-400">{tPeers("ip")}</TableHead>
                    <TableHead className="text-zinc-400">{tPeers("dns")}</TableHead>
                    <TableHead className="text-zinc-400">Allowed IPs</TableHead>
                    <TableHead className="text-zinc-400">{tPeers("server")}</TableHead>
                    <TableHead className="text-zinc-400 w-[1%] whitespace-nowrap">{tPeers("tags")}</TableHead>
                    <TableHead className="text-zinc-400 w-[1%] whitespace-nowrap text-center">{tPeers("status")}</TableHead>
                    <TableHead className="w-14 text-right text-zinc-400">
                      {tPeers("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeers.map((peer, index) => {
                    const server = serverMap.get(peer.confServerId);
                    const peerTags = getPeerTags(peer);
                    return (
                      <TableRow
                        key={peer.id}
                        className="animate-fade-in border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animationFillMode: "backwards",
                        }}
                        onClick={() => setDetailPeerId(peer.id)}
                      >
                        <TableCell className="font-medium text-zinc-200">
                          <div className="flex items-center gap-1.5">
                            {peer.clientName}
                            {peer.expireAt && (() => {
                              const { color, label } = getExpireUrgency(peer.expireAt);
                              return (
                                <Tooltip>
                                  <TooltipTrigger type="button" tabIndex={-1} className="inline-flex">
                                    <CalendarClock className={`h-3.5 w-3.5 ${color}`} />
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                    <p className="text-xs">{label}</p>
                                    <p className="text-[11px] text-zinc-400">
                                      {new Date(peer.expireAt.endsWith('Z') ? peer.expireAt : peer.expireAt + 'Z').toLocaleString('it-IT', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit',
                                      })}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-400">
                          {peer.address}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-400">
                          {peer.dnsAddress}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-zinc-400">
                          {peer.allowedIPs}
                        </TableCell>
                        <TableCell className="text-zinc-400">
                          {server?.endPoint ?? "—"}
                        </TableCell>
                        <TableCell className="w-[1%] whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {peerTags.length > 0 ? (
                              <>
                                {peerTags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
                                    style={{
                                      backgroundColor: tag.color + '20',
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
                                {peerTags.length > 2 && (
                                  <Tooltip>
                                    <TooltipTrigger type="button" tabIndex={-1} className="inline-flex items-center justify-center rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-400 border border-zinc-700/50 cursor-help hover:bg-zinc-700/80 transition-colors">
                                        +{peerTags.length - 2}
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                                      <div className="flex flex-col gap-1.5 py-0.5">
                                        {peerTags.slice(2).map((tag) => (
                                          <div key={tag.id} className="flex items-center gap-2">
                                            <span
                                              className="size-1.5 rounded-full shrink-0"
                                              style={{ backgroundColor: tag.color }}
                                            />
                                            <span className="text-xs font-medium text-zinc-200">{tag.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-zinc-600 italic">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[1%] whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={peer.isActive}
                            onCheckedChange={(checked) => handleTogglePeer(peer, checked)}
                          />
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleDownloadConf(peer)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                {tPeers("downloadConf")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleShowQrCode(peer)}
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                {tPeers("qrCode")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenDuplicate(peer)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                {tCommon("duplicate")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(peer)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                {tCommon("edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-400 focus:text-red-400"
                                onClick={() => setDeleteTarget(peer)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {tCommon("delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            )}

            {/* Pagination Bar */}
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">{tPeers("rowsPerPage")}</span>
                <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-[70px] h-8 border-zinc-700 bg-zinc-800/50 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-zinc-400">
                {totalCount !== null ? (
                  tPeers("paginationTotal", { page: currentPage, totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), total: totalCount })
                ) : (
                  tPeers("pagination", { page: currentPage })
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {tPeers("previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  disabled={totalCount !== null ? currentPage >= Math.ceil(totalCount / pageSize) : peers.length < pageSize}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  {tPeers("next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PeerModal
        open={peerModalOpen}
        onOpenChange={(open) => {
          setPeerModalOpen(open);
          if (!open) {
            setEditingPeer(null);
            setDuplicatePeer(null);
          }
        }}
        peer={editingPeer}
        duplicateFrom={duplicatePeer}
        servers={servers}
        tags={tags}
        peerTagIds={
          editingPeer
            ? getPeerTagIds(editingPeer)
            : duplicatePeer
            ? getPeerTagIds(duplicatePeer)
            : []
        }
        onSave={handleSavePeer}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={tPeers("deletePeerTitle")}
        description={tPeers("deleteConfirmDesc", { name: deleteTarget?.clientName ?? "" })}
        confirmLabel={tCommon("delete")}
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      <QrCodeDialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          setQrDialogOpen(open);
          if (!open && qrCodeUrl) {
            URL.revokeObjectURL(qrCodeUrl);
            setQrCodeUrl(null);
          }
        }}
        qrCodeUrl={qrCodeUrl}
        peerName={qrPeerName}
      />

      <PeerDetailDialog
        open={detailPeerId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailPeerId(null);
        }}
        peerId={detailPeerId}
        serverMap={serverMap}
      />
    </AuthenticatedLayout>
  );
}
