"use client";
import { useTranslations } from "next-intl";


import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  Clock,
  Globe,
  Key,
  Monitor,
  Network,
  Server,
  Shield,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPeer, getPeerStats, getPeerLiveStats, ApiClientError } from "@/lib/api-client";
import type { ConfPeer, PeerUsageHistory, PeerLiveStats, ConfServer } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function parseDate(timestamp: string): Date {
  const t = timestamp.endsWith('Z') || timestamp.includes('+') ? timestamp : timestamp + 'Z';
  return new Date(t);
}

function formatTime(timestamp: string): string {
  const d = parseDate(timestamp);
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(timestamp: string): string {
  const d = parseDate(timestamp);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getExpireInfo(expireAt: string): { label: string; urgency: 'low' | 'medium' | 'high' | 'expired' } {
  const now = Date.now();
  const expire = parseDate(expireAt).getTime();
  const diffMs = expire - now;

  if (diffMs <= 0) return { label: 'Scaduto', urgency: 'expired' };

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = Math.floor(diffHours % 24);

  if (diffDays === 0) {
    return { label: `Scade tra ${remainingHours}h`, urgency: 'high' };
  }
  if (diffDays <= 2) {
    return { label: `Scade tra ${diffDays}g ${remainingHours}h`, urgency: 'high' };
  }
  if (diffDays <= 7) {
    return { label: `Scade tra ${diffDays} giorni`, urgency: 'medium' };
  }
  return { label: `Scade tra ${diffDays} giorni`, urgency: 'low' };
}

// ─── SVG Area Chart ─────────────────────────────────────────────────
interface ChartDataPoint {
  timestamp: string;
  deltaRx: number;
  deltaTx: number;
}

function UsageChart({ data: propData }: { data: ChartDataPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = propData.length === 1 ? [propData[0], propData[0]] : propData;

  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/30">
        <p className="text-sm text-zinc-500">Nessun dato di utilizzo disponibile</p>
      </div>
    );
  }

  const W = 700;
  const H = 220;
  const PAD = { top: 20, right: 20, bottom: 35, left: 60 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.deltaRx, d.deltaTx)),
    1
  );

  // Round up to nice value for Y axis
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(maxVal)));
    return Math.ceil(maxVal / pow) * pow;
  })();

  const minTime = parseDate(data[0].timestamp).getTime();
  const maxTime = parseDate(data[data.length - 1].timestamp).getTime();
  const timeRange = maxTime - minTime;

  const xScale = (i: number) => {
    if (timeRange === 0) return PAD.left + (i / (data.length - 1 || 1)) * chartW;
    const t = parseDate(data[i].timestamp).getTime();
    return PAD.left + ((t - minTime) / timeRange) * chartW;
  };
  const yScale = (v: number) => PAD.top + chartH - (v / niceMax) * chartH;

  // Build path strings
  const buildAreaPath = (values: number[]) => {
    const points = values.map((v, i) => `${xScale(i)},${yScale(v)}`);
    return `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(" ")} L${xScale(values.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;
  };

  const buildLinePath = (values: number[]) => {
    const points = values.map((v, i) => `${xScale(i)},${yScale(v)}`);
    return `M${points.join(" L")}`;
  };

  const rxValues = data.map((d) => d.deltaRx);
  const txValues = data.map((d) => d.deltaTx);

  // Y axis ticks
  const yTicks = [0, niceMax * 0.25, niceMax * 0.5, niceMax * 0.75, niceMax];

  // X axis ticks — filter based on time (target ~5 labels)
  const xTicks: { i: number; label: string }[] = [];
  if (timeRange === 0) {
    xTicks.push({ i: 0, label: formatTime(data[0].timestamp) });
    if (data.length > 1) {
      xTicks.push({ i: data.length - 1, label: formatTime(data[data.length - 1].timestamp) });
    }
  } else {
    const targetTicksCount = 5;
    const stepMs = timeRange / (targetTicksCount - 1);
    for (let k = 0; k < targetTicksCount; k++) {
      const targetTime = minTime + k * stepMs;
      let closestI = 0;
      let minDiff = Infinity;
      for (let i = 0; i < data.length; i++) {
        const t = parseDate(data[i].timestamp).getTime();
        const diff = Math.abs(t - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestI = i;
        }
      }
      if (!xTicks.some((tick) => tick.i === closestI)) {
        xTicks.push({ i: closestI, label: formatTime(data[closestI].timestamp) });
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    // Find nearest data point
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(xScale(i) - mouseX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    if (minDist < 40) {
      setHoveredIndex(nearest);
      setTooltipPos({ x: xScale(nearest), y: Math.min(yScale(rxValues[nearest]), yScale(txValues[nearest])) - 10 });
    } else {
      setHoveredIndex(null);
      setTooltipPos(null);
    }
  };

  return (
    <div className="relative">
      {/* Legend */}
      <div className="mb-3 flex items-center gap-5 pl-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(34,197,94,0.85)" }} />
          <span className="text-xs text-zinc-400">Download (RX)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "rgba(59,130,246,0.85)" }} />
          <span className="text-xs text-zinc-400">Upload (TX)</span>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredIndex(null); setTooltipPos(null); }}
      >
        {/* Grid lines */}
        {yTicks.map((v, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={yScale(v)}
            x2={W - PAD.right}
            y2={yScale(v)}
            stroke="rgba(63,63,70,0.4)"
            strokeDasharray="4 4"
          />
        ))}

        {/* RX Area */}
        <path
          d={buildAreaPath(rxValues)}
          fill="url(#rxGradient)"
          className="transition-opacity duration-300"
        />
        <path
          d={buildLinePath(rxValues)}
          fill="none"
          stroke="rgba(34,197,94,0.85)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* TX Area */}
        <path
          d={buildAreaPath(txValues)}
          fill="url(#txGradient)"
          className="transition-opacity duration-300"
        />
        <path
          d={buildLinePath(txValues)}
          fill="none"
          stroke="rgba(59,130,246,0.85)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,197,94,0.3)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0.02)" />
          </linearGradient>
          <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0.02)" />
          </linearGradient>
        </defs>

        {/* Y axis labels */}
        {yTicks.map((v, i) => (
          <text
            key={i}
            x={PAD.left - 8}
            y={yScale(v)}
            textAnchor="end"
            dominantBaseline="central"
            className="fill-zinc-500 text-[10px]"
          >
            {formatBytes(v)}
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map(({ i, label }) => (
          <text
            key={i}
            x={xScale(i)}
            y={H - 8}
            textAnchor="middle"
            className="fill-zinc-500 text-[10px]"
          >
            {label}
          </text>
        ))}

        {/* Hover indicator */}
        {hoveredIndex !== null && (
          <>
            <line
              x1={xScale(hoveredIndex)}
              y1={PAD.top}
              x2={xScale(hoveredIndex)}
              y2={PAD.top + chartH}
              stroke="rgba(161,161,170,0.3)"
              strokeDasharray="3 3"
            />
            <circle cx={xScale(hoveredIndex)} cy={yScale(rxValues[hoveredIndex])} r="4" fill="rgba(34,197,94,1)" stroke="#18181b" strokeWidth="2" />
            <circle cx={xScale(hoveredIndex)} cy={yScale(txValues[hoveredIndex])} r="4" fill="rgba(59,130,246,1)" stroke="#18181b" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && tooltipPos && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
          style={{
            left: `${(tooltipPos.x / W) * 100}%`,
            top: `${(tooltipPos.y / H) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <p className="mb-1 text-[11px] font-medium text-zinc-300">
            {formatDateTime(data[hoveredIndex].timestamp)}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[11px] text-zinc-400">RX:</span>
            <span className="text-[11px] font-semibold text-green-400">{formatBytes(data[hoveredIndex].deltaRx)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[11px] text-zinc-400">TX:</span>
            <span className="text-[11px] font-semibold text-blue-400">{formatBytes(data[hoveredIndex].deltaTx)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── {tPeers("never")}n Component ─────────────────────────────────────────────────
interface PeerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peerId: number | null;
  serverMap: Map<number, ConfServer>;
}

export function PeerDetailDialog({
  open,
  onOpenChange,
  peerId,
  serverMap,
}: PeerDetailDialogProps) {
  const tPeers = useTranslations("Peers");
  const tCommon = useTranslations("Common");
  const [peer, setPeer] = useState<ConfPeer | null>(null);
  const [stats, setStats] = useState<PeerUsageHistory[]>([]);
  const [liveStats, setLiveStats] = useState<PeerLiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAllData = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const [peerData, statsData] = await Promise.all([
        getPeer(id),
        getPeerStats(id),
      ]);
      setPeer(peerData);
      // Sort stats by timestamp ascending for the chart
      setStats(statsData.sort((a, b) => parseDate(a.timestamp).getTime() - parseDate(b.timestamp).getTime()));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Errore caricamento dettagli peer";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLiveStats = useCallback(async (id: number) => {
    try {
      const live = await getPeerLiveStats(id);
      setLiveStats(live);
    } catch {
      // Silently fail for live stats polling
    } finally {
      setLiveLoading(false);
    }
  }, []);

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && peerId !== null) {
      setPeer(null);
      setStats([]);
      setLiveStats(null);
      setLoading(true);
      setLiveLoading(true);
      fetchAllData(peerId);
      fetchLiveStats(peerId);
    }
  }, [open, peerId, fetchAllData, fetchLiveStats]);

  // Poll live stats every 5 seconds
  useEffect(() => {
    if (open && peerId !== null) {
      intervalRef.current = setInterval(() => {
        fetchLiveStats(peerId);
      }, 5000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [open, peerId, fetchLiveStats]);

  const chartData: ChartDataPoint[] = stats.map((s) => ({
    timestamp: s.timestamp,
    deltaRx: s.deltaRxBytes,
    deltaTx: s.deltaTxBytes,
  }));

  const server = peer ? serverMap.get(peer.confServerId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-full sm:max-w-3xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-xl overflow-y-auto p-4 sm:p-6 border-0 sm:border"
        showCloseButton
      >
        {loading ? (
          <div className="space-y-6 py-4">
            {/* Skeleton header */}
            <div className="space-y-3">
              <div className="h-6 w-48 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-64 animate-pulse rounded bg-zinc-800" />
            </div>
            {/* Skeleton cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-zinc-800" />
                  <div className="mt-2 h-5 w-24 animate-pulse rounded bg-zinc-800" />
                </div>
              ))}
            </div>
            {/* Skeleton chart */}
            <div className="h-52 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/30" />
          </div>
        ) : peer ? (
          <div className="space-y-5">
            {/* Header */}
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/20">
                  <Monitor className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-zinc-100">
                    {peer.clientName}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    <Key className="h-3 w-3" />
                    <span className="font-mono">{peer.publicKey.slice(0, 20)}…</span>
                    <span
                      className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        peer.isActive
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                          : "bg-zinc-700/30 text-zinc-500 border border-zinc-600/30"
                      }`}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${peer.isActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
                      {peer.isActive ? "Attivo" : "Inattivo"}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Expiration banner */}
            {peer.expireAt && (() => {
              const { label, urgency } = getExpireInfo(peer.expireAt);
              const colors = {
                expired: { border: 'border-red-500/30', bg: 'bg-red-500/5', icon: 'text-red-400', text: 'text-red-300', sub: 'text-red-400/70' },
                high:    { border: 'border-orange-500/30', bg: 'bg-orange-500/5', icon: 'text-orange-400', text: 'text-orange-300', sub: 'text-orange-400/70' },
                medium:  { border: 'border-amber-500/30', bg: 'bg-amber-500/5', icon: 'text-amber-400', text: 'text-amber-300', sub: 'text-amber-400/70' },
                low:     { border: 'border-zinc-700', bg: 'bg-zinc-800/30', icon: 'text-zinc-400', text: 'text-zinc-300', sub: 'text-zinc-400' },
              }[urgency];
              return (
                <div className={`flex items-center gap-3 rounded-lg border ${colors.border} ${colors.bg} px-3 py-2.5`}>
                  <CalendarClock className={`h-4 w-4 shrink-0 ${colors.icon}`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${colors.text}`}>{label}</span>
                    <span className={`ml-2 text-[11px] ${colors.sub}`}>
                      {formatDateTime(peer.expireAt)}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Info cards */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2.5">
                <InfoCard icon={<Network className="h-4 w-4 text-blue-400" />} label="Indirizzo" value={peer.address} />
                <InfoCard icon={<Globe className="h-4 w-4 text-violet-400" />} label={tPeers("dns")} value={peer.dnsAddress} />
                <InfoCard icon={<Server className="h-4 w-4 text-teal-400" />} label="Server" value={server?.endPoint ?? "—"} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <InfoCard icon={<Shield className="h-4 w-4 text-amber-400" />} label="Allowed IPs" value={peer.allowedIPs} isList />
                <InfoCard icon={<Clock className="h-4 w-4 text-orange-400" />} label="Persistent KeepAlive" value={peer.persistentKeepAlive ? `${peer.persistentKeepAlive}s` : "Off"} />
              </div>
            </div>

            {/* Live stats */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wifi className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Live Usage</h3>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
                </span>
              </div>
              {liveLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-lg bg-zinc-800/50 p-3">
                      <div className="h-3 w-12 animate-pulse rounded bg-zinc-700" />
                      <div className="mt-2 h-5 w-20 animate-pulse rounded bg-zinc-700" />
                    </div>
                  ))}
                </div>
              ) : liveStats ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-zinc-800/40 p-3 border border-zinc-800/50">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <ArrowDownToLine className="h-3 w-3 text-green-500" />
                      <span className="text-[11px] font-medium">Download (RX)</span>
                    </div>
                    <p className="mt-1.5 text-lg font-bold text-green-400 tabular-nums">
                      {formatBytes(liveStats.rxBytes)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/40 p-3 border border-zinc-800/50">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <ArrowUpFromLine className="h-3 w-3 text-blue-500" />
                      <span className="text-[11px] font-medium">Upload (TX)</span>
                    </div>
                    <p className="mt-1.5 text-lg font-bold text-blue-400 tabular-nums">
                      {formatBytes(liveStats.txBytes)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-800/40 p-3 border border-zinc-800/50">
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <span className="text-[11px] font-medium">Last Handshake</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-zinc-200">
                      {liveStats.latestHandshake
                        ? formatDateTime(liveStats.latestHandshake)
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Dati live non disponibili</p>
              )}
            </div>

            {/* Usage history chart */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-zinc-200">Storico Utilizzo</h3>
                {stats.length > 0 && (
                  <span className="ml-auto text-[11px] text-zinc-500">
                    {stats.length} campioni
                  </span>
                )}
              </div>
              <UsageChart data={chartData} />
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-zinc-500">Peer non trovato</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  icon,
  label,
  value,
  isList = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isList?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700">
      <div className="flex items-center gap-1.5 text-zinc-500">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      {isList ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {value.split(',').filter(Boolean).map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-300 border border-zinc-700/50"
            >
              {item.trim()}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 truncate font-mono text-sm font-medium text-zinc-200" title={value}>
          {value}
        </p>
      )}
    </div>
  );
}
