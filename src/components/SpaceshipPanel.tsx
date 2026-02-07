"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import DynamicStarfield from "./DynamicStarfield";
import SpaceshipSlot from "./SpaceshipSlot";
import {
  getShipWithSlots,
  unassignSlot,
  upgradeShipLevel,
  type ShipWithSlots,
} from "../api";

interface SpaceshipPanelProps {
  onAlienUnassigned?: () => void;
  onRoiChange?: () => void; // Call this BEFORE API call to freeze display
}

export default function SpaceshipPanel({
  onAlienUnassigned,
  onRoiChange,
}: SpaceshipPanelProps) {
  const { publicKey } = useWallet();
  const [ship, setShip] = useState<ShipWithSlots | null>(null);
  const [loading, setLoading] = useState(true);
  const [unassigning, setUnassigning] = useState(false);

  const loadShipData = async () => {
    if (!publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const shipData = await getShipWithSlots(publicKey.toString());
      setShip(shipData);
    } catch (err) {
      console.error("Failed to fetch ship data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShipData();
  }, [publicKey]);

  useEffect(() => {
    const onShipChanged = () => {
      loadShipData();
    };
    window.addEventListener("zeruva_ship_changed", onShipChanged);
    return () => {
      window.removeEventListener("zeruva_ship_changed", onShipChanged);
    };
  }, [publicKey]);

  const slotCount = ship?.maxSlots ?? 2;
  const slots = ship?.slots ?? [];

  const handleUnassignAlien = async (alienDbId: number) => {
    if (!publicKey || unassigning) return;

    setUnassigning(true);
    try {
      // CRITICAL: Freeze display BEFORE API call to prevent ghost earnings
      // This stops the animation loop and freezes ROI before backend processes the change
      if (onRoiChange) {
        onRoiChange();
      }

      await unassignSlot(publicKey.toString(), alienDbId);
      await loadShipData();
      if (onAlienUnassigned) {
        onAlienUnassigned();
      }
    } catch (err) {
      console.error("Failed to unassign alien:", err);
      alert("Failed to unassign alien. Please try again.");
    } finally {
      setUnassigning(false);
    }
  };

  const handleUpgradeShip = async () => {
    // Disabled for now: upgrading must be paid on-chain like ship purchase.
    alert("Ship upgrades are coming soon (paid on-chain). ");
  };

  if (!publicKey) {
    return (
      <div className="w-full relative overflow-hidden rounded-xl border border-gray-800 bg-black/60 backdrop-blur-sm h-auto lg:h-full">
        <div className="absolute inset-0 opacity-30">
          <DynamicStarfield />
        </div>
        <div className="relative z-10 h-full flex items-center justify-center p-6">
          <div className="text-center">
            <div className="text-5xl mb-4">🔒</div>
            <p className="text-gray-400">
              Connect wallet to view your spaceship
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative overflow-hidden rounded-xl border border-cyan-500/30 bg-black/60 backdrop-blur-sm h-auto lg:h-full flex flex-col min-h-0">
      <div className="absolute inset-0 opacity-30">
        <DynamicStarfield />
      </div>

      <div className="relative z-10 p-5 lg:p-6 space-y-4 lg:space-y-5 flex-1 flex flex-col">
        <div className="text-center">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Spaceship Level {ship?.level ?? 1}
          </h2>
          <p className="text-gray-400 text-lg mt-1">{slotCount} Alien Slots</p>
        </div>

        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <motion.div
            animate={{
              y: [0, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="relative w-full max-w-[420px] lg:max-w-[460px]"
          >
            <div className="relative w-full aspect-square">
              <img
                src="/images/spaceship-new.png"
                alt="Spaceship"
                className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(34,211,238,0.8)]"
              />

              <div
                className={`
                absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                grid gap-2 sm:gap-3 lg:gap-4
                ${slotCount === 2 ? "grid-cols-2" : slotCount === 4 ? "grid-cols-2" : "grid-cols-3"}
              `}
              >
                {Array.from({ length: slotCount }).map((_, index) => {
                  const slot = slots.find((s) => s.slot_index === index);
                  const alien = slot?.alien ?? null;

                  return (
                    <SpaceshipSlot
                      key={index}
                      slotIndex={index}
                      alien={alien}
                      onUnassign={handleUnassignAlien}
                      disabled={unassigning}
                    />
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-2 space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUpgradeShip}
            disabled={true}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold
                     shadow-[0_0_20px_rgba(234,179,8,0.5)] hover:shadow-[0_0_30px_rgba(234,179,8,0.7)]
                     transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ship && ship.level >= 3
              ? "Max Level"
              : "Upgrade Ship (Coming Soon)"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
