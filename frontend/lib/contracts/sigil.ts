// Typed wrapper around the Sigil intelligent contract.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

import { read, writeAndWait } from "../genlayer/client";
import type { Deal, RegistryRow, Reputation, Stats, TermsCheck } from "./types";

// ── reads ──────────────────────────────────────────────────────────────────

export async function getDeal(dealId: string): Promise<Deal | null> {
  const raw = await read("get_deal", [dealId]);
  return raw ? JSON.parse(raw) : null;
}

export async function getDealsFor(address: string): Promise<Deal[]> {
  const raw = await read("get_deals_for", [address]);
  return raw ? JSON.parse(raw) : [];
}

export async function getReputation(address: string): Promise<Reputation | null> {
  const raw = await read("get_reputation", [address]);
  return raw ? JSON.parse(raw) : null;
}

export async function getRegistry(n = 50): Promise<RegistryRow[]> {
  const raw = await read("get_registry", [String(n)]);
  return raw ? JSON.parse(raw) : [];
}

export async function getStats(): Promise<Stats | null> {
  const raw = await read("get_stats", []);
  return raw ? JSON.parse(raw) : null;
}

// ── writes ─────────────────────────────────────────────────────────────────

export async function createDeal(
  client: Client, termsHash: string, counterparty: string,
  counterStakeWei: bigint, template: string, label: string, stakeWei: bigint,
) {
  return writeAndWait<Deal>(client, "create_deal",
    [termsHash, counterparty, counterStakeWei.toString(), template, label], stakeWei);
}

export async function acceptDeal(client: Client, dealId: string, termsHash: string, stakeWei: bigint) {
  return writeAndWait<Deal>(client, "accept_deal", [dealId, termsHash], stakeWei);
}

export async function cancelDeal(client: Client, dealId: string) {
  return writeAndWait<Deal>(client, "cancel_deal", [dealId]);
}

export async function confirmSettlement(client: Client, dealId: string, toProposerPct: number) {
  return writeAndWait<Deal>(client, "confirm_settlement", [dealId, String(toProposerPct)]);
}

export async function disputeDeal(
  client: Client, dealId: string, terms: string, salt: string,
  statement: string, evidenceUrls: string[] = [],
) {
  // The contract fetches these pinned URLs at arbitration and weighs them
  // above bare statements; it expects a JSON-string list (defaults to "[]").
  return writeAndWait<Deal>(client, "dispute",
    [dealId, terms, salt, statement, JSON.stringify(evidenceUrls)]);
}

export async function respondToDispute(
  client: Client, dealId: string, statement: string, evidenceUrls: string[] = [],
) {
  return writeAndWait<Deal>(client, "respond",
    [dealId, statement, JSON.stringify(evidenceUrls)]);
}

export async function nudgeDeal(client: Client, dealId: string) {
  return writeAndWait<Deal>(client, "nudge", [dealId]);
}

export async function escalateDeal(client: Client, dealId: string) {
  return writeAndWait<Deal>(client, "escalate", [dealId]);
}

export async function checkTerms(client: Client, terms: string): Promise<TermsCheck | null> {
  return writeAndWait<TermsCheck>(client, "check_terms", [terms]);
}

export { formatGen, parseGen } from "../utils";
