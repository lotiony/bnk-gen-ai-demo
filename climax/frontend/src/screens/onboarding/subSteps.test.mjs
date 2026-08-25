// 서브스텝 구성 규칙 — 선택 개수에 따라 화면 수가 달라지는 것이 v2 의 핵심이라 여기서 고정한다.
import assert from "node:assert/strict";
import test from "node:test";

// buildSubSteps 와 같은 규칙(OnboardingV2.jsx). 화면 코드를 import 하면 react 가 필요해
// 규칙만 옮겨 검증한다 — 규칙이 바뀌면 양쪽을 같이 고쳐야 한다.
const TITLE = { code: "소스 코드", openapi: "이미 열려 있는 API", db: "데이터베이스" };
function buildSubSteps(selected) {
  const steps = [{ id: "pick" }];
  selected.forEach((id) => steps.push({ id: `in:${id}`, label: `${TITLE[id]} 입력` }));
  if (selected.length) steps.push({ id: "run" });
  return steps;
}

test("아무것도 안 고르면 선택 화면 하나뿐이다", () => {
  const s = buildSubSteps([]);
  assert.deepEqual(s.map((x) => x.id), ["pick"]);
});

test("1가지 선택 → 선택·입력·읽기 3단계", () => {
  const s = buildSubSteps(["openapi"]);
  assert.deepEqual(s.map((x) => x.id), ["pick", "in:openapi", "run"]);
});

test("2가지 선택 → 입력 화면이 2개로 늘어난다", () => {
  const s = buildSubSteps(["openapi", "db"]);
  assert.deepEqual(s.map((x) => x.id), ["pick", "in:openapi", "in:db", "run"]);
  assert.equal(s.length, 4, "선택 개수 + 2 여야 한다");
});

test("고른 순서가 입력 순서가 된다", () => {
  const s = buildSubSteps(["db", "openapi"]);
  assert.deepEqual(s.map((x) => x.id), ["pick", "in:db", "in:openapi", "run"]);
});

test("마지막 입력 다음이 읽기 — 그 자리에서 변환이 시작된다", () => {
  const s = buildSubSteps(["openapi", "db"]);
  assert.equal(s[s.length - 2].id, "in:db", "마지막 입력");
  assert.equal(s[s.length - 1].id, "run");
});
