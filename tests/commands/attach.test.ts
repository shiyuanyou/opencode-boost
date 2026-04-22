import { describe, it, expect, vi, beforeEach } from "vitest";
import { attachCommand } from "../../src/commands/attach.js";

vi.mock("../../src/lib/opencode.js", () => ({
  listSessions: vi.fn(),
}));
vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
  writeNames: vi.fn(),
}));

import { listSessions } from "../../src/lib/opencode.js";
import { readNames, writeNames } from "../../src/lib/store.js";

describe("attachCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readNames).mockResolvedValue({});
  });

  it("with -s rejects session not in current cwd", async () => {
    const allSessions = [
      { id: "ses_aaa", title: "A", updated: 1000, created: 900, projectId: "p1", directory: "/proj1" },
    ];
    vi.mocked(listSessions).mockImplementation((cwd?: string) => {
      if (!cwd) return Promise.resolve(allSessions);
      return Promise.resolve(allSessions.filter((s) => s.directory === cwd));
    });

    await expect(
      attachCommand("my-name", "/proj2", { s: "ses_aaa" }),
    ).rejects.toThrow("Session ses_aaa not found in /proj2");
  });

  it("with -s attaches session that belongs to cwd", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_aaa", title: "A", updated: 1000, created: 900, projectId: "p1", directory: "/proj1" },
    ]);

    await attachCommand("my-name", "/proj1", { s: "ses_aaa" });
    expect(writeNames).toHaveBeenCalledWith({
      "/proj1": { "my-name": "ses_aaa" },
    });
  });

  it("without -s picks most recent session in cwd", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_old", title: "Old", updated: 1000, created: 900, projectId: "p1", directory: "/proj1" },
      { id: "ses_new", title: "New", updated: 3000, created: 800, projectId: "p1", directory: "/proj1" },
    ]);

    await attachCommand("latest", "/proj1", {});
    expect(writeNames).toHaveBeenCalledWith({
      "/proj1": { latest: "ses_new" },
    });
  });

  it("without -s throws when no sessions in cwd", async () => {
    vi.mocked(listSessions).mockResolvedValue([]);

    await expect(
      attachCommand("x", "/proj1", {}),
    ).rejects.toThrow("No sessions found in /proj1");
  });

  it("attach --all imports all unmanaged sessions with auto names", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_aaa", title: "Feature Auth", updated: 3000, created: 1000, projectId: "p1", directory: "/proj" },
      { id: "ses_bbb", title: "Fix Bug #42", updated: 2000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
    vi.mocked(readNames).mockResolvedValue({});

    await attachCommand("", "/proj", { all: true });

    expect(writeNames).toHaveBeenCalledWith({
      "/proj": {
        "feature-auth": "ses_aaa",
        "fix-bug-42": "ses_bbb",
      },
    });
  });

  it("attach --all skips already managed sessions", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_aaa", title: "Feature Auth", updated: 3000, created: 1000, projectId: "p1", directory: "/proj" },
      { id: "ses_bbb", title: "Fix Bug", updated: 2000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
    vi.mocked(readNames).mockResolvedValue({ "/proj": { "existing": "ses_aaa" } });

    await attachCommand("", "/proj", { all: true });

    expect(writeNames).toHaveBeenCalledWith({
      "/proj": {
        "existing": "ses_aaa",
        "fix-bug": "ses_bbb",
      },
    });
  });

  it("single attach auto-names from title when name looks like a session ID", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_abc123longid", title: "My Feature", updated: 3000, created: 1000, projectId: "p1", directory: "/proj" },
    ]);
    vi.mocked(readNames).mockResolvedValue({});

    await attachCommand("ses_abc123longid", "/proj", {});

    expect(writeNames).toHaveBeenCalledWith({
      "/proj": { "my-feature": "ses_abc123longid" },
    });
  });
});
