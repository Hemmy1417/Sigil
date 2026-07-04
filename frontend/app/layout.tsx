import type { Metadata } from "next";
import { IBM_Plex_Sans, Lora } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/genlayer/wallet";
import Nav from "@/components/Nav";
import { SealMark } from "@/components/Seal";
import { LiveBackdrop } from "@/components/LiveBackdrop";

const plex = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  subsets: ["latin"],
});

const lora = Lora({
  weight: ["400", "500", "600"],
  variable: "--font-lora",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://sigil-alpha.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "SIGIL — Private agreements, sealed on-chain",
  description:
    "Seal a private deal with anyone. Terms stay confidential; only a cryptographic seal goes on-chain. If someone breaks their word, an AI arbiter rules.",
  openGraph: {
    title: "SIGIL — Private agreements, sealed on-chain",
    description:
      "Terms stay confidential; only a cryptographic seal goes on-chain. Disputes are ruled by an AI validator panel on GenLayer.",
    url: SITE_URL,
    siteName: "Sigil",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SIGIL — Private agreements, sealed on-chain",
    description: "Terms stay confidential; only a cryptographic seal goes on-chain.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${lora.variable}`}>
      <body className="min-h-screen flex flex-col">
        <LiveBackdrop />
        <WalletProvider>
          <Nav />
          <main style={{ flex: 1 }}>{children}</main>
          <footer style={{ borderTop: "1px solid var(--line-soft)", marginTop: 64 }}>
            <div
              style={{
                maxWidth: 1120, margin: "0 auto", padding: "32px 24px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: 12,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <SealMark size={18} />
                <span className="caption">Sigil — what two people seal stays between them.</span>
              </span>
              <span className="caption">Arbitrated by GenLayer validators</span>
            </div>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
