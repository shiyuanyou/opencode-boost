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

export interface RunResult {
  sessionId: string;
  text: string;
}

export function parseRunEventStream(raw: string): RunResult {
  let sessionId = "";
  const textParts: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      if (event.type === "session" && typeof event.session === "object" && event.session !== null) {
        const sess = event.session as Record<string, unknown>;
        if (typeof sess.id === "string") sessionId = sess.id;
      }
      if (event.type === "assistant" && Array.isArray(event.content)) {
        for (const part of event.content as Record<string, unknown>[]) {
          if (part.type === "text" && typeof part.text === "string") {
            textParts.push(part.text);
          }
        }
      }
    } catch {
      // skip non-JSON lines
    }
  }

  if (!sessionId) throw new Error("No session event found in run output");
  return { sessionId, text: textParts.join("") };
}

export async function forkSession(parentSid: string, message: string): Promise<RunResult> {
  try {
    const { stdout } = await execa("opencode", [
      "run",
      "--session", parentSid,
      "--fork",
      "--format", "json",
      message,
    ], { timeout: 120_000 });
    return parseRunEventStream(stdout);
  } catch (err) {
    throw new Error(`Failed to fork session ${parentSid}: ${(err as Error).message}`);
  }
}

export async function deleteSession(sid: string): Promise<void> {
  try {
    await execa("opencode", ["session", "delete", sid]);
  } catch (err) {
    throw new Error(`Failed to delete session ${sid}: ${(err as Error).message}`);
  }
}
