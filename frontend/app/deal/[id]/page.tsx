"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet, shortAddr } from "@/lib/genlayer/wallet";
import {
  getDeal, acceptDeal, cancelDeal, confirmSettlement,
  disputeDeal, respondToDispute, nudgeDeal, escalateDeal,
  formatGen, parseGen,
} from "@/lib/contracts/sigil";
import { fetchTerms, termsHash } from "@/lib/vault";
import { SealMark } from "@/components/Seal";
import type { Deal, DealState } from "@/lib/contracts/types";

const STATE_TAG: Record<DealState, string> = {
  OPEN: "tag-open", ACTIVE: "tag-active", SETTLED: "tag-settled",
  DISPUTED: "tag-disputed", RESOLVED: "tag-resolved", CANCELLED: "tag-cancelled",
};

const PROV_LABEL: Record<string, string> = {
  sealed: "Sealed", accepted: "Accepted", settled_mutual: "Settled by both parties",
  settled_deadline: "Settled at deadline", seal_broken: "Seal broken",
  answered: "Answer given", arbitrated: "The arbiter ruled",
  nudged: "Answer demanded", escalated: "Escalated without answer",
  cancelled: "Cancelled",
};

export default function DealRoom() {
  const { id } = useParams<{ id: string }>();
  const { address, client, provider } = useWallet();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [terms, setTerms] = useState("");
  const [salt, setSalt] = useState("");
  const [termsError, setTermsError] = useState("");

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [statement, setStatement] = useState("");
  const [settlePct, setSettlePct] = useState("50");
  const [acceptStake, setAcceptStake] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const me = address?.toLowerCase() ?? "";
  const iAmProposer = deal ? deal.proposer.toLowerCase() === me : false;
  const iAmCounterparty = deal ? deal.counterparty.toLowerCase() === me : false;
  const iAmParty = iAmProposer || iAmCounterparty;
  const iAmDisputant = deal ? deal.disputant.toLowerCase() === me && me !== "" : false;

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const d = await getDeal(id);
      if (!d) { setNotFound(true); return; }
      setDeal(d);
      if (d.revealed_terms) { setTerms(d.revealed_terms); setSalt(d.revealed_salt); }
    } catch { /* transient — leave prior state */ }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // A party (pre-reveal) fetches the sealed terms from the vault, or local backup.
  useEffect(() => {
    if (!deal || deal.revealed_terms || !iAmParty || !provider || !address || terms) return;
    const local = localStorage.getItem(`sigil_seal_${deal.terms_hash}`);
    if (local) {
      try {
        const { terms: t, salt: s } = JSON.parse(local);
        setTerms(t); setSalt(s);
        return;
      } catch { /* fall through to vault */ }
    }
    fetchTerms(provider, address, deal.terms_hash)
      .then((doc) => {
        setTerms(doc.terms); setSalt(doc.salt);
        localStorage.setItem(`sigil_seal_${deal.terms_hash}`, JSON.stringify({ terms: doc.terms, salt: doc.salt }));
      })
      .catch((e) => setTermsError(e instanceof Error ? e.message : "Could not open the sealed terms"));
  }, [deal, iAmParty, provider, address, terms]);

  async function act(name: string, fn: () => Promise<unknown>) {
    if (!client) return;
    setBusy(name); setError("");
    try {
      const updated = await fn();
      if (updated && typeof updated === "object" && "deal_id" in (updated as Deal)) {
        setDeal(updated as Deal);
      } else {
        await reload();
      }
      setStatement(""); setShowDispute(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : `${name} failed`);
    } finally {
      setBusy("");
    }
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
        <h1 className="sub-heading" style={{ marginBottom: 12 }}>No such deal</h1>
        <Link href="/registry" className="btn-outline">Browse the registry</Link>
      </div>
    );
  }
  if (!deal) {
    return <div style={{ maxWidth: 560, margin: "0 auto", padding: "120px 24px", textAlign: "center" }} className="body-text">Reading the chain…</div>;
  }

  const pot = BigInt(deal.proposer_stake) + BigInt(deal.counter_stake);
  const needStake = BigInt(deal.counter_stake_req);
  const myVote = deal.settle_votes[me];
  const theirVote = deal.settle_votes[(iAmProposer ? deal.counterparty : deal.proposer).toLowerCase()];
  const arbitrating = busy === "respond" || busy === "escalate";

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "48px 24px" }}>
      {/* Arbitration overlay */}
      {arbitrating && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(255,255,255,0.94)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <div className="seal-press" style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <SealMark size={72} />
            </div>
            <h2 className="feature-title" style={{ marginBottom: 10 }}>The arbiter is reading</h2>
            <p className="body-text" style={{ marginBottom: 6 }}>
              Independent validators are reading the agreement and both statements, then ruling a split of the escrow.
            </p>
            <p className="caption">This takes one to three minutes. Keep this page open.</p>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }} className="lg:grid-cols-[1fr_320px]">
        {/* ── The document sheet ── */}
        <div className="sheet" style={{ padding: "clamp(24px, 5vw, 48px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
            <h1 className="sub-heading">{deal.label}</h1>
            <span className={`tag ${STATE_TAG[deal.state]}`}>{deal.state.toLowerCase()}</span>
          </div>
          <div className="caption" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            <span>{deal.template}</span>
            <span>·</span>
            <span>{formatGen(pot)} GEN in escrow</span>
            <span>·</span>
            <span className="mono">{deal.deal_id}</span>
          </div>

          {/* Parties */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
            {[
              { role: "Proposer", addr: deal.proposer, stake: deal.proposer_stake, you: iAmProposer },
              { role: "Counterparty", addr: deal.counterparty, stake: deal.state === "OPEN" ? deal.counter_stake_req : deal.counter_stake, you: iAmCounterparty, pending: deal.state === "OPEN" },
            ].map((p) => (
              <div key={p.role} className="sheet-inset" style={{ padding: 16 }}>
                <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
                  {p.role}{p.you ? " — you" : ""}
                </div>
                <Link href={`/u/${p.addr}`} className="mono" style={{ color: "var(--purple-dark)", textDecoration: "none" }}>
                  {shortAddr(p.addr)}
                </Link>
                <div className="caption" style={{ marginTop: 4 }}>
                  {p.pending ? `must stake ${formatGen(p.stake)} GEN` : `${formatGen(p.stake)} GEN staked`}
                </div>
              </div>
            ))}
          </div>

          {/* The seal */}
          <div className="sheet-inset" style={{ padding: 16, marginBottom: 28, display: "flex", alignItems: "center", gap: 14 }}>
            <SealMark size={36} />
            <div style={{ minWidth: 0 }}>
              <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
                The seal — sha256, salted
              </div>
              <div className="mono" style={{ color: "var(--ink-muted)", wordBreak: "break-all", fontSize: 12 }}>
                {deal.terms_hash}
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={{ marginBottom: 8 }}>
            <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>
              {deal.revealed_terms ? "The terms — revealed by dispute" : iAmParty ? "The terms — visible only to you two" : "The terms"}
            </div>

            {terms ? (
              <div className="terms-text" style={{ borderLeft: "3px solid var(--purple-subtle)", paddingLeft: 20 }}>
                {terms}
              </div>
            ) : iAmParty ? (
              <p className="caption">{termsError || "Opening the vault…"}</p>
            ) : (
              <div className="sheet-inset" style={{ padding: 24, textAlign: "center" }}>
                <p className="body-med" style={{ marginBottom: 4 }}>Sealed.</p>
                <p className="caption">
                  The terms are private to the two parties. They only ever become public if a seal is broken by dispute.
                </p>
              </div>
            )}
          </div>

          {/* Dispute record */}
          {deal.state !== "OPEN" && deal.dispute_statement && (
            <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>The dispute</div>
              <div className="sheet-inset" style={{ padding: 16 }}>
                <div className="caption" style={{ marginBottom: 6 }}>
                  Claim — <span className="mono">{shortAddr(deal.disputant)}</span>{iAmDisputant ? " (you)" : ""}
                </div>
                <p className="body-text">{deal.dispute_statement}</p>
              </div>
              {deal.response_statement && (
                <div className="sheet-inset" style={{ padding: 16 }}>
                  <div className="caption" style={{ marginBottom: 6 }}>Answer</div>
                  <p className="body-text">{deal.response_statement}</p>
                </div>
              )}
            </div>
          )}

          {/* Ruling */}
          {deal.ruling && (
            <div style={{
              marginTop: 28, padding: 20, borderRadius: 12,
              background: deal.state === "SETTLED" ? "var(--green-bg)" : "var(--purple-subtle)",
            }}>
              <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                {deal.ruling.kind === "mutual" ? "Settlement" : deal.ruling.kind === "escalation" ? "Ruling — by escalation" : "The arbiter's ruling"}
              </div>
              <p className="body-med" style={{ marginBottom: 6 }}>
                {deal.ruling.to_proposer}% of the escrow to the proposer, {100 - deal.ruling.to_proposer}% to the counterparty.
              </p>
              <p className="body-text" style={{ fontSize: 15 }}>{deal.ruling.rationale}</p>
            </div>
          )}
        </div>

        {/* ── Margin rail ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Provenance */}
          <div className="sheet" style={{ padding: 20 }}>
            <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
              Chain of custody
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deal.provenance.map((p) => (
                <div key={p.n} className="prov-step done">
                  <span className="prov-dot" />
                  {PROV_LABEL[p.event] ?? (p.event.startsWith("settle_offer_") ? `Settlement offered (${p.event.slice(13)}% to proposer)` : p.event)}
                </div>
              ))}
              {deal.state === "OPEN" && (
                <div className="prov-step"><span className="prov-dot" />Awaiting the counterparty</div>
              )}
              {deal.state === "DISPUTED" && !deal.response_statement && (
                <div className="prov-step"><span className="prov-dot" />Awaiting an answer</div>
              )}
            </div>
          </div>

          {/* Actions */}
          {iAmParty && ["OPEN", "ACTIVE", "DISPUTED"].includes(deal.state) && (
            <div className="sheet" style={{ padding: 20 }}>
              <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 14 }}>
                Your move
              </div>

              {/* OPEN */}
              {deal.state === "OPEN" && iAmCounterparty && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p className="caption">
                    Read the terms carefully. Accepting stakes your GEN and seals you to exactly these words.
                  </p>
                  {needStake > 0n && (
                    <div>
                      <label className="caption" style={{ display: "block", marginBottom: 6 }}>
                        Stake (min {formatGen(needStake)} GEN)
                      </label>
                      <input className="field" type="number" min="0" step="any"
                        placeholder={formatGen(needStake)}
                        value={acceptStake} onChange={(e) => setAcceptStake(e.target.value)} />
                    </div>
                  )}
                  <button
                    className="btn-primary"
                    disabled={!!busy || !terms}
                    onClick={() => act("accept", async () => {
                      const h = await termsHash(terms, salt);
                      const stake = needStake > 0n ? parseGen(acceptStake || formatGen(needStake)) : 0n;
                      return acceptDeal(client, deal.deal_id, h, stake);
                    })}
                  >
                    {busy === "accept" ? "Sealing…" : "Accept and seal"}
                  </button>
                </div>
              )}
              {deal.state === "OPEN" && iAmProposer && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <p className="caption">Unaccepted — you can withdraw your stake at any time.</p>
                  <button className="btn-danger" disabled={!!busy}
                    onClick={() => act("cancel", () => cancelDeal(client, deal.deal_id))}>
                    {busy === "cancel" ? "Withdrawing…" : "Cancel and reclaim stake"}
                  </button>
                </div>
              )}

              {/* ACTIVE */}
              {deal.state === "ACTIVE" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div className="body-med" style={{ marginBottom: 6 }}>Settle</div>
                    <p className="caption" style={{ marginBottom: 10 }}>
                      Both parties confirm the same split and the escrow releases — terms never revealed.
                      {theirVote !== undefined && (
                        <> They proposed <strong>{theirVote}% to the proposer</strong> — match it to settle.</>
                      )}
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="field" type="number" min="0" max="100" style={{ width: 90 }}
                        value={settlePct} onChange={(e) => setSettlePct(e.target.value)} />
                      <button className="btn-outline" style={{ flex: 1, fontSize: 14 }} disabled={!!busy}
                        onClick={() => act("settle", () => confirmSettlement(client, deal.deal_id, Number(settlePct)))}>
                        {busy === "settle" ? "Confirming…" : `Confirm ${settlePct}% to proposer`}
                      </button>
                    </div>
                    {myVote !== undefined && <p className="caption" style={{ marginTop: 6 }}>You proposed {myVote}%. Re-confirm to change it.</p>}
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--line-soft)" }} />

                  {!showDispute ? (
                    <button className="btn-danger" onClick={() => setShowDispute(true)}>Break the seal</button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <p className="caption">
                        Breaking the seal reveals the terms on-chain — permanently — and sends the deal to the arbiter.
                      </p>
                      <textarea className="field" style={{ minHeight: 100 }} maxLength={1500}
                        placeholder="Your claim: what did they fail to do?"
                        value={statement} onChange={(e) => setStatement(e.target.value)} />
                      <button className="btn-danger" disabled={!!busy || !statement.trim() || !terms}
                        onClick={() => act("dispute", () => disputeDeal(client, deal.deal_id, terms, salt, statement))}>
                        {busy === "dispute" ? "Breaking the seal…" : "Reveal and dispute"}
                      </button>
                      <button className="btn-quiet" onClick={() => setShowDispute(false)}>Keep it sealed</button>
                    </div>
                  )}
                </div>
              )}

              {/* DISPUTED */}
              {deal.state === "DISPUTED" && !iAmDisputant && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p className="caption">
                    The seal is broken and their claim stands. Answer it — the arbiter rules the moment you do.
                    Silence lets them escalate, and silence counts against you.
                  </p>
                  <textarea className="field" style={{ minHeight: 100 }} maxLength={1500}
                    placeholder="Your answer to the claim"
                    value={statement} onChange={(e) => setStatement(e.target.value)} />
                  <button className="btn-primary" disabled={!!busy || !statement.trim()}
                    onClick={() => act("respond", () => respondToDispute(client, deal.deal_id, statement))}>
                    {busy === "respond" ? "The arbiter is reading…" : "Answer and go to ruling"}
                  </button>
                </div>
              )}
              {deal.state === "DISPUTED" && iAmDisputant && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {!deal.nudged ? (
                    <>
                      <p className="caption">
                        Waiting for their answer. If they stay silent, demand one on-chain — that arms escalation.
                      </p>
                      <button className="btn-outline" disabled={!!busy}
                        onClick={() => act("nudge", () => nudgeDeal(client, deal.deal_id))}>
                        {busy === "nudge" ? "Demanding…" : "Demand an answer"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="caption">
                        You demanded an answer. If they respond first, their answer is heard.
                        Escalate to send it to the arbiter without one — their silence is weighed against them.
                      </p>
                      <button className="btn-danger" disabled={!!busy}
                        onClick={() => act("escalate", () => escalateDeal(client, deal.deal_id))}>
                        {busy === "escalate" ? "The arbiter is reading…" : "Escalate without an answer"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 10, padding: 12, fontSize: 13, color: "var(--red)" }}>
              {error}
            </div>
          )}

          {/* Verify pointer */}
          <div className="sheet" style={{ padding: 20 }}>
            <div className="small-text" style={{ textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
              Anyone can verify
            </div>
            <p className="caption" style={{ marginBottom: 12 }}>
              Hold the terms and salt? Check them against this seal without trusting anyone.
            </p>
            <Link href={`/verify?deal=${deal.deal_id}`} className="btn-quiet" style={{ fontSize: 13 }}>
              Open the verifier
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
