import path from "path";
import os from "os";
import { createRequire } from "module";
import type { Database } from "better-sqlite3";
import type { ExportedSession, ExportedMessage, MessagePart } from "../types.js";

const require = createRequire(import.meta.url);

export function getDbPath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? path.join(os.homedir(), ".local/share");
  return path.join(base, "opencode", "opencode.db");
}

export interface DbReader {
  getSession(sid: string): ExportedSession | null;
  getMessages(sid: string): ExportedMessage[];
  close(): void;
}

interface BetterSqlite3 {
  (filename: string, options?: { readonly?: boolean }): Database;
}

function loadBetterSqlite3(): BetterSqlite3 | null {
  try {
    const mod = require("better-sqlite3");
    return typeof mod === "function" ? mod : (mod.default as BetterSqlite3);
  } catch {
    return null;
  }
}

function rowToPart(row: Record<string, unknown>): MessagePart {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : {};
  return {
    type: (data.type as string) ?? "text",
    text: data.text,
    id: row.id as string,
    sessionID: row.session_id as string,
    messageID: row.message_id as string,
    ...data,
  };
}

function rowToMessage(
  row: Record<string, unknown>,
  parts: MessagePart[]
): ExportedMessage {
  const data =
    typeof row.data === "string"
      ? (JSON.parse(row.data) as Record<string, unknown>)
      : {};
  return {
    info: {
      id: row.id as string,
      sessionID: row.session_id as string,
      parentID: data.parentID as string | undefined,
      role: (data.role as "user" | "assistant") ?? "user",
      time: {
        created: row.time_created as number,
        completed: undefined,
      },
      ...data,
    },
    parts,
  };
}

function rowToSession(
  row: Record<string, unknown>,
  messages: ExportedMessage[]
): ExportedSession {
  return {
    info: {
      id: row.id as string,
      slug: "",
      projectID: row.project_id as string,
      directory: row.directory as string,
      title: (row.title as string) ?? "",
      version: "",
      time: {
        created: row.time_created as number,
        updated: row.time_updated as number,
      },
    },
    messages,
  };
}

export function openDbReader(): DbReader | null {
  const ctor = loadBetterSqlite3();
  if (!ctor) return null;

  const dbPath = getDbPath();
  let db: Database;
  try {
    db = ctor(dbPath, { readonly: true });
  } catch {
    return null;
  }

  return {
    getSession(sid: string): ExportedSession | null {
      const row = db
        .prepare("SELECT * FROM session WHERE id = ?")
        .get(sid) as Record<string, unknown> | undefined;
      if (!row) return null;
      const messages = this.getMessages(sid);
      return rowToSession(row, messages);
    },

    getMessages(sid: string): ExportedMessage[] {
      const msgRows = db
        .prepare(
          "SELECT * FROM message WHERE session_id = ? ORDER BY time_created ASC"
        )
        .all(sid) as Record<string, unknown>[];

      return msgRows.map((msgRow) => {
        const partRows = db
          .prepare(
            "SELECT * FROM part WHERE message_id = ? ORDER BY id ASC"
          )
          .all(msgRow.id) as Record<string, unknown>[];
        const parts = partRows.map(rowToPart);
        return rowToMessage(msgRow, parts);
      });
    },

    close(): void {
      try {
        db.close();
      } catch {
        // ignore
      }
    },
  };
}
