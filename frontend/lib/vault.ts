// Client for the sealed-terms vault API. Access is proven with a wallet
// signature over a hash-bound, timestamped message — the API recovers the
// signer and checks they are a party to the deal.

import { API_URL } from "./config";
import type { VaultDoc } from "./contracts/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Eip1193 = any;

// Whitespace normalization applied before every hash — sealing and verifying —
// so copy-pasted text round-trips. Windows newlines, non-breaking spaces, and
// outer whitespace are the classic invisible differences.
export function normalizeTerms(terms: string): string {
  return terms
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .trim();
}

// MUST match the contract: sha256(terms + "\n" + salt) hex.
export async function termsHash(terms: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(terms + "\n" + salt);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Matches api/src/lib/auth.ts vaultMessage().
function vaultMessage(hash: string, ts: string): string {
  return `SIGIL vault access\nhash: ${hash.toLowerCase()}\nts: ${ts}`;
}

async function signHeaders(provider: Eip1193, address: string, hash: string) {
  const ts = String(Date.now());
  const signature: string = await provider.request({
    method: "personal_sign",
    params: [vaultMessage(hash, ts), address],
  });
  return { "x-sigil-signature": signature, "x-sigil-ts": ts };
}

export async function storeTerms(
  provider: Eip1193,
  address: string,
  args: { terms: string; salt: string; counterparty: string; label: string; template: string },
): Promise<string> {
  const hash = await termsHash(args.terms, args.salt);
  const headers = await signHeaders(provider, address, hash);
  const res = await fetch(`${API_URL}/api/vault`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(args),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not store the sealed terms");
  return json.hash;
}

export async function fetchTerms(
  provider: Eip1193,
  address: string,
  hash: string,
): Promise<VaultDoc> {
  const headers = await signHeaders(provider, address, hash);
  const res = await fetch(`${API_URL}/api/vault/${hash}`, { headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not fetch the sealed terms");
  return json;
}
