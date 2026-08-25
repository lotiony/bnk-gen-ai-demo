import assert from "node:assert/strict";
import test from "node:test";

import { apiErrorMessage } from "../api.js";

test("formats structured BFF errors without rendering object coercions", () => {
  assert.equal(
    apiErrorMessage({ detail: { code: "rag_upstream_not_configured", message: "RAG upstream 설정 필요" } }, 503),
    "RAG upstream 설정 필요",
  );
  assert.equal(apiErrorMessage({ detail: { code: "run_not_found" } }, 404), "run_not_found");
  assert.equal(apiErrorMessage({}, 502), "HTTP 502");
});
