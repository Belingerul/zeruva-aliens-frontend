"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";

type PriceResp = { ok: true; solUsd: number; source: string; ts: number };

export default function QuoteCard({
  nextUpgradeUsd,
}: {
  nextUpgradeUsd: number;
  // kept optional for backwards-compat with older props
  nextClaimAt?: Date | null;
}) {
  const [price, setPrice] = useState<PriceResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      try {
        const data = await apiRequest<PriceResp>("/price/sol-usd");
        if (!cancelled) setPrice(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load price");
      }
    }

    run();
    const id = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const estSol = useMemo(() => {
    if (!price?.solUsd) return null;
    return nextUpgradeUsd / Number(price.solUsd);
  }, [price?.solUsd, nextUpgradeUsd]);

  return (
    <div className="w-full rounded-xl p-3 bg-black/60 border border-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold text-gray-100 leading-none">
            Treasury / Quote
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Live SOL/USD pricing (auto refresh)
          </div>
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {price?.ts ? new Date(price.ts).toLocaleTimeString() : ""}
        </div>
      </div>

      {error && <div className="text-xs text-red-400 mt-3">{error}</div>}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
          <div className="text-xs text-gray-400">SOL / USD</div>
          <div className="mt-1 text-2xl font-bold text-cyan-300">
            {price ? Number(price.solUsd).toFixed(2) : "…"}
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-black/40 p-3">
          <div className="text-xs text-gray-400">Next Ship Upgrade</div>
          <div className="mt-1 text-2xl font-bold text-gray-100">
            ${nextUpgradeUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {estSol ? `≈ ${estSol.toFixed(6)} SOL` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
