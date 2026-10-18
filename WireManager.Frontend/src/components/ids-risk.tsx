"use client";

import { useLocale, useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import type { ConfPeer } from "@/lib/types";

// Display bands derived from the API score; these do not change IDS scoring.
const riskBands = [
  { min: 75, label: "critical", text: "text-red-400", bar: "bg-red-400/70" },
  { min: 50, label: "high", text: "text-orange-400", bar: "bg-orange-400/70" },
  { min: 25, label: "medium", text: "text-amber-400", bar: "bg-amber-400/70" },
  { min: 0, label: "low", text: "text-emerald-400", bar: "bg-emerald-400/70" },
] as const;

export function IdsRiskIndicator({ score }: { score?: number | null }) {
  const t = useTranslations("Ids");
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return <span className="text-xs text-zinc-500">{t("unavailable")}</span>;
  }

  const value = Math.min(100, Math.max(0, score));
  const band = riskBands.find(({ min }) => value >= min)!;
  const level = t(band.label);

  return (
    <div className="min-w-28 space-y-1.5" title={t("bands")}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium tabular-nums text-zinc-200">
          {value}<span className="font-normal text-zinc-500"> / 100</span>
        </span>
        <span className={band.text}>{level}</span>
      </div>
      <div
        role="progressbar"
        aria-label={t("score")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={t("scoreDescription", { score: value, level })}
        className="h-1 overflow-hidden rounded-full bg-zinc-800"
      >
        <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

type PeerIdsData = Pick<ConfPeer, "idsScore" | "lastIdsDetection" | "lastIdsScoreDecay">;

export function PeerIdsSection({ peer }: { peer: PeerIdsData }) {
  const t = useTranslations("Ids");
  const locale = useLocale();

  function formatTimestamp(timestamp: string | null | undefined) {
    if (timestamp === null) return t("notRecorded");
    if (!timestamp) return t("unavailable");
    // The backend writes UTC, but database DateTimes may omit the timezone suffix.
    const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
    if (Number.isNaN(date.getTime())) return t("unavailable");
    return date.toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (
    <section aria-label={t("title")} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-200">{t("title")}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-zinc-800/50 bg-zinc-800/40 p-3">
          <p className="text-[11px] font-medium text-zinc-500">{t("scoreAndLevel")}</p>
          <IdsRiskIndicator score={peer.idsScore} />
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/40 p-3">
          <p className="text-[11px] font-medium text-zinc-500">{t("lastDetection")}</p>
          <p className="mt-1.5 text-sm font-medium text-zinc-200">{formatTimestamp(peer.lastIdsDetection)}</p>
        </div>
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-800/40 p-3">
          <p className="text-[11px] font-medium text-zinc-500">{t("lastDecay")}</p>
          <p className="mt-1.5 text-sm font-medium text-zinc-200">{formatTimestamp(peer.lastIdsScoreDecay)}</p>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500">{t("bands")}</p>
    </section>
  );
}
