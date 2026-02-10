"use client";

import dynamic from "next/dynamic";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export default function TopBar() {
  return (
    <div className="w-full px-4 md:px-6 py-2 bg-black/40 border-b border-gray-800 flex items-center justify-between gap-3">
      <WalletMultiButtonDynamic className="!bg-cyan-500 !text-black !rounded-lg !px-4 !py-1.5 !font-semibold hover:!bg-cyan-600 !transition-colors" />

      <h1 className="flex-1 text-center text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent leading-none pl-3 sm:pl-6">
        Zeruva Aliens
      </h1>

      <div className="w-[120px]" />
    </div>
  );
}
