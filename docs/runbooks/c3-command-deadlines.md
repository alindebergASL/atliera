# C3 operator command deadlines

Fresh generation remains disabled unless an operator configures a command and the required audit root. Timing configuration does not grant dispatch authority. Recorded replay ignores command configuration.

`C3_MODEL_TIMEOUT_MS` optionally sets the command envelope for `serve` and `run-verifier-evaluation`. It accepts decimal integer milliseconds from 1,000 through 300,000. Omission preserves the 120,000 ms default and existing cleanup grace. An explicit value selects a 15,000 ms TERM grace and passes only the derived non-secret `C3_COMMAND_TIMEOUT_MS` and `C3_COMMAND_KILL_GRACE_MS` values to the wrapper. Ambient credentials are not inherited.

A wrapper must independently admit work against its mission deadline and accounting gates. Budget one finite total transport interval using a monotonic clock, then a separate bounded interval for durable receipts and accounting, with startup/scheduling margin before the outer envelope. Socket timeouts alone are insufficient for a total deadline. Reserve room for both TERM grace and subsequent KILL/cleanup confirmation before the absolute mission deadline. A wrapper may require a narrower range than the generic command option.

For example, an explicitly authorized 240,000 ms envelope can allocate 220 seconds to transport, 10 seconds to finalization and 10 seconds to startup/scheduling margin. With the selected cleanup grace, admission needs more than 270 seconds remaining before the mission deadline. This example is a timing policy, not a product default or spending authorization.

Cancellation signals the owned process group. The provider discards late completion, waits for local cleanup, and holds further execution when cleanup cannot be confirmed. A wrapper should retain captured late bytes as failed evidence and preserve an unknown reservation when settlement is unavailable. If receipt finalization itself stalls, bounded termination cannot guarantee a receipt; the pre-dispatch reservation and pending-settlement gates must remain authoritative. Confirmed local cleanup never establishes upstream cancellation or final billing, and no automatic retry is added.

The [timing tests](../../tests/c3/c3-command-deadline.test.ts), [process lifecycle tests](../../tests/c3/c3-journey.test.ts) and [service cancellation tests](../../tests/c3/c3-service.test.ts) cover configuration, cleanup ownership and stale completion handling. Private wrapper policy and admission records remain external and nonbinding for repository behavior.
