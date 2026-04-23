import { openDbReader, type DbReader } from "./db-reader.js";
import { exportWithRetry } from "./retry.js";
import type { ExportedSession } from "../types.js";

let cachedReader: DbReader | null | undefined = undefined;

function getReader(): DbReader | null {
  if (cachedReader === undefined) {
    cachedReader = openDbReader();
  }
  return cachedReader;
}

export function resetReader(): void {
  if (cachedReader) {
    cachedReader.close();
  }
  cachedReader = undefined;
}

export async function getSessionData(sid: string): Promise<ExportedSession> {
  const reader = getReader();
  if (reader) {
    const session = reader.getSession(sid);
    if (session) {
      return session;
    }
  }
  return exportWithRetry(sid);
}
