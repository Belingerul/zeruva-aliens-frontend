"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";
import TopBar from "./components/TopBar";
import LeftPanel from "./components/LeftPanel";
import AlienMenu from "./components/AlienMenu";
import SpinModal from "./components/SpinModal";
import SpaceshipPanel from "./components/SpaceshipPanel";
import {
  registerUser,
  clearAuthToken,
  getAuthToken,
  getAuthWallet,
  getNonce,
  setAuthToken,
  verifySignature,
} from "./api";

// Minimal base58 encoder (avoids adding new deps)
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  if (!bytes.length) return "";

  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // leading zeros
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  let out = "";
  for (let i = 0; i < zeros; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--)
    out += BASE58_ALPHABET[digits[i]];
  return out;
}

function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<"aliens" | "ship">("aliens");
  const [refreshRewards, setRefreshRewards] = useState<
    (() => Promise<void>) | null
  >(null);
  const [onRoiChange, setOnRoiChange] = useState<(() => void) | null>(null);
  const wallet = useWallet();

  useEffect(() => {
    let cancelled = false;

    async function loginAndRegister() {
      if (!wallet.connected || !wallet.publicKey) return;

      const walletAddress = wallet.publicKey.toString();

      // If token exists but belongs to a different wallet, clear it.
      const existingToken = getAuthToken();
      const existingWallet = getAuthWallet();
      if (existingToken && existingWallet && existingWallet !== walletAddress) {
        clearAuthToken();
      }

      // Ensure wallet supports signing
      if (!wallet.signMessage) {
        console.error("Wallet does not support signMessage");
        return;
      }

      // If we already have a token for this wallet, just register.
      if (getAuthToken() && getAuthWallet() === walletAddress) {
        await registerUser();
        return;
      }

      // 1) Get nonce
      const { nonce, message } = await getNonce(walletAddress);

      // 2) Sign message
      const encoded = new TextEncoder().encode(message);
      const signed = await wallet.signMessage(encoded);

      // 3) Send signature to backend (base58)
      // wallet-adapter gives Uint8Array signature
      const signature = base58Encode(signed);

      const { token } = await verifySignature(walletAddress, nonce, signature);
      setAuthToken(token, walletAddress);

      if (!cancelled) {
        await registerUser();
      }
    }

    loginAndRegister().catch((err) => {
      console.error("Auth/register failed:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [wallet.connected, wallet.publicKey, wallet.signMessage]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSpinComplete = () => {
    handleRefresh();
  };

  const handleRefreshRewardsReady = useCallback(
    (refreshFn: () => Promise<void>) => {
      setRefreshRewards(() => refreshFn);
    },
    [],
  );

  const handleRoiChangeReady = useCallback((onRoiChangeFn: () => void) => {
    setOnRoiChange(() => onRoiChangeFn);
  }, []);

  return (
    <div className="min-h-dvh lg:h-dvh flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-black">
      <TopBar />

      {/*
        Responsive layout notes:
        - Avoid hard-coding a fixed content height (100vh - X) because browser UI + mobile safe areas
          make it unreliable and it forces awkward internal scrolling.
        - Use flex-1 + min-h-0 so children can size/scroll correctly.
      */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 flex-1 min-h-0 lg:overflow-hidden">
        <LeftPanel
          onOpenSpin={() => setIsModalOpen(true)}
          onRefreshRewardsReady={handleRefreshRewardsReady}
          onRoiChangeReady={handleRoiChangeReady}
        />

        {/* Mobile: switch between Aliens / Spaceship without scrolling through the whole list */}
        <div className="lg:hidden">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => setMobileTab("aliens")}
              className={`py-2 rounded-lg font-semibold border transition-colors ${
                mobileTab === "aliens"
                  ? "bg-cyan-500 text-black border-cyan-400"
                  : "bg-black/40 text-gray-200 border-gray-700"
              }`}
            >
              Aliens
            </button>
            <button
              onClick={() => setMobileTab("ship")}
              className={`py-2 rounded-lg font-semibold border transition-colors ${
                mobileTab === "ship"
                  ? "bg-cyan-500 text-black border-cyan-400"
                  : "bg-black/40 text-gray-200 border-gray-700"
              }`}
            >
              Spaceship
            </button>
          </div>

          {mobileTab === "aliens" ? (
            <AlienMenu
              key={`aliens-m-${refreshKey}`}
              onRoiChange={onRoiChange || undefined}
              onAlienAssigned={() => {
                handleRefresh();
                if (refreshRewards) {
                  setTimeout(() => {
                    refreshRewards();
                  }, 100);
                }
              }}
            />
          ) : (
            <SpaceshipPanel
              key={`ship-m-${refreshKey}`}
              onRoiChange={onRoiChange || undefined}
              onAlienUnassigned={() => {
                handleRefresh();
                if (refreshRewards) {
                  setTimeout(() => {
                    refreshRewards();
                  }, 100);
                }
              }}
            />
          )}
        </div>

        {/* Desktop: show both side-by-side */}
        <div className="hidden lg:block flex-1 min-h-0">
          <AlienMenu
            key={`aliens-${refreshKey}`}
            onRoiChange={onRoiChange || undefined}
            onAlienAssigned={() => {
              handleRefresh();
              if (refreshRewards) {
                setTimeout(() => {
                  refreshRewards();
                }, 100);
              }
            }}
          />
        </div>

        <div className="hidden lg:block min-h-0 basis-[34%] shrink-0">
          <SpaceshipPanel
            key={`ship-${refreshKey}`}
            onRoiChange={onRoiChange || undefined}
            onAlienUnassigned={() => {
              handleRefresh();
              if (refreshRewards) {
                setTimeout(() => {
                  refreshRewards();
                }, 100);
              }
            }}
          />
        </div>
      </div>

      {isModalOpen && (
        <SpinModal
          onClose={() => setIsModalOpen(false)}
          onSpinComplete={handleSpinComplete}
        />
      )}
    </div>
  );
}

function App() {
  const endpoint = process.env.VITE_RPC_URL || "https://api.devnet.solana.com";
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
