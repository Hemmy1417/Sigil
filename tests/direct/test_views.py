"""Tests for read-only view methods on a fresh contract."""

import json

from tests.direct.conftest import CONTRACT


def test_empty_stats(direct_deploy):
    contract = direct_deploy(CONTRACT)
    stats = json.loads(contract.get_stats())
    assert stats == {
        "total_deals": 0,
        "total_settled": 0,
        "total_disputes": 0,
        "escrow_wei": "0",
    }


def test_empty_registry(direct_deploy):
    contract = direct_deploy(CONTRACT)
    assert json.loads(contract.get_registry("50")) == []


def test_missing_deal_is_empty(direct_deploy):
    contract = direct_deploy(CONTRACT)
    assert contract.get_deal("s_0") == ""


def test_default_reputation(direct_deploy, direct_alice):
    from tests.direct.conftest import to_hex

    contract = direct_deploy(CONTRACT)
    alice = to_hex(direct_alice)
    rep = json.loads(contract.get_reputation(alice))
    assert rep["sealed"] == 0
    assert rep["settled_clean"] == 0
    assert rep["disputes_won"] == 0
    assert rep["disputes_lost"] == 0
    assert rep["forfeits"] == 0


def test_deals_for_unknown_wallet_is_empty(direct_deploy, direct_alice):
    from tests.direct.conftest import to_hex

    contract = direct_deploy(CONTRACT)
    assert json.loads(contract.get_deals_for(to_hex(direct_alice))) == []
