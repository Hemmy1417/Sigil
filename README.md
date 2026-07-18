<p align="center">
  <img src="https://raw.githubusercontent.com/Hemmy1417/Sigil/main/frontend/app/icon.svg" alt="Sigil" width="140" />
</p>

# Sigil - Private P2P Sealed Agreements

**Confidential deals with real escrow, AI-arbitrated when someone breaks their word.**

Some deals are nobody else's business - a loan to a friend, a gig, a wager, a deposit. Two people
seal any agreement on GenLayer while keeping the terms private: only a salted SHA-256 fingerprint
touches the chain. Settle cleanly and the terms are never revealed. Break your word, and the other
party breaks the seal - the terms go on-chain, hash-verified, and an AI-validator panel rules the
split of the escrow from the agreement's own words and fetched evidence.

Live app: **https://sigil-alpha.vercel.app**

## What it is

- **Commit/reveal privacy** - the public registry shows fingerprints, parties, and states; never
  terms, unless a dispute broke the seal.
- **Cryptographic mutual assent** - the counterparty must present the *same* hash to accept:
  proof both hold identical terms before any money locks.
- **Evidence-grounded arbitration** - the contract itself fetches each party's pinned evidence
  URLs; statements are demoted to advocacy, and rulings bind to the committed agreement plus
  retrieved pages.
- **An enforced response window on a real clock** - a silent respondent is demanded to answer
  on-chain (`nudge`); escalation past them is refused until real fetched time proves the window
  elapsed. A genuine answer always wins if it shows up.
- **A deliberately public reputation ledger** - sealed / settled clean / disputes won / lost /
  forfeits, per wallet: the one thing that is meant to be seen.

## How it works

### Sealing and settling (terms never revealed)
1. Draft terms privately (templates: loan, gig, wager, deposit, custom); the app's vault holds
   them off-chain.
2. The proposer commits `sha256(terms + "\n" + salt)` on-chain with their stake and names the
   counterparty's stake.
3. The counterparty accepts by presenting the same hash and posting their stake.
4. Both parties confirm the same settlement split - the escrow releases; the chain only ever saw
   a seal.

### Breaking the seal (dispute)
1. Either party reveals `terms + salt` on-chain - hash-verified against the seal - with a
   statement and up to three evidence URLs.
2. The other party responds with their statement and evidence; the panel rules immediately on the
   merits.
3. If they stay silent: `nudge` stamps the response window; after it provably elapses, `escalate`
   rules one-sided - the silence is weighed as a forfeit.
4. The ruled split pays out; both records update on the reputation ledger.

## Rulings

| Split bucket | Meaning |
|---|---|
| `100 / 0` | The agreement's words and fetched evidence fully support the proposer. |
| `75 / 25` - `25 / 75` | Partial merit either way. |
| `50 / 50` | Nothing verifiable resolves an ambiguous term - the arbiter defaults to the middle, never handing the escrow to one side on their word alone. |
| `0 / 100` | The counterparty's case holds in full. |

Validators agree on the bucket, not prose - LLM stylistic variation never kills a consensus round.
Unreachable evidence URLs are surfaced to the arbiter as "no evidence," not silently trusted.

## Deal lifecycle

```text
OPEN -> ACTIVE -> SETTLED                      (both confirm the same split)
  |        |
  |     DISPUTED -> RESOLVED                   (respond, or nudge -> window -> escalate)
  -> CANCELLED                                 (unaccepted deal withdrawn)
```

| State | What happens |
|---|---|
| `OPEN` | Sealed and staked by the proposer; awaiting the counterparty's matching hash + stake. |
| `ACTIVE` | Both committed and escrowed; terms remain private. |
| `DISPUTED` | The seal is broken - terms revealed on-chain, hash-verified; the answer path is open. |
| `RESOLVED` | The panel ruled a split; escrow paid out accordingly; reputations updated. |
| `SETTLED` | Clean mutual settlement - the terms were never revealed. |
| `CANCELLED` | Withdrawn before acceptance; the proposer's stake returns. |

## GenLayer consensus functions

| Function | Kind | What runs under consensus |
|---|---|---|
| `respond` | write | The panel reads the revealed agreement + both statements, fetches every pinned evidence URL, and rules the split bucket via `gl.eq_principle.prompt_comparative`. |
| `escalate` | write | The same arbitration, one-sided, allowed only after a fresh clock-fetch proves the response window elapsed since the nudge; silence is a forfeit. |
| `nudge` | write | Fetches the consensus wall-clock to stamp the response window. |
| `check_terms` | write | An AI pre-read of draft terms - clarity score + issues a neutral arbiter would struggle with; stores nothing. |

## Contract

| Field | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com` |
| Contract address | [`0x097c434abF6f1dC87AC8658a46d25c307916AAE8`](https://studio.genlayer.com/?import-contract=0x097c434abF6f1dC87AC8658a46d25c307916AAE8) |
| Source | `contracts/sigil.py` |

### Write methods

| Method | Who | Payable | Notes |
|---|---|---|---|
| `create_deal(terms_hash, counterparty, counter_stake_wei, template, label)` | proposer | stake | Commits the salted SHA-256 seal. |
| `accept_deal(deal_id, terms_hash)` | counterparty | stake | Must present the identical hash - mutual assent, proven. |
| `cancel_deal(deal_id)` | proposer | - | Before acceptance only; stake returns. |
| `confirm_settlement(deal_id, to_proposer_pct)` | each party | - | Escrow releases when both confirm the same split. |
| `dispute(deal_id, terms, salt, statement, evidence_urls)` | either party | - | Reveals the terms, hash-verified against the seal. |
| `respond(deal_id, statement, evidence_urls)` | the other party | - | Resolves the dispute on the merits. |
| `nudge(deal_id)` | disputant | - | On-chain demand to answer; stamps the response window. |
| `escalate(deal_id)` | disputant | - | One-sided ruling, refused until the window provably passed. |
| `check_terms(terms)` | anyone | - | AI clerk pre-read of a draft. |

### Read methods

`get_deal`, `get_deals_for`, `get_reputation`, `get_registry`, `get_stats`

### Consensus guarantees

- **The ruling grounds in fetched evidence** - the contract fetches the pinned URLs itself;
  parties' statements are advocacy, not fact.
- **The window is real time, not protocol actions** - the clock is fetched from Cloudflare's edge
  and Ethereum's own latest block timestamp under consensus; filler transactions cannot advance
  it, and no number of wallets can manufacture elapsed minutes.
- **Fails closed** - no reachable time source, or the two sources disagreeing by more than 300 s,
  refuses escalation; it is never granted on an untrusted clock. Execution is serialized, so a
  `respond` that lands before escalation resolves the dispute on its merits.

## Verified end-to-end

Live MetaMask run on the deployed lineage:

```text
dispute   "never delivered" vs a pinned delivery receipt
fetch     the contract retrieved the receipt page itself
ruling    100% to the counterparty - decided on the fetched evidence,
          against the party who only asserted
```

Direct tests pin the window enforcement:

```text
escalate immediately after nudge            -> refused
escalate after the fetched clock advances   -> allowed, silence forfeits
creating unrelated filler deals             -> does NOT advance the window
no reachable / diverging time sources       -> fails closed, never grants
```

> The v0.4 redeploy fixed a dead clock: the original sources (`timeapi.io` ~6 minutes behind UTC,
> `worldtimeapi.org` unreachable from validators) tripped the divergence guard on every call, so
> the fail-closed logic - correctly - refused every escalation. The sources were replaced with the
> probe-verified pair, and the tests now include a source that *lies*, the exact case the old
> stubs missed.

**24 direct-mode tests.**

## Tech stack

| Layer | Tech |
|---|---|
| Intelligent Contract | Python on GenVM (seals, escrow, arbitration, reputation) |
| Consensus | `gl.eq_principle.prompt_comparative` + nondet evidence fetches |
| Frontend | Next.js, React, Tailwind - Kraken-inspired light design |
| Terms vault | Next.js API routes + Firestore (off-chain by design - privacy is the product) |
| Web3 | GenLayerJS, EIP-6963 injected wallets |

## Repository

```text
contracts/sigil.py          The Intelligent Contract (v0.4, deployed)
tests/direct/               24 direct-mode tests, pytest
frontend/                   Next.js app (deals, deal room, verify, registry, record)
```

## Getting started

```bash
# contract tests
python -m pytest tests/direct -q

# frontend
cd frontend
cp .env.example .env.local     # contract address prefilled for Studionet
npm install
npm run dev
```

## Security

- Terms never touch the chain unless a dispute reveals them - and a reveal is hash-verified
  against the original seal, so nobody can substitute a different agreement.
- The response window cannot be shortcut: only real fetched time opens the escalate path, and the
  disputant cannot nudge and escalate in the same breath.
- A trustless verifier lets anyone holding `terms + salt` prove they match an on-chain seal
  entirely in the browser - the vault never has to be trusted for integrity.
- Wallet payouts go through an empty `@gl.evm.contract_interface` proxy (`emit_transfer` at a
  plain wallet strands value).

## Design notes

- Privacy is the product: the registry proves *that* an agreement exists and *how it ended*,
  never what it said. Reputation is the one deliberately public surface.
- The middle-split default on ambiguity makes breaking the seal unattractive as a weapon - a
  fabricated dispute cannot expect better than 50/50 without evidence.
- The clock war story is kept in the tests: a stubbed source that lies is now a permanent
  regression case, because production-identical stubs were exactly how the dead clock stayed
  green.

## Disclaimer

Sigil is a hackathon project on a test network. Escrowed GEN is testnet currency; do not use the
contract for real agreements without an audit.
