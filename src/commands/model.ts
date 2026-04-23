import { readConfig, writeConfig } from "../lib/store.js";
import { listModels } from "../lib/opencode.js";

export async function modelCommand(
  arg: string | undefined,
  opts: { list?: boolean }
): Promise<void> {
  if (opts.list) return listModelsAction();
  if (arg) return setModel(arg);

  const config = await readConfig();
  if (config?.summarizer?.model) {
    const resolved = config.models?.[config.summarizer.model] ?? config.summarizer.model;
    console.log(`Current default model: ${config.summarizer.model} -> ${resolved}`);
  } else {
    console.log("No default model configured.");
    console.log("Run `ocb model <alias-or-id>` to set one.");
  }
}

async function listModelsAction(): Promise<void> {
  const models = await listModels();
  const config = await readConfig();

  const sorted = [...models].sort((a, b) => a.cost - b.cost);

  for (const m of sorted) {
    const costLabel = m.cost === 0 ? "(free)" : "";
    console.log(`  ${m.id.padEnd(40)} ${m.name.padEnd(20)} ${costLabel}`);
  }

  if (config?.models && Object.keys(config.models).length > 0) {
    console.log("\nConfigured aliases:");
    for (const [alias, id] of Object.entries(config.models)) {
      console.log(`  ${alias} -> ${id}`);
    }
  }
}

async function setModel(value: string): Promise<void> {
  let config = await readConfig();

  const isAlias = config?.models?.[value];
  const resolved = isAlias ?? value;

  if (!config) {
    config = { summarizer: { method: "opencode-run", model: value }, models: {} };
  } else {
    config.summarizer = config.summarizer ?? { method: "opencode-run", model: "" };
    config.summarizer.model = value;
  }

  await writeConfig(config);
  console.log(`\u2713 Default model set: ${value} -> ${resolved}`);
}
