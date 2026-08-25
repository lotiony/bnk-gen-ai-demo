import assert from "node:assert/strict";
import test from "node:test";

function memoryStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("v4 온보딩 draft는 v6에서 복원하지 않는다", async (t) => {
  const oldLocalStorage = globalThis.localStorage;
  const oldSessionStorage = globalThis.sessionStorage;
  globalThis.localStorage = memoryStorage({
    ember_onb_drafts: JSON.stringify({ old: { __v: 4, updatedAt: Date.now(), step: 2 } }),
  });
  globalThis.sessionStorage = memoryStorage();
  t.after(() => {
    globalThis.localStorage = oldLocalStorage;
    globalThis.sessionStorage = oldSessionStorage;
  });

  const drafts = await import(`./onboardingDrafts.js?test=v6-${Date.now()}`);
  assert.equal(drafts.DRAFT_VERSION, 6);
  assert.equal(drafts.readDraft("old"), null);
});
