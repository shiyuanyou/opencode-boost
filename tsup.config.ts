import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  external: ["readline/promises", "better-sqlite3"],
  outExtension: () => ({ js: ".js" }),
});
