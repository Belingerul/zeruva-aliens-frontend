"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { apiRequest } from "../../../src/api";

type BuyEggIntent = {
  serialized: string;
  intentId: string;
  amountSol: number;
  lamports: number;
  solUsd: number;
  solUsdSource: string;
  admin: string;
  eggType: string;
  priceUsd: number;
  expiresAt: string;
};

export default function ConfirmEggClient() {
  const params = useSearchParams();
  const wallet = useWallet();

  const walletAddress = wallet.publicKey?.toBase58() ?? null;
  const eggType = (params.get("eggType") || "basic").toLowerCase();

  const [intent, setIntent] = useState<BuyEggIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sig, setSig] = useState<string | null>(null);

  const expiresMs = useMemo(() => {
    return intent?.expiresAt ? new Date(intent.expiresAt).getTime() : null;
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

      if (!wallet.connected) {
        setLoading(false);
        setError("Please click Connect Wallet and approve the Phantom popup.");
        return;
      }

      if (!walletAddress) {
        setLoading(false);
        setError("Wallet connected but no address found. Try reconnecting.");
        return;
      }

      try {
        const { ensureAuth } = await import("../../../src/utils/ensureAuth");
        await ensureAuth(wallet);
      } catch (e: any) {
        setLoading(false);
        setError(e?.message || "Login failed");
        return;
      }

      if (!["basic", "rare", "ultra"].includes(eggType)) {
        setLoading(false);
        setError("Invalid egg type.");
        return;
      }

      try {
        const data = await apiRequest<BuyEggIntent>("/buy-egg", {
          method: "POST",
          body: JSON.stringify({ eggType }),
        });
        setIntent(data);
      } catch (e: any) {
        setError(e?.message || "Failed to prepare egg purchase");
      } finally {
        setLoading(false);
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, eggType]);

  async function handleConfirm() {
    if (!intent) return;
    if (!wallet.signTransaction) {
      setError("Wallet doesn't support transaction signing");
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const { Transaction, Connection } = await import("@solana/web3.js");
      const connection = new Connection(
        process.env.VITE_RPC_URL || "https://api.devnet.solana.com",
        "confirmed",
      );

      const tx = Transaction.from(Buffer.from(intent.serialized, "base64"));
      const signed = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      await apiRequest("/confirm-buy-egg", {
        method: "POST",
        body: JSON.stringify({
          eggType: intent.eggType,
          signature,
          intentId: intent.intentId,
        }),
      });

      window.opener?.dispatchEvent(new Event("zeruva_eggs_changed"));
      setSig(signature);
    } catch (e: any) {
      setError(e?.message || "Confirmation failed");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-black via-gray-950 to-black text-white p-6">
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-2xl border border-gray-800 bg-black/60 backdrop-blur p-6">
          <div className="text-2xl font-bold">Confirm Egg Purchase</div>
          <div className="text-sm text-gray-400 mt-1">
            Review the quote and sign the transaction.
          </div>

          <div className="mt-5 space-y-3">
            {!wallet.connected && (
              <div className="w-full space-y-2">
                <WalletMultiButton className="!w-full !justify-center !bg-cyan-500 !text-black !rounded-lg !py-3 !font-bold hover:!bg-cyan-600" />
                <button
                  onClick={() => {
                    const url = encodeURIComponent(window.location.href);
                    const ref = encodeURIComponent(window.location.origin);
                    window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
                  }}
                  className="w-full py-3 rounded-lg border border-gray-700 text-gray-200"
                >
                  Open this page in Phantom
                </button>
                <div className="text-[11px] text-gray-500">
                  If you’re on mobile and Phantom won’t open from your browser, use this.
                </div>
              </div>
            )}
            {loading && <div className="text-gray-300 text-sm">Preparing…</div>}
            {error && <div className="text-red-400 text-sm">{error}</div>}

            {intent && (
              <div className="rounded-xl border border-gray-800 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Egg</div>
                    <div className="text-xl font-bold capitalize">
                      {intent.eggType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Price</div>
                    <div className="text-xl font-bold">
                      ${Number(intent.priceUsd).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-gray-400">
                  ≈ {Number(intent.amountSol).toFixed(6)} SOL · Rate{" "}
                  {Number(intent.solUsd).toFixed(2)} USD/SOL ({intent.solUsdSource})
                </div>
                <div className="text-sm text-gray-400">
                  Quote expires in: {secondsLeft ?? "—"}s
                </div>
              </div>
            )}

            {sig && (
              <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-4">
                <div className="font-semibold text-green-300">Confirmed!</div>
                <div className="text-sm text-gray-200 break-all mt-1">
                  {sig}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!intent || confirming || !!sig}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold disabled:opacity-50"
            >
              {sig ? "Confirmed" : confirming ? "Confirming…" : "Confirm & Sign"}
            </button>
            <button
              onClick={() => window.close()}
              className="px-4 py-3 rounded-lg border border-gray-700 text-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
