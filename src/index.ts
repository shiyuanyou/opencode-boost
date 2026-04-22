import { Command } from "commander";
import { listCommand } from "./commands/list.js";
import { originAvailableCommand } from "./commands/origin.js";
import { showCommand } from "./commands/show.js";
import { attachCommand } from "./commands/attach.js";
import { checkoutCommand } from "./commands/checkout.js";
import { renameCommand } from "./commands/rename.js";
import { unmanageCommand } from "./commands/unmanage.js";
import { deleteCommand } from "./commands/delete.js";
import { graphCommand } from "./commands/graph.js";
import { reflogCommand } from "./commands/reflog.js";
import { rollbackCommand } from "./commands/rollback.js";
import { modelCommand } from "./commands/model.js";
import { compactCommand } from "./commands/compact.js";
import { rebaseCommand } from "./commands/rebase.js";
import { injectCommand } from "./commands/inject.js";
import { pickCommand } from "./commands/pick.js";

function action(fn: (...args: unknown[]) => Promise<void>) {
  return async (...args: unknown[]) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  };
}

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.2.0");

program
  .command("list")
  .description("List managed sessions for current directory")
  .action(action(async () => {
    await listCommand(process.cwd());
  }));

const origin = program.command("origin").description("Origin session commands");

origin
  .command("available")
  .description("(deprecated) Use `ocb list` instead - now shows all sessions")
  .action(action(async () => {
    await originAvailableCommand(process.cwd());
  }));

program
  .command("graph")
  .description("Show session fork tree")
  .action(action(async () => {
    await graphCommand(process.cwd());
  }));

program
  .command("show <ref>")
  .description("Show session message list")
  .option("-m <nums>", "Show specific message(s) detail, comma-separated")
  .option("--json", "Output raw JSON")
  .action(action(async (ref: string, opts: { m?: string; json?: boolean }) => {
    await showCommand(ref, process.cwd(), opts);
  }));

program
  .command("attach [name]")
  .description("Create alias for a session (auto-names if session ID given)")
  .option("-s <sid>", "Session ID to attach (default: most recent)")
  .option("--all", "Attach all unmanaged sessions with auto-generated names")
  .action(action(async (name: string | undefined, opts: { s?: string; all?: boolean }) => {
    await attachCommand(name ?? "", process.cwd(), opts);
  }));

program
  .command("checkout <ref>")
  .description("Switch active session")
  .option("-b <name>", "Fork from ref into new named session")
  .option("--model <model>", "Model to use for fork")
  .action(action(async (ref: string, opts: { b?: string; model?: string }) => {
    await checkoutCommand(ref, process.cwd(), opts);
  }));

program
  .command("rename <old> <new>")
  .description("Rename a session alias")
  .action(action(async (oldName: string, newName: string) => {
    await renameCommand(oldName, newName, process.cwd());
  }));

program
  .command("unmanage <ref>")
  .description("Remove session from ocb management (session is not deleted)")
  .action(action(async (ref: string) => {
    await unmanageCommand(ref, process.cwd());
  }));

program
  .command("delete <ref>")
  .description("Delete a session permanently")
  .option("-f, --force", "Skip confirmation prompt")
  .action(action(async (ref: string, opts: { force?: boolean }) => {
    await deleteCommand(ref, process.cwd(), opts);
  }));

program
  .command("reflog [ref]")
  .description("View operation history")
  .action(action(async (ref: string | undefined) => {
    await reflogCommand(ref, process.cwd());
  }));

program
  .command("rollback <name>")
  .description("Rollback name to a historical version")
  .option("-f, --force", "Skip confirmation prompt")
  .option("-s, --step <step>", "Step number to rollback to")
  .action(action(async (name: string, opts: { force?: boolean; step?: string }) => {
    await rollbackCommand(name, opts.step, process.cwd(), { force: opts.force });
  }));

program
  .command("model [alias-or-id]")
  .description("View or set the summarizer default model")
  .option("--list", "List all available models")
  .action(action(async (arg: string | undefined, opts: { list?: boolean }) => {
    await modelCommand(arg, opts);
  }));

program
  .command("compact <ref>")
  .description("Compress message range into LLM summary")
  .requiredOption("-m <range>", "Message range to compact (e.g. 3-8)")
  .option("--model <model>", "Model to use for summarization")
  .option("--manual <summary>", "Provide summary manually instead of LLM")
  .action(action(async (ref: string, opts: { m: string; model?: string; manual?: string }) => {
    await compactCommand(ref, process.cwd(), opts);
  }));

program
  .command("rebase <ref>")
  .description("Interactive rebase (keep/compact/drop messages)")
  .option("--model <model>", "Model to use for summarization")
  .action(action(async (ref: string, opts: { model?: string }) => {
    await rebaseCommand(ref, process.cwd(), opts);
  }));

program
  .command("inject <source-ref> [target-ref]")
  .description("Inject knowledge summary from source into target session")
  .option("--model <model>", "Model to use for summarization")
  .option("--raw", "Skip summarization, inject raw text")
  .action(action(async (sourceRef: string, targetRef: string | undefined, opts: { model?: string; raw?: boolean }) => {
    await injectCommand(sourceRef, targetRef, process.cwd(), opts);
  }));

program
  .command("pick <ref>")
  .description("Pick specific messages and inject into current session")
  .requiredOption("-m <nums>", "Message numbers to pick (comma-separated)")
  .action(action(async (ref: string, opts: { m: string }) => {
    await pickCommand(ref, process.cwd(), opts);
  }));

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
