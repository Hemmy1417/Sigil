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
# Test wall-clock (epoch seconds). Tests advance this to simulate REAL time
# passing — which no on-chain party can do. Starts ~2025-10.
_NOW = [1_760_000_000]


# Per-source clock SKEW in seconds, keyed by a substring of the source URL.
# Default 0 (every source honest). A test can bias one source to model the real
# world: timeapi.io was ~381s behind UTC, which is exactly what broke this
# contract in production while the tests — which served every source from one
# shared clock — stayed green.
_SKEW = {}


class _NondetWeb:
    @staticmethod
    def render(url, mode="text"):
        _WEB_CALLS.append(url)
        skew = next((v for k, v in _SKEW.items() if k in url), 0)
        now = _NOW[0] + skew
        # Serve the contract's pinned time sources from the test clock.
        if "cdn-cgi/trace" in url:
            return f"fl=1x2\nh=cloudflare.com\nts={now}.000\nvisit_scheme=https\n"
        if "blockscout" in url and "main-page/blocks" in url:
            import datetime as _dt
            t = _dt.datetime.fromtimestamp(now, _dt.timezone.utc)
            return json.dumps([{
                "height": 25550946,
                "timestamp": t.strftime("%Y-%m-%dT%H:%M:%S.000000Z"),
            }])
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
    _NOW[0] = 1_760_000_000            # reset the test wall-clock each test
    _SKEW.clear()                      # …and assume every clock source is honest
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


def test_escalate_allowed_after_real_time_elapses(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    _as(module, P, 0)
    c.nudge(did)
    # only REAL wall-clock time opens the gate — advance the clock past the window
    _NOW[0] += module.RESPONSE_WINDOW_SECONDS + 1
    _as(module, P, 0)
    out = json.loads(c.escalate(did))
    assert out["state"] == "RESOLVED"
    assert out["ruling"]["kind"] == "escalation"


def test_filler_deals_do_NOT_advance_the_window(module, c):
    """The exact exploit the judges flagged: the disputant tries to run out the
    window by creating unrelated deals. With a wall-clock gate, action count is
    irrelevant — escalation stays refused until real time passes."""
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    _as(module, P, 0)
    c.nudge(did)
    # spam many filler deals (advancing the global action counter) WITHOUT
    # advancing the real clock
    for _ in range(10):
        _as(module, P, GEN)
        c.create_deal(_hash("filler", str(_)), Q, "0", "custom", "filler")
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="response window still open"):
        c.escalate(did)


def test_escalation_fails_closed_when_clock_is_unavailable(module, c):
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "Answer me.", "[]")
    # time sources return an unusable clock → nudge itself is refused
    _NOW[0] = 0
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="unreachable or unreliable"):
        c.nudge(did)


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


# ── Clock sources: the bug that made this contract's window inert ─────────────
#
# Shipped with timeapi.io + cloudflare + worldtimeapi and a 300s divergence
# guard. On-chain probing (2026-07-17) proved worldtimeapi never loads from
# validators and timeapi.io serves a clock ~381s BEHIND real UTC — so the guard
# tripped on every call, _utc_now() always read 0, and escalate() ALWAYS
# reverted. The response window this contract exists to enforce could never
# open. The old tests missed it because the stub served every source from one
# shared clock, i.e. it modelled a world where no clock ever lies.

def test_clock_sources_are_only_the_on_chain_proven_ones(module):
    assert module.TIME_SOURCES == (
        ("https://cloudflare.com/cdn-cgi/trace", "cf_trace"),
        ("https://eth.blockscout.com/api/v2/main-page/blocks", "eth_block"),
    )
    urls = " ".join(u for u, _ in module.TIME_SOURCES)
    assert "timeapi.io" not in urls        # serves time ~6 minutes behind UTC
    assert "worldtimeapi" not in urls      # WEBPAGE_LOAD_FAILED from validators


def test_epoch_from_iso_matches_civil(module):
    assert module._epoch_from_iso("2026-07-17T07:35:11.000000Z") == \
        module._epoch_from_civil(2026, 7, 17, 7, 35, 11)


def test_both_clock_sources_are_actually_read_and_agree(module, c):
    """Regression: prove the window really opens on honest clocks — the exact
    thing that silently stopped working in production."""
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "claim", "[]")
    _as(module, P, 0)
    _WEB_CALLS.clear()
    c.nudge(did)
    assert any("cdn-cgi/trace" in u for u in _WEB_CALLS)
    assert any("blockscout" in u for u in _WEB_CALLS)
    _NOW[0] += module.RESPONSE_WINDOW_SECONDS + 1
    _as(module, P, 0)
    out = json.loads(c.escalate(did))      # the window opens on real elapsed time
    assert out["state"] == "RESOLVED"
    assert out["ruling"]["kind"] == "escalation"


def test_a_lying_clock_source_fails_closed_not_open(module, c):
    """If one source drifts beyond tolerance (timeapi.io's real 381s bias), the
    reading is discarded and escalation is REFUSED — never granted on bad time."""
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "claim", "[]")
    _SKEW["blockscout"] = -381             # one source lies by >300s
    _as(module, P, 0)
    with pytest.raises(module.gl.vm.UserError, match="unreachable or unreliable"):
        c.nudge(did)


def test_one_dead_source_still_leaves_a_working_clock(module, c):
    """A single outage must not block a dispute — one honest source suffices."""
    did = _active_deal(module, c)
    _as(module, P, 0)
    c.dispute(did, TERMS, SALT, "claim", "[]")
    real = module.TIME_SOURCES
    try:
        # blockscout goes dark; Cloudflare alone must still open the window
        module.TIME_SOURCES = (real[0], ("https://unreachable.example/x", "eth_block"))
        _as(module, P, 0)
        c.nudge(did)
        _NOW[0] += module.RESPONSE_WINDOW_SECONDS + 1
        _as(module, P, 0)
        out = json.loads(c.escalate(did))
        assert out["state"] == "RESOLVED"
        assert out["ruling"]["kind"] == "escalation"
    finally:
        module.TIME_SOURCES = real
