import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAddress } from "ethers";
import { vaultDb } from "@/lib/server/firebaseAdmin";
import { requireWallet } from "@/lib/server/vaultAuth";

export const runtime = "nodejs";

const MAX_TERMS = 4000;
const MAX_LABEL = 80;

function sha256(terms: string, salt: string): string {
  return createHash("sha256").update(terms + "\n" + salt, "utf8").digest("hex");
}

// Store sealed terms before the on-chain commit. Doc id = terms hash, so the
// vault and the chain share one key. Only the proposer may store; the server
// recomputes the hash so a mismatched commit can never enter the vault.
export async function POST(req: NextRequest) {
  try {
    const { terms, salt, counterparty, label, template } = await req.json();
    if (typeof terms !== "string" || !terms.trim() || terms.length > MAX_TERMS) {
      return NextResponse.json({ error: `terms required, max ${MAX_TERMS} chars` }, { status: 400 });
    }
    if (typeof salt !== "string" || salt.length < 8 || salt.length > 128) {
      return NextResponse.json({ error: "salt required, 8-128 chars" }, { status: 400 });
    }
    const cp = getAddress(String(counterparty ?? ""));
    const hash = sha256(terms, salt);
    const caller = requireWallet(req.headers, hash);
    if (caller === cp) {
      return NextResponse.json({ error: "counterparty must be a different wallet" }, { status: 400 });
    }

    const ref = vaultDb().collection("vault").doc(hash);
    if ((await ref.get()).exists) {
      return NextResponse.json({ error: "these exact terms are already sealed — change the salt" }, { status: 409 });
    }

    await ref.set({
      hash,
      terms,
      salt,
      proposer: caller,
      counterparty: cp,
      label: String(label ?? "").slice(0, MAX_LABEL),
      template: String(template ?? "custom").slice(0, 20),
      createdAt: Date.now(),
    });
    return NextResponse.json({ hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bad request";
    const code = msg.toLowerCase().includes("signature") ? 401 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
