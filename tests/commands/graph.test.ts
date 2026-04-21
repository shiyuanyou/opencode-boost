import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TreeNode } from "../../src/commands/graph.js";

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
