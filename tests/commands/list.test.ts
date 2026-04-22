import { describe, it, expect, vi, beforeEach } from "vitest";
import { listCommand } from "../../src/commands/list.js";

vi.mock("../../src/lib/opencode.js", () => ({
  listSessions: vi.fn(),
  getCurrentSession: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
  readState: vi.fn(),
  writeState: vi.fn(),
}));

vi.mock("../../src/lib/sync.js", () => ({
  syncStateWithOpencode: vi.fn(),
}));

import { listSessions } from "../../src/lib/opencode.js";
import { readNames, readState } from "../../src/lib/store.js";
import { syncStateWithOpencode } from "../../src/lib/sync.js";

const mockSessions = [
  { id: "ses_aaa", title: "Feature A", updated: 3000, created: 1000, projectId: "p1", directory: "/proj" },
  { id: "ses_bbb", title: "Bug Fix", updated: 2000, created: 900, projectId: "p1", directory: "/proj" },
  { id: "ses_ccc", title: "Refactor", updated: 1000, created: 800, projectId: "p1", directory: "/proj" },
];

describe("listCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(syncStateWithOpencode).mockResolvedValue();
  });

  it("shows all sessions, marking managed ones with name", async () => {
    vi.mocked(listSessions).mockResolvedValue(mockSessions);
    vi.mocked(readNames).mockResolvedValue({
      "/proj": { "feat-a": "ses_aaa" },
    });
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "feat-a" } });

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    await listCommand("/proj");

    console.log = origLog;

    expect(logs.some((l) => l.includes("* feat-a") && l.includes("ses_aaa".slice(0, 15)))).toBe(true);
    expect(logs.some((l) => l.includes("ses_bbb".slice(0, 15)))).toBe(true);
    expect(logs.some((l) => l.includes("ses_ccc".slice(0, 15)))).toBe(true);
  });

  it("shows unmanaged sessions with title and Unmanaged section", async () => {
    vi.mocked(listSessions).mockResolvedValue(mockSessions);
    vi.mocked(readNames).mockResolvedValue({ "/proj": {} });
    vi.mocked(readState).mockResolvedValue({});

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    await listCommand("/proj");

    console.log = origLog;

    expect(logs.some((l) => l.includes("Unmanaged:"))).toBe(true);
    expect(logs.some((l) => l.includes("Bug Fix"))).toBe(true);
  });

  it("calls syncStateWithOpencode before listing", async () => {
    vi.mocked(listSessions).mockResolvedValue([]);
    vi.mocked(readNames).mockResolvedValue({});
    vi.mocked(readState).mockResolvedValue({});

    await listCommand("/proj");

    expect(syncStateWithOpencode).toHaveBeenCalledWith("/proj");
  });

  it("shows 'No sessions found' when empty", async () => {
    vi.mocked(listSessions).mockResolvedValue([]);
    vi.mocked(readNames).mockResolvedValue({});
    vi.mocked(readState).mockResolvedValue({});

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    await listCommand("/proj");

    console.log = origLog;

    expect(logs.some((l) => l.includes("No sessions found"))).toBe(true);
  });
});
