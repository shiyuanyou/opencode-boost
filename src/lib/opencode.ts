import { execa } from "execa";
import type { SessionInfo, ExportedSession } from "../types.js";

export function parseExportOutput(raw: string): ExportedSession {
  const lines = raw.split("\n");
  const jsonStart = lines.findIndex((l) => l.startsWith("{"));
  if (jsonStart === -1) throw new Error("No JSON found in export output");
  const jsonStr = lines.slice(jsonStart).join("\n");
  try {
    return JSON.parse(jsonStr) as ExportedSession;
  } catch (e) {
    const msg = (e as Error).message;
    if (jsonStr.trimEnd().endsWith("}") === false) {
      throw new Error(
        "Export output appears truncated (incomplete JSON). " +
        "This usually happens when exporting the currently active session. " +
        "Try exporting a different session or wait until the session is idle."
      );
    }
    throw new Error(`Failed to parse export JSON: ${msg}`);
  }
}

export function parseSessionList(raw: string): SessionInfo[] {
  return JSON.parse(raw) as SessionInfo[];
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    const { stdout } = await execa("opencode", ["session", "list", "--format", "json"]);
    return parseSessionList(stdout);
  } catch (err) {
    throw new Error(`Failed to list sessions: ${(err as Error).message}`);
  }
}

export async function exportSession(sid: string): Promise<ExportedSession> {
  try {
    const { stdout } = await execa("opencode", ["export", sid]);
    return parseExportOutput(stdout);
  } catch (err) {
    throw new Error(`Failed to export session ${sid}: ${(err as Error).message}`);
  }
}

export async function deleteSession(sid: string): Promise<void> {
  try {
    await execa("opencode", ["session", "delete", sid]);
  } catch (err) {
    throw new Error(`Failed to delete session ${sid}: ${(err as Error).message}`);
  }
}
