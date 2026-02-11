"use client";

export default function ConfirmLoadingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-black via-gray-950 to-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-black/60 backdrop-blur p-6">
        <div className="text-xl font-bold mb-2">Preparing confirmation…</div>
        <div className="text-sm text-gray-400">
          Loading your quote and building the transaction.
        </div>
        <div className="mt-6 h-2 w-full bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-gradient-to-r from-cyan-500 to-purple-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
