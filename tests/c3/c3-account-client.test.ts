import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { ACCOUNT_READING_CLIENT_SCRIPT } from "../../src/c3/account-client.ts";

function browser(options: { stored?: unknown; account?: string; csrf?: string; hash?: string; unavailable?: boolean; home?: boolean } = {}) {
  const values = new Map<string, string>();
  const key = `atliera.c3.account-reading.v1:${options.account ?? "a"}:${options.csrf ?? "s"}`;
  if (options.stored !== undefined) values.set(key, JSON.stringify(options.stored));
  const actions: unknown[] = [];
  const handlers = new Map<string, (event: any) => void>();
  const frames: (() => void)[] = [];
  const link = { id: "account-prepare", getAttribute: () => "/?prepare=1", focus: (args: unknown) => actions.push(["focus", args]) };
  const storage = { getItem: (k: string) => { if (options.unavailable) throw Error("unavailable"); return values.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (options.unavailable) throw Error("unavailable"); values.set(k, v); }, removeItem: (k: string) => values.delete(k) };
  const document = { querySelector: (selector: string) => selector === '.account-workspace' ? (options.home === false ? null : {}) :
    selector.includes('meta[name="c3-account"]') ? { getAttribute: () => options.account ?? "a" } : selector.includes('meta[name="c3-csrf"]') ? { getAttribute: () => options.csrf ?? "s" } : link,
    getElementById: () => link, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) };
  const window = { sessionStorage: storage, location: { hash: options.hash ?? "" }, scrollY: 860,
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
    requestAnimationFrame: (callback: () => void) => frames.push(callback), scrollTo: (...args: number[]) => actions.push(["scroll", ...args]) };
  runInNewContext(ACCOUNT_READING_CLIENT_SCRIPT, { document, window });
  const click = (overrides = {}) => handlers.get('click')?.({ target: { closest: () => link }, button: 0, ...overrides });
  return { key, values, actions, frames, click, pageshow: () => handlers.get('pageshow')?.({ persisted: true }) };
}

test("Account round trip stores only position and restores focus without moving the reading point", () => {
  const first = browser(); first.click();
  const stored = JSON.parse(first.values.get(first.key)!);
  assert.deepEqual(stored, { y: 860, origin: "account-prepare", route: "/?prepare=1" });
  const returned = browser({ stored });
  assert.equal(returned.frames.length, 1);
  returned.frames[0]!();
  assert.equal(JSON.stringify(returned.actions), JSON.stringify([["focus", { preventScroll: true }], ["scroll", 0, 860]]));
  assert.equal(returned.values.has(returned.key), false, "return receipt is consumed");
  const nativeBack = browser(); nativeBack.click(); nativeBack.pageshow();
  assert.equal(nativeBack.values.size, 0, "native history restore must not leave a stale receipt for a later reload");
  assert.equal(nativeBack.actions.length, 0);
});
test("Deliberate source fragments, unavailable storage and modified clicks do not hijack navigation", () => {
  const stored = { y: 900, origin: "account-prepare", route: "/?prepare=1" };
  assert.equal(browser({ stored, hash: '#account-research' }).frames.length, 0);
  const blocked = browser({ unavailable: true }); assert.doesNotThrow(() => blocked.click());
  for (const event of [{ ctrlKey: true }, { metaKey: true }, { button: 1 }]) {
    const state = browser(); state.click(event); assert.equal(state.values.size, 0);
  }
  const workshop = browser({ home: false }); workshop.click(); assert.equal(workshop.values.size, 0);
});
test("Malformed reading receipts cannot select arbitrary routes, invalid positions or selectors", () => {
  for (const stored of [null, { y: -1 }, { y: 1, origin: 'bad"selector', route: '/?prepare=1' },
    { y: 1, origin: '', route: 'https://untrusted.invalid' }, { y: '900', origin: '', route: '/?prepare=1' }]) {
    assert.equal(browser({ stored }).frames.length, 0);
  }
});
