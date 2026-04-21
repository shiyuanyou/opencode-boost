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

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.1.0");

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
  .action(async (ref: string, opts: { b?: string }) => {
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

program.parseAsync().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${message}`);
  process.exit(1);
});
