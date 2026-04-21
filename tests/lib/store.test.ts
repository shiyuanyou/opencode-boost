import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readNames, writeNames, readState, writeState } from "../../src/lib/store.js";
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

describe("store", () => {
  it("returns empty names store when file does not exist", async () => {
    const names = await readNames();
    expect(names).toEqual({});
  });

  it("writes and reads names", async () => {
    await writeNames({ "/proj": { "fix-auth": "ses_abc" } });
    const names = await readNames();
    expect(names["/proj"]["fix-auth"]).toBe("ses_abc");
  });

  it("returns empty state when file does not exist", async () => {
    const state = await readState();
    expect(state).toEqual({});
  });

  it("writes and reads state", async () => {
    await writeState({ "/proj": { current: "fix-auth" } });
    const state = await readState();
    expect(state["/proj"].current).toBe("fix-auth");
  });
});
