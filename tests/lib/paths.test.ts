import { describe, it, expect, beforeEach } from "vitest";
import { getDataDir, getConfigDir } from "../../src/lib/paths.js";
import path from "path";
import os from "os";

describe("paths", () => {
  it("returns XDG_DATA_HOME based dir when env is set", () => {
    process.env.XDG_DATA_HOME = "/custom/data";
    const dir = getDataDir();
    expect(dir).toBe("/custom/data/opencode-boost");
    delete process.env.XDG_DATA_HOME;
  });

  it("falls back to ~/.local/share when XDG_DATA_HOME not set", () => {
    delete process.env.XDG_DATA_HOME;
    const dir = getDataDir();
    expect(dir).toBe(path.join(os.homedir(), ".local/share/opencode-boost"));
  });

  it("returns XDG_CONFIG_HOME based dir when env is set", () => {
    process.env.XDG_CONFIG_HOME = "/custom/config";
    const dir = getConfigDir();
    expect(dir).toBe("/custom/config/opencode-boost");
    delete process.env.XDG_CONFIG_HOME;
  });

  it("falls back to ~/.config when XDG_CONFIG_HOME not set", () => {
    delete process.env.XDG_CONFIG_HOME;
    const dir = getConfigDir();
    expect(dir).toBe(path.join(os.homedir(), ".config/opencode-boost"));
  });
});
