"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getUserAliens, type Alien } from "../api";

const tierColors: Record<string, string> = {
  Common: "border-green-500",
  Rare: "border-blue-500",
  Epic: "border-purple-500",
  Legendary: "border-yellow-500",
};

export default function Hangar({
  onSelect,
}: {
  onSelect: (alien: Alien) => void;
}) {
  const wallet = useWallet();
  const [aliens, setAliens] = useState<Alien[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      setLoading(true);
      getUserAliens(wallet.publicKey.toString())
        .then(setAliens)
        .catch((err) => console.error("Failed to load aliens:", err))
        .finally(() => setLoading(false));
    }
  }, [wallet.connected, wallet.publicKey]);

  if (loading) {
    return (
      <div className="text-white text-center p-8">Loading your aliens...</div>
    );
  }

  if (aliens.length === 0) {
    return (
      <div className="text-gray-400 text-center p-8">
        No aliens in hangar yet. Spin to get your first alien!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 max-h-96 overflow-y-auto">
      {aliens.map((alien) => (
        <div
          key={alien.id}
          className={`bg-gray-900 border-2 ${tierColors[alien.tier || "Common"]} rounded-xl p-3 cursor-pointer hover:scale-105 transition-transform`}
          onClick={() => onSelect(alien)}
        >
          <img
            src={alien.image || "/placeholder.svg"}
            className="w-full h-24 object-contain mb-2"
            alt={`Alien ${alien.alien_id || alien.id}`}
          />
          <div className="text-white text-sm font-semibold">
            Alien #{alien.alien_id || alien.id}
          </div>
          <div
            className={`text-xs font-bold ${alien.tier === "Legendary" ? "text-yellow-400" : alien.tier === "Epic" ? "text-purple-400" : alien.tier === "Rare" ? "text-blue-400" : "text-green-400"}`}
          >
            {alien.tier || "Common"}
          </div>
          {alien.roi !== undefined && (
            <div className="text-cyan-300 text-xs">
              {(alien.roi * 100).toFixed(1)}%/day
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
