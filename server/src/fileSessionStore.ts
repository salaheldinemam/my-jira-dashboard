import fs from "node:fs";
import path from "node:path";
import { Store, type SessionData } from "express-session";

type SessionRecord = SessionData & { cookie?: { expires?: Date | string } };

function sidPath(dir: string, sid: string): string {
  const safe = sid.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(dir, `${safe}.json`);
}

/** Persists express-session data to disk so restarts do not log users out. */
export class FileSessionStore extends Store {
  private readonly dir: string;

  constructor(options: { path: string }) {
    super();
    this.dir = options.path;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  get(sid: string, callback: (err: unknown, session?: SessionRecord | null) => void): void {
    const file = sidPath(this.dir, sid);
    fs.readFile(file, "utf8", (err, raw) => {
      if (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          callback(null, null);
          return;
        }
        callback(err);
        return;
      }
      try {
        const session = JSON.parse(raw) as SessionRecord;
        if (session.cookie?.expires && typeof session.cookie.expires === "string") {
          session.cookie.expires = new Date(session.cookie.expires);
        }
        callback(null, session);
      } catch (parseErr) {
        callback(parseErr);
      }
    });
  }

  set(sid: string, session: SessionRecord, callback?: (err?: unknown) => void): void {
    const file = sidPath(this.dir, sid);
    fs.writeFile(file, JSON.stringify(session), "utf8", (err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    const file = sidPath(this.dir, sid);
    fs.unlink(file, (err) => {
      if (err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        callback?.();
        return;
      }
      callback?.(err);
    });
  }

  touch(sid: string, session: SessionRecord, callback?: (err?: unknown) => void): void {
    this.set(sid, session, callback);
  }
}
