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
- **Nudge → escalate, with a real window** — a silent respondent is demanded to answer
  on-chain; escalation past them is only possible after a genuine response window has
  elapsed, so no one can nudge and escalate in the same breath. Silence is weighed against
  them and forfeits their record
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

**A real response opportunity.** A disputant cannot break the seal and immediately trigger
the no-answer path. `escalate` requires a prior `nudge` *and* that `RESPONSE_WINDOW` protocol
actions have elapsed since it — nudge and escalate can never land in the same transaction.
Because on-chain execution is serialized, a `respond` that arrives before escalation is mined
resolves the dispute on its merits (with both parties' evidence), so a genuine answer always
wins if it shows up. Studionet's GenVM exposes no wall clock, so the window is measured in
protocol actions rather than seconds — the honest primitive for this environment.

**Verified on-chain.** Both were exercised end-to-end through MetaMask on the deployed contract:

- *Evidence path* — a disputant claimed "never delivered" while the counterparty's pinned
  receipt (fetched by the contract) showed on-time delivery. The arbiter ruled **100% to the
  counterparty** — decided on the fetched evidence, against the party who only asserted.
- *Response window* — immediately after a `nudge`, `escalate` reverted with *"response window
  still open."* Once the window legitimately elapsed with no answer, `escalate` succeeded, ruled
  **by escalation**, and recorded a **forfeit** against the silent party. It blocks the instant
  no-answer path without stonewalling a genuine one.

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

- **Address:** `0xb89e664E44CB5E68988C9D6D928fdaeC43048042`

> **Payout fix (July 2026).** Wallet payouts are sent as EVM external messages (an empty `@gl.evm.contract_interface` proxy executed by the contract's ghost account). The previous GenVM-call pattern errored at finalization on plain wallets and stranded the value; the contract was redeployed at the address above with the corrected transfer path.

- **Network:** GenLayer Studionet
- **View in Studio:** [GenLayer Studio](https://studio.genlayer.com/?import-contract=0xb89e664E44CB5E68988C9D6D928fdaeC43048042)

No wall-clock exists on Studionet's GenVM, so every lifecycle gate is action-based:
unaccepted proposals are cancellable, deadlines live in the sealed terms (the arbiter
enforces them on reveal), and dispute liveness uses nudge → escalate, where a response
that lands first always wins.

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
