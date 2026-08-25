import assert from "node:assert/strict";
import test from "node:test";

import {
  bindingDraftPatch,
  canExploreAsset,
  DETAIL_TABS,
  filterAssets,
  hasImpact,
  impactFromError,
  impactProjectNavigation,
  mergeExplorerBrowseResults,
  normalizeDetail,
  normalizeRegistry,
  projectBindingChanges,
  registryQuery,
  releaseLabel,
  releaseSnapshotDiff,
  resolveDetachNavigation,
  skillEditNavigation,
  statusMeta,
  toolExplorerNavigation,
  detachNavigation,
  updateCapabilityEnabled,
  validationCheckLabel,
  validationCheckDetails,
  validationCheckStatus,
  validationIssueCopy,
  validationSkillReason,
  versionLabel,
} from "./resourceRegistry.js";

const attached = {
  asset_id: "mcp-product",
  name: "Product MCP",
  created_project: { id: "proj-product", name: "상품플랫폼" },
  source: { kind: "openapi", label: "Product API" },
  visibility: "public",
  lifecycle_status: "ready",
  skill_impact_count: 4,
  binding: {
    id: "bind-sales-product",
    pinned_version: { id: "ver-32", version: "v3.2" },
    enabled: true,
    has_draft: false,
    current_release: { id: "rel-14", release_no: "sales-r14" },
  },
  capabilities: [
    { resource_id: "getProduct", method: "get", path: "/products/{id}", enabled: true },
    { resource_id: "updateProduct", method: "patch", path: "/products/{id}", mutating: true, enabled: false },
  ],
};

test("registry normalizes asset, capability, binding, and metrics", () => {
  const result = normalizeRegistry({ view: "attached", assets: [attached], metrics: { attached: 12 } });
  assert.equal(result.assets[0].capability_count, 2);
  assert.equal(result.assets[0].capabilities[0].tool_id, "getProduct");
  assert.equal(result.assets[0].capabilities[0].method, "GET");
  assert.equal(result.assets[0].capabilities[1].enabled, false);
  assert.equal(result.assets[0].binding.id, "bind-sales-product");
  assert.equal(result.metrics.attached, 12, "server metrics override local fallback");
  assert.equal(result.metrics.current_release, 1);
});

test("pool hides leaked private assets but keeps a creator-owned reattach candidate", () => {
  const result = normalizeRegistry({ view: "pool", assets: [
    { ...attached, asset_id: "public", binding: null },
    { ...attached, asset_id: "private", visibility: "private", binding: null },
    { ...attached, asset_id: "owned-private", visibility: "private", binding: null,
      permissions: { attach: true } },
  ] });
  assert.deepEqual(result.assets.map((asset) => asset.asset_id), ["public", "owned-private"]);
});

test("review view keeps blocked, review, and draft assets", () => {
  const result = normalizeRegistry({ view: "review", assets: [
    attached,
    { ...attached, asset_id: "blocked", lifecycle_status: "blocked" },
    { ...attached, asset_id: "review", lifecycle_status: "review" },
    { ...attached, asset_id: "draft", lifecycle_status: "ready", binding: { ...attached.binding, has_draft: true } },
  ] });
  assert.deepEqual(result.assets.map((asset) => asset.asset_id), ["blocked", "review", "draft"]);
});

test("search includes creator, source, tool, method, and path", () => {
  const assets = normalizeRegistry({ assets: [attached] }).assets;
  assert.equal(filterAssets(assets, { query: "상품플랫폼" }).length, 1);
  assert.equal(filterAssets(assets, { query: "product api" }).length, 1);
  assert.equal(filterAssets(assets, { query: "PATCH" }).length, 1);
  assert.equal(filterAssets(assets, { query: "updateProduct" }).length, 1);
  assert.equal(filterAssets(assets, { query: "/products" }).length, 1);
  assert.equal(filterAssets(assets, { query: "missing" }).length, 0);
});

test("scope filters distinguish creator, shared binding, and enabled binding", () => {
  const assets = normalizeRegistry({ assets: [attached] }).assets;
  assert.equal(filterAssets(assets, { scope: "owned", projectId: "proj-product" }).length, 1);
  assert.equal(filterAssets(assets, { scope: "owned", projectId: "proj-sales" }).length, 0);
  assert.equal(filterAssets(assets, { scope: "shared", projectId: "proj-sales" }).length, 1);
  assert.equal(filterAssets(assets, { scope: "enabled", projectId: "proj-sales" }).length, 1);
  assets[0].binding.enabled = false;
  assert.equal(filterAssets(assets, { scope: "enabled", projectId: "proj-sales" }).length, 0);
});

test("detail supports both flat and nested asset payloads", () => {
  const detail = normalizeDetail({ asset: attached, versions: [{ id: "ver-32", version: "v3.2" }], releases: [{ release_no: "sales-r14" }] });
  assert.equal(detail.asset_id, "mcp-product");
  assert.equal(detail.versions.length, 1);
  assert.equal(versionLabel(detail.versions[0]), "v3.2");
  assert.equal(releaseLabel(detail.releases[0]), "sales-r14");
});

test("an undisclosed configured credential reference is omitted until explicitly replaced", () => {
  const untouched = bindingDraftPatch({
    environment: " stage ", enabled: true, pinned_version_id: "ver-32",
    credential_configured: true, credential_ref: "", credential_ref_dirty: false,
  });
  assert.deepEqual(untouched, {
    environment: "stage", enabled: true, pinned_version_id: "ver-32",
  });

  const replaced = bindingDraftPatch({
    environment: "stage", enabled: true,
    credential_configured: true, credential_ref: " vault://new/ref ",
    credential_ref_dirty: true,
  });
  assert.equal(replaced.credential_ref, "vault://new/ref");
});

test("status and structured impact retain blocker meaning", () => {
  assert.deepEqual(statusMeta("ready"), { value: "ready", label: "READY", tone: "ready" });
  assert.equal(statusMeta("blocked").tone, "blocked");
  const impact = { projects: [{ id: "p1" }], skills: [] };
  assert.equal(hasImpact(impact), true);
  assert.equal(hasImpact({ projects: [], skills: [], blockers: [] }), false);
  assert.equal(impactFromError({ body: { detail: { impact } } }), impact);
});

test("registry query encodes search text and guards unknown views", () => {
  assert.equal(registryQuery({ view: "pool", query: "Product MCP" }), "view=pool&query=Product+MCP");
  assert.equal(registryQuery({ view: "unknown" }), "view=attached");
});

test("validation checks use the backend level contract when status is absent", () => {
  assert.equal(validationCheckStatus({ level: "error", message: "missing" }), "error");
  assert.equal(validationCheckStatus({ level: "warning" }), "warning");
  assert.equal(validationCheckStatus({ state: "ready", level: "error" }), "ready");
  assert.equal(validationCheckLabel({ level: "error" }, 2), "ERROR");
});

test("connection validation issues explain the cause and next action", () => {
  assert.deepEqual(validationIssueCopy({
    code: "EGRESS_POLICY_DENIED", target: "http://127.0.0.1:8080/mock",
  }, true), {
    code: "EGRESS_POLICY_DENIED",
    target: "http://127.0.0.1:8080/mock",
    title: "로컬 연결 정책에서 차단됨",
    description: "대상 호스트가 허용 목록에 없어 연결 요청을 보내지 않았습니다.",
    actionLabel: "로컬 연결 정책 설정 → 재검증",
  });
  assert.equal(validationIssueCopy({ code: "CONNECTION_REFUSED" }, true).actionLabel,
    "서비스 실행·주소 확인 → 재검증");
  assert.equal(validationIssueCopy({ code: "AUTH_FAILED" }, true).title, "인증 실패");
});

test("blocked validation detail disclosure is driven by the backend detail kind", () => {
  const connection = validationCheckDetails({
    id: "smoke",
    details: { kind: "connection_issues", items: [{ code: "AUTH_FAILED" }] },
  });
  assert.deepEqual(connection, {
    kind: "connection_issues", items: [{ code: "AUTH_FAILED" }],
  });
  const skills = validationCheckDetails({
    id: "skill_dependency",
    details: { kind: "skills", items: [{ id: "skl-1", reason: "binding_disabled" }] },
  });
  assert.equal(skills.kind, "skills");
  assert.equal(validationSkillReason(skills.items[0].reason, true),
    "다음 Release에서 Binding이 OFF되어 실행할 수 없습니다.");
});

test("Explorer detach navigation carries both immutable target ids", () => {
  const nav = detachNavigation({
    tool_id: "getProduct", asset_id: "mcp-product", binding_id: "bind-sales-product",
  });
  assert.deepEqual(nav, {
    tab: "resources", view: "attached", assetId: "mcp-product",
    bindingId: "bind-sales-product", detailTab: "binding",
    fromTool: "getProduct", action: "detach",
  });
  assert.equal(resolveDetachNavigation(nav, null), "wait");
  assert.equal(resolveDetachNavigation(nav, { asset_id: "mcp-product", binding: { id: "bind-sales-product" } }), "ready");
  assert.equal(resolveDetachNavigation(nav, { asset_id: "mcp-product", binding: { id: "replacement" } }), "stale");
  assert.equal(detachNavigation({ tool_id: "legacy" }).action, undefined);
});

test("impact project shortcut opens its binding and focuses detach", () => {
  assert.deepEqual(impactProjectNavigation({
    project_id: "proj-consumer", binding_id: "bind-consumer",
  }, "mcp-orders"), {
    projectId: "proj-consumer",
    screen: "projectSettings",
    payload: {
      tab: "resources", view: "attached", assetId: "mcp-orders",
      detailTab: "binding", focusAction: "detach",
      bindingId: "bind-consumer",
    },
  });
  assert.equal(impactProjectNavigation({}, "mcp-orders"), null);
});

test("MVP detail tabs merge validation into project binding", () => {
  assert.deepEqual(DETAIL_TABS, ["overview", "sharing", "binding", "history"]);
});

test("project binding changes compare Current Release with pending settings", () => {
  const changes = projectBindingChanges({
    pinned_version: { id: "ver-40", version: "v4.0" },
    current_release: {
      version_id: "ver-32", version: "v3.2",
      snapshot: { environment: "prod", credential_configured: true, enabled: true },
    },
  }, {
    pinned_version_id: "ver-40", environment: "stage",
    credential_configured: true, credential_ref_dirty: false, enabled: false,
  }, [
    { id: "ver-32", version: "v3.2" }, { id: "ver-40", version: "v4.0" },
  ]);
  assert.deepEqual(changes, [
    { field: "version", before: "v3.2", after: "v4.0" },
    { field: "environment", before: "prod", after: "stage" },
    { field: "enabled", before: "ON", after: "OFF" },
  ]);
});

test("server enabled state updates only the matching capability immutably", () => {
  const before = [{ tool_id: "one", enabled: true }, { tool_id: "two", enabled: true }];
  const after = updateCapabilityEnabled(before, "one", false);
  assert.equal(after[0].enabled, false);
  assert.equal(after[1], before[1]);
  assert.equal(before[0].enabled, true);
});

test("validation impact links an affected Skill to the existing edit contract", () => {
  assert.deepEqual(skillEditNavigation({
    id: "skill-42", name: "만기 안내", step: 2, tool_id: "getMaturity",
  }), {
    screen: "skillCreate", payload: {
      editId: "skill-42", focusStep: 2, impactTool: "getMaturity",
      returnTo: "projectSettings",
    },
  });
  assert.equal(skillEditNavigation("만기 안내"), null);
});

test("Explorer navigation is available only for a published Current Release", () => {
  assert.equal(canExploreAsset(attached), true);
  assert.equal(canExploreAsset({ ...attached, binding: null }), false);
  assert.equal(canExploreAsset({
    ...attached, binding: { ...attached.binding, current_release: null },
  }), false);
});

test("Tool shortcut opens Explorer browse-all with the exact tool selected", () => {
  assert.deepEqual(toolExplorerNavigation(" getProduct "), {
    screen: "explorer", payload: { view: "all", tool: "getProduct" },
  });
  assert.equal(toolExplorerNavigation(""), null);

  const merged = mergeExplorerBrowseResults(
    [{ tool_id: "listProducts" }, { tool_id: "getCoverage" }],
    [{ tool_id: "getProduct", method: "GET" }],
    "getProduct",
  );
  assert.deepEqual(merged.map((item) => item.tool_id), [
    "getProduct", "listProducts", "getCoverage",
  ]);
  assert.deepEqual(
    mergeExplorerBrowseResults([{ tool_id: "getProduct" }], [], "getProduct"),
    [{ tool_id: "getProduct" }],
  );
});

test("release history derives a safe config diff without credential paths", () => {
  const changes = releaseSnapshotDiff(
    { version: "v2", snapshot: { environment: "prod", enabled: false,
      credential_configured: true, revision: 4 } },
    { version: "v1", snapshot: { environment: "stage", enabled: true,
      credential_configured: false, revision: 3 } },
  );
  assert.deepEqual(changes.map((item) => item.field), [
    "version", "environment", "enabled", "credential", "revision",
  ]);
  assert.equal(JSON.stringify(changes).includes("vault://"), false);
});
