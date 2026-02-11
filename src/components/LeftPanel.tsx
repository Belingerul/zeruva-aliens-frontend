"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  buySpaceship,
  confirmBuySpaceship,
  getShipWithSlots,
  type ShipWithSlots,
} from "../api";
import RewardsCard from "./RewardsCard";
import { useEffect, useMemo, useState } from "react";

interface LeftPanelProps {
  onOpenSpin: () => void;
  onRefreshRewardsReady?: (refreshFn: () => Promise<void>) => void;
  onRoiChangeReady?: (onRoiChangeFn: () => void) => void;
}

export default function LeftPanel({
  onOpenSpin,
  onRefreshRewardsReady,
  onRoiChangeReady,
}: LeftPanelProps) {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? null;

  const [ship, setShip] = useState<ShipWithSlots | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);

  async function refreshShip() {
    if (!walletAddress) {
      setShip(null);
      return;
    }
    setShipLoading(true);
    setShipError(null);
    try {
      const data = await getShipWithSlots(walletAddress);
      setShip(data);
    } catch (e: any) {
      console.error("Failed to load ship:", e);
      setShipError(e?.message || "Failed to load ship");
      setShip(null);
    } finally {
      setShipLoading(false);
    }
  }

  useEffect(() => {
    refreshShip();
    // refresh when ship changes elsewhere
    const onChanged = () => refreshShip();
    window.addEventListener("zeruva_ship_changed", onChanged);
    return () => window.removeEventListener("zeruva_ship_changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const { currentLevel, nextLevel, nextPriceUsd } = useMemo(() => {
    const level = ship?.level ?? 1;
    const maxLevel = 3;
    const next = Math.min(maxLevel, level + 1);
    const prices: Record<number, number> = { 1: 30, 2: 60, 3: 120 };
    return {
      currentLevel: level,
      nextLevel: next,
      nextPriceUsd: prices[next] ?? 0,
    };
  }, [ship]);

  const canUpgrade = wallet.connected && currentLevel < 3;

  async function handleUpgradeSpaceship() {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }

    const levelToBuy = nextLevel;

    try {
      const { serialized, intentId } = await buySpaceship(walletAddress!, levelToBuy);

      const { Transaction, Connection } = await import("@solana/web3.js");
      const connection = new Connection(
        process.env.VITE_RPC_URL || "https://api.devnet.solana.com",
        "confirmed",
      );

      const tx = Transaction.from(Buffer.from(serialized, "base64"));

      if (!wallet.signTransaction) {
        alert("Wallet doesn't support transaction signing");
        return;
      }

      const signed = await wallet.signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, "confirmed");

      await confirmBuySpaceship(levelToBuy, signature, intentId);

      window.dispatchEvent(new Event("zeruva_ship_changed"));

      alert(`Spaceship upgraded! Tx: ${signature}`);
    } catch (error: any) {
      console.error("Upgrade failed:", error);
      alert(`Upgrade failed: ${error.message || "Network Error"}`);
    }
  }

  const isDisabled = !wallet.connected;

  return (
    <div className="w-full lg:w-96 xl:w-[26rem] rounded-xl p-6 bg-black/60 backdrop-blur-sm border border-gray-800 h-auto lg:h-full lg:self-stretch flex flex-col gap-4">
      {/* Spin Section */}
      <div>
        <h3 className="font-semibold mb-4 text-gray-100 text-lg">
          Spin an Egg
        </h3>
        <button
          onClick={onOpenSpin}
          disabled={isDisabled}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-700"
        >
          {isDisabled ? "Connect Wallet First" : "🎰 Open Spin Modal"}
        </button>
      </div>

      {/* Spaceship Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-100 text-lg">Spaceship</h3>
          <div className="text-xs text-gray-400">
            {shipLoading ? "Loading…" : shipError ? "" : `Lv ${currentLevel}`}
          </div>
        </div>

        {shipError && (
          <div className="text-[11px] text-red-400 mb-2">{shipError}</div>
        )}

        <button
          onClick={handleUpgradeSpaceship}
          disabled={!canUpgrade || shipLoading}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-semibold hover:from-purple-700 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-700 disabled:to-gray-700"
        >
          {isDisabled
            ? "Connect Wallet to Upgrade"
            : currentLevel >= 3
              ? "Max Level Reached"
              : `Upgrade to Lv${nextLevel} ($${nextPriceUsd})`}
        </button>

        <div className="mt-2 text-[11px] text-gray-400 leading-snug">
          {currentLevel >= 3
            ? "Your ship is at max level."
            : "Upgrades increase your available alien slots."}
        </div>
      </div>

      {/* Passive Income / Rewards Card */}
      <RewardsCard
        onRefreshReady={onRefreshRewardsReady}
        onRoiChangeReady={onRoiChangeReady}
      />

      {wallet.connected && wallet.publicKey && (
        <div className="mt-auto text-sm text-cyan-200 bg-black/40 rounded-xl p-3 border border-gray-700">
          <div className="font-semibold mb-1">Connected</div>
          <div className="font-mono text-base break-all">
            {wallet.publicKey.toBase58()}
          </div>
        </div>
      )}
    </div>
  );
}
