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
- **AI arbitration** — `gl.eq_principle.prompt_comparative` consensus; validators only
  need to agree on the split bucket (0/25/50/75/100), which keeps rulings determinate
- **AI terms pre-read** — before sealing, ask the same arbiter to flag ambiguity in a
  draft (clarity score + issues)
- **Deal templates** — loan, gig, wager, deposit, or custom
- **Reputation ledger** — the one deliberately-public thing: sealed / settled clean /
  disputes won / disputes lost / forfeits, per wallet
- **Nudge → escalate** — a silent respondent can be demanded to answer on-chain, then
  escalated past; silence is weighed against them and forfeits their record
- **Trustless verifier** — anyone holding terms + salt can prove they match an on-chain
  seal, entirely in the browser

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

- **Address:** `0xc46614d4B85a6F4D81e4E3817A1F4171c327ADA3`
- **Network:** GenLayer Studionet
- **View in Studio:** [GenLayer Studio](https://studio.genlayer.com/?import-contract=0xc46614d4B85a6F4D81e4E3817A1F4171c327ADA3)

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
