"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiRequest } from "../../../src/api";
import ConfirmProviders from "../Providers";

type ClaimIntent = {
  ok: true;
  intentId: string | null;
  earningsUsd: number;
  lamports: number;
  amountSol: number;
  solUsd: number;
  solUsdSource: string;
  expiresAt: string;
  to: string;
  from: string | null;
};

type ClaimPaid = {
  ok: true;
  signature: string;
  alreadyPaid?: boolean;
};

function ConfirmClaimInner() {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? null;

  const [intent, setIntent] = useState<ClaimIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sig, setSig] = useState<string | null>(null);

  const expiresMs = useMemo(() => {
    const iso = intent?.expiresAt;
    return iso ? new Date(iso).getTime() : null;
  }, [intent?.expiresAt]);

  const secondsLeft = useMemo(() => {
    if (!expiresMs) return null;
    return Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
  }, [expiresMs, loading, intent]);

  useEffect(() => {
    let timer: any;
    if (expiresMs) timer = setInterval(() => {}, 1000);
    return () => timer && clearInterval(timer);
  }, [expiresMs]);

  useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      setSig(null);
      setIntent(null);

      if (!walletAddress) {
        setLoading(false);
        setError("Connect your wallet to continue.");
        return;
      }

      try {
        const { ensureAuth } = await import("../../../src/utils/ensureAuth");
        await ensureAuth(wallet);

        // expected_earnings is optional; backend is authoritative.
        const data = await apiRequest<ClaimIntent>("/claim-sol-intent", {
          method: "POST",
          body: JSON.stringify({}),
        });
        setIntent(data);
      } catch (e: any) {
        setError(e?.message || "Failed to create claim intent");
      } finally {
        setLoading(false);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  async function handleConfirm() {
    if (!intent?.intentId) return;
    setConfirming(true);
    setError(null);
    try {
      const paid = await apiRequest<ClaimPaid>("/confirm-claim-sol", {
        method: "POST",
        body: JSON.stringify({ intentId: intent.intentId }),
      });
      setSig(paid.signature);
    } catch (e: any) {
      setError(e?.message || "Claim confirmation failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-black via-gray-950 to-black text-white p-6">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-gray-800 bg-black/60 backdrop-blur p-6">
          <div className="text-2xl font-bold">Confirm Claim Rewards</div>
          <div className="text-sm text-gray-400 mt-1">
            A quote is created first, then the backend pays SOL from the dev treasury.
          </div>

          <div className="mt-5 space-y-3">
            {!wallet.connected && (
              <button
                onClick={() => wallet.connect()}
                className="w-full py-3 rounded-lg bg-cyan-500 text-black font-bold"
              >
                Connect Wallet
              </button>
            )}

            {loading && (
              <div className="text-gray-300 text-sm">Preparing quote…</div>
            )}

            {error && <div className="text-red-400 text-sm">{error}</div>}

            {intent && intent.intentId === null && !loading && !error && (
              <div className="text-sm text-gray-300">
                Nothing to claim right now.
              </div>
            )}

            {intent && intent.intentId && (
              <div className="rounded-xl border border-gray-800 bg-black/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-gray-400">You will receive</div>
                    <div className="text-xl font-bold">
                      {Number(intent.amountSol).toFixed(6)} SOL
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Earnings</div>
                    <div className="text-xl font-bold">
                      ${Number(intent.earningsUsd).toFixed(4)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-400">
                  Rate: {Number(intent.solUsd).toFixed(2)} USD/SOL ({intent.solUsdSource})
                </div>
                <div className="text-sm text-gray-400">
                  Quote expires in: {secondsLeft ?? "—"}s
                </div>
              </div>
            )}

            {sig && (
              <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-4">
                <div className="font-semibold text-green-300">Paid!</div>
                <div className="text-sm text-gray-200 break-all mt-1">{sig}</div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!intent?.intentId || confirming || !!sig}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold disabled:opacity-50"
            >
              {sig ? "Confirmed" : confirming ? "Confirming…" : "Confirm Claim"}
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          If your browser doesn’t allow window.close(), just close this tab.
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function ConfirmClaimPage() {
  return (
    <ConfirmProviders>
      <ConfirmClaimInner />
    </ConfirmProviders>
  );
}
