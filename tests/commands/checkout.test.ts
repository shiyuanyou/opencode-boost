import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/opencode.js", () => ({
  getCurrentSession: vi.fn(),
  forkSession: vi.fn(),
}));

vi.mock("../../src/lib/retry.js", () => ({
  exportWithRetry: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
  readNames: vi.fn(),
  writeNames: vi.fn(),
  readForks: vi.fn(),
  writeForks: vi.fn(),
}));

vi.mock("../../src/lib/ref.js", () => ({
  resolveRef: vi.fn(),
}));

import { getCurrentSession, forkSession } from "../../src/lib/opencode.js";
import { exportWithRetry } from "../../src/lib/retry.js";
import { readState, readNames, readForks } from "../../src/lib/store.js";
import { resolveRef } from "../../src/lib/ref.js";
import { checkoutCommand } from "../../src/commands/checkout.js";

function msg(id: string, parentID: string | undefined, role: "user" | "assistant", text: string) {
  return {
    info: { id, sessionID: "ses_parent", parentID, role, time: { created: 1000 } },
    parts: [{ type: "text", text, id: `prt_${id}`, sessionID: "ses_parent", messageID: id }],
  };
}

describe("checkoutCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("switch mode", () => {
    it("switches to a named session", async () => {
      vi.mocked(resolveRef).mockResolvedValue("ses_abc");
      vi.mocked(readNames).mockResolvedValue({ "/proj": { "fix-auth": "ses_abc" } });
      vi.mocked(readState).mockResolvedValue({ "/proj": { current: null } });

      await checkoutCommand("fix-auth", "/proj");

      expect(readState).toHaveBeenCalled();
    });

    it("defaults to current session when ref is undefined", async () => {
      vi.mocked(getCurrentSession).mockResolvedValue("ses_active");
      vi.mocked(resolveRef).mockResolvedValue("ses_active");
      vi.mocked(readNames).mockResolvedValue({ "/proj": {} });
      vi.mocked(readState).mockResolvedValue({ "/proj": { current: null } });

      await checkoutCommand(undefined, "/proj");

      expect(resolveRef).toHaveBeenCalledWith("ses_active", "/proj");
    });
  });

  describe("fork mode (checkout -b)", () => {
    it("forks from parent session using exportWithRetry", async () => {
      vi.mocked(readNames).mockResolvedValue({ "/proj": {} });
      vi.mocked(resolveRef).mockResolvedValue("ses_parent");
      vi.mocked(exportWithRetry).mockResolvedValue({
        info: { id: "ses_parent" } as any,
        messages: [msg("m1", undefined, "user", "hello"), msg("m2", "m1", "assistant", "hi")],
      });
      vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_child", text: "" });
      vi.mocked(readState).mockResolvedValue({ "/proj": { current: null } });
      vi.mocked(readForks).mockResolvedValue({});

      await checkoutCommand("parent-ref", "/proj", { b: "new-branch" });

      expect(exportWithRetry).toHaveBeenCalledWith("ses_parent");
      expect(forkSession).toHaveBeenCalledWith("ses_parent", "ocb-fork", undefined);
    });

    it("rejects duplicate branch name", async () => {
      vi.mocked(readNames).mockResolvedValue({ "/proj": { "existing": "ses_x" } });

      await expect(
        checkoutCommand("parent", "/proj", { b: "existing" })
      ).rejects.toThrow("already exists");
    });

    it("forks from current session when parentRef is '.'", async () => {
      vi.mocked(readNames).mockResolvedValue({ "/proj": { "cur": "ses_cur" } });
      vi.mocked(readState).mockResolvedValue({ "/proj": { current: "cur" } });
      vi.mocked(exportWithRetry).mockResolvedValue({
        info: { id: "ses_cur" } as any,
        messages: [msg("m1", undefined, "user", "hello")],
      });
      vi.mocked(forkSession).mockResolvedValue({ sessionId: "ses_child", text: "" });
      vi.mocked(readForks).mockResolvedValue({});

      await checkoutCommand(".", "/proj", { b: "new-branch" });

      expect(exportWithRetry).toHaveBeenCalledWith("ses_cur");
    });
  });
});
