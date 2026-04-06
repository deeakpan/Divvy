import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Sans, Space_Mono, Unbounded } from "next/font/google";
import "./globals.css";
import "./app-shell.css";
import { WalletProvider } from "./components/WalletContext";

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

/** Distinct wordmark for “Divvy” in marketing header/footer */
const brandWord = Unbounded({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

/** Tab / home-screen icons: keep `app/icon.png` and `app/apple-icon.png` in sync with `public/divvy.png` when the brand asset changes. */
export const metadata: Metadata = {
  title: "Divvy: Split your tokens. Earn everywhere.",
  description: "Deposit STRK or ETH. Divvy splits it automatically across staking, USDC yield, and your cold wallet. All in one transaction on Starknet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${bricolage.variable} ${dmSans.variable} ${spaceMono.variable} ${brandWord.variable}`}
    >
      <body>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
