"""
Self-contained direct-mode tests for the sigil.py hardening (hackathon
feedback): the contract-verifiable evidence path in arbitration and the
enforced response window between nudge and escalate. Uses a stubbed genlayer
runtime (no gltest plugin needed). Run with: python -m pytest tests/direct -q
"""

import hashlib
import importlib.util
import json
import pathlib
import sys
import types
import pytest


CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "sigil.py"


class _UserError(Exception):
    pass


class _VmModule:
    UserError = _UserError


class _TreeMap(dict):
    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _Address(str):
    def __new__(cls, v):
        if isinstance(v, _Address):
            raise TypeError("cannot convert 'Address' object to bytes")
        return super().__new__(cls, v)


class _ViewDeco:
    def __call__(self, fn): return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)
    def __call__(self, fn): return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


class _Evm:
    @staticmethod
    def contract_interface(cls):
        class _Proxy:
            def __init__(self, addr): self._addr = str(addr)
            def emit_transfer(self, value, on=None):
                _GL._emit.append((self._addr, int(value), on))
        return _Proxy


_WEB_CALLS = []


class _NondetWeb:
    @staticmethod
    def render(url, mode="text"):
        _WEB_CALLS.append(url)
        if "unreachable" in url:
            raise RuntimeError("403")
        return f"[fetched proof from {url}]"


class _Nondet:
    web = _NondetWeb()

    @staticmethod
    def exec_prompt(task):
        _EqPrinciple.last_prompt = task
        return _EqPrinciple.canned


class _EqPrinciple:
    canned = '{"split_to_disputant": 75, "rationale": "stub"}'
    last_prompt = ""

    @classmethod
    def prompt_comparative(cls, fn, principle):
        return fn()


class _GL:
    class Contract: pass
    evm = _Evm(); nondet = _Nondet(); eq_principle = _EqPrinciple
    public = _Public(); vm = _VmModule
    _emit = []
    class message:
        sender_address = "0x0000000000000000000000000000000000000000"
        value = 0


def _install():
    mod = types.ModuleType("genlayer")
    mod.gl = _GL; mod.TreeMap = _TreeMap; mod.u256 = _U256; mod.Address = _Address
    mod.__all__ = ["gl", "TreeMap", "u256", "Address"]
    sys.modules["genlayer"] = mod


_install()


def _load():
    _install()  # re-assert this file's stub so a sibling conftest can't shadow it
    spec = importlib.util.spec_from_file_location("sigil_contract", CONTRACT_PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


P = "0x1111111111111111111111111111111111111111"
Q = "0x2222222222222222222222222222222222222222"
GEN = 10 ** 18
TERMS = "Alice pays Bob 5 GEN on delivery of the report by Friday."
SALT = "s3cr3t-salt"


def _hash(terms, salt):
    return hashlib.sha256((terms + "\n" + salt).encode("utf-8")).hexdigest()


@pytest.fixture
def module():
    return _load()


@pytest.fixture
def c(module):
    _GL._emit = []
    _WEB_CALLS.clear()
    _EqPrinciple.canned = '{"split_to_disputant": 75, "rationale": "stub"}'
    _as(module, P, 0)
    s = module.Sigil()
    # GenLayer auto-initializes TreeMap-typed storage; the stub doesn't, so do it here.
    for name in ("deals", "wallet_deals", "reputation"):
        setattr(s, name, module.TreeMap())
    return s


def _as(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def _active_deal(module, c):
    h = _hash(TERMS, SALT)
    _as(module, P, GEN)
    d = json.loads(c.create_deal(h, Q, "0", "custom", "gig"))
    _as(module, Q, GEN)
    c.accept_deal(d["deal_id"], h)
    return d["deal_id"]


# ── contract-verifiable evidence path ────────────────────────────────────────

def test_dispute_evidence_is_fetched_and_reaches_arbiter(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)   # proposer disputes with pinned evidence
    c.dispute(did, TERMS, SALT, "Bob never delivered.",
              json.dumps(["https://proof.example.com/repo-empty"]))
    # counterparty answers with their own evidence → arbitration runs
    _as(module, Q, 0)
    c.respond(did, "Here is the delivered report.",
              json.dumps(["https://proof.example.com/delivered.pdf"]))
    # the contract fetched both parties' pinned URLs
    assert "https://proof.example.com/repo-empty" in _WEB_CALLS
    assert "https://proof.example.com/delivered.pdf" in _WEB_CALLS
    # and they were handed to the arbiter as FETCHED EVIDENCE
    assert "FETCHED EVIDENCE" in _EqPrinciple.last_prompt
    assert "proof.example.com/delivered.pdf" in _EqPrinciple.last_prompt


def test_bad_evidence_urls_are_dropped(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    d = json.loads(c.dispute(did, TERMS, SALT, "claim",
                             json.dumps(["not-a-url", "ftp://x", "https://ok.example.com/e"])))
    assert d["dispute_evidence"] == ["https://ok.example.com/e"]


def test_arbitration_resolves_and_pays(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Bob owes me.", "[]")
    _as(module, Q, 0)
    out = json.loads(c.respond(did, "No I don't.", "[]"))
    assert out["state"] == "RESOLVED"
    # split_to_disputant 75 → disputant (proposer) gets 75% of the 2-GEN pot
    assert module.gl._emit  # a payout fired


# ── enforced response window ─────────────────────────────────────────────────

def test_cannot_nudge_and_escalate_in_the_same_breath(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    _as(module, P, 0)
    c.nudge(did)
    # immediate escalate — no window has elapsed
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="response window still open"):
        c.escalate(did)


def test_escalate_allowed_after_window_elapses(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    _as(module, P, 0)
    c.nudge(did)
    # advance the protocol action counter by RESPONSE_WINDOW via unrelated writes
    for _ in range(module.RESPONSE_WINDOW):
        _as(module, P, GEN)
        c.create_deal(_hash("x", "y"), Q, "0", "custom", "filler")
    _as(module, P, 0)
    out = json.loads(c.escalate(did))
    assert out["state"] == "RESOLVED"
    assert out["ruling"]["kind"] == "escalation"


def test_respond_during_window_beats_escalation(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    _as(module, P, 0)
    c.nudge(did)
    # counterparty answers before the window elapses → resolves by arbitration
    _as(module, Q, 0)
    c.respond(did, "Here is my answer.", "[]")
    # now escalate can't fire — the deal is already RESOLVED
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="no open dispute"):
        c.escalate(did)


def test_escalate_still_requires_a_nudge(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "claim", "[]")
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="nudge first"):
        c.escalate(did)
