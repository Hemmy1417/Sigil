"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet, shortAddr } from "@/lib/genlayer/wallet";
import { getDealsFor, formatGen } from "@/lib/contracts/sigil";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import type { Deal, DealState } from "@/lib/contracts/types";

const STATE_TAG: Record<DealState, string> = {
  OPEN: "tag-open", ACTIVE: "tag-active", SETTLED: "tag-settled",
  DISPUTED: "tag-disputed", RESOLVED: "tag-resolved", CANCELLED: "tag-cancelled",
};

function DealCard({ deal, me }: { deal: Deal; me: string }) {
  const iAmProposer = deal.proposer.toLowerCase() === me.toLowerCase();
  const other = iAmProposer ? deal.counterparty : deal.proposer;
  const pot = BigInt(deal.proposer_stake) + BigInt(deal.counter_stake);

  return (
    <Link href={`/deal/${deal.deal_id}`} className="sheet" style={{ padding: 20, textDecoration: "none", display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div className="body-med">{deal.label}</div>
        <span className={`tag ${STATE_TAG[deal.state]}`}>{deal.state.toLowerCase()}</span>
      </div>
      <div className="caption" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span>with <span className="mono">{shortAddr(other)}</span></span>
        <span>·</span>
        <span>{formatGen(pot)} GEN in escrow</span>
        <span>·</span>
        <span>{deal.template}</span>
        <span>·</span>
        <span>{iAmProposer ? "you proposed" : "proposed to you"}</span>
      </div>
    </Link>
  );
}

export default function DealsPage() {
  const { address, hasWallet, connect, connecting } = useWallet();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!address || !CONTRACT_CONFIGURED) return;
    setLoading(true);
    try {
      setDeals(await getDealsFor(address));
    } catch {
      setError("Could not reach the chain — retry in a moment.");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { reload(); }, [reload]);

  if (!address) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
        <h1 className="sub-heading" style={{ marginBottom: 12 }}>Your deals</h1>
        <p className="body-text" style={{ marginBottom: 24 }}>Connect a wallet to see the agreements you&apos;ve sealed.</p>
        <button className="btn-primary" disabled={connecting || !hasWallet} onClick={() => connect().catch(() => {})}>
          {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "No wallet detected"}
        </button>
      </div>
    );
  }

  const me = address.toLowerCase();
  const awaitingMe = deals.filter((d) => d.state === "OPEN" && d.counterparty.toLowerCase() === me);
  const myProposals = deals.filter((d) => d.state === "OPEN" && d.proposer.toLowerCase() === me);
  const needsMyAnswer = deals.filter(
    (d) => d.state === "DISPUTED" && d.disputant.toLowerCase() !== me,
  );
  const active = deals.filter((d) => d.state === "ACTIVE");
  const disputedByMe = deals.filter((d) => d.state === "DISPUTED" && d.disputant.toLowerCase() === me);
  const closed = deals.filter((d) => ["SETTLED", "RESOLVED", "CANCELLED"].includes(d.state));

  const sections: { title: string; hint?: string; items: Deal[] }[] = [
    { title: "Waiting for your seal", hint: "Someone proposed these to you — review the terms and stake to accept.", items: awaitingMe },
    { title: "A dispute names you", hint: "Answer before the disputant escalates. Silence counts against you.", items: needsMyAnswer },
    { title: "Active", items: active },
    { title: "Your open proposals", items: myProposals },
    { title: "Your open disputes", items: disputedByMe },
    { title: "Closed", items: closed },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 40, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="small-text" style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
            Your record
          </div>
          <h1 className="section-heading">Deals</h1>
        </div>
        <Link href="/new" className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>Seal a new deal</Link>
      </div>

      {error && <p className="caption" style={{ color: "var(--red)", marginBottom: 16 }}>{error}</p>}
      {loading && deals.length === 0 && <p className="body-text">Reading the chain…</p>}

      {!loading && deals.length === 0 && !error && (
        <div className="sheet" style={{ padding: 48, textAlign: "center" }}>
          <p className="body-med" style={{ marginBottom: 8 }}>No deals yet.</p>
          <p className="caption" style={{ marginBottom: 24 }}>Seal your first agreement — it takes two minutes.</p>
          <Link href="/new" className="btn-primary">Draft a deal</Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {sections.filter((s) => s.items.length > 0).map((s) => (
          <section key={s.title}>
            <h2 className="feature-title" style={{ fontSize: 18, marginBottom: 4 }}>{s.title}</h2>
            {s.hint && <p className="caption" style={{ marginBottom: 12 }}>{s.hint}</p>}
            {!s.hint && <div style={{ marginBottom: 12 }} />}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {s.items.map((d) => <DealCard key={d.deal_id} deal={d} me={address} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
