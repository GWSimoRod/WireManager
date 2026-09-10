"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ScrollText,
  ShieldAlert,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Layers,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useAuth } from "@/lib/auth-context";
import { getAuditLogs, ApiClientError } from "@/lib/api-client";
import type { AuditLog } from "@/lib/types";

const actorBadgeColors: Record<string, string> = {
  Admin: "bg-red-500/15 text-red-400 border-red-500/20",
  admin: "bg-red-500/15 text-red-400 border-red-500/20",
  Operator: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  operator: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  System: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  system: "bg-blue-500/15 text-blue-400 border-blue-500/20",
};

export default function AuditPage() {
  const tAudit = useTranslations("Audit");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const { userRole } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  // Detail modal state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [hasCopiedDetails, setHasCopiedDetails] = useState(false);

  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (userRole !== "Admin") return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await getAuditLogs(currentPage, pageSize);
        setLogs(result.data);
        setTotalCount(result.totalCount);
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : tAudit("loadError");
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userRole, currentPage, pageSize, tAudit]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Extract unique entities from current logs for the filter dropdown
  const uniqueEntities = useMemo(() => {
    const defaultEntities = ["User", "Peer", "Server", "Tag", "Service", "Policy", "Setup"];
    const fromLogs = logs.map((l) => l.entity).filter(Boolean);
    const combined = Array.from(new Set([...defaultEntities, ...fromLogs]));
    return combined.sort();
  }, [logs]);

  // Client-side filtering across the loaded batch
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (statusFilter === "success" && !log.isSuccess) return false;
      if (statusFilter === "failed" && log.isSuccess) return false;

      // Entity filter
      if (
        entityFilter !== "all" &&
        log.entity?.toLowerCase() !== entityFilter.toLowerCase()
      ) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesAction = log.action?.toLowerCase().includes(query);
        const matchesEntity = log.entity?.toLowerCase().includes(query);
        const matchesEntityId = log.entityId?.toLowerCase().includes(query);
        const matchesActor = log.actorId?.toLowerCase().includes(query) ||
          log.actorType?.toLowerCase().includes(query);
        const matchesDetails = log.details?.toLowerCase().includes(query);

        if (
          !matchesAction &&
          !matchesEntity &&
          !matchesEntityId &&
          !matchesActor &&
          !matchesDetails
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, statusFilter, entityFilter, searchTerm]);

  function handlePageSizeChange(value: string | null) {
    if (value) {
      setPageSize(Number(value));
      setCurrentPage(1);
    }
  }

  function handleCopyDetails(text: string) {
    navigator.clipboard.writeText(text);
    setHasCopiedDetails(true);
    toast.success(tCommon("success"));
    setTimeout(() => setHasCopiedDetails(false), 2000);
  }

  function formatTimestamp(timestamp: string): string {
    try {
      const t = timestamp.endsWith("Z") || timestamp.includes("+")
        ? timestamp
        : timestamp + "Z";
      const date = new Date(t);
      return date.toLocaleString(locale === "it" ? "it-IT" : "en-US", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return timestamp;
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                <ScrollText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                  {tAudit("title")}
                </h1>
                <p className="text-xs text-zinc-400">{tAudit("subtitle")}</p>
              </div>
            </div>
          </div>

          {userRole === "Admin" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={loading || refreshing}
              className="border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin text-blue-400" : ""}`}
              />
              {tAudit("refresh")}
            </Button>
          )}
        </div>

        {userRole !== "Admin" ? (
          /* ─── Access Denied ─── */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              {tCommon("accessDenied")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{tAudit("adminOnly")}</p>
          </div>
        ) : (
          /* ─── Admin Content ─── */
          <div className="space-y-4">
            {/* Filter Toolbar */}
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  type="text"
                  placeholder={tAudit("searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 border-zinc-700 bg-zinc-800/50 pl-9 text-sm placeholder:text-zinc-500 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              {/* Status & Entity Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    if (val) setStatusFilter(val as "all" | "success" | "failed");
                  }}
                >
                  <SelectTrigger className="h-9 min-w-[130px] border-zinc-700 bg-zinc-800/50 text-xs text-zinc-200">
                    <SelectValue placeholder={tAudit("filterStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tAudit("allStatuses")}</SelectItem>
                    <SelectItem value="success">{tAudit("success")}</SelectItem>
                    <SelectItem value="failed">{tAudit("failed")}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Entity Filter */}
                <Select
                  value={entityFilter}
                  onValueChange={(val) => {
                    if (val) setEntityFilter(val);
                  }}
                >
                  <SelectTrigger className="h-9 min-w-[140px] border-zinc-700 bg-zinc-800/50 text-xs text-zinc-200">
                    <SelectValue placeholder={tAudit("filterEntity")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tAudit("allEntities")}</SelectItem>
                    {uniqueEntities.map((ent) => (
                      <SelectItem key={ent} value={ent}>
                        {ent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-xl backdrop-blur-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-[180px] text-zinc-400">
                      {tAudit("timestamp")}
                    </TableHead>
                    <TableHead className="w-[110px] text-zinc-400">
                      {tAudit("status")}
                    </TableHead>
                    <TableHead className="w-[160px] text-zinc-400">
                      {tAudit("action")}
                    </TableHead>
                    <TableHead className="w-[160px] text-zinc-400">
                      {tAudit("entity")}
                    </TableHead>
                    <TableHead className="w-[180px] text-zinc-400">
                      {tAudit("actor")}
                    </TableHead>
                    <TableHead className="text-zinc-400">
                      {tAudit("details")}
                    </TableHead>
                    <TableHead className="w-[70px] text-right text-zinc-400">
                      {tCommon("actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // Skeleton Rows
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow
                        key={i}
                        className="border-zinc-800 hover:bg-transparent"
                      >
                        <TableCell>
                          <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell>
                          <div className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell>
                          <div className="h-5 w-24 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-24 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell>
                          <div className="h-4 w-44 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto h-7 w-7 animate-pulse rounded bg-zinc-800" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredLogs.length === 0 ? (
                    <TableRow className="border-zinc-800 hover:bg-transparent">
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center py-10">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-500 mb-3">
                            <ScrollText className="h-6 w-6" />
                          </div>
                          <p className="text-sm font-medium text-zinc-300">
                            {tAudit("noAudits")}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 max-w-sm">
                            {tAudit("noAuditsDesc")}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="group border-zinc-800 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      >
                        {/* Timestamp */}
                        <TableCell className="text-xs text-zinc-300 font-mono">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                            <span>{formatTimestamp(log.timestamp)}</span>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          {log.isSuccess ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] gap-1 px-2 py-0.5"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {tAudit("success")}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[11px] gap-1 px-2 py-0.5"
                            >
                              <XCircle className="h-3 w-3" />
                              {tAudit("failed")}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {log.action}
                          </span>
                        </TableCell>

                        {/* Entity */}
                        <TableCell className="text-sm text-zinc-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-zinc-200">
                              {log.entity}
                            </span>
                            {log.entityId && (
                              <Badge
                                variant="outline"
                                className="bg-zinc-800 text-[10px] text-zinc-400 border-zinc-700 px-1.5 py-0"
                              >
                                #{log.entityId}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Actor */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${
                                  actorBadgeColors[log.actorType] ||
                                  "bg-zinc-800 text-zinc-400 border-zinc-700"
                                }`}
                              >
                                {log.actorType}
                              </Badge>
                            </div>
                            <span
                              className="text-[11px] font-mono text-zinc-500 truncate max-w-[150px]"
                              title={log.actorId}
                            >
                              {log.actorId}
                            </span>
                          </div>
                        </TableCell>

                        {/* Details Preview */}
                        <TableCell className="text-xs text-zinc-400 max-w-[320px]">
                          <span
                            className="line-clamp-1 truncate font-mono text-[11px] text-zinc-400"
                            title={log.details ?? ""}
                          >
                            {log.details || "—"}
                          </span>
                        </TableCell>

                        {/* View Action */}
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                            title={tAudit("viewDetails")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-800 pt-4">
                {/* Page Size Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {tAudit("rowsPerPage")}
                  </span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={handlePageSizeChange}
                  >
                    <SelectTrigger className="w-[75px] h-8 border-zinc-700 bg-zinc-800/50 text-xs text-zinc-200">
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

                {/* Page Status */}
                <div className="text-xs text-zinc-400">
                  {totalCount !== null ? (
                    tAudit("paginationTotal", {
                      page: currentPage,
                      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
                      total: totalCount,
                    })
                  ) : (
                    tAudit("pagination", { page: currentPage })
                  )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                    className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    {tCommon("cancel") === "Annulla" ? "Precedente" : "Previous"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={
                      loading ||
                      (totalCount !== null
                        ? currentPage >= Math.ceil(totalCount / pageSize)
                        : logs.length < pageSize)
                    }
                    className="h-8 border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {tCommon("cancel") === "Annulla" ? "Successivo" : "Next"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Detail Dialog ─── */}
        <Dialog
          open={selectedLog !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedLog(null);
          }}
        >
          <DialogContent className="sm:max-w-xl bg-zinc-900 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg text-zinc-100">
                <ScrollText className="h-5 w-5 text-blue-400" />
                {tAudit("dialogTitle")}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                {selectedLog &&
                  tAudit("dialogSubtitle", { id: selectedLog.id })}
              </DialogDescription>
            </DialogHeader>

            {selectedLog && (
              <div className="space-y-4 pt-2">
                {/* Status & Action Hero */}
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {tAudit("action")}:
                    </span>
                    <span className="font-mono text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    {selectedLog.isSuccess ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs gap-1"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {tAudit("operationSuccessful")}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-rose-500/15 text-rose-400 border-rose-500/20 text-xs gap-1"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        {tAudit("operationFailed")}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Timestamp */}
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{tAudit("timestamp")}</span>
                    </div>
                    <div className="font-mono text-zinc-200">
                      {formatTimestamp(selectedLog.timestamp)}
                    </div>
                  </div>

                  {/* Entity & ID */}
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                      <Layers className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{tAudit("entity")}</span>
                    </div>
                    <div className="flex items-center gap-2 font-medium text-zinc-200">
                      <span>{selectedLog.entity}</span>
                      {selectedLog.entityId && (
                        <Badge
                          variant="outline"
                          className="bg-zinc-800 text-[10px] text-zinc-300 border-zinc-700 px-1.5 py-0"
                        >
                          #{selectedLog.entityId}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actor Type */}
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                      <span>{tAudit("actorType")}</span>
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          actorBadgeColors[selectedLog.actorType] ||
                          "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {selectedLog.actorType}
                      </Badge>
                    </div>
                  </div>

                  {/* Actor ID */}
                  <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                    <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                      <span>{tAudit("actorId")}</span>
                    </div>
                    <div
                      className="font-mono text-[11px] text-zinc-300 break-all"
                      title={selectedLog.actorId}
                    >
                      {selectedLog.actorId}
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-400">
                      {tAudit("details")}
                    </span>
                    {selectedLog.details && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyDetails(selectedLog.details!)}
                        className="h-7 text-[11px] text-zinc-400 hover:text-zinc-200 gap-1 px-2"
                      >
                        {hasCopiedDetails ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-300 max-h-56 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar">
                    {selectedLog.details || (
                      <span className="italic text-zinc-500">
                        {tAudit("noDetails")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
