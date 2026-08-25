import assert from "node:assert/strict";
import test from "node:test";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

async function freshStore(name) {
  globalThis.localStorage = memoryStorage();
  return import(`./jobStore.js?test=${name}`);
}

test("온보딩 종료 잡은 진행 매핑에서 확인 대기 스토어로 이관된다", async () => {
  const store = await freshStore("finish");
  store.setJob("project-a", "job-1", store.JOB_SOURCE.ONBOARDING);

  assert.equal(store.finishJob("project-a", "job-1", "done"), true);
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs")), {});
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.sources")), {});
  const ended = JSON.parse(localStorage.getItem("ktel.jobs.ended"));
  assert.equal(ended["project-a"].jobId, "job-1");
  assert.equal(ended["project-a"].status, "done");
  assert.equal(ended["project-a"].source, store.JOB_SOURCE.ONBOARDING);
  assert.equal(typeof ended["project-a"].endedAt, "number");

  store.acknowledgeJob("project-a");
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.ended")), {});
});

test("일반 일괄 변환 종료 잡은 온보딩 확인 스토어에 남기지 않는다", async () => {
  const store = await freshStore("migration");
  store.setJob("project-a", "job-1", store.JOB_SOURCE.MIGRATION);

  assert.equal(store.finishJob("project-a", "job-1", "done"), true);
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs")), {});
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.sources")), {});
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.ended")), {});
});

test("오래된 폴러는 같은 프로젝트의 새 잡을 종료시키지 않는다", async () => {
  const store = await freshStore("stale");
  store.setJob("project-a", "job-old");
  store.setJob("project-a", "job-new");

  assert.equal(store.finishJob("project-a", "job-old", "done"), false);
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs")), { "project-a": "job-new" });
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.ended")), {});
});

test("running 상태는 종료 스토어로 이관하지 않는다", async () => {
  const store = await freshStore("running");
  store.setJob("project-a", "job-1");

  assert.equal(store.finishJob("project-a", "job-1", "running"), false);
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs")), { "project-a": "job-1" });
  assert.deepEqual(JSON.parse(localStorage.getItem("ktel.jobs.ended")), {});
});
