"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api";

type PriceResp = { ok: true; solUsd: number; source: string; ts: number };

export default function QuoteCard({ nextUpgradeUsd }: { nextUpgradeUsd: number }) {
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
    <div className="w-full rounded-xl p-4 bg-black/60 border border-gray-800">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-100">Quote / Treasury</div>
        <div className="text-[11px] text-gray-500">
          {price?.ts ? new Date(price.ts).toLocaleTimeString() : ""}
        </div>
      </div>

      {error && <div className="text-[11px] text-red-400 mt-2">{error}</div>}

      <div className="mt-2 text-sm text-gray-300">
        SOL/USD: <span className="text-cyan-300 font-semibold">{price ? Number(price.solUsd).toFixed(2) : "…"}</span>
        <span className="text-gray-500"> {price ? `(${price.source})` : ""}</span>
      </div>

      <div className="mt-2 text-sm text-gray-300">
        Next upgrade: <span className="text-gray-100 font-semibold">${nextUpgradeUsd.toFixed(2)}</span>
        <span className="text-gray-500"> {estSol ? `≈ ${estSol.toFixed(6)} SOL` : ""}</span>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Uses backend price feed. Treasury payout balance display can be added next.
      </div>
    </div>
  );
}
