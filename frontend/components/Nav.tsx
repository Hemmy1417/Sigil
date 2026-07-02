"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet, shortAddr } from "@/lib/genlayer/wallet";
import { SigilWordmark } from "./Seal";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/deals", label: "Deals" },
  { href: "/new", label: "Draft a deal" },
  { href: "/verify", label: "Verify a seal" },
  { href: "/registry", label: "Registry" },
];

export default function Nav() {
  const { address, wallets, hasWallet, connecting, connect, disconnect } = useWallet();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
    setPickerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  async function handleConnect(w?: (typeof wallets)[number]) {
    setError("");
    try {
      await connect(w);
      setPickerOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect");
    }
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line-soft)",
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <SigilWordmark />
        </Link>

        <nav className="desktop-only" style={{ alignItems: "center", gap: 22 }}>
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={`nav-link${pathname === href ? " active" : ""}`}
              style={{ whiteSpace: "nowrap" }}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop wallet area */}
        <div className="desktop-only" style={{ position: "relative", alignItems: "center" }}>
          {!address ? (
            <button
              className="btn-primary"
              style={{ padding: "9px 18px", fontSize: 14, whiteSpace: "nowrap" }}
              disabled={connecting}
              onClick={() => (wallets.length > 1 ? setPickerOpen((o) => !o) : handleConnect())}
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          ) : (
            <button className="btn-quiet mono" onClick={() => setMenuOpen((o) => !o)}>
              {shortAddr(address)}
            </button>
          )}

          {pickerOpen && wallets.length > 1 && (
            <div
              className="sheet"
              style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 220, padding: 8, zIndex: 50 }}
            >
              {wallets.map((w) => (
                <button
                  key={w.info.uuid}
                  onClick={() => handleConnect(w)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 12px", background: "transparent", border: "none",
                    borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500,
                    color: "var(--ink)", textAlign: "left",
                  }}
                >
                  {w.info.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.info.icon} alt="" width={20} height={20} />
                  )}
                  {w.info.name}
                </button>
              ))}
            </div>
          )}

          {menuOpen && address && (
            <div
              className="sheet"
              style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 180, padding: 8, zIndex: 50 }}
            >
              <Link
                href={`/u/${address}`}
                onClick={() => setMenuOpen(false)}
                style={{ display: "block", padding: "10px 12px", fontSize: 14, color: "var(--ink)", textDecoration: "none" }}
              >
                Your record
              </Link>
              <button
                onClick={() => { disconnect(); setMenuOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                  background: "transparent", border: "none", color: "var(--red)",
                  fontSize: 14, cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Menu"
          className="mobile-only"
          style={{
            background: "transparent", border: "none", cursor: "pointer", padding: 8,
            flexDirection: "column", gap: 5,
          }}
        >
          <span style={{ width: 22, height: 2, background: "var(--ink)", transition: "transform 0.2s", transform: mobileOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
          <span style={{ width: 22, height: 2, background: "var(--ink)", transition: "opacity 0.2s", opacity: mobileOpen ? 0 : 1 }} />
          <span style={{ width: 22, height: 2, background: "var(--ink)", transition: "transform 0.2s", transform: mobileOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
        </button>
      </div>

      {error && (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "6px 24px", fontSize: 13, color: "var(--red)" }}>
          {error}
        </div>
      )}

      {/* Mobile drawer — portal escapes the header stacking context */}
      {mobileOpen && typeof document !== "undefined" && createPortal(
        <div
          className="mobile-only"
          style={{
            position: "fixed", top: 64, left: 0, right: 0, bottom: 0,
            background: "var(--paper)", zIndex: 9999, overflowY: "auto",
            flexDirection: "column", padding: 24, gap: 4,
          }}
        >
          {LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              style={{ fontSize: 18, padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}
            >
              {label}
            </Link>
          ))}
          {address ? (
            <>
              <Link href={`/u/${address}`} className="nav-link" style={{ fontSize: 18, padding: "14px 0", borderBottom: "1px solid var(--line-soft)" }}>
                Your record
              </Link>
              <button
                onClick={() => { disconnect(); setMobileOpen(false); }}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--red)", fontSize: 18, fontWeight: 500, textAlign: "left",
                  padding: "14px 0",
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              disabled={connecting || !hasWallet}
              onClick={() => handleConnect()}
            >
              {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "No wallet detected"}
            </button>
          )}
        </div>,
        document.body,
      )}
    </header>
  );
}
