"use client";

// Sigil — Kraken light theme. Soft ink-in-water blooms on paper, sealed
// envelope glyphs floating up, faint watermark grid. Reads as "private
// letter under a wax seal".

export function LiveBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="sig-paper" />
      <div className="sig-watermark" />
      <div className="sig-blooms">
        <span className="sig-bloom sig-b0" />
        <span className="sig-bloom sig-b1" />
        <span className="sig-bloom sig-b2" />
      </div>
      <div className="sig-envelopes">
        {["✉", "◈", "✉", "§", "◈", "✉", "§", "◈"].map((c, i) => (
          <span key={i} className={`sig-env sig-e${i}`}>{c}</span>
        ))}
      </div>

      <style jsx>{`
        .sig-paper {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 60% at 50% 0%,
              rgba(120, 100, 70, 0.03) 0%, transparent 60%),
            radial-gradient(ellipse 80% 50% at 50% 100%,
              rgba(90, 70, 40, 0.02) 0%, transparent 55%);
        }
        .sig-watermark {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(to right,  rgba(60, 50, 30, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(60, 50, 30, 0.03) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 90%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 90%);
        }

        .sig-blooms { position: absolute; inset: 0; }
        .sig-bloom {
          position: absolute;
          border-radius: 9999px;
          filter: blur(80px);
          opacity: 0.28;
          will-change: transform;
        }
        .sig-b0 {
          width: 520px; height: 520px;
          top: -140px; left: -120px;
          background: radial-gradient(circle at 40% 40%, #7B4B26, transparent 70%);
          animation: sigDriftA 34s ease-in-out infinite;
        }
        .sig-b1 {
          width: 480px; height: 480px;
          top: 45%; right: -140px;
          background: radial-gradient(circle at 60% 40%, #B85436, transparent 70%);
          animation: sigDriftB 40s ease-in-out infinite;
        }
        .sig-b2 {
          width: 420px; height: 420px;
          bottom: -140px; left: 40%;
          background: radial-gradient(circle at 50% 50%, #8A6B3B, transparent 70%);
          animation: sigDriftC 46s ease-in-out infinite;
        }
        @keyframes sigDriftA {
          0%, 100% { transform: translate(0, 0)         scale(1);    }
          50%       { transform: translate(80px, 60px)   scale(1.12); }
        }
        @keyframes sigDriftB {
          0%, 100% { transform: translate(0, 0)         scale(1);    }
          50%       { transform: translate(-100px, 80px) scale(1.08); }
        }
        @keyframes sigDriftC {
          0%, 100% { transform: translate(0, 0)          scale(1);    }
          50%       { transform: translate(60px, -100px) scale(1.15); }
        }

        .sig-envelopes { position: absolute; inset: 0; }
        .sig-env {
          position: absolute; bottom: -40px;
          font-family: "Lora", ui-serif, Georgia, serif;
          color: rgba(120, 70, 40, 0.20);
          animation: sigRise linear infinite;
        }
        @keyframes sigRise {
          0%   { transform: translateY(0)       rotate(0deg);   opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.6; }
          100% { transform: translateY(-115vh)  rotate(-8deg);  opacity: 0; }
        }
        .sig-e0 { left:  6%; animation-duration: 38s; animation-delay:  0s;  font-size: 20px; }
        .sig-e1 { left: 20%; animation-duration: 44s; animation-delay:  6s;  font-size: 24px; }
        .sig-e2 { left: 34%; animation-duration: 40s; animation-delay:  2s;  font-size: 18px; }
        .sig-e3 { left: 48%; animation-duration: 46s; animation-delay:  9s;  font-size: 22px; }
        .sig-e4 { left: 62%; animation-duration: 42s; animation-delay:  4s;  font-size: 20px; }
        .sig-e5 { left: 76%; animation-duration: 48s; animation-delay: 11s;  font-size: 24px; }
        .sig-e6 { left: 88%; animation-duration: 40s; animation-delay:  7s;  font-size: 18px; }
        .sig-e7 { left: 96%; animation-duration: 44s; animation-delay:  1s;  font-size: 22px; }

        @media (prefers-reduced-motion: reduce) {
          .sig-bloom, .sig-env { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
