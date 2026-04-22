import { exportSession } from "./opencode.js";
import type { ExportedSession } from "../types.js";

export async function exportWithRetry(sid: string): Promise<ExportedSession> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await exportSession(sid);
    } catch (err) {
      if (attempt < 2 && (err as Error).message.includes("truncated")) {
        console.log(`  Session still active, waiting... (attempt ${attempt + 1}/3)`);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Failed to export session ${sid} after retries`);
}
