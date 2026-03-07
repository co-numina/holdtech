import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "HoldTech — Solana Token Holderbase Quality Analysis",
  description: "Analyze any Solana token's holderbase. Wallet age, activity scoring, bundle detection, cabal pattern analysis, and AI-powered quality verdict.",
  openGraph: {
    title: "HoldTech — See Through the Holderbase",
    description: "Paste any Solana token address. Get wallet age, sybil detection, cabal scoring, and a plain-English quality verdict.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className={inter.className}>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
