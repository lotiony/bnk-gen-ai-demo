import assert from "node:assert/strict";
import test from "node:test";

import { SCREEN_PATH, legacyRedirect, pathForScreen, screenForPath } from "./routes.js";

test("화면 id ↔ 주소는 1:1 이다", () => {
  const paths = Object.values(SCREEN_PATH);
  assert.equal(new Set(paths).size, paths.length, "중복된 주소가 있으면 뒤 화면이 앞 화면을 가린다");
  for (const [screen, path] of Object.entries(SCREEN_PATH)) {
    assert.equal(screenForPath(path), screen);
    assert.equal(pathForScreen(screen), path);
  }
});

test("끝의 슬래시는 같은 화면으로 본다", () => {
  assert.equal(screenForPath("/skills/create/"), "skillCreate");
  assert.equal(screenForPath("/"), "dashboard");
});

test("모르는 주소는 대시보드로 떨어진다 — 흰 화면을 만들지 않는다", () => {
  assert.equal(screenForPath("/nope/nope"), "dashboard");
  assert.equal(pathForScreen("존재하지않는화면"), "/");
});

test("예전 ?screen= 딥링크는 새 주소로 옮긴다", () => {
  assert.equal(legacyRedirect("?screen=skillManage"), "/skills/manage");
  assert.equal(legacyRedirect("?screen=playground&foo=1"), "/playground?foo=1");
});

test("은퇴한 마법사 딥링크는 src 에 맞는 리소스 화면으로 간다", () => {
  assert.equal(legacyRedirect("?screen=wizard&src=db"), "/resources/db");
  assert.equal(legacyRedirect("?screen=wizard&src=openapi"), "/resources/api");
  assert.equal(legacyRedirect("?screen=wizard"), "/resources/api");
});

test("옮길 대상이 없으면 주소를 건드리지 않는다", () => {
  assert.equal(legacyRedirect(""), null);
  assert.equal(legacyRedirect("?foo=1"), null);
  assert.equal(legacyRedirect("?screen=존재하지않음"), null);
});
