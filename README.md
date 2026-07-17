# SIGIL

**Private P2P agreements, sealed on-chain. AI-arbitrated when someone breaks their word.**

Some deals are nobody else's business — a loan to a friend, a gig, a wager, a deposit.
Sigil lets two people seal any agreement with real escrow while keeping the terms
confidential: only a salted SHA-256 fingerprint ever touches the chain. If a party
breaks their word, the other breaks the seal — the terms are revealed on-chain and a
GenLayer AI validator panel reads the agreement, hears both sides, and rules a split
of the escrow.

**Live:** [sigil-alpha.vercel.app](https://sigil-alpha.vercel.app)

---

## How it works

1. **Write it, seal it** — Two people draft terms privately. The proposer commits
   `sha256(terms + "\n" + salt)` on-chain with their stake. The counterparty must
   present the *same hash* to accept — cryptographic proof both hold identical terms.
2. **Keep your word** — Both parties confirm the same settlement split and the escrow
   releases. The terms are never revealed. The chain only ever saw a seal.
3. **Or break the seal** — Either party reveals terms + salt on-chain (hash-verified)
   with their claim. The other answers, and an AI validator panel rules what percentage
   of the escrow each side receives — from the agreement's own words.

## Features

- **Commit/reveal privacy** — the public registry shows fingerprints, parties, and
  states. Never terms, unless a seal was broken by dispute
- **AI arbitration on fetched evidence** — `gl.eq_principle.prompt_comparative` consensus;
  the contract fetches each party's pinned evidence URLs and rules from the hash-committed
  agreement + that retrieved evidence, not bare statements. Validators only agree on the
  split bucket (0/25/50/75/100), which keeps rulings determinate
- **AI terms pre-read** — before sealing, ask the same arbiter to flag ambiguity in a
  draft (clarity score + issues)
- **Deal templates** — loan, gig, wager, deposit, or custom
- **Reputation ledger** — the one deliberately-public thing: sealed / settled clean /
  disputes won / disputes lost / forfeits, per wallet
- **Nudge → escalate, with a real wall-clock window** — a silent respondent is demanded to
  answer on-chain; escalation past them is refused until a genuine response window of **real
  elapsed time** has passed since the nudge — time the contract fetches from independent public
  clocks, so no party can shortcut it by spamming unrelated transactions. Silence is weighed
  against the absent party and forfeits their record
- **Trustless verifier** — anyone holding terms + salt can prove they match an on-chain
  seal, entirely in the browser

## Dispute integrity

Two properties make an arbitrated split defensible rather than a coin toss on unauthenticated
text — both enforced in `sigil.py`, both covered by the direct tests in `tests/direct/`, and
both verified live on Studionet (see *Verified on-chain* below).

**Contract-verifiable evidence path.** `dispute` and `respond` each accept `evidence_urls`
(up to three). At arbitration the *contract itself* fetches every pinned URL with
`gl.nondet.web.render` and injects the retrieved pages into the arbiter's prompt as
`FETCHED EVIDENCE`. The ruling is grounded in the hash-committed agreement and that fetched
evidence; the parties' written statements are explicitly demoted to advocacy. When nothing
verifiable resolves an ambiguous term, the arbiter defaults to a middle split — it never
hands the escrow to one side on their word alone. Unreachable URLs are surfaced to the
arbiter as "no evidence," not silently trusted.

**A real response opportunity, enforced against a real clock.** A disputant cannot break the
seal and immediately trigger the no-answer path. `escalate` requires a prior `nudge` *and*
that `RESPONSE_WINDOW_SECONDS` of **real wall-clock time** have elapsed since it. Studionet's
GenVM exposes no native clock, so the contract fetches the current time under validator consensus
from two independent, **probe-verified** sources — Cloudflare's edge clock (`/cdn-cgi/trace`) and
**Ethereum's own latest block timestamp** (via Blockscout), i.e. a clock produced by a decentralised
consensus rather than any single vendor's server — and refuses escalation until the window has
genuinely passed. This closes the gap a protocol-action counter left open:
the disputant produces protocol actions at will — even unrelated filler deals advance a global
counter — so only *real elapsed time*, which no party can manufacture with any number of wallets,
is a window that cannot be shortcut. The clock **fails closed**: if no time source is reachable, or
if the two sources disagree by more than 300s (one is lying or stale), escalation is refused, never
granted. And because execution is serialized, a `respond` that lands before escalation resolves the
dispute on its merits, so a genuine answer always wins if it shows up.

> **Why those two sources, specifically.** The first version of this clock used `timeapi.io` and
> `worldtimeapi.org`. Probing `_utc_now()` from Studionet validators (2026-07-17) proved
> `worldtimeapi.org` never loads at all, and **`timeapi.io` serves a clock ~6 minutes behind real
> UTC** — its 381s disagreement with Cloudflare tripped the divergence guard on *every* call, so the
> clock always read 0 and, because it fails closed, **`escalate()` always reverted**: the response
> window could never open. The fail-closed logic was correct; the sources were not. Both current
> sources are probe-verified on-chain, and the direct tests now include a source that *lies* — the
> old tests served every source from one shared clock, which is precisely why they stayed green
> while production was inert.

**Verified on-chain.** Both were exercised end-to-end through MetaMask on the deployed contract:

- *Evidence path* — a disputant claimed "never delivered" while the counterparty's pinned
  receipt (fetched by the contract) showed on-time delivery. The arbiter ruled **100% to the
  counterparty** — decided on the fetched evidence, against the party who only asserted.
- *Response window (real-clock, v0.3)* — the direct tests in `tests/direct/test_hardening.py`
  pin the new enforcement: `escalate` is refused immediately after a `nudge`; it succeeds only
  once the fetched wall-clock has advanced past the window; **creating unrelated filler deals does
  NOT advance it** (the exact exploit the earlier action-counter allowed); and the whole path fails
  closed when no time source is reachable. The evidence-path verification above is unchanged; the
  end-to-end MetaMask re-run of the real-clock window on the redeployed contract is the one
  remaining live check.

## Architecture

```
frontend (Next.js 16, Vercel) ──── genlayer-js ──── GenLayer Studionet
        │                                               sigil.py
        └── /api/vault (Next.js route handlers) ── Firebase Firestore
            the sealed-terms vault: terms stored off-chain,
            readable only by the two parties (wallet-signature auth)
```

| Layer | Technology |
|-------|-----------|
| Contract | GenLayer Intelligent Contract (Python) |
| Frontend | Next.js 16, React 19, Tailwind v4 — Kraken-inspired light design |
| Auth | Injected wallets only (EIP-6963: MetaMask, Rabby, …) |
| Vault | Next.js API routes + Firebase Admin (Firestore) |
| Chain | GenLayer Studionet, GEN token |

## Contract

- **Address:** `0x097c434abF6f1dC87AC8658a46d25c307916AAE8`

> **Payout fix (July 2026).** Wallet payouts are sent as EVM external messages (an empty `@gl.evm.contract_interface` proxy executed by the contract's ghost account). The previous GenVM-call pattern errored at finalization on plain wallets and stranded the value; the contract was redeployed at the address above with the corrected transfer path.

- **Network:** GenLayer Studionet
- **View in Studio:** [GenLayer Studio](https://studio.genlayer.com/?import-contract=0x097c434abF6f1dC87AC8658a46d25c307916AAE8)

Studionet's GenVM exposes no native clock, so most lifecycle gates are action-based:
unaccepted proposals are cancellable, and deadlines live in the sealed terms (the arbiter
enforces them on reveal). The one gate under adversarial timing pressure — the dispute
response window — is instead enforced against **real wall-clock time fetched from independent
public clocks**, because only real time is a window the disputant cannot advance themselves.
A `respond` that lands before escalation still always wins.

## The vault

The chain holds only a hash, but the counterparty must read the terms to decide whether
to accept. The vault stores sealed terms off-chain: the server recomputes the hash
before storing (a mismatched commit can never enter), and reads require a wallet
signature over a hash-bound, timestamped message — only the two named parties pass.
Both parties also keep a local browser backup of terms + salt.

## Project structure

```
Sigil/
├── contracts/sigil.py        # the intelligent contract
├── deploy/deployScript.ts    # scripted deployment
├── tests/direct/             # direct-mode contract tests (pytest)
├── gltest.config.yaml
└── frontend/
    ├── app/                  # landing, deals, new, deal/[id], verify, registry, u/[address]
    │   └── api/vault/        # the sealed-terms vault (route handlers + Firestore)
    ├── components/
    └── lib/
        ├── genlayer/         # client + wallet provider
        ├── contracts/        # typed contract wrapper + types
        ├── server/           # Firebase Admin + signature auth (server-only)
        └── hooks/
```

## Local development

```bash
# contract tests
pip install -r requirements.txt
pytest tests/direct/ -v

# frontend (includes the vault API routes)
cd frontend
cp .env.Example .env.local    # contract address + Firebase Admin credentials
npm install && npm run dev
```

## Environment variables

**`frontend/.env.local` (also set these on Vercel):**
- `NEXT_PUBLIC_CONTRACT_ADDRESS`
- `FIREBASE_PROJECT_ID` — vault (server-side only)
- `FIREBASE_CLIENT_EMAIL` — vault (server-side only)
- `FIREBASE_PRIVATE_KEY` — vault (server-side only)

## Signed writes

Contract writes are signed by the **connected wallet's own EIP-1193 provider**: the
wallet context builds the genlayer-js client with `createClient({ chain, account,
provider })` and every write routes through it — never an implicit `window.ethereum`
fallback. A repository-level test (`frontend/tests/signed-write.test.ts`) proves the
write path routes `eth_sendTransaction` through that provider with the correct `from`.
