"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getReputation, getDealsFor } from "@/lib/contracts/sigil";
import { shortAddr } from "@/lib/genlayer/wallet";
import type { Reputation, Deal, DealState } from "@/lib/contracts/types";

const STATE_TAG: Record<DealState, string> = {
  OPEN: "tag-open", ACTIVE: "tag-active", SETTLED: "tag-settled",
  DISPUTED: "tag-disputed", RESOLVED: "tag-resolved", CANCELLED: "tag-cancelled",
};

export default function RecordPage() {
  const { address } = useParams<{ address: string }>();
  const [rep, setRep] = useState<Reputation | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!address) return;
    Promise.allSettled([getReputation(address), getDealsFor(address)]).then(([r, d]) => {
      if (r.status === "fulfilled" && r.value) setRep(r.value);
      if (d.status === "fulfilled") setDeals(d.value);
      setLoaded(true);
    });
  }, [address]);

  const closedGood = rep ? rep.settled_clean + rep.disputes_won : 0;
  const roughDeals = rep ? rep.disputes_lost + rep.forfeits : 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
      <div className="small-text" style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
        Public record
      </div>
      <h1 className="section-heading mono" style={{ fontSize: 26, marginBottom: 8, wordBreak: "break-all" }}>
        {address}
      </h1>
      <p className="body-text" style={{ marginBottom: 40 }}>
        A wallet&apos;s reputation is the one thing on Sigil that is deliberately public:
        how they behave when a deal ends.
      </p>

      {rep && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Deals sealed", value: rep.sealed },
            { label: "Settled clean", value: rep.settled_clean, good: true },
            { label: "Disputes won", value: rep.disputes_won },
            { label: "Disputes lost", value: rep.disputes_lost, bad: rep.disputes_lost > 0 },
            { label: "Forfeits", value: rep.forfeits, bad: rep.forfeits > 0 },
          ].map(({ label, value, good, bad }) => (
            <div key={label} className="sheet-inset" style={{ padding: 16 }}>
              <div style={{
                fontSize: 24, fontWeight: 700,
                color: bad ? "var(--red)" : good && value > 0 ? "var(--green-dark)" : "var(--ink)",
              }}>
                {value}
              </div>
              <div className="caption">{label}</div>
            </div>
          ))}
        </div>
      )}

      {rep && (rep.sealed > 0) && (
        <p className="caption" style={{ marginBottom: 40 }}>
          {roughDeals === 0 && closedGood > 0 && "Every closed deal on this record ended clean or won."}
          {roughDeals === 0 && closedGood === 0 && "No closed deals yet — the record is still being written."}
          {roughDeals > 0 && `${roughDeals} deal${roughDeals > 1 ? "s" : ""} on this record ended in a lost dispute or forfeit.`}
        </p>
      )}

      <h2 className="feature-title" style={{ fontSize: 18, marginBottom: 12 }}>Sealed deals</h2>
      {!loaded && <p className="body-text">Reading the chain…</p>}
      {loaded && deals.length === 0 && <p className="caption">No deals on this wallet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deals.map((d) => (
          <Link key={d.deal_id} href={`/deal/${d.deal_id}`} className="sheet" style={{ padding: "14px 18px", textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="body-med" style={{ fontSize: 15 }}>{d.label}</span>
              <span className={`tag ${STATE_TAG[d.state]}`}>{d.state.toLowerCase()}</span>
            </div>
            <span className="caption">
              with <span className="mono">{shortAddr(d.proposer.toLowerCase() === address.toLowerCase() ? d.counterparty : d.proposer)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
