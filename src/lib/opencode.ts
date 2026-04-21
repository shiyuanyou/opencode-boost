import { execa } from "execa";
import type { SessionInfo, ExportedSession } from "../types.js";

export function parseExportOutput(raw: string): ExportedSession {
  const lines = raw.split("\n");
  // Skip lines until we find the JSON start
  const jsonStart = lines.findIndex((l) => l.trimStart().startsWith("{"));
  if (jsonStart === -1) throw new Error("No JSON found in export output");
  const jsonStr = lines.slice(jsonStart).join("\n");
  return JSON.parse(jsonStr) as ExportedSession;
}

export function parseSessionList(raw: string): SessionInfo[] {
  return JSON.parse(raw) as SessionInfo[];
}

export async function listSessions(): Promise<SessionInfo[]> {
  const { stdout } = await execa("opencode", ["session", "list", "--format", "json"]);
  return parseSessionList(stdout);
}

export async function exportSession(sid: string): Promise<ExportedSession> {
  const { stdout } = await execa("opencode", ["export", sid]);
  return parseExportOutput(stdout);
}

export async function deleteSession(sid: string): Promise<void> {
  await execa("opencode", ["session", "delete", sid]);
}
