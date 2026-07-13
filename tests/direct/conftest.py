"""Shared direct-mode test harness for sigil.py.

Installs a stubbed genlayer runtime (no gltest plugin) and provides the
`direct_deploy` / `direct_vm` / `direct_alice` fixtures the create/view tests
use. The stub mirrors the one in test_hardening.py so the two never diverge.
"""

import hashlib
import importlib.util
import pathlib
import sys
import types

import pytest

CONTRACT = "contracts/sigil.py"
CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "sigil.py"

ALICE = "0x1111111111111111111111111111111111111111"
BOB = "0x2222222222222222222222222222222222222222"


def seal_hash(terms: str, salt: str) -> str:
    """The commit scheme: sha256(terms + "\\n" + salt) hex — must match the
    contract's _hash_of and the frontend's termsHash."""
    return hashlib.sha256((terms + "\n" + salt).encode("utf-8")).hexdigest()


def to_hex(addr):
    """Direct-mode addresses are already hex strings; tolerate a real Address."""
    if isinstance(addr, str):
        return addr
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    return str(addr)


# ── genlayer runtime stub (mirrors test_hardening.py) ────────────────────────

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


class _NondetWeb:
    @staticmethod
    def render(url, mode="text"):
        if "unreachable" in url:
            raise RuntimeError("403")
        return f"[fetched proof from {url}]"


class _Nondet:
    web = _NondetWeb()

    @staticmethod
    def exec_prompt(task):
        return _EqPrinciple.canned


class _EqPrinciple:
    canned = '{"split_to_disputant": 50, "rationale": "stub"}'

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


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("sigil_conftest", CONTRACT_PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ── fixtures the create/view tests expect ────────────────────────────────────

@pytest.fixture
def _direct_mod():
    m = _load()
    _GL._emit = []
    m.gl.message.sender_address = ALICE
    m.gl.message.value = 0
    return m


@pytest.fixture
def direct_deploy(_direct_mod):
    def _deploy(_path=CONTRACT):
        s = _direct_mod.Sigil()
        # GenLayer auto-initializes TreeMap storage; the stub doesn't, so do it here.
        for name in ("deals", "wallet_deals", "reputation"):
            setattr(s, name, _direct_mod.TreeMap())
        return s
    return _deploy


@pytest.fixture
def direct_vm(_direct_mod):
    class _VM:
        @property
        def sender(self):
            return _direct_mod.gl.message.sender_address
        @sender.setter
        def sender(self, v):
            _direct_mod.gl.message.sender_address = to_hex(v)
        @property
        def value(self):
            return _direct_mod.gl.message.value
        @value.setter
        def value(self, v):
            _direct_mod.gl.message.value = int(v)
    return _VM()


@pytest.fixture
def direct_alice():
    return ALICE
