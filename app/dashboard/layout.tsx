"use client";
import { WalletProviders } from "../providers";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
