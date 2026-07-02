"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { isAddress } from "ethers";
import { useWallet } from "@/lib/genlayer/wallet";
import { TEMPLATES } from "@/lib/config";
import { createDeal, checkTerms, parseGen, getStats } from "@/lib/contracts/sigil";
import { storeTerms, termsHash, randomSalt, normalizeTerms } from "@/lib/vault";
import { SealMark } from "@/components/Seal";
import type { TermsCheck, Deal } from "@/lib/contracts/types";

function NewDealForm() {
  const { address, client, provider, hasWallet, connect, connecting } = useWallet();
  const router = useRouter();
  const params = useSearchParams();

  const [template, setTemplate] = useState("custom");
  const [label, setLabel] = useState("");
  const [terms, setTerms] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [myStake, setMyStake] = useState("1");
  const [theirStake, setTheirStake] = useState("0");

  const [check, setCheck] = useState<TermsCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sealStep, setSealStep] = useState("");
  const [error, setError] = useState("");
  const [sealedHash, setSealedHash] = useState("");
  const [sealedId, setSealedId] = useState("");

  useEffect(() => {
    const t = params.get("template");
    if (t && TEMPLATES[t]) {
      setTemplate(t);
      setTerms(TEMPLATES[t].body);
      setLabel(TEMPLATES[t].name);
    }
  }, [params]);

  function pickTemplate(key: string) {
    setTemplate(key);
    setCheck(null);
    if (TEMPLATES[key].body && (!terms.trim() || Object.values(TEMPLATES).some((t) => t.body === terms))) {
      setTerms(TEMPLATES[key].body);
    }
    if (!label.trim() || Object.values(TEMPLATES).some((t) => t.name === label)) {
      setLabel(TEMPLATES[key].name === "Custom" ? "" : TEMPLATES[key].name);
    }
  }

  async function handleCheck() {
    if (!client || !terms.trim()) return;
    setChecking(true); setError(""); setCheck(null);
    try {
      const result = await checkTerms(client, terms);
      if (result) setCheck(result);
      else setError("The arbiter's answer did not come back readable — try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pre-read failed");
    } finally {
      setChecking(false);
    }
  }

  async function handleSeal() {
    if (!client || !provider || !address) return;
    setError("");
    if (!terms.trim()) return setError("Write the terms first.");
    if (!isAddress(counterparty)) return setError("Enter the counterparty's wallet address.");
    if (counterparty.toLowerCase() === address.toLowerCase()) return setError("You cannot seal a deal with yourself.");

    let stakeWei: bigint, needWei: bigint;
    try {
      stakeWei = parseGen(myStake);
      needWei = parseGen(theirStake || "0");
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Check the stake amounts.");
    }
    if (stakeWei <= 0n) return setError("Your stake must be more than zero.");

    setSealing(true);
    try {
      const salt = randomSalt();
      const cleanTerms = normalizeTerms(terms);
      const hash = await termsHash(cleanTerms, salt);

      setSealStep("Placing the terms in the vault…");
      await storeTerms(provider, address, {
        terms: cleanTerms, salt, counterparty,
        label: label.trim() || "Sealed deal",
        template,
      });

      // Local backup of the reveal material, in case the vault is unreachable later.
      localStorage.setItem(`sigil_seal_${hash}`, JSON.stringify({ terms: cleanTerms, salt }));

      setSealStep("Pressing the seal on-chain — validators are confirming…");
      const deal = (await createDeal(
        client, hash, counterparty, needWei, template,
        label.trim() || "Sealed deal", stakeWei,
      )) as Deal | null;

      setSealedHash(hash);
      if (deal?.deal_id) {
        setSealedId(deal.deal_id);
      } else {
        // Result payload unavailable — find it by hash.
        const stats = await getStats();
        if (stats) setSealedId(`s_${stats.total_deals - 1}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sealing failed");
    } finally {
      setSealing(false);
      setSealStep("");
    }
  }

  /* ── Sealed — the wax moment ── */
  if (sealedHash) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "88px 24px", textAlign: "center" }}>
        <div className="seal-press" style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <SealMark size={96} />
        </div>
        <h1 className="sub-heading" style={{ marginBottom: 12 }}>Sealed.</h1>
        <p className="body-text" style={{ marginBottom: 8 }}>
          The agreement is committed. Only this fingerprint is public:
        </p>
        <div className="sheet-inset mono" style={{ padding: 14, wordBreak: "break-all", color: "var(--ink-muted)", marginBottom: 24 }}>
          {sealedHash}
        </div>
        <p className="caption" style={{ marginBottom: 32 }}>
          Send the deal link to your counterparty — they review the terms privately and stake to accept.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {sealedId && <Link href={`/deal/${sealedId}`} className="btn-primary">Open the deal</Link>}
          <Link href="/deals" className="btn-outline">Your deals</Link>
        </div>
      </div>
    );
  }

  /* ── Not connected ── */
  if (!address) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "120px 24px", textAlign: "center" }}>
        <h1 className="sub-heading" style={{ marginBottom: 12 }}>Draft a deal</h1>
        <p className="body-text" style={{ marginBottom: 24 }}>Connect a wallet to seal an agreement.</p>
        <button className="btn-primary" disabled={connecting || !hasWallet} onClick={() => connect().catch((e) => setError(e.message))}>
          {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "No wallet detected"}
        </button>
        {error && <p className="caption" style={{ color: "var(--red)", marginTop: 12 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px" }}>
      <div className="small-text" style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 12 }}>
        New agreement
      </div>
      <h1 className="section-heading" style={{ marginBottom: 8 }}>Draft a deal</h1>
      <p className="body-text" style={{ marginBottom: 40 }}>
        Write the terms together, off the record. Only the seal — a salted fingerprint — goes on-chain.
      </p>

      {/* Template picker */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
        {Object.entries(TEMPLATES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => pickTemplate(key)}
            className={template === key ? "btn-subtle" : "btn-quiet"}
            style={{ fontSize: 14 }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>Public label</label>
          <input
            className="field"
            placeholder="A short name — this IS public on the registry"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={80}
          />
          <p className="caption" style={{ marginTop: 6 }}>
            Keep it vague if you want: &quot;Sealed deal&quot; is a fine label.
          </p>
        </div>

        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>The terms — private, sealed</label>
          <textarea
            className="field terms-input"
            placeholder="Write the agreement in plain language. Say who does what, by when, and what happens if they don't. The AI arbiter will read exactly these words if there's ever a dispute."
            value={terms}
            onChange={(e) => { setTerms(e.target.value); setCheck(null); }}
            maxLength={4000}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <p className="caption">Deadlines belong here — the arbiter enforces what&apos;s written.</p>
            <p className="caption">{terms.length}/4000</p>
          </div>
        </div>

        {/* AI pre-read */}
        <div className="sheet-inset" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="body-med" style={{ marginBottom: 4 }}>Ask the arbiter to pre-read</div>
              <p className="caption">
                Optional. The same AI panel that would judge a dispute reads your draft and flags
                ambiguity now — takes one to three minutes.
              </p>
            </div>
            <button className="btn-outline" style={{ fontSize: 14, padding: "9px 18px" }} disabled={checking || !terms.trim()} onClick={handleCheck}>
              {checking ? "The arbiter is reading…" : "Pre-read the terms"}
            </button>
          </div>

          {check && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className={`tag ${check.verdict === "ready" ? "tag-settled" : "tag-disputed"}`}>
                  {check.verdict === "ready" ? "Ready to seal" : "Needs work"}
                </span>
                <span className="caption">Clarity {check.clarity}/100</span>
              </div>
              {check.issues.length > 0 && (
                <ul style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {check.issues.map((issue, i) => (
                    <li key={i} className="caption" style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--amber)" }}>—</span> {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="body-med" style={{ display: "block", marginBottom: 8 }}>Counterparty wallet</label>
          <input
            className="field mono"
            placeholder="0x…"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value.trim())}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <div>
            <label className="body-med" style={{ display: "block", marginBottom: 8 }}>Your stake (GEN)</label>
            <input className="field" type="number" min="0" step="any" value={myStake} onChange={(e) => setMyStake(e.target.value)} />
          </div>
          <div>
            <label className="body-med" style={{ display: "block", marginBottom: 8 }}>Their stake (GEN)</label>
            <input className="field" type="number" min="0" step="any" value={theirStake} onChange={(e) => setTheirStake(e.target.value)} />
            <p className="caption" style={{ marginTop: 6 }}>What they must escrow to accept. Zero is allowed.</p>
          </div>
        </div>

        {error && (
          <div style={{ background: "var(--red-bg)", border: "1px solid var(--red)", borderRadius: 10, padding: 12, fontSize: 14, color: "var(--red)" }}>
            {error}
          </div>
        )}

        <button className="btn-primary" style={{ width: "100%" }} disabled={sealing} onClick={handleSeal}>
          {sealing ? sealStep || "Sealing…" : "Press the seal"}
        </button>
        {sealing && (
          <p className="caption" style={{ textAlign: "center" }}>
            Validators are committing the seal — this takes a minute or two. Keep this page open.
          </p>
        )}
      </div>
    </div>
  );
}

export default function NewDealPage() {
  return (
    <Suspense>
      <NewDealForm />
    </Suspense>
  );
}
