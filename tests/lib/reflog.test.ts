import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readReflog, writeReflog } from "../../src/lib/store.js";
import fs from "fs";
import os from "os";
import path from "path";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocb-test-"));
  process.env.XDG_DATA_HOME = tmpDir;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
  delete process.env.XDG_DATA_HOME;
});

describe("reflog store", () => {
  it("returns empty reflog when file does not exist", async () => {
    const reflog = await readReflog();
    expect(reflog).toEqual({});
  });

  it("writes and reads reflog entries", async () => {
    const data: import("../../src/types.js").ReflogStore = {
      "/proj": [
        { name: "fix-auth", sessionId: "ses_abc", operation: "original", from: null, timestamp: 1000 },
        { name: "fix-auth", sessionId: "ses_compact", operation: "compact", from: "ses_abc", timestamp: 2000 },
      ],
    };
    await writeReflog(data);
    const reflog = await readReflog();
    expect(reflog["/proj"]).toHaveLength(2);
    expect(reflog["/proj"][0].operation).toBe("original");
    expect(reflog["/proj"][1].from).toBe("ses_abc");
  });
});
