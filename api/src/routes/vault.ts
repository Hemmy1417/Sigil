import { Router } from "express";
import { createHash } from "crypto";
import { getAddress } from "ethers";
import { db } from "../lib/firebaseAdmin.js";
import { requireWallet } from "../lib/auth.js";

export const vault = Router();

const MAX_TERMS = 4000;
const MAX_LABEL = 80;
const HASH_RE = /^[0-9a-f]{64}$/;

function sha256(terms: string, salt: string): string {
  return createHash("sha256").update(terms + "\n" + salt, "utf8").digest("hex");
}

function normHash(h: unknown): string {
  const s = String(h ?? "").trim().toLowerCase().replace(/^0x/, "");
  if (!HASH_RE.test(s)) throw new Error("hash must be a sha256 hex digest");
  return s;
}

// Store sealed terms before the on-chain commit. Doc id = terms hash, so the
// vault and the chain share one key. Only the proposer may store; the server
// recomputes the hash so a mismatched commit can never enter the vault.
vault.post("/", async (req, res) => {
  try {
    const { terms, salt, counterparty, label, template } = req.body ?? {};
    if (typeof terms !== "string" || !terms.trim() || terms.length > MAX_TERMS) {
      return res.status(400).json({ error: `terms required, max ${MAX_TERMS} chars` });
    }
    if (typeof salt !== "string" || salt.length < 8 || salt.length > 128) {
      return res.status(400).json({ error: "salt required, 8-128 chars" });
    }
    const cp = getAddress(String(counterparty ?? ""));
    const hash = sha256(terms, salt);
    const caller = requireWallet(req, hash);
    if (caller.address === cp) {
      return res.status(400).json({ error: "counterparty must be a different wallet" });
    }

    const ref = db.collection("vault").doc(hash);
    const existing = await ref.get();
    if (existing.exists) {
      return res.status(409).json({ error: "these exact terms are already sealed — change the salt" });
    }

    await ref.set({
      hash,
      terms,
      salt,
      proposer: caller.address,
      counterparty: cp,
      label: String(label ?? "").slice(0, MAX_LABEL),
      template: String(template ?? "custom").slice(0, 20),
      createdAt: Date.now(),
    });
    return res.json({ hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad request";
    return res.status(400).json({ error: msg });
  }
});

// Fetch sealed terms. Only the two named parties may read.
vault.get("/:hash", async (req, res) => {
  try {
    const hash = normHash(req.params.hash);
    const caller = requireWallet(req, hash);

    const snap = await db.collection("vault").doc(hash).get();
    if (!snap.exists) return res.status(404).json({ error: "no sealed terms under this hash" });

    const doc = snap.data()!;
    const isParty =
      caller.address === doc.proposer || caller.address === doc.counterparty;
    if (!isParty) return res.status(403).json({ error: "only the two parties may read the sealed terms" });

    return res.json({
      hash: doc.hash,
      terms: doc.terms,
      salt: doc.salt,
      proposer: doc.proposer,
      counterparty: doc.counterparty,
      label: doc.label,
      template: doc.template,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad request";
    const code = msg.includes("signature") || msg.includes("Signature") ? 401 : 400;
    return res.status(code).json({ error: msg });
  }
});
