import { Command } from "commander";

const program = new Command();

program
  .name("ocb")
  .description("opencode session manager")
  .version("0.1.0");

program.parse();
