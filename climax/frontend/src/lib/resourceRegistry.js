export const REGISTRY_VIEWS = ["attached", "pool", "review"];
export const REGISTRY_FILTERS = ["all", "owned", "shared", "enabled"];
export const DETAIL_TABS = ["overview", "sharing", "binding", "history"];

const asArray = (value) => (Array.isArray(value) ? value : []);
const lower = (value) => String(value ?? "").trim().toLowerCase();

export function versionLabel(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return String(value.label || value.version || value.name || value.id || fallback);
}

export function releaseLabel(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  return String(value.release_no || value.name || value.label || value.id || fallback);
}

export function sourceLabel(asset) {
  const source = asset?.source;
  if (source && typeof source === "object") {
    return source.label || source.name || source.kind || source.type || asset?.base_url || "—";
  }
  return source || asset?.base_url || "—";
}

export function normalizeCapability(raw = {}) {
  return {
    ...raw,
    resource_id: raw.resource_id || raw.tool_id || raw.id || "",
    tool_id: raw.tool_id || raw.resource_id || raw.id || "",
    method: String(raw.method || "").toUpperCase(),
    path: raw.path || "",
    mutating: !!raw.mutating,
    enabled: raw.enabled !== false,
  };
}

export function normalizeBinding(raw) {
  if (!raw) return null;
  return {
    ...raw,
    id: raw.id || raw.binding_id || "",
    pinned_version: raw.pinned_version ?? raw.version ?? null,
    available_version: raw.available_version ?? null,
    environment: raw.environment || "",
    credential_ref: raw.credential_ref || "",
    enabled: raw.enabled !== false,
    revision: raw.revision || raw.draft_revision || "",
    validation_state: lower(raw.validation_state || raw.status || "review") || "review",
    current_release: raw.current_release ?? null,
    has_draft: !!raw.has_draft,
    legacy_limited: !!raw.legacy_limited,
  };
}

export function bindingDraftPatch(draft = {}) {
  const patch = {
    environment: String(draft.environment || "").trim(),
    enabled: draft.enabled !== false,
  };
  if (draft.pinned_version_id) patch.pinned_version_id = draft.pinned_version_id;
  // GET intentionally returns no credential reference path.  An untouched blank
  // input therefore means "keep the configured reference", not "erase it".
  if (draft.credential_ref_dirty) {
    patch.credential_ref = String(draft.credential_ref || "").trim();
  }
  return patch;
}

export function normalizeAsset(raw = {}) {
  const capabilities = asArray(raw.capabilities).map(normalizeCapability);
  const lifecycle = lower(raw.lifecycle_status || raw.binding?.validation_state || "pool") || "pool";
  return {
    ...raw,
    asset_id: raw.asset_id || raw.id || "",
    name: raw.name || raw.asset_id || raw.id || "MCP",
    created_project: raw.created_project || null,
    visibility: lower(raw.visibility || "private") || "private",
    latest_version: raw.latest_version ?? null,
    binding: normalizeBinding(raw.binding),
    capabilities,
    capability_count: Number(raw.capability_count ?? capabilities.length ?? 0),
    used_by_count: Number(raw.used_by_count ?? raw.project_usage_count ?? 0),
    skill_impact_count: Number(raw.skill_impact_count ?? 0),
    lifecycle_status: lifecycle,
    permissions: raw.permissions || {},
  };
}

export function normalizeDetail(payload = {}) {
  const raw = payload.asset && typeof payload.asset === "object"
    ? { ...payload.asset, ...payload, asset: undefined }
    : payload;
  return {
    ...normalizeAsset(raw),
    versions: asArray(payload.versions ?? raw.versions),
    releases: asArray(payload.releases ?? raw.releases),
    impact: payload.impact ?? raw.impact ?? null,
    validation: payload.validation ?? raw.validation ?? null,
  };
}

export function computedMetrics(assets = []) {
  return {
    attached: assets.filter((asset) => !!asset.binding).length,
    pool: assets.filter((asset) => !asset.binding).length,
    current_release: assets.filter((asset) => !!asset.binding?.current_release).length,
    draft: assets.filter((asset) => !!asset.binding?.has_draft).length,
    blocker: assets.filter((asset) => asset.lifecycle_status === "blocked").length,
    review: assets.filter((asset) => asset.lifecycle_status === "review" || asset.lifecycle_status === "blocked").length,
  };
}

export function normalizeRegistry(payload = {}, requestedView = "attached") {
  const view = REGISTRY_VIEWS.includes(payload.view) ? payload.view : requestedView;
  let assets = asArray(payload.assets ?? payload.items).map(normalizeAsset);
  // UI 방어선일 뿐 보안 경계는 아니다. 생성 프로젝트는 자신이 분리한 Private
  // asset을 다시 찾을 수 있어야 하므로 서버가 명시적으로 attach 권한을 준 항목은 유지한다.
  if (view === "pool") assets = assets.filter((asset) => (
    asset.visibility === "public" || asset.permissions?.attach === true
  ));
  if (view === "review") {
    assets = assets.filter((asset) => asset.lifecycle_status === "review"
      || asset.lifecycle_status === "blocked" || asset.binding?.has_draft);
  }
  return {
    view,
    assets,
    metrics: { ...computedMetrics(assets), ...(payload.metrics || {}) },
    actor: payload.actor || null,
  };
}

export function filterAssets(assets, { query = "", scope = "all", projectId = "" } = {}) {
  const q = lower(query);
  return asArray(assets).filter((asset) => {
    if (scope === "owned" && asset.created_project?.id !== projectId) return false;
    if (scope === "shared" && (!asset.binding || asset.created_project?.id === projectId)) return false;
    if (scope === "enabled"
      && (asset.binding?.current_enabled ?? asset.binding?.enabled) !== true) return false;
    if (!q) return true;
    const haystack = [
      asset.asset_id, asset.name, asset.visibility, asset.created_project?.name,
      sourceLabel(asset), asset.base_url,
      ...asset.capabilities.flatMap((capability) => [
        capability.tool_id, capability.method, capability.path,
      ]),
    ].map(lower).join(" ");
    return haystack.includes(q);
  });
}

export function statusMeta(status) {
  const value = lower(status || "pool") || "pool";
  if (["ready", "passed", "pass", "ok", "success", "healthy"].includes(value)) {
    return { value, label: value === "healthy" ? "HEALTHY" : "READY", tone: "ready" };
  }
  if (value === "blocked" || value === "failed" || value === "error") {
    return { value, label: value === "blocked" ? "BLOCKED" : "FAILED", tone: "blocked" };
  }
  if (["review", "draft", "pending", "warning", "warn"].includes(value)) {
    return { value, label: value === "draft" ? "UNPUBLISHED" : "REVIEW", tone: "review" };
  }
  return { value, label: "POOL", tone: "pool" };
}

export function validationCheckStatus(check = {}) {
  return check.status || check.state || check.level || "pending";
}

export function validationCheckLabel(check = {}, index = 0) {
  return check.label || check.name || check.code
    || (check.level ? String(check.level).toUpperCase() : `Check ${index + 1}`);
}

export function validationIssueCopy(issue = {}, ko = true) {
  const code = String(issue.code || "CONNECTION_FAILED").trim().toUpperCase();
  const copy = {
    EGRESS_POLICY_DENIED: {
      ko: ["로컬 연결 정책에서 차단됨", "대상 호스트가 허용 목록에 없어 연결 요청을 보내지 않았습니다.", "로컬 연결 정책 설정 → 재검증"],
      en: ["Blocked by local connection policy", "The request was not sent because the target host is not allowlisted.", "Configure local connection policy → revalidate"],
    },
    CONNECTION_REFUSED: {
      ko: ["대상 서비스에 연결할 수 없음", "대상 주소에서 연결을 수락하지 않았습니다. 서비스 실행 상태와 주소를 확인하세요.", "서비스 실행·주소 확인 → 재검증"],
      en: ["Connection refused", "The target did not accept the connection. Check the service and endpoint.", "Check service and endpoint → revalidate"],
    },
    CONNECTION_TIMEOUT: {
      ko: ["연결 시간 초과", "제한 시간 안에 대상 서비스의 응답을 받지 못했습니다.", "네트워크·서비스 상태 확인 → 재검증"],
      en: ["Connection timed out", "The target did not respond before the timeout.", "Check network and service → revalidate"],
    },
    AUTH_FAILED: {
      ko: ["인증 실패", "대상 서비스가 Credential을 승인하지 않았습니다.", "Credential reference 확인 → 재검증"],
      en: ["Authentication failed", "The upstream did not accept the configured credential.", "Check credential reference → revalidate"],
    },
    UPSTREAM_ERROR: {
      ko: ["대상 서비스 오류", "대상 서비스가 서버 오류를 반환했습니다.", "대상 서비스 상태 확인 → 재검증"],
      en: ["Upstream service error", "The target returned a server error.", "Check upstream service → revalidate"],
    },
    CONNECTION_FAILED: {
      ko: ["연결 검사 실패", "대상 서비스와 연결을 완료하지 못했습니다.", "연결 설정 확인 → 재검증"],
      en: ["Connection check failed", "The connection to the target could not be completed.", "Check connection settings → revalidate"],
    },
  }[code] || null;
  const [title, description, action] = copy?.[ko ? "ko" : "en"]
    || [code, String(issue.message || ""), ko ? "설정 확인 → 재검증" : "Check settings → revalidate"];
  return { ...issue, code, title, description, actionLabel: action };
}

export function validationCheckDetails(check = {}, impact = {}) {
  const declared = check.details;
  if (declared && typeof declared === "object" && Array.isArray(declared.items)) {
    return { kind: String(declared.kind || "items"), items: declared.items };
  }
  // Compatibility for validation rows saved before the structured detail
  // contract was introduced. New results always use check.details.
  if (Array.isArray(check.issues) && check.issues.length > 0) {
    return { kind: "connection_issues", items: check.issues };
  }
  if (check.id === "skill_dependency" && asArray(impact.skills).length > 0) {
    return { kind: "skills", items: asArray(impact.skills) };
  }
  return { kind: "", items: [] };
}

export function validationSkillReason(reason, ko = true) {
  const key = String(reason || "");
  const copy = {
    binding_disabled: ["다음 Release에서 Binding이 OFF되어 실행할 수 없습니다.", "The next Release disables the Binding used by this Skill."],
    binding_detach: ["Binding을 분리하면 이 Skill을 실행할 수 없습니다.", "Detaching the Binding would break this Skill."],
    removed_tool: ["선택한 Version에서 이 Tool이 제거됩니다.", "The selected Version removes this Tool."],
    schema_mapping_invalid: ["선택한 Version의 schema와 현재 Skill mapping이 호환되지 않습니다.", "The Skill mapping is incompatible with the selected Version schema."],
  }[key];
  return copy ? copy[ko ? 0 : 1] : "";
}

export function updateCapabilityEnabled(items, toolId, enabled) {
  return asArray(items).map((item) => (
    item.tool_id === toolId ? { ...item, enabled: !!enabled } : item
  ));
}

export function canExploreAsset(asset = {}) {
  return !!asset.binding?.current_release && asArray(asset.capabilities).length > 0;
}

export function toolExplorerNavigation(toolId) {
  const tool = String(toolId || "").trim();
  if (!tool) return null;
  return { screen: "explorer", payload: { view: "all", tool } };
}

export function mergeExplorerBrowseResults(allResults, matchingResults, toolId) {
  const tool = String(toolId || "").trim();
  const all = asArray(allResults);
  const exact = [...asArray(matchingResults), ...all]
    .find((item) => item?.tool_id === tool);
  if (!exact) return all;
  return [exact, ...all.filter((item) => item?.tool_id !== tool)];
}

export function releaseSnapshotDiff(newer = {}, older = {}) {
  if (!older || typeof older !== "object") return [];
  const current = newer.snapshot || {};
  const previous = older.snapshot || {};
  const fields = [
    ["version", versionLabel(older.version || older.pinned_version), versionLabel(newer.version || newer.pinned_version)],
    ["environment", previous.environment || "default", current.environment || "default"],
    ["enabled", previous.enabled === false ? "OFF" : "ON", current.enabled === false ? "OFF" : "ON"],
    ["credential", previous.credential_configured ? "configured" : "none", current.credential_configured ? "configured" : "none"],
    ["revision", String(previous.revision ?? "—"), String(current.revision ?? "—")],
  ];
  return fields.filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ field, before, after }));
}

export function projectBindingChanges(binding, draft = {}, versions = []) {
  if (!binding) return [];
  const release = binding.current_release || null;
  const snapshot = release?.snapshot || {};
  const labelVersion = (value) => {
    const raw = value && typeof value === "object"
      ? (value.id || value.version_id || value.version || value.label)
      : value;
    const match = asArray(versions).find((version) => (
      String(version?.id || version?.version_id || "") === String(raw || "")
    ));
    return versionLabel(match || value, "—");
  };
  const currentVersion = release
    ? labelVersion(release.version_id || release.version || release.pinned_version)
    : "—";
  const pendingVersion = labelVersion(
    draft.pinned_version_id || binding.pinned_version,
  );
  const currentEnvironment = release ? String(snapshot.environment || "default") : "—";
  const pendingEnvironment = String(draft.environment || binding.environment || "default").trim() || "default";
  const currentCredential = release && snapshot.credential_configured ? "configured" : "none";
  const pendingCredential = (draft.credential_ref_dirty
    ? !!String(draft.credential_ref || "").trim()
    : !!draft.credential_configured) ? "configured" : "none";
  const currentEnabled = release ? (snapshot.enabled === false ? "OFF" : "ON") : "—";
  const pendingEnabled = draft.enabled === false ? "OFF" : "ON";
  return [
    ["version", currentVersion, pendingVersion],
    ["environment", currentEnvironment, pendingEnvironment],
    ["credential", currentCredential, pendingCredential],
    ["enabled", currentEnabled, pendingEnabled],
  ].filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ field, before, after }));
}

export function detachNavigation(capability = {}) {
  const assetId = capability.asset_id || "";
  const bindingId = capability.binding_id || "";
  return {
    tab: "resources",
    view: "attached",
    assetId,
    bindingId,
    detailTab: "binding",
    fromTool: capability.tool_id || "",
    ...(assetId && bindingId ? { action: "detach" } : {}),
  };
}

export function impactProjectNavigation(item = {}, assetId = "") {
  const projectId = typeof item === "string"
    ? item : String(item.project_id || item.id || "");
  if (!projectId || !assetId) return null;
  const bindingId = typeof item === "object"
    ? String(item.binding_id || "") : "";
  return {
    projectId,
    screen: "projectSettings",
    payload: {
      tab: "resources",
      view: "attached",
      assetId,
      detailTab: "binding",
      focusAction: "detach",
      ...(bindingId ? { bindingId } : {}),
    },
  };
}

export function resolveDetachNavigation(nav, detail) {
  if (nav?.action !== "detach" || !nav.assetId || !nav.bindingId) return "none";
  if (!detail || detail.asset_id !== nav.assetId) return "wait";
  return detail.binding?.id === nav.bindingId ? "ready" : "stale";
}

export function skillEditNavigation(skill) {
  if (!skill || typeof skill !== "object") return null;
  const editId = skill.id || skill.skill_id || "";
  if (!editId) return null;
  const step = Number(skill.step ?? skill.step_index);
  return {
    screen: "skillCreate",
    payload: {
      editId,
      ...(Number.isInteger(step) && step >= 0 ? { focusStep: step } : {}),
      ...(skill.tool_id ? { impactTool: skill.tool_id } : {}),
      returnTo: "projectSettings",
    },
  };
}

export function impactItems(impact) {
  if (!impact || typeof impact !== "object") return {
    projects: [], skills: [], blockers: [],
    schemaDiff: { added: [], removed: [], changed: [], items: [] },
  };
  const diff = impact.schema_diff && typeof impact.schema_diff === "object"
    ? impact.schema_diff : {};
  return {
    projects: asArray(impact.projects ?? impact.affected_projects),
    skills: asArray(impact.skills ?? impact.affected_skills),
    blockers: asArray(impact.blockers ?? impact.validation_blockers),
    schemaDiff: {
      added: asArray(diff.added),
      removed: asArray(diff.removed),
      changed: asArray(diff.changed),
      items: asArray(diff.items),
    },
  };
}

export function hasImpact(impact) {
  const items = impactItems(impact);
  return items.projects.length > 0 || items.skills.length > 0 || items.blockers.length > 0
    || Number(impact?.project_count || 0) > 0 || Number(impact?.skill_count || 0) > 0;
}

export function impactFromError(error) {
  return error?.body?.detail?.impact || error?.body?.impact || null;
}

export function registryQuery({ view = "attached", query = "" } = {}) {
  const params = new URLSearchParams({ view: REGISTRY_VIEWS.includes(view) ? view : "attached" });
  if (String(query).trim()) params.set("query", String(query).trim());
  return params.toString();
}
