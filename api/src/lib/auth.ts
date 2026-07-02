import { verifyMessage, getAddress } from "ethers";
import type { Request } from "express";

const MAX_SKEW_MS = 5 * 60 * 1000;

// The exact string the frontend asks the wallet to sign. Timestamp bound so a
// captured signature cannot be replayed later than the skew window.
export function vaultMessage(hash: string, ts: string): string {
  return `SIGIL vault access\nhash: ${hash.toLowerCase()}\nts: ${ts}`;
}

export type Caller = { address: string };

// Verifies the x-sigil-* headers and returns the checksummed caller address.
// Throws with a human message on any failure.
export function requireWallet(req: Request, hash: string): Caller {
  const sig = String(req.headers["x-sigil-signature"] ?? "");
  const ts = String(req.headers["x-sigil-ts"] ?? "");
  if (!sig || !ts) throw new Error("Missing signature headers");

  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(age) || age > MAX_SKEW_MS) {
    throw new Error("Signature expired — retry");
  }

  let recovered: string;
  try {
    recovered = verifyMessage(vaultMessage(hash, ts), sig);
  } catch {
    throw new Error("Invalid signature");
  }
  return { address: getAddress(recovered) };
}
