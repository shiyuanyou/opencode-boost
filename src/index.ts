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

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.2.0");

program
  .command("list")
  .description("List managed sessions for current directory")
  .action(async () => {
    try {
      await listCommand(process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

const origin = program.command("origin").description("Origin session commands");

origin
  .command("available")
  .description("List unmanaged sessions in current directory")
  .action(async () => {
    try {
      await originAvailableCommand(process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("graph")
  .description("Show session fork tree")
  .action(async () => {
    try {
      await graphCommand(process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("show <ref>")
  .description("Show session message list")
  .option("-m <nums>", "Show specific message(s) detail, comma-separated")
  .option("--json", "Output raw JSON")
  .action(async (ref: string, opts: { m?: string; json?: boolean }) => {
    try {
      await showCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("attach <name>")
  .description("Create alias for a session")
  .option("-s <sid>", "Session ID to attach (default: most recent)")
  .action(async (name: string, opts: { s?: string }) => {
    try {
      await attachCommand(name, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("checkout <ref>")
  .description("Switch active session")
  .option("-b <name>", "Fork from ref into new named session")
  .option("--model <model>", "Model to use for fork")
  .action(async (ref: string, opts: { b?: string; model?: string }) => {
    try {
      await checkoutCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("rename <old> <new>")
  .description("Rename a session alias")
  .action(async (old: string, newName: string) => {
    try {
      await renameCommand(old, newName, process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("unmanage <ref>")
  .description("Remove session from ocb management (session is not deleted)")
  .action(async (ref: string) => {
    try {
      await unmanageCommand(ref, process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("delete <ref>")
  .description("Delete a session permanently")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (ref: string, opts: { force?: boolean }) => {
    try {
      await deleteCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("reflog [ref]")
  .description("View operation history")
  .action(async (ref: string | undefined) => {
    try {
      await reflogCommand(ref, process.cwd());
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("rollback <name>")
  .description("Rollback name to a historical version")
  .option("-f, --force", "Skip confirmation prompt")
  .option("-s, --step <step>", "Step number to rollback to")
  .action(async (name: string, opts: { force?: boolean; step?: string }) => {
    try {
      await rollbackCommand(name, opts.step, process.cwd(), { force: opts.force });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("model [alias-or-id]")
  .description("View or set the summarizer default model")
  .option("--list", "List all available models")
  .action(async (arg: string | undefined, opts: { list?: boolean }) => {
    try {
      await modelCommand(arg, opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("compact <ref>")
  .description("Compress message range into LLM summary")
  .requiredOption("-m <range>", "Message range to compact (e.g. 3-8)")
  .option("--model <model>", "Model to use for summarization")
  .option("--manual <summary>", "Provide summary manually instead of LLM")
  .action(async (ref: string, opts: { m: string; model?: string; manual?: string }) => {
    try {
      await compactCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("rebase <ref>")
  .description("Interactive rebase (keep/compact/drop messages)")
  .option("--model <model>", "Model to use for summarization")
  .action(async (ref: string, opts: { model?: string }) => {
    try {
      await rebaseCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("inject <source-ref> [target-ref]")
  .description("Inject knowledge summary from source into target session")
  .option("--model <model>", "Model to use for summarization")
  .option("--raw", "Skip summarization, inject raw text")
  .action(async (sourceRef: string, targetRef: string | undefined, opts: { model?: string; raw?: boolean }) => {
    try {
      await injectCommand(sourceRef, targetRef, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("pick <ref>")
  .description("Pick specific messages and inject into current session")
  .requiredOption("-m <nums>", "Message numbers to pick (comma-separated)")
  .action(async (ref: string, opts: { m: string }) => {
    try {
      await pickCommand(ref, process.cwd(), opts);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
