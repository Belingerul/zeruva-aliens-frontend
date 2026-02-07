import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getShip, getAliens, upgradeShip, type AlienWithStats } from "../api";

export function useSpaceship() {
  const { publicKey } = useWallet();
  const [shipLevel, setShipLevel] = useState(1);
  const [aliens, setAliens] = useState<AlienWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const wallet = publicKey?.toBase58() || "";

  const fetchData = async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [shipData, aliensData] = await Promise.all([
        getShip(wallet),
        getAliens(wallet),
      ]);

      setShipLevel(shipData.level);
      setAliens(aliensData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error("Failed to fetch spaceship data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [wallet]);

  const handleUpgradeShip = async () => {
    if (!wallet) return;
    try {
      await upgradeShip(wallet, shipLevel + 1);
      await fetchData();
    } catch (err: any) {
      console.error("Failed to upgrade ship:", err);
      alert("Failed to upgrade ship");
    }
  };

  return {
    shipLevel,
    aliens,
    loading,
    error,
    handleUpgradeShip,
    refetch: fetchData,
  };
}
