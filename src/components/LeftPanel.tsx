"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { buySpaceship, confirmBuySpaceship } from "../api";
import RewardsCard from "./RewardsCard";
import { useRef, useEffect } from "react";

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

  async function handleBuySpaceship(level: number) {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const walletAddress = wallet.publicKey.toBase58();
      const { serialized } = await buySpaceship(walletAddress, level);

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

      await confirmBuySpaceship(level, signature);

      alert(`Spaceship purchased! Tx: ${signature}`);
    } catch (error: any) {
      console.error("Purchase failed:", error);
      alert(`Purchase failed: ${error.message || "Network Error"}`);
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
        <h3 className="font-semibold mb-4 text-gray-100 text-lg">
          Buy Spaceship
        </h3>
        <div className="space-y-3">
          <button
            onClick={() => handleBuySpaceship(1)}
            disabled={isDisabled}
            className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            Buy Lv1 ($30)
          </button>
          <button
            onClick={() => handleBuySpaceship(2)}
            disabled={isDisabled}
            className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            Buy Lv2 ($60)
          </button>
          <button
            onClick={() => handleBuySpaceship(3)}
            disabled={isDisabled}
            className="w-full py-3 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            Buy Lv3 ($120)
          </button>
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
