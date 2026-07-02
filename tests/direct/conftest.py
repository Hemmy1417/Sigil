"""Shared helpers for direct mode tests."""

import hashlib

CONTRACT = "contracts/sigil.py"


def seal_hash(terms: str, salt: str) -> str:
    """The commit scheme: sha256(terms + "\\n" + salt) hex — must match the
    contract's _hash_of and the frontend's termsHash."""
    return hashlib.sha256((terms + "\n" + salt).encode("utf-8")).hexdigest()


def to_hex(addr_bytes):
    """Convert address bytes to checksummed hex matching contract output."""
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.py.types import Address

    return Address(addr_bytes).as_hex
