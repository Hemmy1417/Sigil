import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;
export const CHAIN_HEX = ("0x" + studionet.id.toString(16)) as `0x${string}`;
export const CHAIN_RPC = studionet.rpcUrls.default.http[0];
export const CHAIN_NAME = studionet.name;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xD29b1a8b2ED86fd82269F977AE9825E2fB016377") as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS);

// The vault lives in this app's own /api routes — same origin, empty base URL.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export const TEMPLATES: Record<string, { name: string; blurb: string; body: string }> = {
  loan: {
    name: "Loan",
    blurb: "One party lends, the other repays by a date.",
    body:
      "LOAN AGREEMENT\n\n" +
      "The proposer lends the counterparty [AMOUNT] GEN.\n" +
      "The counterparty repays the full amount by [DATE].\n" +
      "Repayment is confirmed when both parties settle this deal with the full escrow to the proposer.\n" +
      "If repayment is late or short, the proposer is entitled to the counterparty's full stake.",
  },
  gig: {
    name: "Gig",
    blurb: "Work delivered against payment, privately.",
    body:
      "WORK AGREEMENT\n\n" +
      "The counterparty delivers the following to the proposer by [DATE]:\n" +
      "- [DELIVERABLE 1]\n" +
      "- [DELIVERABLE 2]\n\n" +
      "\"Done\" means: [ACCEPTANCE CRITERIA].\n" +
      "On delivery, the parties settle with the full escrow to the counterparty.\n" +
      "If delivery is incomplete by the date, the proposer is entitled to the escrow.",
  },
  wager: {
    name: "Wager",
    blurb: "A bet with a named settlement source.",
    body:
      "WAGER\n\n" +
      "The question: [QUESTION].\n" +
      "Settlement source: [EXACT SOURCE, e.g. coinbase.com BTC-USD daily close].\n" +
      "If the outcome is [OUTCOME A], the proposer takes the full escrow.\n" +
      "If the outcome is [OUTCOME B], the counterparty takes the full escrow.\n" +
      "Settlement date: [DATE].",
  },
  deposit: {
    name: "Deposit",
    blurb: "A security deposit returned on good behavior.",
    body:
      "SECURITY DEPOSIT\n\n" +
      "The counterparty's stake is a deposit against: [WHAT IT PROTECTS].\n" +
      "The deposit is returned in full (settle 0% to proposer) if, by [DATE]: [CONDITIONS MET].\n" +
      "The proposer may claim up to the full deposit for: [DAMAGE / BREACH TERMS].",
  },
  custom: {
    name: "Custom",
    blurb: "Write your own terms from a blank page.",
    body: "",
  },
};
