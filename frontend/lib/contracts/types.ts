export type DealState = "OPEN" | "ACTIVE" | "SETTLED" | "DISPUTED" | "RESOLVED" | "CANCELLED";

export type Ruling = {
  kind: "mutual" | "arbitration" | "escalation";
  to_proposer: number;
  split_to_disputant?: number;
  rationale: string;
};

export type Deal = {
  deal_id: string;
  seq: number;
  proposer: string;
  counterparty: string;
  terms_hash: string;
  template: string;
  label: string;
  proposer_stake: string;
  counter_stake_req: string;
  counter_stake: string;
  state: DealState;
  settle_votes: Record<string, number>;
  disputant: string;
  dispute_statement: string;
  response_statement: string;
  revealed_terms: string;
  revealed_salt: string;
  nudged: boolean;
  ruling: Ruling | null;
  provenance: { n: number; event: string }[];
};

export type RegistryRow = {
  deal_id: string;
  terms_hash: string;
  state: DealState;
  template: string;
  label: string;
  proposer: string;
  counterparty: string;
  seq: number;
  revealed: boolean;
};

export type Reputation = {
  owner: string;
  sealed: number;
  settled_clean: number;
  disputes_won: number;
  disputes_lost: number;
  forfeits: number;
};

export type Stats = {
  total_deals: number;
  total_settled: number;
  total_disputes: number;
  escrow_wei: string;
};

export type TermsCheck = {
  clarity: number;
  issues: string[];
  verdict: "ready" | "needs_work";
};

export type VaultDoc = {
  hash: string;
  terms: string;
  salt: string;
  proposer: string;
  counterparty: string;
  label: string;
  template: string;
  createdAt: number;
};
