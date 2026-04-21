import path from "path";
import os from "os";

export function getDataDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg ?? path.join(os.homedir(), ".local/share");
  return path.join(base, "opencode-boost");
}

export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ?? path.join(os.homedir(), ".config");
  return path.join(base, "opencode-boost");
}
