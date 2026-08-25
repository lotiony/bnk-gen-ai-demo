import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("../../public/rag-fixtures/4078c35341414a3b9b86adb6e61f112828a6490d832dfdb4c729f7191fc7de5c/terms-bbox-84-render.json", import.meta.url);

test("terms bbox fixture supplies normalized PDF overlays", async () => {
  const data = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const boxes = data.items.flatMap((item) => item.page_bboxes || []);

  assert.equal(data.schema_version, "terms-bbox-render/v1");
  assert.equal(data.items.length, 283);
  assert.equal(boxes.length, 346);
  assert.ok(boxes.every(({ page_number, display_bbox }) =>
    page_number >= 1
    && display_bbox.length === 4
    && display_bbox.every((value) => value >= 0 && value <= 1)
    && display_bbox[0] < display_bbox[2]
    && display_bbox[1] < display_bbox[3]));
});
