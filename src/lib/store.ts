import fs from "fs/promises";
import path from "path";
import { getDataDir, getConfigDir } from "./paths.js";
import type { NamesStore, StateStore, ForksStore, ReflogStore, ConfigStore } from "../types.js";

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = filePath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

function namesPath() {
  return path.join(getDataDir(), "names.json");
}

function statePath() {
  return path.join(getDataDir(), "state.json");
}

export async function readNames(): Promise<NamesStore> {
  return readJson<NamesStore>(namesPath(), {});
}

export async function writeNames(data: NamesStore): Promise<void> {
  return writeJson(namesPath(), data);
}

export async function readState(): Promise<StateStore> {
  return readJson<StateStore>(statePath(), {});
}

export async function writeState(data: StateStore): Promise<void> {
  return writeJson(statePath(), data);
}

function forksPath() {
  return path.join(getDataDir(), "forks.json");
}

export async function readForks(): Promise<ForksStore> {
  return readJson<ForksStore>(forksPath(), {});
}

export async function writeForks(data: ForksStore): Promise<void> {
  return writeJson(forksPath(), data);
}

function reflogPath() {
  return path.join(getDataDir(), "reflog.json");
}

export async function readReflog(): Promise<ReflogStore> {
  return readJson<ReflogStore>(reflogPath(), {});
}

export async function writeReflog(data: ReflogStore): Promise<void> {
  return writeJson(reflogPath(), data);
}

function configPath() {
  return path.join(getConfigDir(), "config.json");
}

export async function readConfig(): Promise<ConfigStore | null> {
  return readJson<ConfigStore | null>(configPath(), null);
}

export async function writeConfig(data: ConfigStore): Promise<void> {
  return writeJson(configPath(), data);
}
