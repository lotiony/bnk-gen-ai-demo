import assert from "node:assert/strict";
import test from "node:test";

import { createRetainedResourceCache } from "./retainedResourceCache.js";

const scheduledCache = (options) => {
  const scheduled = [];
  const cache = createRetainedResourceCache({
    ...options,
    schedule: (callback) => scheduled.push(callback),
  });
  const flush = () => {
    while (scheduled.length) scheduled.shift()();
  };
  return { cache, flush };
};

test("concurrent consumers and StrictMode remounts share one loading promise", async () => {
  const { cache, flush } = scheduledCache({ maxInactive: 10 });
  let loads = 0;
  const load = async () => ({ id: ++loads });

  const first = cache.acquire("pdf-a", load);
  first.release();
  const remounted = cache.acquire("pdf-a", load);
  const spreadPage = cache.acquire("pdf-a", load);
  flush();

  assert.equal((await remounted.promise).id, 1);
  assert.equal(await spreadPage.promise, await remounted.promise);
  assert.equal(loads, 1);
  assert.equal(cache.snapshot()[0].references, 2);
  remounted.release();
  spreadPage.release();
  flush();
  assert.equal(cache.size(), 1);
});

test("only the ten most recently used inactive PDF resources are retained", async () => {
  const disposed = [];
  const { cache, flush } = scheduledCache({
    maxInactive: 10,
    dispose: (value) => disposed.push(value.id),
  });

  for (let index = 1; index <= 11; index += 1) {
    const lease = cache.acquire(`pdf-${index}`, async () => ({ id: index }));
    await lease.promise;
    lease.release();
    flush();
  }

  assert.equal(cache.size(), 10);
  assert.deepEqual(disposed, [1]);
  assert.equal(cache.snapshot().some(({ key }) => key === "pdf-1"), false);
  assert.equal(cache.snapshot().some(({ key }) => key === "pdf-11"), true);
});

test("active resources are never evicted even when the inactive limit is exceeded", async () => {
  const disposed = [];
  const { cache, flush } = scheduledCache({
    maxInactive: 1,
    dispose: (value) => disposed.push(value.id),
  });
  const active = cache.acquire("active", async () => ({ id: "active" }));
  await active.promise;

  for (const id of ["old", "recent"]) {
    const lease = cache.acquire(id, async () => ({ id }));
    await lease.promise;
    lease.release();
    flush();
  }

  assert.equal(cache.snapshot().find(({ key }) => key === "active").references, 1);
  assert.deepEqual(disposed, ["old"]);
  active.release();
  flush();
});

test("failed resources are removed so retry creates a fresh load", async () => {
  const { cache, flush } = scheduledCache({ maxInactive: 10 });
  let loads = 0;
  const failing = cache.acquire("pdf", async () => {
    loads += 1;
    throw new Error("failed");
  });
  await assert.rejects(failing.promise, /failed/);
  failing.release();
  flush();

  const retry = cache.acquire("pdf", async () => ({ id: ++loads }));
  assert.equal((await retry.promise).id, 2);
  retry.release();
  flush();
});
