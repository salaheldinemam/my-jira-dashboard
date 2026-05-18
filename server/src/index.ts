import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import dotenv from "dotenv";
import { FileSessionStore } from "./fileSessionStore.js";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Support running server from either repo root or /server workspace.
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const PORT = Number(process.env.PORT) || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || "dev-session-secret-change-me";
const SESSION_MAX_AGE_MS = Number(process.env.SESSION_MAX_AGE_MS) || 1000 * 60 * 60 * 24 * 30;
const sessionsDir =
  process.env.SESSION_STORE_PATH?.trim() || path.resolve(process.cwd(), ".sessions");

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // Jira user avatars (Gravatar + Atlassian CDN)
        "img-src": [
          "'self'",
          "data:",
          "https://secure.gravatar.com",
          "https://*.atl-paas.net",
          "https://*.atlassian.com",
        ],
      },
    },
  })
);
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
    store: new FileSessionStore({ path: sessionsDir }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_MS,
    },
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter(SESSION_SECRET));
app.use("/api", apiRouter(SESSION_SECRET));

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  const indexHtml = path.join(clientDist, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.error(`Production client build not found at ${clientDist}. Run "npm run build" from the repo root.`);
  }
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(indexHtml, (err) => {
      if (err) {
        console.error("Failed to serve SPA index:", err);
        if (!res.headersSent) res.status(500).send("Client build missing");
      }
    });
  });
}

app.listen(PORT, () => {
  console.log(`Jira Insights API listening on :${PORT}`);
});
