"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRegistry, getStats } from "@/lib/contracts/sigil";
import { CONTRACT_CONFIGURED, CONTRACT_ADDRESS } from "@/lib/config";
import { shortAddr } from "@/lib/genlayer/wallet";
import type { RegistryRow, Stats, DealState } from "@/lib/contracts/types";

const STATE_TAG: Record<DealState, string> = {
  OPEN: "tag-open", ACTIVE: "tag-active", SETTLED: "tag-settled",
  DISPUTED: "tag-disputed", RESOLVED: "tag-resolved", CANCELLED: "tag-cancelled",
};

export default function RegistryPage() {
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!CONTRACT_CONFIGURED) return;
    Promise.allSettled([getRegistry(100), getStats()]).then(([r, s]) => {
      if (r.status === "fulfilled") setRows(r.value);
      if (s.status === "fulfilled" && s.value) setStats(s.value);
      setLoaded(true);
    });
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px" }}>
      <div className="small-text" style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
        The public record
      </div>
      <h1 className="section-heading" style={{ marginBottom: 8 }}>Registry</h1>
      <p className="body-text" style={{ marginBottom: 12, maxWidth: 560 }}>
        Every deal ever sealed — as fingerprint, parties, and state. This is everything
        the chain knows. Terms appear nowhere unless a seal was broken by dispute.
      </p>
      <p className="caption" style={{ marginBottom: 40 }}>
        Contract{" "}
        <a
          href={`https://studio.genlayer.com/?import-contract=${CONTRACT_ADDRESS}`}
          target="_blank" rel="noreferrer"
          className="mono"
          style={{ color: "var(--purple-dark)" }}
        >
          {shortAddr(CONTRACT_ADDRESS)}
        </a>{" "}
        on GenLayer Studionet — open it and read the state yourself.
      </p>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 40 }}>
          {[
            { label: "Deals sealed", value: stats.total_deals },
            { label: "Settled in private", value: stats.total_settled },
            { label: "Seals broken", value: stats.total_disputes },
          ].map(({ label, value }) => (
            <div key={label} className="sheet-inset" style={{ padding: 16 }}>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
              <div className="caption">{label}</div>
            </div>
          ))}
        </div>
      )}

      {!loaded && <p className="body-text">Reading the chain…</p>}
      {loaded && rows.length === 0 && (
        <div className="sheet" style={{ padding: 48, textAlign: "center" }}>
          <p className="body-med" style={{ marginBottom: 8 }}>The record is empty.</p>
          <Link href="/new" className="btn-primary">Seal the first deal</Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <Link key={r.deal_id} href={`/deal/${r.deal_id}`} className="sheet" style={{ padding: "16px 20px", textDecoration: "none", display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="body-med">{r.label}</span>
                <span className="tag">{r.template}</span>
                <span className={`tag ${STATE_TAG[r.state]}`}>{r.state.toLowerCase()}</span>
                {r.revealed && <span className="tag tag-disputed">terms revealed</span>}
              </div>
              <span className="caption mono">{r.deal_id}</span>
            </div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-faint)", wordBreak: "break-all", marginBottom: 6 }}>
              {r.terms_hash}
            </div>
            <div className="caption">
              <span className="mono">{shortAddr(r.proposer)}</span>
              {" ⇄ "}
              <span className="mono">{shortAddr(r.counterparty)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
