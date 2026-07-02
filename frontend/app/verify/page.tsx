"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDeal, getRegistry } from "@/lib/contracts/sigil";
import { termsHash, normalizeTerms } from "@/lib/vault";
import { SealMark } from "@/components/Seal";
import type { Deal, RegistryRow } from "@/lib/contracts/types";

type Verdict =
  | { kind: "match"; deal: Deal | RegistryRow }
  | { kind: "match_hash_only"; hash: string }
  | { kind: "mismatch"; expected: string; computed: string }
  | { kind: "no_deal"; computed: string };

function VerifyForm() {
  const params = useSearchParams();
  const [dealId, setDealId] = useState("");
  const [terms, setTerms] = useState("");
  const [salt, setSalt] = useState("");
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = params.get("deal");
    if (d) setDealId(d);
  }, [params]);

  async function handleLoadRevealed() {
    setError(""); setVerdict(null);
    try {
      const deal = await getDeal(dealId.trim());
      if (!deal) { setError("No deal exists under that id."); return; }
      if (!deal.revealed_terms) { setError("That deal's seal is unbroken — its terms are not public."); return; }
      setTerms(deal.revealed_terms);
      setSalt(deal.revealed_salt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the deal");
    }
  }

  async function handleVerify() {
    setChecking(true); setError(""); setVerdict(null);
    try {
      // Normalized exactly like the sealing flow, so copy-pasted text round-trips.
      const cleanTerms = normalizeTerms(terms);
      const cleanSalt = salt.trim();
      const computed = await termsHash(cleanTerms, cleanSalt);

      if (dealId.trim()) {
        const deal = await getDeal(dealId.trim());
        if (!deal) { setError("No deal exists under that id."); return; }
        if (deal.terms_hash === computed) {
          setVerdict({ kind: "match", deal });
        } else {
          // Legacy seals may predate normalization — try the raw text too.
          const rawComputed = await termsHash(terms, cleanSalt);
          setVerdict(
            deal.terms_hash === rawComputed
              ? { kind: "match", deal }
              : { kind: "mismatch", expected: deal.terms_hash, computed },
          );
        }
        return;
      }

      // No deal id — scan the registry for either hash form.
      const rawComputed = await termsHash(terms, cleanSalt);
      const rows = await getRegistry(200);
      const found = rows.find((r) => r.terms_hash === computed || r.terms_hash === rawComputed);
      setVerdict(found ? { kind: "match", deal: found } : { kind: "no_deal", computed });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "56px 24px" }}>
      <div className="small-text" style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
        Trustless check
      </div>
      <h1 className="section-heading" style={{ marginBottom: 8 }}>Verify a seal</h1>
      <p className="body-text" style={{ marginBottom: 40 }}>
        Anyone holding the terms and salt can prove they match an on-chain seal —
        no account, no permission, no trust. The check runs entirely in your browser.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>Deal id — optional</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="field mono" style={{ flex: 1, minWidth: 220 }}
              placeholder="s_0 (leave empty to search the whole registry)"
              value={dealId} onChange={(e) => setDealId(e.target.value)} />
            <button className="btn-quiet" style={{ whiteSpace: "nowrap" }} disabled={!dealId.trim()} onClick={handleLoadRevealed}>
              Load revealed terms
            </button>
          </div>
          <p className="caption" style={{ marginTop: 6 }}>
            If this deal&apos;s seal was already broken, its terms and salt are public — load them instead of pasting.
          </p>
        </div>
        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>The terms — exact text</label>
          <textarea className="field terms-input" style={{ minHeight: 160 }}
            placeholder="Paste the agreement text, character for character."
            value={terms} onChange={(e) => setTerms(e.target.value)} />
        </div>
        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>The salt</label>
          <input className="field mono" placeholder="The random string generated at sealing"
            value={salt} onChange={(e) => setSalt(e.target.value)} />
        </div>

        {error && (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 10, padding: 12, fontSize: 14, color: "var(--red)" }}>
            {error}
          </div>
        )}

        <button className="btn-primary" disabled={checking || !terms.trim() || !salt.trim()} onClick={handleVerify}>
          {checking ? "Checking…" : "Check the seal"}
        </button>

        {verdict?.kind === "match" && (
          <div className="sheet" style={{ padding: 24, borderColor: "var(--green)", display: "flex", gap: 16, alignItems: "flex-start" }}>
            <SealMark size={40} />
            <div>
              <div className="body-med" style={{ color: "var(--green-dark)", marginBottom: 4 }}>Authentic.</div>
              <p className="body-text" style={{ fontSize: 15, marginBottom: 10 }}>
                These exact words are sealed on-chain as <span className="mono">{verdict.deal.deal_id}</span> —
                state: {verdict.deal.state.toLowerCase()}. Not a character has changed.
              </p>
              <Link href={`/deal/${verdict.deal.deal_id}`} className="btn-quiet" style={{ fontSize: 13 }}>
                Open the deal
              </Link>
            </div>
          </div>
        )}
        {verdict?.kind === "mismatch" && (
          <div className="sheet" style={{ padding: 24, borderColor: "var(--red)" }}>
            <div className="body-med" style={{ color: "var(--red)", marginBottom: 4 }}>Does not match.</div>
            <p className="body-text" style={{ fontSize: 15, marginBottom: 12 }}>
              This text + salt does not produce the seal on {dealId.trim()}. Either the terms were altered,
              the salt is wrong, or this is a different agreement.
            </p>
            <div className="caption mono" style={{ wordBreak: "break-all" }}>on-chain: {verdict.expected}</div>
            <div className="caption mono" style={{ wordBreak: "break-all" }}>computed: {verdict.computed}</div>
          </div>
        )}
        {verdict?.kind === "no_deal" && (
          <div className="sheet" style={{ padding: 24 }}>
            <div className="body-med" style={{ marginBottom: 4 }}>No seal found.</div>
            <p className="body-text" style={{ fontSize: 15, marginBottom: 8 }}>
              Nothing in the latest 200 registry entries carries this fingerprint.
            </p>
            <div className="caption mono" style={{ wordBreak: "break-all" }}>computed: {verdict.computed}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
