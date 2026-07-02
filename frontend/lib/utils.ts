export function formatGen(wei: string | bigint): string {
  const n = Number(BigInt(wei)) / 1e18;
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function parseGen(input: string): bigint {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) throw new Error("Enter a valid GEN amount");
  return BigInt(Math.round(n * 1e6)) * BigInt(1e12);
}

export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
