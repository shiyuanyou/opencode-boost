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
});
