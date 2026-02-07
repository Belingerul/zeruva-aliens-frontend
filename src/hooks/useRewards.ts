"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiRequest, AUTH_CHANGED_EVENT, getAuthToken } from "../api";

interface RewardsState {
  isLoading: boolean;
  error: string | null;
  livePoints: number; // calculated from time only - high precision for smooth display
  totalRoiPerDay: number; // dollars per day from active aliens
  totalClaimedPoints: number; // total points claimed so far (authoritative from backend)
  pendingEarnings: number; // pending earnings from backend (authoritative)
  lastClaimAt: Date | null;
  refresh: () => Promise<void>;
  getCalculatedValue: () => number; // Get current calculated value for claim validation
  resetAfterClaim: () => void; // immediately reset lastClaimAt to current time
  onRoiChange: () => void; // Optimistic update when ROI changes (assign/unassign)
}

export function useRewards(walletAddress: string | null): RewardsState {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalRoiPerDay, setTotalRoiPerDay] = useState(0);
  const [totalClaimedPoints, setTotalClaimedPoints] = useState(0); // Total points claimed (authoritative from backend)
  const [pendingEarnings, setPendingEarnings] = useState(0); // Pending earnings from backend (authoritative)
  const [displayPendingEarnings, setDisplayPendingEarnings] = useState(0); // Display-only pending (may be adjusted)
  const [lastClaimAt, setLastClaimAt] = useState<Date | null>(null); // Display timestamp (may be adjusted for visual continuity)
  const [serverLastClaimAt, setServerLastClaimAt] = useState<Date | null>(null); // Authoritative server timestamp (for claim validation)

  // High-precision live counter using requestAnimationFrame for smooth updates
  const [livePoints, setLivePoints] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false); // State to track refresh (triggers useEffect)
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(performance.now());
  const currentLivePointsRef = useRef<number>(0); // Track current display value for freezing
  const refreshTimeoutRef = useRef<number | null>(null);
  const refreshRequestIdRef = useRef<number>(0);
  const roiChangeDebounceRef = useRef<number | null>(null);
  const pendingAdjustmentRef = useRef<number>(0);
  const serverLastClaimAtRef = useRef<Date | null>(null);
  const activationInfoRef = useRef<{
    activatedAtMs: number;
    serverLastClaimAt: Date | null;
    roi: number;
  } | null>(null);

  // Track ROI to detect changes
  const lastRoiPerDayRef = useRef<number>(0);

  // Flag to prevent animation loop from running during refresh (prevents ghost earnings)
  // When true, calculateLivePoints will NOT add new earnings
  // Using both ref (for immediate checks) and state (for useEffect reactivity)
  const isRefreshingRef = useRef<boolean>(false);

  // Calculate current live points with high precision (LOCAL ONLY - visual display)
  // CRITICAL: Backend's pending_earnings is authoritative
  // We start with backend's pending_earnings and add new earnings accumulated since last_claim_at
  const calculateLivePoints = useCallback((): number => {
    // Always start with backend's authoritative pending_earnings
    // Backend has already stored all earnings accumulated before ROI changes
    let basePending = displayPendingEarnings;

    // CRITICAL: If we're refreshing, don't add new earnings (prevent ghost earnings)
    // This flag is set by onRoiChange() BEFORE the API call completes
    // It prevents calculateLivePoints from using stale ROI values
    if (isRefreshingRef.current) {
      return Number(basePending.toFixed(6));
    }

    // Add new earnings accumulated since last_claim_at
    // Use server's timestamp to avoid client/server time discrepancies
    const timestampToUse = serverLastClaimAt || lastClaimAt;

    // Only add earnings if ROI > 0 AND we're not refreshing
    if (timestampToUse && totalRoiPerDay > 0) {
      const now = Date.now();
      const timestampTime = timestampToUse.getTime();
      const elapsedMs = now - timestampTime;

      if (elapsedMs > 0) {
        const elapsedSeconds = elapsedMs / 1000;
        const earningsPerSecond = totalRoiPerDay / 86400;
        const newEarnings = elapsedSeconds * earningsPerSecond;
        basePending += newEarnings;
      }
    }
    // If ROI is 0, basePending stays as pending_earnings (no new earnings)

    // Round to 6 decimal places for display precision
    // This matches backend's NUMERIC(30, 10) precision
    return Number(basePending.toFixed(6));
  }, [displayPendingEarnings, lastClaimAt, serverLastClaimAt, totalRoiPerDay]);

  // Calculate CLAIMABLE earnings for claim validation
  // CRITICAL: This must match what the backend will calculate EXACTLY.
  // Backend compares against: pending_earnings + (now - last_claim_at) * (currentROI / 86400)
  // (NOT total_claimed_points)
  const calculateClaimable = useCallback((): number => {
    const authoritativeLastClaimAt = serverLastClaimAt || lastClaimAt;

    if (!authoritativeLastClaimAt) {
      return Number(pendingEarnings.toFixed(6));
    }

    const now = Date.now();
    const lastClaimTime = authoritativeLastClaimAt.getTime();
    const elapsedMs = now - lastClaimTime;

    let totalPending = pendingEarnings;

    if (elapsedMs > 0 && totalRoiPerDay > 0) {
      const elapsedSeconds = elapsedMs / 1000;
      const earningsPerSecond = totalRoiPerDay / 86400;
      const newEarnings = elapsedSeconds * earningsPerSecond;
      totalPending += newEarnings;
    }

    return Number(totalPending.toFixed(6));
  }, [pendingEarnings, totalRoiPerDay, serverLastClaimAt, lastClaimAt]);

  // Get current calculated CLAIMABLE earnings for backend validation
  const getCalculatedValue = useCallback((): number => {
    return calculateClaimable();
  }, [calculateClaimable]);

  // Smooth animation loop using requestAnimationFrame
  // Updates every frame for smooth visual increment
  const updateLivePoints = useCallback(() => {
    // CRITICAL: Stop immediately if we're refreshing (prevents ghost earnings)
    // This check must happen FIRST, before any calculations
    if (isRefreshingRef.current || isRefreshing) {
      animationFrameRef.current = null;
      return;
    }

    // CRITICAL: Also check if ROI is 0 - no earnings to calculate
    if (totalRoiPerDay === 0) {
      animationFrameRef.current = null;
      return;
    }

    const newPoints = calculateLivePoints();
    setLivePoints(newPoints);
    currentLivePointsRef.current = newPoints; // Track current value for freezing
    lastUpdateTimeRef.current = performance.now();

    // Always schedule next frame if conditions are met
    // This ensures the loop continues running
    if (!isRefreshingRef.current && !isRefreshing && totalRoiPerDay > 0) {
      animationFrameRef.current = requestAnimationFrame(updateLivePoints);
    } else {
      animationFrameRef.current = null;
    }
  }, [calculateLivePoints, isRefreshing, totalRoiPerDay]);

  // Call /api/rewards to fetch authoritative state from backend
  // This function should ONLY be called:
  // 1. Once on initial wallet connect/change (automatic)
  // 2. After claim action (user-initiated)
  // 3. After assign/unassign (to sync with backend)
  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    const requestId = ++refreshRequestIdRef.current;

    setIsLoading(true);
    setError(null);
    isRefreshingRef.current = true; // Prevent animation loop during refresh (immediate check)
    setIsRefreshing(true); // Trigger useEffect to stop animation loop

    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    try {
      const data = await apiRequest<any>(`/rewards/${walletAddress}`);

      // Ignore stale responses from older refresh calls
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }

      // Store authoritative values from backend
      // These are the ONLY source of truth
      const parsedRoiPerDay = Number(
        data.total_roi_per_day ?? data.total_per_day ?? 0,
      );
      const parsedTotalClaimed = Number(
        data.total_claimed_points ?? data.total_claimed ?? 0,
      );
      const parsedPending = Number(data.pending_earnings ?? 0);

      const newRoiPerDay = Number.isFinite(parsedRoiPerDay)
        ? parsedRoiPerDay
        : 0;
      const newTotalClaimedPoints = Number.isFinite(parsedTotalClaimed)
        ? parsedTotalClaimed
        : 0;
      const newPendingEarnings = Number.isFinite(parsedPending)
        ? parsedPending
        : 0; // Pending earnings from backend (AUTHORITATIVE)
      const newServerLastClaimAt = data.last_claim_at
        ? new Date(data.last_claim_at)
        : null;

      // If backend doesn't return last_claim_at but ROI is active, initialize a local timestamp
      // This prevents the animation loop from stalling after ROI changes from 0 -> >0
      const wasRoiZero = lastRoiPerDayRef.current === 0;
      const shouldResetDisplayTimestamp =
        newRoiPerDay > 0 && !newServerLastClaimAt;
      const normalizedLastClaimAt = shouldResetDisplayTimestamp
        ? new Date()
        : newServerLastClaimAt;

      // Detect ROI 0 -> >0 ONLY when server last_claim_at is missing
      // This is a backend gap scenario; track activation to prevent ghost earnings on ROI drop
      if (wasRoiZero && newRoiPerDay > 0 && !newServerLastClaimAt) {
        activationInfoRef.current = {
          activatedAtMs: Date.now(),
          serverLastClaimAt: serverLastClaimAtRef.current ?? null,
          roi: newRoiPerDay,
        };
      } else if (newServerLastClaimAt) {
        activationInfoRef.current = null;
      }

      // If ROI just dropped to 0 after being active, compensate any ghost time gap
      if (!wasRoiZero && newRoiPerDay === 0 && activationInfoRef.current) {
        const {
          activatedAtMs,
          serverLastClaimAt: activationServerLastClaimAt,
          roi,
        } = activationInfoRef.current;
        if (activationServerLastClaimAt) {
          const gapMs = activatedAtMs - activationServerLastClaimAt.getTime();
          if (gapMs > 0) {
            const gapSeconds = gapMs / 1000;
            const ghost = gapSeconds * (roi / 86400);
            pendingAdjustmentRef.current += ghost;
          }
        }
        activationInfoRef.current = null;
      }

      // CRITICAL: Backend's pending_earnings is ALWAYS authoritative
      // Only apply a local display adjustment when server last_claim_at is missing
      // (prevents ghost earnings in backend gap scenarios)
      let adjustedPendingEarnings = newPendingEarnings;
      if (pendingAdjustmentRef.current > 0) {
        adjustedPendingEarnings = Math.max(
          0,
          newPendingEarnings - pendingAdjustmentRef.current,
        );
      }
      pendingAdjustmentRef.current = 0;

      // Update state FIRST (before setting display)
      setTotalRoiPerDay(newRoiPerDay);
      setTotalClaimedPoints(newTotalClaimedPoints);
      setPendingEarnings(newPendingEarnings);
      setDisplayPendingEarnings(adjustedPendingEarnings);
      setServerLastClaimAt(newServerLastClaimAt);
      setLastClaimAt(normalizedLastClaimAt);
      serverLastClaimAtRef.current = newServerLastClaimAt;

      // Update display IMMEDIATELY with backend's authoritative value
      // This prevents delays and ghost earnings
      setLivePoints(adjustedPendingEarnings);
      currentLivePointsRef.current = adjustedPendingEarnings; // Update ref

      // Update last ROI to detect next change
      lastRoiPerDayRef.current = newRoiPerDay;

      // CRITICAL: Clear refresh flags - useEffect will restart animation loop
      // Clear immediately so useEffect can trigger
      isRefreshingRef.current = false;
      setIsRefreshing(false); // This will trigger useEffect to restart animation loop

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      // Use requestAnimationFrame to ensure state updates are flushed
      // This gives useEffect a chance to run and restart the loop
      requestAnimationFrame(() => {
        // Double-check and explicitly restart if useEffect didn't
        if (
          newRoiPerDay > 0 &&
          normalizedLastClaimAt &&
          walletAddress &&
          animationFrameRef.current === null
        ) {
          console.log(
            "[useRewards] Fallback: Explicitly restarting animation loop after refresh",
            {
              newRoiPerDay,
              serverLastClaimAt: normalizedLastClaimAt,
              walletAddress,
            },
          );
          animationFrameRef.current = requestAnimationFrame(updateLivePoints);
        }
      });
    } catch (e: any) {
      console.error("useRewards error", e);
      // Ignore stale errors from older refresh calls
      if (requestId !== refreshRequestIdRef.current) {
        return;
      }
      setError(e.message || "Failed to load rewards");
      // Clear refresh flag on error too
      isRefreshingRef.current = false;
      setIsRefreshing(false); // Allow animation loop to restart

      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    } finally {
      if (requestId === refreshRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [walletAddress, updateLivePoints]);

  // Immediately reset after claim - will be updated by server response
  const resetAfterClaim = useCallback(() => {
    // Optimistic update - actual values come from server
    const now = new Date();
    setLastClaimAt(now);
    setServerLastClaimAt(now); // Also update server timestamp for claim calculation
    serverLastClaimAtRef.current = now;
    setLivePoints(0); // Reset display to 0 immediately
    currentLivePointsRef.current = 0; // Update ref
    setPendingEarnings(0); // Clear pending earnings optimistically
    setDisplayPendingEarnings(0);
    pendingAdjustmentRef.current = 0;
    activationInfoRef.current = null;
  }, []);

  // Optimistic update when ROI changes (assign/unassign)
  // This prevents delay and ghost earnings by immediately freezing display
  // CRITICAL: Called BEFORE the API call (assignSlot/unassignSlot) to prevent ghost earnings
  const onRoiChange = useCallback(() => {
    // Freeze display immediately to prevent ghost earnings while ROI changes.
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setLivePoints(displayPendingEarnings);
    currentLivePointsRef.current = displayPendingEarnings;

    // Debounce a refresh so rapid assign/unassign (multiple clicks) doesn't desync ROI.
    // This makes the UI smooth even when you assign 2 aliens quickly.
    if (roiChangeDebounceRef.current !== null) {
      window.clearTimeout(roiChangeDebounceRef.current);
      roiChangeDebounceRef.current = null;
    }

    roiChangeDebounceRef.current = window.setTimeout(() => {
      roiChangeDebounceRef.current = null;
      // Refresh pulls authoritative ROI/pending/last_claim_at and restarts the live counter.
      refresh().catch(() => {});
    }, 250);

    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    // Safety net: if refresh never comes back, unfreeze after 8s
    refreshTimeoutRef.current = window.setTimeout(() => {
      if (isRefreshingRef.current) {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
      refreshTimeoutRef.current = null;
    }, 8000);
  }, [displayPendingEarnings, refresh]);

  // Start/stop animation loop based on whether we have valid data
  useEffect(() => {
    // CRITICAL: Always check refresh flag FIRST - if refreshing, do nothing
    // This prevents the animation loop from starting during refresh
    // Use both ref (for immediate checks) and state (for useEffect reactivity)
    if (isRefreshingRef.current || isRefreshing) {
      // Stop animation loop if it's running
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // If ROI is 0, stop earnings calculation and just show backend pending
    if (totalRoiPerDay === 0) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setLivePoints(displayPendingEarnings);
      currentLivePointsRef.current = displayPendingEarnings;
      return;
    }

    if (!lastClaimAt && totalRoiPerDay > 0 && walletAddress) {
      // Fallback: ensure we have a display timestamp so the live counter can run
      // This does NOT affect claim validation (serverLastClaimAt remains authoritative)
      setLastClaimAt(new Date());
      return;
    }

    if (lastClaimAt && totalRoiPerDay > 0 && walletAddress) {
      // Start animation loop only if not already running
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(updateLivePoints);
      }
    } else {
      // Stop animation loop when no wallet or no lastClaimAt
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    lastClaimAt,
    totalRoiPerDay,
    walletAddress,
    displayPendingEarnings,
    updateLivePoints,
    isRefreshing,
  ]);

  // Watchdog: if the rAF loop stops for any reason (tab throttle, React remount, etc.)
  // restart it so earnings keep moving visually.
  useEffect(() => {
    if (!walletAddress) return;
    if (isRefreshingRef.current || isRefreshing) return;
    if (totalRoiPerDay <= 0) return;
    if (!lastClaimAt) return;

    const id = window.setInterval(() => {
      if (isRefreshingRef.current || isRefreshing) return;
      if (totalRoiPerDay <= 0) return;
      if (!walletAddress) return;
      if (!lastClaimAt) return;

      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(updateLivePoints);
      }
    }, 1500);

    return () => window.clearInterval(id);
  }, [
    walletAddress,
    isRefreshing,
    totalRoiPerDay,
    lastClaimAt,
    updateLivePoints,
  ]);

  // Initial load ONCE per session - only when wallet connects or changes
  // This is the ONLY automatic call to /api/rewards
  // DO NOT call refresh() from anywhere else automatically
  useEffect(() => {
    // Don’t call protected endpoints until we have an auth token.
    // Otherwise the UI spams 401 "Missing Bearer token" before the user signs.
    const token = walletAddress ? getAuthToken() : null;

    if (walletAddress && token) {
      refresh();
    } else {
      // Reset state when wallet disconnects
      setTotalRoiPerDay(0);
      setTotalClaimedPoints(0);
      setLastClaimAt(null);
      setServerLastClaimAt(null);
      serverLastClaimAtRef.current = null;
      setError(null);
      setPendingEarnings(0);
      setDisplayPendingEarnings(0);
      pendingAdjustmentRef.current = 0;
      activationInfoRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]); // Intentionally exclude refresh from deps to prevent re-calls

  // When auth token is created after the wallet connects (user signs message),
  // refresh rewards immediately so the live counter starts.
  useEffect(() => {
    if (!walletAddress) return;

    const handler = () => {
      const token = getAuthToken();
      if (token) refresh();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, handler);
  }, [walletAddress, refresh]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      if (roiChangeDebounceRef.current !== null) {
        window.clearTimeout(roiChangeDebounceRef.current);
        roiChangeDebounceRef.current = null;
      }
    };
  }, []);

  return {
    isLoading,
    error,
    livePoints,
    totalRoiPerDay,
    totalClaimedPoints,
    pendingEarnings,
    lastClaimAt,
    refresh,
    getCalculatedValue,
    resetAfterClaim,
    onRoiChange,
  };
}
