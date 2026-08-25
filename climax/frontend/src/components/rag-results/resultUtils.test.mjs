import assert from "node:assert/strict";
import test from "node:test";

import {
  graphData,
  includeCurrentResult,
} from "./resultUtils.js";

test("graphData keeps every valid entity and relation from the complete response", () => {
  const value = graphData(
    [{ id: "entity-1", name: "first" }, { id: "entity-2", name: "second" }],
    [{ id: "relation-1", source: "entity-1", target: "entity-2" }],
  );

  assert.equal(value.nodes.length, 2);
  assert.equal(value.edges.length, 1);
  assert.equal("is_truncated" in value, false);
});

test("includeCurrentResult pins an old directly opened result without duplicating it", () => {
  const current = { reference_id: "old-reference", filename: "old.pdf" };
  const recent = [{ reference_id: "recent-reference", filename: "recent.pdf" }];
  assert.deepEqual(
    includeCurrentResult(recent, current, "old-reference"),
    [current, ...recent],
  );
  assert.deepEqual(
    includeCurrentResult([current, ...recent], current, "old-reference"),
    [current, ...recent],
  );
});
