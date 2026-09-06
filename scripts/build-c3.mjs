import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outputDirectory = resolve("dist/c3");
await rm(outputDirectory, { recursive: true, force: true });
await build({ entryPoints: ["src/c3/cli.ts"], outfile: resolve(outputDirectory, "atliera-c3.js"),
  bundle: true, platform: "node", format: "esm", target: "node22", sourcemap: true, packages: "external" });
