import express from "express";
import cors from "cors";
import { vault } from "./routes/vault.js";

const app = express();

const ALLOWED = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED.some((re) => re.test(origin))) return cb(null, true);
      return cb(new Error("CORS: origin not allowed"));
    },
    allowedHeaders: ["Content-Type", "x-sigil-signature", "x-sigil-ts"],
  }),
);
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "sigil-api" }));
app.use("/vault", vault);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => console.log(`[sigil-api] listening on :${port}`));
