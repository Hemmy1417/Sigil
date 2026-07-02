"use client";

import Link from "next/link";
import { TEMPLATES } from "@/lib/config";
import { useStats } from "@/lib/hooks/useStats";
import { SealMark } from "@/components/Seal";

const STEPS = [
  {
    n: "01",
    title: "Write it, seal it",
    body:
      "Draft your terms with the other person. Only a cryptographic fingerprint goes on-chain — the words stay between you two. Both of you stake GEN into escrow.",
  },
  {
    n: "02",
    title: "Keep your word",
    body:
      "When the deal is done, you both confirm the same settlement and the escrow releases. The terms are never revealed. The chain only ever saw a seal.",
  },
  {
    n: "03",
    title: "Or break the seal",
    body:
      "If someone breaks their word, either party can reveal the terms on-chain. An AI validator panel reads the agreement, hears both sides, and splits the escrow.",
  },
];

export default function Landing() {
  const stats = useStats();

  return (
    <div>
      {/* ── Hero ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "88px 24px 64px" }}>
        <div style={{ maxWidth: 640 }}>
          <div
            className="small-text"
            style={{ color: "var(--purple)", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 16 }}
          >
            Private agreements · Sealed on-chain
          </div>
          <h1 className="hero-display" style={{ marginBottom: 20 }}>
            Some deals are<br />nobody else&apos;s business.
          </h1>
          <p className="body-text" style={{ fontSize: 18, marginBottom: 32, maxWidth: 520 }}>
            Seal a private agreement with anyone — a loan, a gig, a wager, a deposit.
            The terms stay confidential. The escrow is real. And if someone breaks
            their word, an AI arbiter reads the contract and rules.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/new" className="btn-primary">Seal a deal</Link>
            <Link href="/registry" className="btn-outline">See the public registry</Link>
          </div>
        </div>
      </section>

      {/* ── Live stats ── */}
      {stats && (
        <section style={{ borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)", background: "var(--paper-warm)" }}>
          <div
            style={{
              maxWidth: 1120, margin: "0 auto", padding: "24px",
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16,
            }}
          >
            {[
              { label: "Deals sealed", value: stats.total_deals },
              { label: "Settled in private", value: stats.total_settled },
              { label: "Seals broken", value: stats.total_disputes },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
                <div className="caption">{label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── How it works ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
        <h2 className="section-heading" style={{ marginBottom: 40 }}>How a sigil works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {STEPS.map((s) => (
            <div key={s.n} className="sheet" style={{ padding: 28 }}>
              <div className="small-text" style={{ color: "var(--purple)", marginBottom: 12 }}>{s.n}</div>
              <h3 className="feature-title" style={{ marginBottom: 10 }}>{s.title}</h3>
              <p className="body-text" style={{ fontSize: 15 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The privacy proof ── */}
      <section style={{ background: "var(--paper-warm)", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
        <div
          style={{
            maxWidth: 1120, margin: "0 auto", padding: "72px 24px",
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 48, alignItems: "center",
          }}
        >
          <div>
            <h2 className="section-heading" style={{ marginBottom: 16 }}>
              The chain sees the seal.<br />Never the words.
            </h2>
            <p className="body-text" style={{ marginBottom: 16 }}>
              Every deal on Sigil is committed as a salted SHA-256 fingerprint. The public
              registry proves an agreement exists, who sealed it, and what state it&apos;s in —
              and nothing else.
            </p>
            <p className="body-text">
              Terms are only revealed if a party disputes. In the happy path — most deals —
              the contract settles and the words are never seen by anyone but you two.
            </p>
          </div>
          <div className="sheet" style={{ padding: 24 }}>
            <div className="small-text" style={{ marginBottom: 12, textTransform: "uppercase", letterSpacing: "1px" }}>
              What the public registry shows
            </div>
            <div className="sheet-inset" style={{ padding: 16, marginBottom: 8 }}>
              <div className="mono" style={{ color: "var(--ink-muted)", wordBreak: "break-all" }}>
                cfa70a106cfcf4f28246a66d15044d95…
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <span className="tag tag-settled">Settled</span>
                <span className="tag">Wager</span>
              </div>
            </div>
            <div className="caption" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SealMark size={16} />
              Terms: sealed forever. Nobody ever saw them.
            </div>
          </div>
        </div>
      </section>

      {/* ── Templates ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "72px 24px" }}>
        <h2 className="section-heading" style={{ marginBottom: 8 }}>Start from a template</h2>
        <p className="body-text" style={{ marginBottom: 32 }}>
          Five shapes cover most handshakes. Every template is just words — edit anything.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {Object.entries(TEMPLATES).filter(([k]) => k !== "custom").map(([key, t]) => (
            <Link
              key={key}
              href={`/new?template=${key}`}
              className="sheet"
              style={{ padding: 20, textDecoration: "none", display: "block" }}
            >
              <div className="body-med" style={{ marginBottom: 6 }}>{t.name}</div>
              <div className="caption">{t.blurb}</div>
            </Link>
          ))}
          <Link
            href="/new"
            className="sheet"
            style={{ padding: 20, textDecoration: "none", display: "block", borderStyle: "dashed" }}
          >
            <div className="body-med" style={{ marginBottom: 6, color: "var(--purple)" }}>Custom</div>
            <div className="caption">{TEMPLATES.custom.blurb}</div>
          </Link>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section style={{ maxWidth: 1120, margin: "0 auto", padding: "24px 24px 72px", textAlign: "center" }}>
        <div className="sheet" style={{ padding: "56px 24px", background: "var(--paper-warm)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <SealMark size={48} />
          </div>
          <h2 className="sub-heading" style={{ marginBottom: 12 }}>Shake hands. Press the seal.</h2>
          <p className="body-text" style={{ marginBottom: 28 }}>
            Two wallets, one agreement, zero public terms.
          </p>
          <Link href="/new" className="btn-primary">Seal a deal</Link>
        </div>
      </section>
    </div>
  );
}
