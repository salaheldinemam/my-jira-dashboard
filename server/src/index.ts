import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import dotenv from "dotenv";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Support running server from either repo root or /server workspace.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const PORT = Number(process.env.PORT) || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || "dev-session-secret-change-me";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter(SESSION_SECRET));
app.use("/api", apiRouter(SESSION_SECRET));

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Jira Insights API listening on :${PORT}`);
});
