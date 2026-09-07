import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { C3_CLIENT_SCRIPT } from "../../src/c3/render.ts";
import { PLANNING_CLIENT_SCRIPT } from "../../src/c3/planning-client.ts";

function client(options: { cache?: Map<string, string>; fetch?: (body: any) => Promise<any>; storageFails?: boolean; initial?: string; sectionNote?: boolean; confirm?: () => boolean; composed?: boolean; proposal?: boolean; owner?: string; version?: string } = {}) {
  const cache = options.cache ?? new Map<string, string>();
  const field = { name: "text", value: options.initial ?? "Saved section", maxLength: 4000 };
  const proposalFields = ["concern", "action", "owner", "targetDate", "questionOrBlocker"].map((name) => ({ name, value: name === "action" ? "Saved action" : name === "owner" ? options.owner ?? "" : "", maxLength: 4000 }));
  const inputNames = ["targetDate"];
  const evidence = { name: "evidenceIds", multiple: true, options: [{ value: "known", selected: false }, { value: "second", selected: false }] };
  const projection = Object.fromEntries([...proposalFields.map((f) => f.name), "evidenceIds"].map((name) => [name, { textContent: "Not set" }]));
  const savedCopy = { textContent: "Saved section" };
  const authorship = { textContent: "Template-authored planning prompt" };
  const status = { textContent: "", after() {} };
  const detail = { open: false };
  const listeners = new Map<string, (event: any) => any>();
  let cancel: () => void = () => {};
  const buttons = [{ disabled: false }, { disabled: false }];
  const form = {
    dataset: { editKey: "strategy-options", endpoint: "/api/planning/strategy", version: options.version ?? "0", section: "options" },
    querySelectorAll: (selector: string) => selector === "textarea" ? (options.proposal ? proposalFields.filter((f) => !inputNames.includes(f.name)) : [field]) : selector === 'input[type="text"]' ? (options.proposal ? proposalFields.filter((f) => inputNames.includes(f.name)) : []) : selector === "select[multiple]" ? (options.proposal ? [evidence] : []) : buttons,
    querySelector: (selector: string) => selector === "[data-local-status]" ? status : { addEventListener(_name: string, fn: () => void) { cancel = fn; } },
    closest: (selector: string) => selector === "details" ? detail : { querySelector: (s: string) => s.startsWith("[data-proposed-value=") ? projection[s.match(/="([^"]+)"/)![1]!] : s === "[data-saved-copy]" ? (options.proposal ? null : savedCopy) : s === "[data-authorship]" ? authorship : null },
    addEventListener: (name: string, fn: (event: any) => any) => listeners.set(name, listeners.has(name) ? ((prior) => (event: any) => { prior(event); return fn(event); })(listeners.get(name)!) : fn),
  };
  const windowListeners = new Map<string, (event: any) => void>();
  const note = { value: "Saved global note", addEventListener() {} };
  let click: (event: any) => void = () => {};
  const document = { addEventListener: (name: string, fn: (event: any) => void) => { if (name === "click") click = fn; },
    querySelectorAll: () => [form], querySelector: (selector: string) => selector.startsWith("meta") ? ({ content: selector.includes("csrf") ? "session-one" : "account-one", getAttribute: () => "session-one" }) : selector === "[data-correction-note]" ? note : null,
    createElement: () => ({ className: "", textContent: "" }) };
  const window = { confirm: options.confirm ?? (() => false), sessionStorage: { getItem: (key: string) => cache.get(key),
    setItem(key: string, value: string) { if (options.storageFails) throw new Error("storage unavailable"); cache.set(key, value); },
    removeItem(key: string) { if (options.storageFails) throw new Error("storage unavailable"); cache.delete(key); } },
    addEventListener: (name: string, fn: (event: any) => void) => windowListeners.set(name, fn) };
  if (options.sectionNote) Object.assign(form.dataset, { recordId: "same-record", endpoint: "/api/section-note" });
  if (options.proposal) { Object.assign(form.dataset, { proposedNextStep: "", editKey: "next-steps-proposal", endpoint: "/api/planning/next-steps" }); delete (form.dataset as any).section; }
  const scope: any = { document, window, requestJson: async (_url: string, body: unknown) => {
    const response = options.fetch ? await options.fetch(JSON.parse(JSON.stringify(body))) : { ok: true, json: async () => ({ version: 1, status: "Session edit kept", noChange: false }) };
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    return payload;
  } };
  scope.fetch = async (_url: string, init: any) => options.fetch!(JSON.parse(init.body));
  vm.runInNewContext(options.composed ? C3_CLIENT_SCRIPT.replace("let confirmLocalEditDeparture = () => true;", "let confirmLocalEditDeparture = () => true; globalThis.localGuard = () => confirmLocalEditDeparture();") : PLANNING_CLIENT_SCRIPT, scope);
  return { note, navigate: () => { let prevented = false; click({ button: 0, target: { closest: () => ({ getAttribute: (name: string) => name === "href" ? "/?prepare=1" : null, hasAttribute: () => false }) }, preventDefault() { prevented = true; } }); return !prevented; },
    proposalFields, evidence, projection, guard: () => options.composed ? scope.localGuard() : scope.confirmLocalEditDeparture(), field, savedCopy, authorship, status, cache, detail, buttons, form,
    input: () => listeners.get("input")!({}), cancel: () => cancel(),
    submit: () => listeners.get("submit")!({ preventDefault() {} }), windowListeners };
}

test("in-place session edit preserves newer typing, version identity and reload recovery", async () => {
  let settle!: (value: any) => void;
  let submitted: any;
  const pending = new Promise((resolve) => { settle = resolve; });
  const ui = client({ fetch: async (body) => { submitted = body; return pending; } });
  ui.field.value = "Submitted user plan";
  const saving = ui.submit();
  assert.equal(ui.savedCopy.textContent, "Saved section", "brief stays visible while saving");
  assert.equal(ui.buttons[0]!.disabled, true);
  ui.field.value = "Newer unsubmitted typing";
  ui.input();
  settle({ ok: true, json: async () => ({ version: 1, status: "Session edit kept", noChange: false }) });
  await saving;
  assert.deepEqual(submitted, { version: 0, section: "options", text: "Submitted user plan" });
  assert.equal(ui.savedCopy.textContent, "Submitted user plan");
  assert.equal(ui.field.value, "Newer unsubmitted typing");
  assert.match(ui.status.textContent, /Newer typing/);
  assert.equal(ui.form.dataset.version, "1");
  assert.equal(JSON.parse([...ui.cache.values()][0]!).identity, "1");
  ui.cancel();
  assert.equal(ui.field.value, "Submitted user plan");
  assert.equal(ui.cache.size, 0);
});

test("no-change, clear, failed save and blocked storage have truthful in-place outcomes", async () => {
  const noChange = client({ fetch: async () => ({ ok: true, json: async () => ({ version: 0, noChange: true, status: "No change" }) }) });
  await noChange.submit();
  assert.equal(noChange.authorship.textContent, "Template-authored planning prompt");
  assert.equal(noChange.cache.size, 0);
  const clear = client();
  clear.field.value = "";
  await clear.submit();
  assert.equal(clear.savedCopy.textContent, "Section cleared. No conclusion asserted.");
  const failure = client({ fetch: async () => ({ ok: false, json: async () => ({ error: "Stale version" }) }) });
  failure.field.value = "Unsubmitted correction";
  await failure.submit();
  assert.equal(failure.field.value, "Unsubmitted correction");
  assert.equal(failure.savedCopy.textContent, "Saved section");
  assert.match(failure.status.textContent, /Stale version/);
  assert.equal(failure.buttons[0]!.disabled, false);
  const blocked = client({ storageFails: true });
  blocked.field.value = "Unsaved";
  blocked.input();
  assert.match(blocked.status.textContent, /Reload recovery unavailable/);
  let prevented = false;
  blocked.windowListeners.get("beforeunload")!({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});

test("unsubmitted local edits reopen by account/session/kind identity; stale versions do not overwrite", () => {
  const first = client();
  first.field.value = "Recovered plan";
  first.input();
  const restored = client({ cache: first.cache });
  assert.equal(restored.field.value, "Recovered plan");
  assert.equal(restored.detail.open, true);
  const key = [...first.cache.keys()][0]!;
  first.cache.set(key, JSON.stringify({ identity: "99", values: { text: "Stale plan" } }));
  const stale = client({ cache: first.cache });
  assert.equal(stale.field.value, "Saved section");
  assert.match(stale.status.textContent, /different brief version/);
});


test("malformed success responses never mark text saved or clear recovery", async () => {
  for (const payload of [{ error: "Invalid local service response" }, {}, { status: "Saved" },
    { status: "Saved", noChange: false, version: 99 }]) {
    const ui = client({ fetch: async () => ({ ok: true, json: async () => payload }) });
    ui.field.value = "Unconfirmed edit";
    await ui.submit();
    assert.equal(ui.savedCopy.textContent, "Saved section");
    assert.equal(ui.field.value, "Unconfirmed edit");
    assert.match(ui.status.textContent, /not confirmed/);
    assert.equal(ui.cache.size, 1);
    assert.equal(ui.form.dataset.version, "0");
  }
});

test("CS-02 section cache binds original saved text even when generation identity is unchanged", () => {
  const first = client({ sectionNote: true }); first.field.value = "Old unsent text"; first.input();
  assert.equal(JSON.parse([...first.cache.values()][0]!).saved.text, "Saved section");
  const same = client({ sectionNote: true, cache: first.cache });
  assert.equal(same.field.value, "Old unsent text");
  const stale = client({ sectionNote: true, cache: first.cache, initial: "Other tab saved this" });
  assert.equal(stale.field.value, "Other tab saved this");
  assert.match(stale.status.textContent, /saved baseline/);
  assert.equal(JSON.parse([...stale.cache.values()][0]!).saved.text, "Saved section", "recovery never rebases old values");
});

test("CS-06 local approval cannot bypass a pending save without further typing", async () => {
  let settle!: (value: any) => void;
  const ui = client({ confirm: () => true, fetch: async () => new Promise((resolve) => { settle = resolve; }) });
  ui.field.value = "Dirty section"; ui.input();
  assert.equal(ui.guard(), true);
  const saving = ui.submit();
  assert.equal(ui.guard(), false);
  settle({ ok: true, json: async () => ({ status: "Kept", noChange: false, version: 1 }) }); await saving;
});

test("CS-06 global veto resets local approval and blocks departure during the subsequent save", async () => {
  let settle!: (value: any) => void;
  let confirmations = 0;
  const ui = client({ composed: true, sectionNote: true, confirm: () => ++confirmations % 2 === 1, fetch: async () => new Promise((resolve) => { settle = resolve; }) });
  ui.field.value = "Dirty section"; ui.input(); ui.note.value = "Dirty global note";
  assert.equal(ui.navigate(), false); assert.equal(confirmations, 2);
  assert.equal(ui.navigate(), false, "later navigation must ask local and global again after veto");
  assert.equal(confirmations, 4);
  const saving = ui.submit(); // Deliberately no typing after the veto.
  assert.equal(ui.guard(), false); assert.equal(ui.navigate(), false);
  assert.equal(confirmations, 4, "busy save refuses without discard prompts");
  settle({ ok: true, json: async () => ({ status: "Kept", noChange: false }) }); await saving;
});

test("CS-06 explicit departure guards blocked storage, failed saves and in-flight typing", async () => {
  let confirmations = 0;
  const failed = client({ storageFails: true, confirm: () => { confirmations++; return false; }, fetch: async () => ({ ok: false, json: async () => ({ error: "offline" }) }) });
  failed.field.value = "Do not lose this"; failed.input();
  assert.equal(failed.guard(), false); assert.equal(confirmations, 1);
  await failed.submit(); assert.equal(failed.guard(), false); assert.equal(failed.field.value, "Do not lose this");
  let settle!: (value: any) => void;
  const busy = client({ confirm: () => true, fetch: async () => new Promise((resolve) => { settle = resolve; }) });
  busy.field.value = "Submitted"; const saving = busy.submit(); busy.field.value = "Newer typing"; busy.input();
  assert.equal(busy.guard(), false, "in-flight save cannot depart even with discard confirmation");
  settle({ ok: true, json: async () => ({ status: "Kept", noChange: false, version: 1 }) }); await saving;
  assert.equal(busy.field.value, "Newer typing"); assert.equal(busy.guard(), true);
});


test("proposal save projects acknowledged fields and preserves delayed typing and evidence recovery", async () => {
  let settle!: (value: any) => void; let body: any;
  const ui = client({ proposal: true, fetch: async (value) => { body = value; return new Promise((resolve) => { settle = resolve; }); } });
  ui.proposalFields[0]!.value = "Exact concern"; ui.evidence.options[0]!.selected = true;
  const saving = ui.submit(); ui.proposalFields[1]!.value = "Newer action"; ui.evidence.options[1]!.selected = true; ui.input();
  settle({ ok: true, json: async () => ({ version: 1, noChange: false, status: "Kept" }) }); await saving;
  assert.deepEqual(body.proposedNextStep.evidenceIds, ["known"]);
  assert.equal(body.proposedNextStep.action, "Saved action");
  assert.equal(ui.projection.action!.textContent, "Saved action");
  assert.equal(ui.projection.owner!.textContent, "Unassigned");
  assert.equal(ui.proposalFields[1]!.value, "Newer action");
  const restored = client({ proposal: true, cache: ui.cache });
  assert.match(restored.status.textContent, /different brief version/);
  ui.cancel(); assert.equal(ui.proposalFields[1]!.value, "Saved action"); assert.equal(ui.evidence.options[1]!.selected, false);
});

test("proposal evidence cache restores safely and failed acknowledgement preserves saved projection", async () => {
  const ui = client({ proposal: true, fetch: async () => ({ ok: true, json: async () => ({ version: 99, status: "Kept", noChange: false }) }) });
  ui.evidence.options[0]!.selected = true; ui.input();
  const restored = client({ proposal: true, cache: ui.cache }); assert.equal(restored.evidence.options[0]!.selected, true);
  await ui.submit(); assert.equal(ui.projection.action!.textContent, "Not set"); assert.match(ui.status.textContent, /not confirmed/);
  ui.cancel(); assert.equal(ui.evidence.options[0]!.selected, false);
});


test("proposal transport failure and invalid cached evidence never replace the kept proposal", async () => {
  const ui = client({ proposal: true, fetch: async () => ({ ok: false, json: async () => ({ error: "offline" }) }) });
  ui.proposalFields[1]!.value = "Unsubmitted action"; ui.evidence.options[0]!.selected = true; ui.input();
  await ui.submit(); assert.equal(ui.projection.action!.textContent, "Not set"); assert.equal(ui.proposalFields[1]!.value, "Unsubmitted action"); assert.match(ui.status.textContent, /offline/);
  const key = [...ui.cache.keys()][0]!; const cached = JSON.parse(ui.cache.get(key)!); cached.values.evidenceIds = ["foreign"];
  ui.cache.set(key, JSON.stringify(cached)); const reopened = client({ proposal: true, cache: ui.cache });
  assert.equal(reopened.evidence.options[0]!.selected, false); assert.equal(reopened.proposalFields[1]!.value, "Saved action"); assert.match(reopened.status.textContent, /different brief version or saved baseline/);
  ui.cancel(); assert.equal(ui.proposalFields[1]!.value, "Saved action"); assert.equal(ui.evidence.options[0]!.selected, false);
});


test("compact owner textarea and date input join payload, recovery, no-change, cancellation and delayed typing", async () => {
  let body: any; let settle!: (value: any) => void;
  const ui = client({ proposal: true, fetch: async (value) => { body = value; return new Promise((resolve) => { settle = resolve; }); } });
  const owner = ui.proposalFields.find((f) => f.name === "owner")!;
  const date = ui.proposalFields.find((f) => f.name === "targetDate")!;
  owner.value = 'A & "B"'; date.value = "2028-02-29"; ui.input();
  const cached = JSON.parse([...ui.cache.values()][0]!);
  assert.equal(cached.values.owner, owner.value); assert.equal(cached.values.targetDate, date.value);
  assert.equal(cached.saved.owner, ""); assert.equal(cached.saved.targetDate, "");
  assert.equal(ui.guard(), false, "owner/date edits require the departure guard");
  const restored = client({ proposal: true, cache: new Map(ui.cache) });
  assert.equal(restored.proposalFields[2]!.value, owner.value);
  assert.equal(restored.proposalFields[3]!.value, date.value); assert.equal(restored.detail.open, true);
  restored.cancel(); assert.equal(restored.proposalFields[2]!.value, ""); assert.equal(restored.proposalFields[3]!.value, "");
  const saving = ui.submit(); owner.value = "Newer owner"; date.value = "2028-03-01"; ui.input();
  settle({ ok: true, json: async () => ({ version: 1, noChange: false, status: "Kept" }) }); await saving;
  assert.equal(body.proposedNextStep.owner, 'A & "B"'); assert.equal(body.proposedNextStep.targetDate, "2028-02-29");
  assert.equal(ui.projection.owner!.textContent, 'A & "B"'); assert.equal(ui.projection.targetDate!.textContent, "2028-02-29");
  assert.equal(owner.value, "Newer owner"); assert.equal(date.value, "2028-03-01");
  assert.match(ui.status.textContent, /Newer typing/);
  assert.equal(JSON.parse([...ui.cache.values()][0]!).values.owner, "Newer owner");
  ui.cancel(); assert.equal(owner.value, 'A & "B"'); assert.equal(date.value, "2028-02-29");
  const same = client({ proposal: true, fetch: async (value) => { body = value; return { ok: true, json: async () => ({ version: 0, noChange: true, status: "No change" }) }; } });
  await same.submit(); assert.equal(body.proposedNextStep.owner, ""); assert.equal(body.proposedNextStep.targetDate, "");
  assert.equal(same.form.dataset.version, "0"); assert.equal(same.cache.size, 0);
});


test("single-line owner acknowledgement recovers newer multiline owner and action on reload", async () => {
  let settle!: (value: any) => void;
  const ui = client({ proposal: true, owner: "First line\nSecond line", fetch: async () => new Promise((resolve) => { settle = resolve; }) });
  assert.ok(ui.form.querySelectorAll("textarea").some((field) => field === ui.proposalFields[2]!));
  ui.proposalFields[2]!.value = "Single line owner";
  const saving = ui.submit();
  const newerOwner = "\nNewer team A\nNewer team B & <review>";
  ui.proposalFields[2]!.value = newerOwner;
  ui.proposalFields[1]!.value = "Newer unsubmitted action"; ui.input();
  settle({ ok: true, json: async () => ({ version: 1, noChange: false, status: "Kept" }) });
  await saving;
  const cached = JSON.parse([...ui.cache.values()][0]!);
  assert.equal(cached.identity, "1");
  assert.equal(cached.saved.owner, "Single line owner");
  assert.equal(cached.values.owner, newerOwner);
  assert.equal(ui.proposalFields[2]!.value, newerOwner);
  assert.equal(ui.projection.owner!.textContent, "Single line owner");
  assert.equal(cached.saved.action, "Saved action");
  assert.deepEqual(Object.keys(cached.saved), ["concern", "action", "owner", "questionOrBlocker", "targetDate", "evidenceIds"]);
  const reopened = client({ proposal: true, owner: "Single line owner", version: "1", cache: ui.cache });
  assert.ok(reopened.form.querySelectorAll("textarea").some((field) => field === reopened.proposalFields[2]!));
  assert.equal(reopened.proposalFields[1]!.value, "Newer unsubmitted action");
  assert.equal(reopened.proposalFields[2]!.value, newerOwner);
  assert.match(reopened.status.textContent, /Unsubmitted edit restored/);
  reopened.cancel();
  assert.equal(reopened.proposalFields[1]!.value, "Saved action");
  assert.equal(reopened.proposalFields[2]!.value, "Single line owner");
});

test("saved baseline accepts old cache property order but requires identical keys and field values", () => {
  const ui = client({ proposal: true });
  ui.proposalFields[1]!.value = "Cached action"; ui.input();
  const key = [...ui.cache.keys()][0]!;
  const cached = JSON.parse(ui.cache.get(key)!);
  // Older all-textarea forms stored owner/date before questionOrBlocker.
  const oldSaved = Object.fromEntries(["concern", "action", "owner", "targetDate", "questionOrBlocker", "evidenceIds"].map((name) => [name, cached.saved[name]]));
  const restore = (saved: any) => client({ proposal: true, cache: new Map([[key, JSON.stringify({ ...cached, saved })]]) });
  const reopened = restore(oldSaved);
  assert.equal(reopened.proposalFields[1]!.value, "Cached action");
  assert.match(reopened.status.textContent, /Unsubmitted edit restored/);
  const { owner: _owner, ...missingOwner } = oldSaved;
  for (const saved of [missingOwner, { ...oldSaved, extra: "" }, { ...oldSaved, owner: "Other owner" },
    { ...oldSaved, evidenceIds: ["known"] }, { ...missingOwner, replacement: "" }]) {
    const stale = restore(saved);
    assert.equal(stale.proposalFields[1]!.value, "Saved action");
    assert.match(stale.status.textContent, /different brief version or saved baseline/);
  }
});
