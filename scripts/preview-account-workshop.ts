/** Synthetic-only preview. No environment provider configuration or private files are read. */
import { canonicalJson } from "../src/c3/context.ts";
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord } from "../src/c3/draft.ts";
import { startC3Server } from "../src/c3/service.ts";
import { syntheticCorrection, syntheticMeetingCandidate, syntheticMeetingRequest, syntheticWorkshopContext } from "../tests/fixtures/c3-workshop.ts";

const args = process.argv.slice(2);
const account = args.includes("--cedar") ? "cedar" : "harbor";
const mode = args.includes("--sparse") ? "sparse" : args.includes("--conflict") ? "conflict" : "normal";
const context = syntheticWorkshopContext(account, mode);
const initial = createC3ModelRequest(context, syntheticMeetingRequest);
const raw = syntheticMeetingCandidate(context);
const record = createGenerationRecord(initial, raw, context);
if (!record.draft) throw new Error("Synthetic initial candidate did not validate");
const revision = createC3ModelRequest(context, syntheticMeetingRequest, createC3RevisionContext(record, syntheticCorrection, 1));
const revisedRaw = syntheticMeetingCandidate(context, true);
if (!createGenerationRecord(revision, revisedRaw, context).draft) throw new Error("Synthetic revision candidate did not validate");
const responses = new Map([[canonicalJson(initial), raw], [canonicalJson(revision), revisedRaw]]);
const running = await startC3Server({ context, port: 4321, recordedReplay: { initialRequest: syntheticMeetingRequest, correctionNote: syntheticCorrection },
  syntheticPreview: true,
  provider: { name: "synthetic-authored-preview", executionMode: "local", async generate(request, signal) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new Error("Synthetic local work cancelled")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 800);
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
    if (args.includes("--failure")) throw new Error("Synthetic failure exercise. Previous draft and inputs remain available.");
    const response = responses.get(canonicalJson(request));
    if (response === undefined) throw new Error("Synthetic exact-match refused. Restore the supplied setup/correction. No model recording or live generation exists in this preview.");
    return response;
  } } });
console.log(`Synthetic Account Intel / Workshop: ${running.origin}\n${account} / ${mode}. Hand-authored test candidates, not model recordings. Ctrl-C ends all session state.`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { void running.close().then(() => process.exit(0)); });
