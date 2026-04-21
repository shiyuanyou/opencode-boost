import { readNames, writeNames, readState, writeState } from "../lib/store.js";

export async function renameCommand(oldName: string, newName: string, cwd: string): Promise<void> {
  const names = await readNames();
  const dirNames = names[cwd] ?? {};
  if (!dirNames[oldName]) throw new Error(`No session named "${oldName}"`);
  if (dirNames[newName]) throw new Error(`Name "${newName}" already exists`);

  dirNames[newName] = dirNames[oldName];
  delete dirNames[oldName];
  names[cwd] = dirNames;
  await writeNames(names);

  const state = await readState();
  if (state[cwd]?.current === oldName) {
    state[cwd].current = newName;
    await writeState(state);
  }

  console.log(`\u2713 Renamed: ${oldName} \u2192 ${newName}`);
}
