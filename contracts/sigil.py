# v0.2.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import hashlib
from genlayer import *

# SIGIL — private P2P agreements. Terms live off-chain; only a salted SHA-256
# commitment is public. Escrow in GEN. On dispute the disputant breaks the seal
# (reveals terms + salt on-chain), the counterparty answers, and an AI validator
# panel rules a split of the pot.
#
# Studionet's GenVM exposes no time source (gl.message has no datetime, no block
# number), so every lifecycle gate is action-based, never clock-based:
#   - unaccepted proposals are cancellable by the proposer at any moment
#   - deadlines belong in the sealed terms; the arbiter enforces them on reveal
#   - a silent respondent is handled by nudge -> escalate (a respond that lands
#     first always wins, because transactions serialize)


SPLIT_BUCKETS   = (0, 25, 50, 75, 100)   # % of pot to the DISPUTANT — arbiter picks one
MAX_TERMS_CHARS = 4000
MAX_STATEMENT   = 1500
MAX_LABEL       = 80
TEMPLATES       = ("loan", "gig", "wager", "deposit", "custom")
NO_ANSWER       = "(the accused party gave no answer)"


def _parse_json(raw):
    text = raw.strip()
    if "```" in text:
        parts = text.split("```")
        text  = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def _nearest_bucket(pct):
    try:
        p = int(pct)
    except (ValueError, TypeError):
        return 50
    return min(SPLIT_BUCKETS, key=lambda b: abs(b - p))


class Sigil(gl.Contract):
    total_deals:    u256
    total_settled:  u256
    total_disputes: u256
    deals:          TreeMap[str, str]   # deal_id -> deal JSON
    wallet_deals:   TreeMap[str, str]   # address -> JSON list of deal_ids
    reputation:     TreeMap[str, str]   # address -> reputation JSON
    pot:            u256

    def __init__(self):
        self.total_deals    = u256(0)
        self.total_settled  = u256(0)
        self.total_disputes = u256(0)
        self.pot            = u256(0)

    # ── internal helpers ─────────────────────────────────────────────────────

    def _deal(self, deal_id):
        raw = self.deals.get(deal_id, "")
        if not raw:
            raise gl.vm.UserError("no such deal")
        return json.loads(raw)

    def _save(self, deal):
        self.deals[deal["deal_id"]] = json.dumps(deal)

    def _index(self, address, deal_id):
        key = address.lower()
        raw = self.wallet_deals.get(key, "")
        ids = json.loads(raw) if raw else []
        if deal_id not in ids:
            ids.append(deal_id)
            self.wallet_deals[key] = json.dumps(ids)

    def _rep(self, address):
        raw = self.reputation.get(address.lower(), "")
        if raw:
            return json.loads(raw)
        return {"owner": address, "sealed": 0, "settled_clean": 0,
                "disputes_won": 0, "disputes_lost": 0, "forfeits": 0}

    def _bump(self, address, field):
        r = self._rep(address)
        r[field] = int(r.get(field, 0)) + 1
        self.reputation[address.lower()] = json.dumps(r)

    def _pay(self, address, amount):
        if amount > 0:
            gl.get_contract_at(Address(address)).emit_transfer(value=u256(int(amount)), on="finalized")

    def _payout(self, deal, to_proposer):
        total = int(deal["proposer_stake"]) + int(deal["counter_stake"])
        share_p = (total * int(to_proposer)) // 100
        share_c = total - share_p
        self._pay(deal["proposer"], share_p)
        self._pay(deal["counterparty"], share_c)
        self.pot = u256(max(0, int(self.pot) - total))

    def _log(self, deal, event):
        deal["provenance"].append({"n": len(deal["provenance"]), "event": event})

    def _require_party(self, deal, who):
        w = who.lower()
        if w != deal["proposer"].lower() and w != deal["counterparty"].lower():
            raise gl.vm.UserError("only a party to this deal may do that")

    def _hash_of(self, terms, salt):
        return hashlib.sha256((terms + "\n" + salt).encode("utf-8")).hexdigest()

    # ── AI: arbitration (relaxed consensus — bucket agreement only) ─────────

    def _arbitrate(self, deal):
        terms     = deal["revealed_terms"]
        claim     = deal["dispute_statement"]
        answer    = deal["response_statement"] or NO_ANSWER
        disputant = "proposer" if deal["disputant"].lower() == deal["proposer"].lower() else "counterparty"

        def deliberate():
            prompt = f"""You are the neutral arbiter for SIGIL, a private agreements protocol.
Two parties sealed the agreement below. The {disputant} has disputed it.
Both stakes sit in escrow. Decide what percentage of the TOTAL escrow the DISPUTANT should receive.

THE SEALED AGREEMENT (revealed for this dispute):
{terms}

DISPUTANT'S CLAIM ({disputant}):
{claim}

OTHER PARTY'S ANSWER:
{answer}

Rules:
- Judge ONLY from the agreement text and the two statements.
- The agreement's own words control. If it is silent or ambiguous on the disputed point, favor a middle split.
- If the answer is "{NO_ANSWER}", weigh the silence against that party but still honor what the agreement says.
- Pick the split from exactly these buckets: 0, 25, 50, 75, 100 (percent of total escrow to the disputant).

Respond ONLY with JSON:
{{"split_to_disputant": <0|25|50|75|100>, "rationale": "<two sentences, plain language>"}}"""
            return gl.nondet.exec_prompt(prompt)

        principle = (
            "Outputs are equivalent if split_to_disputant falls in the same bucket. "
            "Rationale wording may differ freely."
        )
        verdict = _parse_json(gl.eq_principle.prompt_comparative(deliberate, principle))
        bucket  = _nearest_bucket(verdict.get("split_to_disputant", 50))
        why     = str(verdict.get("rationale", "")).strip()[:500] or "The arbiter has ruled."
        return bucket, why

    def _resolve(self, deal, bucket, why, kind, responder):
        disputant_is_proposer = deal["disputant"].lower() == deal["proposer"].lower()
        to_proposer = bucket if disputant_is_proposer else 100 - bucket
        deal["state"]  = "RESOLVED"
        deal["ruling"] = {"kind": kind, "to_proposer": to_proposer,
                          "split_to_disputant": bucket, "rationale": why}
        self._payout(deal, to_proposer)
        if bucket > 50:
            self._bump(deal["disputant"], "disputes_won")
            self._bump(responder, "disputes_lost")
        elif bucket < 50:
            self._bump(responder, "disputes_won")
            self._bump(deal["disputant"], "disputes_lost")

    # ── writes ───────────────────────────────────────────────────────────────

    @gl.public.write.payable
    def create_deal(self, terms_hash: str, counterparty: str,
                    counter_stake_wei: str, template: str, label: str) -> str:
        proposer = str(gl.message.sender_address)
        stake    = int(gl.message.value)

        h = terms_hash.strip().lower()
        if h.startswith("0x"):
            h = h[2:]
        if len(h) != 64 or any(c not in "0123456789abcdef" for c in h):
            raise gl.vm.UserError("terms_hash must be a sha256 hex digest")
        cp = counterparty.strip()
        if not cp.startswith("0x") or len(cp) != 42:
            raise gl.vm.UserError("counterparty must be a wallet address")
        if cp.lower() == proposer.lower():
            raise gl.vm.UserError("you cannot seal a deal with yourself")
        if stake <= 0:
            raise gl.vm.UserError("send your stake (value) to seal the deal")

        need = max(0, int(counter_stake_wei or "0"))
        tmpl = template if template in TEMPLATES else "custom"
        seq  = int(self.total_deals)

        deal_id = f"s_{seq}"
        deal = {
            "deal_id":            deal_id,
            "seq":                seq,
            "proposer":           proposer,
            "counterparty":       cp,
            "terms_hash":         h,
            "template":           tmpl,
            "label":              label.strip()[:MAX_LABEL] or "Sealed deal",
            "proposer_stake":     str(stake),
            "counter_stake_req":  str(need),
            "counter_stake":      "0",
            "state":              "OPEN",
            "settle_votes":       {},
            "disputant":          "",
            "dispute_statement":  "",
            "response_statement": "",
            "revealed_terms":     "",
            "revealed_salt":      "",
            "nudged":             False,
            "ruling":             None,
            "provenance":         [],
        }
        self._log(deal, "sealed")
        self._save(deal)
        self._index(proposer, deal_id)
        self._index(cp, deal_id)
        self._bump(proposer, "sealed")
        self.pot         = u256(int(self.pot) + stake)
        self.total_deals = u256(seq + 1)
        return json.dumps(deal)

    @gl.public.write.payable
    def accept_deal(self, deal_id: str, terms_hash: str) -> str:
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        stake  = int(gl.message.value)

        if deal["state"] != "OPEN":
            raise gl.vm.UserError("deal is not open for acceptance")
        if sender.lower() != deal["counterparty"].lower():
            raise gl.vm.UserError("this deal names a different counterparty")
        h = terms_hash.strip().lower()
        if h.startswith("0x"):
            h = h[2:]
        if h != deal["terms_hash"]:
            raise gl.vm.UserError("terms hash does not match the sealed commitment")
        if stake < int(deal["counter_stake_req"]):
            raise gl.vm.UserError("stake below the amount the proposal requires")

        deal["counter_stake"] = str(stake)
        deal["state"]         = "ACTIVE"
        self._log(deal, "accepted")
        self._save(deal)
        self._bump(sender, "sealed")
        self.pot = u256(int(self.pot) + stake)
        return json.dumps(deal)

    @gl.public.write
    def cancel_deal(self, deal_id: str) -> str:
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        if deal["state"] != "OPEN":
            raise gl.vm.UserError("only an unaccepted proposal can be cancelled")
        if sender.lower() != deal["proposer"].lower():
            raise gl.vm.UserError("only the proposer may cancel")
        deal["state"] = "CANCELLED"
        self._log(deal, "cancelled")
        self._save(deal)
        self._pay(deal["proposer"], int(deal["proposer_stake"]))
        self.pot = u256(max(0, int(self.pot) - int(deal["proposer_stake"])))
        return json.dumps(deal)

    @gl.public.write
    def confirm_settlement(self, deal_id: str, to_proposer_pct: str) -> str:
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        self._require_party(deal, sender)
        if deal["state"] != "ACTIVE":
            raise gl.vm.UserError("deal is not active")
        pct = int(to_proposer_pct)
        if pct < 0 or pct > 100:
            raise gl.vm.UserError("split must be 0-100")

        deal["settle_votes"][sender.lower()] = pct
        votes = deal["settle_votes"]
        p, c  = deal["proposer"].lower(), deal["counterparty"].lower()
        if p in votes and c in votes and votes[p] == votes[c]:
            deal["state"] = "SETTLED"
            deal["ruling"] = {"kind": "mutual", "to_proposer": votes[p],
                              "rationale": "Both parties confirmed the same settlement. Terms were never revealed."}
            self._log(deal, "settled_mutual")
            self._payout(deal, votes[p])
            self._bump(deal["proposer"], "settled_clean")
            self._bump(deal["counterparty"], "settled_clean")
            self.total_settled = u256(int(self.total_settled) + 1)
        else:
            self._log(deal, f"settle_offer_{pct}")
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def dispute(self, deal_id: str, terms: str, salt: str, statement: str) -> str:
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        self._require_party(deal, sender)
        if deal["state"] != "ACTIVE":
            raise gl.vm.UserError("only an active deal can be disputed")
        if not statement.strip():
            raise gl.vm.UserError("state your claim")
        if len(terms) > MAX_TERMS_CHARS:
            raise gl.vm.UserError("terms exceed the protocol maximum")
        if self._hash_of(terms, salt) != deal["terms_hash"]:
            raise gl.vm.UserError("reveal does not match the sealed commitment")

        deal["state"]             = "DISPUTED"
        deal["disputant"]         = sender
        deal["dispute_statement"] = statement.strip()[:MAX_STATEMENT]
        deal["revealed_terms"]    = terms
        deal["revealed_salt"]     = salt
        self._log(deal, "seal_broken")
        self._save(deal)
        self.total_disputes = u256(int(self.total_disputes) + 1)
        return json.dumps(deal)

    @gl.public.write
    def respond(self, deal_id: str, statement: str) -> str:
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        self._require_party(deal, sender)
        if deal["state"] != "DISPUTED":
            raise gl.vm.UserError("no open dispute on this deal")
        if sender.lower() == deal["disputant"].lower():
            raise gl.vm.UserError("the disputant does not answer their own claim")
        if not statement.strip():
            raise gl.vm.UserError("state your answer")

        deal["response_statement"] = statement.strip()[:MAX_STATEMENT]
        self._log(deal, "answered")
        bucket, why = self._arbitrate(deal)
        self._log(deal, "arbitrated")
        self._resolve(deal, bucket, why, "arbitration", sender)
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def nudge(self, deal_id: str) -> str:
        """On-chain demand to answer. Arms escalation — the respondent can still
        answer at any moment; a respond that lands first always wins."""
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        if deal["state"] != "DISPUTED":
            raise gl.vm.UserError("no open dispute on this deal")
        if sender.lower() != deal["disputant"].lower():
            raise gl.vm.UserError("only the disputant may nudge")
        if deal["nudged"]:
            raise gl.vm.UserError("already nudged — you may escalate")
        deal["nudged"] = True
        self._log(deal, "nudged")
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def escalate(self, deal_id: str) -> str:
        """Arbitration without an answer. Requires a prior nudge; the silence is
        weighed against the absent party and counts as a forfeit on their record."""
        deal   = self._deal(deal_id)
        sender = str(gl.message.sender_address)
        if deal["state"] != "DISPUTED":
            raise gl.vm.UserError("no open dispute on this deal")
        if sender.lower() != deal["disputant"].lower():
            raise gl.vm.UserError("only the disputant may escalate")
        if not deal["nudged"]:
            raise gl.vm.UserError("nudge first — give them the chance to answer")

        disputant_is_proposer = deal["disputant"].lower() == deal["proposer"].lower()
        other = deal["counterparty"] if disputant_is_proposer else deal["proposer"]
        bucket, why = self._arbitrate(deal)
        self._log(deal, "escalated")
        self._resolve(deal, bucket, why, "escalation", other)
        self._bump(other, "forfeits")
        self._save(deal)
        return json.dumps(deal)

    @gl.public.write
    def check_terms(self, terms: str) -> str:
        """AI pre-read of draft terms. Stores nothing; costs one consensus round."""
        if not terms.strip() or len(terms) > MAX_TERMS_CHARS:
            raise gl.vm.UserError("provide terms up to the protocol maximum")

        def review():
            prompt = f"""You review draft agreements for SIGIL before they are sealed.
Read the draft and flag what a neutral arbiter would struggle with in a future dispute.

DRAFT:
{terms}

Respond ONLY with JSON:
{{"clarity": <0-100>, "issues": ["<up to 4 short flags: ambiguity, missing deadline, undefined 'done', one-sided term>"], "verdict": "<ready|needs_work>"}}"""
            return gl.nondet.exec_prompt(prompt)

        principle = (
            "Outputs are equivalent if verdict matches and clarity scores are within 25 points. "
            "Issue lists may differ in wording and count."
        )
        return json.dumps(_parse_json(gl.eq_principle.prompt_comparative(review, principle)))

    # ── reads (public data never includes terms unless a seal was broken) ────

    @gl.public.view
    def get_deal(self, deal_id: str) -> str:
        return self.deals.get(deal_id, "")

    @gl.public.view
    def get_deals_for(self, address: str) -> str:
        raw = self.wallet_deals.get(address.lower(), "")
        ids = json.loads(raw) if raw else []
        out = [json.loads(self.deals[i]) for i in ids if i in self.deals]
        out.sort(key=lambda d: -int(d["seq"]))
        return json.dumps(out)

    @gl.public.view
    def get_reputation(self, address: str) -> str:
        return json.dumps(self._rep(address))

    @gl.public.view
    def get_registry(self, n: str) -> str:
        """Public registry: every deal as hash + state + parties. Never terms."""
        count = int(self.total_deals)
        take  = min(count, max(1, int(n or "50")))
        out = []
        for i in range(count - 1, count - 1 - take, -1):
            raw = self.deals.get(f"s_{i}", "")
            if raw:
                d = json.loads(raw)
                out.append({
                    "deal_id": d["deal_id"], "terms_hash": d["terms_hash"],
                    "state": d["state"], "template": d["template"], "label": d["label"],
                    "proposer": d["proposer"], "counterparty": d["counterparty"],
                    "seq": d["seq"],
                    "revealed": bool(d["revealed_terms"]),
                })
        return json.dumps(out)

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_deals":    int(self.total_deals),
            "total_settled":  int(self.total_settled),
            "total_disputes": int(self.total_disputes),
            "escrow_wei":     str(int(self.pot)),
        })
