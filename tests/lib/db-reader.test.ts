import { describe, it, expect, beforeEach } from "vitest";
import { getDbPath } from "../../src/lib/db-reader.js";
import path from "path";
import os from "os";

describe("db-reader", () => {
  describe("getDbPath", () => {
    beforeEach(() => {
      delete process.env.XDG_DATA_HOME;
    });

    it("returns XDG_DATA_HOME based path when env is set", () => {
      process.env.XDG_DATA_HOME = "/custom/data";
      expect(getDbPath()).toBe("/custom/data/opencode/opencode.db");
    });

    it("falls back to ~/.local/share when XDG_DATA_HOME not set", () => {
      expect(getDbPath()).toBe(
        path.join(os.homedir(), ".local/share/opencode/opencode.db")
      );
    });
  });
});
