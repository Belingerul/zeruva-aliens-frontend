"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useRewards } from "../hooks/useRewards";
import { apiRequest } from "../api";
import {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";

interface RewardsCardProps {
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
  onRoiChangeReady?: (onRoiChangeFn: () => void) => void;
}

const RewardsCard = forwardRef<
  { refresh: () => Promise<void> } | undefined,
  RewardsCardProps
>(({ onRefreshReady, onRoiChangeReady }, ref) => {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? null;

  const {
    isLoading,
    error,
    livePoints,
    totalRoiPerDay,
    getCalculatedValue,
    refresh,
    resetAfterClaim,
    onRoiChange,
  } = useRewards(walletAddress);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const onRefreshReadyRef = useRef(onRefreshReady);
  const lastRegisteredRefreshRef = useRef<(() => Promise<void>) | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    onRefreshReadyRef.current = onRefreshReady;
  }, [onRefreshReady]);

  // Expose refresh function to parent via callback
  // Only register when refresh function reference actually changes (prevents infinite loops)
  useEffect(() => {
    if (
      refresh &&
      refresh !== lastRegisteredRefreshRef.current &&
      onRefreshReadyRef.current
    ) {
      lastRegisteredRefreshRef.current = refresh;
      onRefreshReadyRef.current(refresh);
    }
  }, [refresh]);

  // Expose onRoiChange function to parent
  useEffect(() => {
    if (onRoiChange && onRoiChangeReady) {
      onRoiChangeReady(onRoiChange);
    }
  }, [onRoiChange, onRoiChangeReady]);

  useImperativeHandle(ref, () => ({
    refresh,
  }));

  const perSecond = totalRoiPerDay > 0 ? totalRoiPerDay / 86400 : 0; // $/sec from $/day

  async function handleClaim() {
    if (!walletAddress) {
      alert("Connect your wallet to claim.");
      return;
    }
    setIsClaiming(true);
    setClaimError(null);

    try {
      // Calculate current value client-side
      // Backend will independently verify this value for anti-cheat protection
      const calculatedValue = getCalculatedValue();

      // Send claim request with calculated value for backend validation
      // Backend must:
      // 1. Independently calculate expected value using lastClaimTimestamp, totalClaimedPoints, and dailyROI
      // 2. Compare with client's calculatedValue within tolerance (e.g., ±0.01)
      // 3. Reject if mismatch (potential cheating)
      // 4. On success: update totalClaimedPoints and lastClaimTimestamp
      await apiRequest(`/claim-rewards`, {
        method: "POST",
        body: JSON.stringify({
          expected_earnings: calculatedValue,
        }),
      });

      // After successful claim, call /api/rewards ONCE to get updated state
      // This is the second allowed call (after initial load)
      // Backend response contains authoritative values which refresh() will fetch
      await refresh();
    } catch (e: any) {
      console.error("Claim error", e);
      setClaimError(e.message || "Claim failed");
      // On error, call /api/rewards to sync with server state
      await refresh();
    } finally {
      setIsClaiming(false);
    }
  }

  return (
    <div className="w-full rounded-xl p-5 bg-black/60 border border-gray-800 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {/* Circle with live earnings */}
        <div className="w-28 h-28 rounded-full border border-cyan-500/60 flex flex-col items-center justify-center bg-black/60 shrink-0">
          <div className="text-lg text-gray-200 font-semibold relative -top-2">
            Earnings
          </div>
          {/* High-precision display: show 4 decimal places for smooth visual updates */}
          <div className="text-[20px] leading-none font-bold text-white relative -top-1">
            ${(livePoints ?? 0).toFixed(4)}
          </div>
        </div>

        <div className="flex flex-col text-gray-300 gap-1 min-w-0">
          <div className="text-xl font-bold text-gray-100 leading-none">
            Passive Income
          </div>
          <div className="text-lg">
            <span className="text-gray-400">ROI:</span>{" "}
            <span className="text-cyan-300 font-semibold">
              {(totalRoiPerDay ?? 0).toFixed(2)} $ / day
            </span>
          </div>
          {isLoading && (
            <div className="text-[10px] text-gray-500">Updating...</div>
          )}
          {error && <div className="text-[10px] text-red-400">{error}</div>}
          {claimError && (
            <div className="text-[10px] text-red-400">{claimError}</div>
          )}
        </div>
      </div>

      {/* Claim Button – keep style consistent with rest of app */}
      <button
        onClick={handleClaim}
        disabled={!walletAddress || isClaiming}
        className="mt-1 w-full py-3.5 rounded-lg bg-cyan-600 text-white text-base font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-700"
      >
        {isClaiming
          ? "Claiming..."
          : !walletAddress
            ? "Connect Wallet to Claim"
            : "Claim Earnings"}
      </button>
    </div>
  );
});

RewardsCard.displayName = "RewardsCard";

export default RewardsCard;
