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

export async function listSessions(cwd?: string): Promise<SessionInfo[]> {
  try {
    const { stdout } = await execa("opencode", ["session", "list", "--format", "json"]);
    const all = parseSessionList(stdout);
    if (!cwd) return all;
    return all.filter((s) => s.directory === cwd);
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
      if (!sessionId && event.type === "step_start" && typeof event.sessionID === "string") {
        sessionId = event.sessionID;
      }
      if (event.type === "assistant" && Array.isArray(event.content)) {
        for (const part of event.content as Record<string, unknown>[]) {
          if (part.type === "text" && typeof part.text === "string") {
            textParts.push(part.text);
          }
        }
      }
      if (event.type === "text" && typeof event.part === "object" && event.part !== null) {
        const part = event.part as Record<string, unknown>;
        if (part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text as string);
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
    ], { timeout: 180_000 });
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

export async function importSession(jsonPath: string): Promise<string> {
  try {
    const { stdout } = await execa("opencode", ["import", jsonPath]);
    const lines = stdout.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;
        if (event.type === "session" && typeof event.session === "object" && event.session !== null) {
          const sess = event.session as Record<string, unknown>;
          if (typeof sess.id === "string") return sess.id;
        }
        if (event.type === "step_start" && typeof event.sessionID === "string") {
          return event.sessionID;
        }
      } catch {
        // skip non-JSON lines
      }
    }
    throw new Error("No session ID found in import output");
  } catch (err) {
    throw new Error(`Failed to import session: ${(err as Error).message}`);
  }
}

export async function runSession(
  message: string,
  opts?: { model?: string; title?: string }
): Promise<RunResult> {
  try {
    const args = ["run", "--format", "json"];
    if (opts?.model) args.push("--model", opts.model);
    if (opts?.title) args.push("--title", opts.title);
    args.push(message);
    const { stdout } = await execa("opencode", args, { timeout: 180_000 });
    return parseRunEventStream(stdout);
  } catch (err) {
    throw new Error(`Failed to run: ${(err as Error).message}`);
  }
}

export async function injectMessage(sessionId: string, message: string): Promise<RunResult> {
  try {
    const { stdout } = await execa("opencode", [
      "run",
      "--session", sessionId,
      "--format", "json",
      message,
    ], { timeout: 180_000 });
    return parseRunEventStream(stdout);
  } catch (err) {
    throw new Error(`Failed to inject into session ${sessionId}: ${(err as Error).message}`);
  }
}

export interface ModelInfo {
  id: string;
  providerID: string;
  name: string;
  cost: number;
}

export function parseModelsOutput(raw: string): ModelInfo[] {
  const models: ModelInfo[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    if (line.includes("/") && !line.startsWith("{")) {
      const [providerID, modelID] = line.split("/");
      if (!modelID) continue;
      let name = modelID;
      let cost = 0;
      if (i + 1 < lines.length) {
        try {
          const next = lines[i + 1].trim();
          if (next.startsWith("{")) {
            const meta = JSON.parse(next) as Record<string, unknown>;
            if (typeof meta.name === "string") name = meta.name;
            if (typeof meta.cost === "number") cost = meta.cost;
          }
        } catch {
          // skip
        }
      }
      models.push({ id: line, providerID, modelID: modelID.trim(), name, cost });
    }
  }
  return models;
}

export async function listModels(): Promise<ModelInfo[]> {
  try {
    const { stdout } = await execa("opencode", ["models", "--verbose"]);
    return parseModelsOutput(stdout);
  } catch (err) {
    throw new Error(`Failed to list models: ${(err as Error).message}`);
  }
}
