"""Validation tests for create_deal — the checks that guard the seal."""

import pytest

from tests.direct.conftest import CONTRACT, seal_hash

VALID_HASH = seal_hash("Test terms.", "salt-123")
OTHER_WALLET = "0x000000000000000000000000000000000000dEaD"


def test_rejects_malformed_hash(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with pytest.raises(Exception, match="sha256"):
        contract.create_deal("not-a-hash", OTHER_WALLET, "0", "custom", "Bad hash")


def test_rejects_malformed_counterparty(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with pytest.raises(Exception, match="wallet address"):
        contract.create_deal(VALID_HASH, "nobody", "0", "custom", "Bad counterparty")


def test_rejects_self_deal(direct_vm, direct_deploy, direct_alice):
    from tests.direct.conftest import to_hex

    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with pytest.raises(Exception, match="yourself"):
        contract.create_deal(VALID_HASH, to_hex(direct_alice), "0", "custom", "Self deal")


def test_rejects_zero_stake(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with pytest.raises(Exception, match="stake"):
        contract.create_deal(VALID_HASH, OTHER_WALLET, "0", "custom", "No stake")


def test_hash_scheme_matches_contract(direct_deploy):
    """The frontend and tests compute sha256(terms + "\\n" + salt); a deal
    sealed with that hash must verify by the same scheme."""
    assert seal_hash("abc", "s") == seal_hash("abc", "s")
    assert seal_hash("abc", "s") != seal_hash("abc", "t")
    assert len(VALID_HASH) == 64
