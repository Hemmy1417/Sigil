// The SIGIL mark — a scalloped wax seal, logo option A.

export function SealMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true">
      <path
        d="M48 6 L55 12 L64 10 L68 18 L77 19 L77 28 L84 33 L80 41 L85 49 L78 54 L79 63 L70 66 L67 74 L58 73 L52 80 L44 76 L36 80 L30 73 L21 74 L18 66 L9 63 L10 54 L3 49 L8 41 L4 33 L11 28 L11 19 L20 18 L24 10 L33 12 L40 6 L44 10 Z"
        fill="#7132f5"
      />
      <circle cx="48" cy="44" r="26" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      <path
        d="M57 34 c-2-3-6-4-9-4 -5 0-9 3-9 7 0 4 4 6 9 7 5 1 9 3 9 7 0 4-4 7-9 7 -4 0-8-2-10-5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SigilWordmark({ sealSize = 28 }: { sealSize?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <SealMark size={sealSize} />
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "3px",
          color: "var(--ink)",
        }}
      >
        SIGIL
      </span>
    </span>
  );
}
