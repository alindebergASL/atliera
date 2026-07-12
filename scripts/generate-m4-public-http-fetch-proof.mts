import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateM4PublicHttpFetchProof } from "../src/capability/m4-public-http-fetch-proof.ts";

const proof = await generateM4PublicHttpFetchProof();
const rendered = `${JSON.stringify(proof, null, 2)}\n`;
if (process.argv.includes("--write")) {
  writeFileSync(resolve("fixtures/validation/m4-public-http-fetch-v1-recorded-proof.json"), rendered, "utf8");
}
process.stdout.write(rendered);
