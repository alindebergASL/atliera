import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { C3_CLIENT_SCRIPT } from "../../src/c3/render.ts";
import { PLANNING_CLIENT_SCRIPT } from "../../src/c3/planning-client.ts";

function client(options: { cache?: Map<string, string>; fetch?: (body: any) => Promise<any>; storageFails?: boolean; initial?: string; sectionNote?: boolean; confirm?: () => boolean; composed?: boolean } = {}) {
  const cache = options.cache ?? new Map<string, string>();
  const field = { name: "text", value: options.initial ?? "Saved section", maxLength: 4000 };
  const savedCopy = { textContent: "Saved section" };
  const authorship = { textContent: "Template-authored planning prompt" };
  const status = { textContent: "", after() {} };
  const detail = { open: false };
  const listeners = new Map<string, (event: any) => any>();
  let cancel: () => void = () => {};
  const buttons = [{ disabled: false }, { disabled: false }];
  const form = {
    dataset: { editKey: "strategy-options", endpoint: "/api/planning/strategy", version: "0", section: "options" },
    querySelectorAll: (selector: string) => selector === "textarea" ? [field] : buttons,
    querySelector: (selector: string) => selector === "[data-local-status]" ? status : { addEventListener(_name: string, fn: () => void) { cancel = fn; } },
    closest: (selector: string) => selector === "details" ? detail : { querySelector: (s: string) => s === "[data-saved-copy]" ? savedCopy : s === "[data-authorship]" ? authorship : null },
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
  const scope: any = { document, window, requestJson: async (_url: string, body: unknown) => {
    const response = options.fetch ? await options.fetch(JSON.parse(JSON.stringify(body))) : { ok: true, json: async () => ({ version: 1, status: "Session edit kept", noChange: false }) };
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    return payload;
  } };
  scope.fetch = async (_url: string, init: any) => options.fetch!(JSON.parse(init.body));
  vm.runInNewContext(options.composed ? C3_CLIENT_SCRIPT.replace("let confirmLocalEditDeparture = () => true;", "let confirmLocalEditDeparture = () => true; globalThis.localGuard = () => confirmLocalEditDeparture();") : PLANNING_CLIENT_SCRIPT, scope);
  return { note, navigate: () => { let prevented = false; click({ button: 0, target: { closest: () => ({ getAttribute: (name: string) => name === "href" ? "/?prepare=1" : null, hasAttribute: () => false }) }, preventDefault() { prevented = true; } }); return !prevented; },
    guard: () => options.composed ? scope.localGuard() : scope.confirmLocalEditDeparture(), field, savedCopy, authorship, status, cache, detail, buttons, form,
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
