import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readNames, writeNames, readState, writeState, readForks, writeForks } from "../../src/lib/store.js";
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

describe("forks store", () => {
  it("returns empty forks store when file does not exist", async () => {
    const forks = await readForks();
    expect(forks).toEqual({});
  });

  it("writes and reads forks", async () => {
    const data: import("../../src/types.js").ForksStore = {
      "/proj": {
        ses_child: {
          parentSessionId: "ses_parent",
          parentMessageId: "msg_003",
          timestamp: 1000,
        },
      },
    };
    await writeForks(data);
    const forks = await readForks();
    expect(forks["/proj"]["ses_child"].parentSessionId).toBe("ses_parent");
    expect(forks["/proj"]["ses_child"].parentMessageId).toBe("msg_003");
  });
});
