import { exportSession } from "./opencode.js";
import type { ExportedSession } from "../types.js";

export async function exportWithRetry(sid: string, maxAttempts = 5, delayMs = 8000): Promise<ExportedSession> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await exportSession(sid);
    } catch (err) {
      const msg = (err as Error).message;
      if (attempt < maxAttempts - 1 && msg.includes("truncated")) {
        console.log(`  Session still active, waiting... (attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      if (msg.includes("truncated")) {
        throw new Error(
          `Session ${sid} is still active and cannot be exported.\n` +
          `  \u2192 First switch to another session: ocb checkout <other-session>\n` +
          `  \u2192 Then retry: ocb checkout -b <name> <this-session>\n` +
          `  Or wait until the session becomes idle and try again.`
        );
      }
      throw err;
    }
  }
  throw new Error(`Failed to export session ${sid} after retries`);
}
