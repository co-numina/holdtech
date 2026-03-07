"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect, useCallback } from "react";

export interface TierInfo {
  wallet: string;
  balance: number;
  tier: "FREE" | "SCOUT" | "OPERATOR" | "WHALE";
  nextTier: { name: string; min: number } | null;
  needed: number;
}

export function useTier() {
  const { publicKey, connected } = useWallet();
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const checkTier = useCallback(async () => {
    if (!publicKey) {
      setTierInfo(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/check-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      if (res.ok) {
        setTierInfo(await res.json());
      }
    } catch {}
    setLoading(false);
  }, [publicKey]);

  useEffect(() => {
    if (connected && publicKey) {
      checkTier();
    } else {
      setTierInfo(null);
    }
  }, [connected, publicKey, checkTier]);

  return { tierInfo, loading, checkTier, connected };
}
