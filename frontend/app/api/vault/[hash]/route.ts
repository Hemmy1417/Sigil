import { NextRequest, NextResponse } from "next/server";
import { vaultDb } from "@/lib/server/firebaseAdmin";
import { requireWallet } from "@/lib/server/vaultAuth";

export const runtime = "nodejs";

const HASH_RE = /^[0-9a-f]{64}$/;

// Fetch sealed terms. Only the two named parties may read.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const raw = (await params).hash.trim().toLowerCase().replace(/^0x/, "");
    if (!HASH_RE.test(raw)) {
      return NextResponse.json({ error: "hash must be a sha256 hex digest" }, { status: 400 });
    }
    const caller = requireWallet(req.headers, raw);

    const snap = await vaultDb().collection("vault").doc(raw).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "no sealed terms under this hash" }, { status: 404 });
    }

    const doc = snap.data()!;
    if (caller !== doc.proposer && caller !== doc.counterparty) {
      return NextResponse.json({ error: "only the two parties may read the sealed terms" }, { status: 403 });
    }

    return NextResponse.json({
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
    const code = msg.toLowerCase().includes("signature") ? 401 : 400;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
