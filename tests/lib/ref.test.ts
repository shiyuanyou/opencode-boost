import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveRef } from "../../src/lib/ref.js";

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
}));
vi.mock("../../src/lib/opencode.js", () => ({
  listSessions: vi.fn(),
}));

import { readNames } from "../../src/lib/store.js";
import { listSessions } from "../../src/lib/opencode.js";

describe("resolveRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readNames).mockResolvedValue({
      "/proj": { "fix-auth": "ses_abc123" },
    });
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_abc123", title: "Fix auth", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
      { id: "ses_def456", title: "Other", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
  });

  it("resolves a name to session-id without calling listSessions", async () => {
    const sid = await resolveRef("fix-auth", "/proj");
    expect(sid).toBe("ses_abc123");
    expect(listSessions).not.toHaveBeenCalled();
  });

  it("resolves a session-id directly if it exists", async () => {
    const sid = await resolveRef("ses_def456", "/proj");
    expect(sid).toBe("ses_def456");
  });

  it("throws if ref not found", async () => {
    await expect(resolveRef("nonexistent", "/proj")).rejects.toThrow();
  });
});
