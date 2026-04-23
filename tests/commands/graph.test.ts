import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TreeNode } from "../../src/commands/graph.js";

vi.mock("../../src/lib/opencode.js", () => ({
  listSessions: vi.fn(),
  exportSession: vi.fn(),
}));

vi.mock("../../src/lib/store.js", () => ({
  readNames: vi.fn(),
  readForks: vi.fn(),
  readState: vi.fn(),
}));

import { listSessions, exportSession } from "../../src/lib/opencode.js";
import { readNames, readForks, readState } from "../../src/lib/store.js";

describe("graph tree rendering", () => {
  let lines: string[];

  beforeEach(() => {
    lines = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => {
      lines.push(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a single root node", async () => {
    const { printNode } = await import("../../src/commands/graph.js");
    const root: TreeNode = {
      sid: "ses_abc12345678",
      name: "fix-auth",
      isCurrent: true,
      updated: Date.now() - 7200000,
      forkLabel: null,
      children: [],
    };
    printNode(root, "* ", "  ");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("fix-auth");
    expect(lines[0]).toContain("*");
  });

  it("renders root with two children", async () => {
    const { printNode } = await import("../../src/commands/graph.js");
    const root: TreeNode = {
      sid: "ses_abc12345678",
      name: "fix-auth",
      isCurrent: true,
      updated: Date.now() - 7200000,
      forkLabel: null,
      children: [
        {
          sid: "ses_def45678901",
          name: "try-jwt",
          isCurrent: false,
          updated: Date.now() - 3600000,
          forkLabel: "[3]",
          children: [],
        },
        {
          sid: "ses_jkl01234567",
          name: "try-session",
          isCurrent: false,
          updated: Date.now() - 2700000,
          forkLabel: "[10]",
          children: [],
        },
      ],
    };
    printNode(root, "* ", "  ");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("fix-auth");
    expect(lines[1]).toContain("try-jwt");
    expect(lines[1]).toContain("[3]");
    expect(lines[2]).toContain("try-session");
    expect(lines[2]).toContain("[10]");
    expect(lines[1]).toContain("\u251c");
    expect(lines[2]).toContain("\u2514");
  });

  it("renders nested children", async () => {
    const { printNode } = await import("../../src/commands/graph.js");
    const root: TreeNode = {
      sid: "ses_abc12345678",
      name: "fix-auth",
      isCurrent: true,
      updated: Date.now() - 7200000,
      forkLabel: null,
      children: [
        {
          sid: "ses_def45678901",
          name: "try-jwt",
          isCurrent: false,
          updated: Date.now() - 3600000,
          forkLabel: "[3]",
          children: [
            {
              sid: "ses_ghi78901234",
              name: "try-rs256",
              isCurrent: false,
              updated: Date.now() - 1800000,
              forkLabel: "[7]",
              children: [],
            },
          ],
        },
      ],
    };
    printNode(root, "* ", "  ");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("fix-auth");
    expect(lines[1]).toContain("try-jwt");
    expect(lines[2]).toContain("try-rs256");
    expect(lines[2]).toContain("[7]");
  });

  it("renders unnamed session", async () => {
    const { printNode } = await import("../../src/commands/graph.js");
    const node: TreeNode = {
      sid: "ses_abc12345678",
      name: null,
      isCurrent: false,
      updated: Date.now() - 7200000,
      forkLabel: null,
      children: [],
    };
    printNode(node, "  ", "  ");

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("(ses_abc12345678)");
    expect(lines[0]).not.toContain("null");
  });
});

describe("graphCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("shows message when no managed sessions", async () => {
    vi.mocked(readNames).mockResolvedValue({ "/proj": {} });
    vi.mocked(readForks).mockResolvedValue({});
    vi.mocked(readState).mockResolvedValue({});
    vi.mocked(listSessions).mockResolvedValue([]);

    const { graphCommand } = await import("../../src/commands/graph.js");
    await graphCommand("/proj");

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("No managed sessions"));
  });

  it("calls exportSession for parent sessions to resolve fork positions", async () => {
    vi.mocked(readNames).mockResolvedValue({ "/proj": { parent: "ses_p", child: "ses_c" } });
    vi.mocked(readForks).mockResolvedValue({
      "/proj": { ses_c: { parentSessionId: "ses_p", parentMessageId: "m2", timestamp: 1000 } },
    });
    vi.mocked(readState).mockResolvedValue({ "/proj": { current: "child" } });
    vi.mocked(listSessions).mockResolvedValue([
      { id: "ses_p", title: "P", updated: 1000, created: 900, projectId: "p1", directory: "/proj" },
      { id: "ses_c", title: "C", updated: 2000, created: 900, projectId: "p1", directory: "/proj" },
    ]);
    vi.mocked(exportSession).mockResolvedValue({
      info: { id: "ses_p" } as any,
      messages: [
        { info: { id: "m1", sessionID: "ses_p", parentID: undefined, role: "user", time: { created: 1000 } }, parts: [] },
        { info: { id: "m2", sessionID: "ses_p", parentID: "m1", role: "assistant", time: { created: 1000 } }, parts: [] },
      ],
    });

    const { graphCommand } = await import("../../src/commands/graph.js");
    await graphCommand("/proj");

    expect(exportSession).toHaveBeenCalledWith("ses_p");
  });
});
