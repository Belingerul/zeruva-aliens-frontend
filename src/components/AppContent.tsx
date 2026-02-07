"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import TopBar from "./TopBar";
import LeftPanel from "./LeftPanel";
import RoomView from "./RoomView";
import SpinModal from "./SpinModal";

export default function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const wallet = useWallet();

  const handleOpenSpin = () => {
    if (!wallet.connected || !wallet.publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <TopBar />

      <div className="flex-1 flex flex-col md:flex-row gap-4 px-4 pb-4 max-w-7xl mx-auto w-full">
        <LeftPanel onOpenSpin={handleOpenSpin} />
        <RoomView />
      </div>

      {isModalOpen && <SpinModal onClose={() => setIsModalOpen(false)} />}
    </div>
  );
}
