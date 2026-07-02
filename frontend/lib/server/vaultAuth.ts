// Server-only: wallet-signature verification for vault access.

import { verifyMessage, getAddress } from "ethers";

const MAX_SKEW_MS = 5 * 60 * 1000;

// The exact string the client asks the wallet to sign (lib/vault.ts).
export function vaultMessage(hash: string, ts: string): string {
  return `SIGIL vault access\nhash: ${hash.toLowerCase()}\nts: ${ts}`;
}

// Verifies the x-sigil-* headers and returns the checksummed caller address.
export function requireWallet(headers: Headers, hash: string): string {
  const sig = headers.get("x-sigil-signature") ?? "";
  const ts = headers.get("x-sigil-ts") ?? "";
  if (!sig || !ts) throw new Error("Missing signature headers");

  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(age) || age > MAX_SKEW_MS) {
    throw new Error("Signature expired — retry");
  }

  try {
    return getAddress(verifyMessage(vaultMessage(hash, ts), sig));
  } catch {
    throw new Error("Invalid signature");
  }
}
