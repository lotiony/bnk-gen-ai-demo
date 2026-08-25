// 백엔드 REST 호출 헬퍼
let _activeProjectId = null;
export function setActiveProjectId(id) { _activeProjectId = id; }

function withProject(url) {
  if (!_activeProjectId || url.includes("project_id=")) return url;   // 명시 project_id 우선
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}project_id=${encodeURIComponent(_activeProjectId)}`;
}

// 활성 프로젝트가 서버에 없을 때 발행 — ProjectContext 가 받아 다시 고른다.
// 이게 없으면 프로젝트 삭제·백엔드 재기동 후 폴러들이 죽은 id 로 30초마다 404 를 계속 찍는다
// (전부 .catch 로 감싸여 화면은 멀쩡하고 로그만 쌓여서 더 늦게 발견된다).
export const PROJECT_MISSING_EVENT = "climax:project-missing";

function notifyIfProjectGone(status, data, scopedUrl) {
  if (status !== 404 || data?.detail !== "project not found") return;
  // 그 요청이 '활성' 프로젝트를 썼을 때만. 다른 프로젝트를 명시로 조회하다 난 404 로
  // 활성 선택을 갈아치우면 멀쩡한 화면이 엉뚱하게 튄다.
  if (!_activeProjectId) return;
  if (!scopedUrl.includes(`project_id=${encodeURIComponent(_activeProjectId)}`)) return;
  window.dispatchEvent(new CustomEvent(PROJECT_MISSING_EVENT,
                                       { detail: { projectId: _activeProjectId } }));
}

// 현재 역할 — 발표용 가짜 로그인이 localStorage 에 저장, 백엔드 소프트 필터가 이 헤더로 판정
export function currentRoleId() { return localStorage.getItem("ember_role_id") || ""; }

export class ApiError extends Error {
  constructor(message, { status, url, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export function apiErrorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (detail && typeof detail === "object") {
    return detail.message || detail.detail || detail.code || `HTTP ${status}`;
  }
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.error === "string" && data.error) return data.error;
  return `HTTP ${status}`;
}

export function requireAuthMode(config) {
  if (config?.mode === "demo" || config?.mode === "entra") return config.mode;
  throw new Error("서버 인증 모드를 확인할 수 없습니다.");
}

const _etagCache = new Map();
const _graphCache = new Map();
const _graphRequests = new Map();

async function cachedGraph(key, url) {
  const cached = _graphCache.get(key);
  if (cached) {
    _graphCache.delete(key);
    _graphCache.set(key, cached);
    return cached;
  }
  if (_graphRequests.has(key)) return _graphRequests.get(key);
  const request = je(url).then((graph) => {
    if (_graphRequests.get(key) === request) {
      _graphCache.set(key, graph);
      while (_graphCache.size > 4) _graphCache.delete(_graphCache.keys().next().value);
    }
    return graph;
  }).finally(() => {
    if (_graphRequests.get(key) === request) _graphRequests.delete(key);
  });
  _graphRequests.set(key, request);
  return request;
}

async function requestJson(url, opts = {}, conditional = false) {
  const scopedUrl = withProject(url);
  const cached = conditional ? _etagCache.get(scopedUrl) : null;
  const rid = currentRoleId();
  const headers = {
    ...opts.headers,
    ...(rid ? { "X-Emberlink-Role": rid } : {}),
    ...(cached?.etag ? { "If-None-Match": cached.etag } : {}),
  };
  const r = await fetch(scopedUrl, { ...opts, headers });
  if (r.status === 304 && cached) return cached.data;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    notifyIfProjectGone(r.status, data, scopedUrl);
    throw new ApiError(apiErrorMessage(data, r.status), {
      status: r.status,
      url: scopedUrl,
      body: data,
    });
  }
  const etag = conditional ? r.headers.get("ETag") : null;
  if (etag) {
    if (_etagCache.size >= 200) _etagCache.delete(_etagCache.keys().next().value);
    _etagCache.set(scopedUrl, { etag, data });
  }
  return data;
}

async function j(url, opts = {}) { return requestJson(url, opts); }
async function je(url, opts = {}) { return requestJson(url, opts, true); }

// 잡 시작 API 응답 직후 발행 — TaskStatus 가 폴링 주기를 기다리지 않고 즉시 갱신
export const JOB_EVENT = "climax:job-started";
const notifyJob = (r) => { window.dispatchEvent(new Event(JOB_EVENT)); return r; };

// 에이전트 챗이 온톨로지를 바꿨을 때 발행 — Designer/Mapping 화면이 다시 읽는다.
export const ONTOLOGY_EVENT = "climax:ontology-changed";
const ONTOLOGY_WRITE_TOOLS = new Set([
  "ontology_add_class", "ontology_add_relationship", "ontology_add_property",
  "ontology_update_class", "ontology_add_mapping", "ontology_run_automap",
  "ontology_set_row_access", "ontology_resolve_entities", "ontology_run_shacl",
  "ontology_delete_class", "ontology_delete_relationship", "ontology_delete_property",
  "ontology_delete_mapping", "ontology_merge_classes", "ontology_clear",
]);
const RAG_ANSWER_FORMAT = "답변은 Markdown으로 작성하세요. 첫 줄은 질문에 맞는 구체적인 '## 제목', 다음은 1~2문장의 결론, 이어서 '### 핵심 내용' 아래 bullet 목록을 작성하세요. 추가 설명이 필요할 때만 '### 상세 설명'을 사용하세요. 근거가 있는 각 문장 끝에 [n] 인용을 붙이고 별도 References 목록은 작성하지 마세요.";

export const api = {
  runtime: () => j("/api/runtime"),
  stats: () => j("/api/registry/stats"),
  search: (q, filters = {}) => {
    const p = new URLSearchParams({ query: q || "", top_k: "30" });
    if (filters.method?.length) p.set("method", filters.method.join(","));
    if (filters.service) p.set("service", filters.service);
    if (filters.mutating != null) p.set("mutating", String(filters.mutating));
    if (filters.source?.length) p.set("source", filters.source.join(","));
    if (filters.enabled != null) p.set("enabled", String(filters.enabled));
    if (filters.sort) p.set("sort", filters.sort);
    return j(`/api/apis?${p.toString()}`);
  },
  // pid 명시 시 그 프로젝트 스코프로 조회 — 변환 검증은 전역 활성 프로젝트와 다를 수 있어 필수
  describe: (id, pid) => j(pid ? `/api/apis/${id}?project_id=${encodeURIComponent(pid)}` : `/api/apis/${id}`),
  invoke: (id, args, allowMutating) =>
    j(`/api/apis/${id}/invoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arguments: args, allow_mutating: allowMutating }),
    }),
  setMcpEnabled: (id, enabled) => j(`/api/apis/${id}/enabled`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }) }),
  deleteMcp: (id) => j(`/api/apis/${id}`, { method: "DELETE" }),
  // scope 미지정 = 현재 프로젝트 호출만, "all" = 전역(감사 로그 화면)
  audit: (limit = 20, scope) => j(`/api/audit?limit=${limit}${scope ? `&scope=${scope}` : ""}`),
  auditStats: (windowH = 24) => j(`/api/audit/stats?window_h=${windowH}`),
  monitorStatus: (pid) => j(`/api/monitor/status/${pid}`),
  monitorProbe: (pid, service) => j(`/api/monitor/probe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid, service: service || null }) }),
  reseed: () => j("/api/scan/reseed", { method: "POST" }),
  scanImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return j("/api/scan/image", { method: "POST", body: fd });
  },
  scanOpenapi: (body) => j("/api/scan/openapi", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  scanDb: (body) => j("/api/scan/db", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  // Azure ARM 인벤토리 — MSAL access token 을 Authorization 으로 passthrough
  azureSubscriptions: (armToken) => j("/api/inventory/azure/subscriptions", { headers: { Authorization: `Bearer ${armToken}` } }),
  azureVms: (armToken, subscription) => j(`/api/inventory/azure/vms?subscription=${encodeURIComponent(subscription)}`, { headers: { Authorization: `Bearer ${armToken}` } }),
  azurePostgres: (armToken, subscription) => j(`/api/inventory/azure/postgres?subscription=${encodeURIComponent(subscription)}`, { headers: { Authorization: `Bearer ${armToken}` } }),
  // VM 내부 API 확인 — 구독에서 이미 아는 VM 주소로 표준 스펙 경로만 프로브.
  // port 지정 시 그 포트만 확인 — 관례 포트(8080·8000·443·3000·80)에서 못 찾았을 때 사용자가 보완
  azureVmProbe: (armToken, vmId, port) => j(`/api/inventory/azure/vm-probe`, { method: "POST", headers: { Authorization: `Bearer ${armToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ vm_id: vmId, ...(port ? { port: Number(port) } : {}) }) }),
  // ontology=true 면 온톨로지 tool(계약·매핑·실체화·검증)까지 붙은 에이전트로 실행.
  // history 는 직전 대화 — 확인 게이트("삭제할까요?" → "네")가 성립하려면 앞 턴이 필요하다.
  agentChat: (message, { ontology = false, history = [] } = {}) =>
    j("/api/agent/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, ontology, history }),
    }).then((d) => {
      // 온톨로지를 실제로 바꾼 tool 이 돌았으면 Designer/Mapping 화면이 다시 읽도록 알린다.
      if ((d.steps || []).some((s) => s.type === "tool" && ONTOLOGY_WRITE_TOOLS.has(s.tool))) {
        window.dispatchEvent(new Event(ONTOLOGY_EVENT));
      }
      return d;
    }),
  agentSimulate: (message) =>
    j("/api/agent/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
  // EmberLink Hybrid Tool Selector (임베딩 게이트 + gpt-5-mini 판별)
  agentHybrid: (message) =>
    j("/api/agent/hybrid", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
  projectRagQuery: (target, query, projectId) => j(`/api/playground/rag-query?project_id=${encodeURIComponent(projectId)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, query }),
  }),
  graphRagEvidence: (query, workspace) => {
    const body = {
      query, mode: "mix", top_k: 40, chunk_top_k: 20,
      max_entity_tokens: 6000, max_relation_tokens: 8000, max_total_tokens: 30000,
      enable_rerank: true, include_references: true, only_need_context: true,
    };
    return j(`/api/graphrag/query/data?workspace=${encodeURIComponent(workspace)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
  },
  ragLiveGraph: async (workspace) => {
    const scope = encodeURIComponent(workspace);
    const labels = await j(`/api/graphrag/graph/label/popular?workspace=${scope}&limit=1`);
    const label = Array.isArray(labels) ? labels[0] : labels?.labels?.[0];
    if (!label) return { nodes: [], edges: [], is_truncated: false };
    return j(`/api/graphrag/graphs?workspace=${scope}&label=${encodeURIComponent(label)}&max_depth=3&max_nodes=100`);
  },
  graphRagQuery: (query, workspace = "climax_ko", signal) => {
    const body = {
      query, workspace, mode: "mix", top_k: 40, chunk_top_k: 20,
      max_entity_tokens: 6000, max_relation_tokens: 8000, max_total_tokens: 30000,
      enable_rerank: true, include_references: true,
      user_prompt: RAG_ANSWER_FORMAT,
    };
    return j("/api/graphrag/query/complete", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify(body),
    });
  },
  playgroundGraphRagQuery: async ({ query, workspace, projectId, appMode, signal }) => {
    if (appMode !== "preview") {
      const result = await api.graphRagQuery(query, workspace, signal);
      return { ...result, apiCalls: 1 };
    }
    const invoked = await api.projectRagQuery("graphrag", query, projectId);
    const body = invoked.response?.body || {};
    const evidence = await api.graphRagEvidence(
      query, invoked.profile.projection === "terms" ? "climax_ko" : "climax_ko_chunk",
    );
    return {
      answer: body.response,
      evidence: evidence.data,
      references: body.references,
      documentName: invoked.document.filename,
      toolId: invoked.tool_id,
      apiCalls: 2,
    };
  },
  // 맥락 검색 — 문장형 요청을 조합·근거·누락으로 답한다
  // signal: 사용자가 중지할 수 있어야 하는 유일한 검색 경로(LLM 2콜이라 수 초 걸린다)
  ask: (query, signal) => j("/api/apis/ask", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ query, project_id: _activeProjectId }) }),
  // 프로젝트 원격 MCP 엔드포인트 토큰 — 서버가 HttpOnly 로그인 세션을 검증한다.
  listTokens: (pid) => j(`/api/projects/${pid}/tokens`),
  issueToken: (pid, name, scope) => j(`/api/projects/${pid}/tokens`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, scope }) }),
  revokeToken: (pid, tid) => j(`/api/projects/${pid}/tokens/${tid}`, {
    method: "DELETE" }),
  // Skills — MCP 파이프라인 + 프롬프트. project_id 는 withProject(목록) / body(생성) 로 부착
  listSkills: (query, tag) =>
    j(`/api/skills?${new URLSearchParams({ query: query || "", tag: tag || "" })}`),
  getSkill: (id) => j(`/api/skills/${id}`),
  createSkill: (body) => j("/api/skills", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, project_id: body.project_id ?? _activeProjectId }) }),
  updateSkill: (id, body) => j(`/api/skills/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  deleteSkill: (id) => j(`/api/skills/${id}`, { method: "DELETE" }),
  // 초안 추천 — steps 를 주면 조합은 유지하고 프롬프트만 다시 만든다
  // signal: 맥락 검색과 같은 이유로 중지 가능해야 한다(LLM 호출이라 수 초 걸린다)
  draftSkill: (context, steps, signal) => j("/api/skills/draft", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ context, steps: steps ?? null, project_id: _activeProjectId }) }),
  // 저장 전 점검 — 정적 검사 + 실제 실행 트레이스. 변경형은 기본 차단.
  /** 시험 실행을 단계별로 받아 화면이 한 칸씩 채워지게 한다(SSE). onEvent 로 흘려준다. */
  // io: {inputs, outputs} — 저장 전 선언. 배선이 이 선언을 가리키는지 서버가 함께 본다.
  dryRunSkillStream: async (steps, input = "", allowMutating = false, onEvent = () => {}, name = "", io = {}) => {
    const res = await fetch(withProject("/api/skills/dry-run/stream"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(currentRoleId() ? { "X-Emberlink-Role": currentRoleId() } : {}) },
      // project_id 는 본문에도 넣는다 — 쿼리스트링은 body 모델(DryRunReq)이 읽지 않아
      // 기본 프로젝트로 떨어지고, 남의 프로젝트 tool 목록으로 검사돼 전부 "없는 MCP" 가 된다.
      body: JSON.stringify({ project_id: _activeProjectId, steps, input, allow_mutating: allowMutating, name,
        inputs: io.inputs || [], outputs: io.outputs || [] }),
    });
    if (!res.ok || !res.body) throw new Error(`시험 실행 실패 (${res.status})`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (line) onEvent(JSON.parse(line.slice(5).trim()));
      }
    }
  },
  dryRunSkill: (steps, input = "", allowMutating = false) => j("/api/skills/dry-run", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: _activeProjectId, steps, input, allow_mutating: allowMutating }) }),
  runSkill: (id, input) => j(`/api/skills/${id}/run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: input || "" }) }),
  // manifest 일괄 변환
  manifestValidate: (manifest) => j("/api/manifest/validate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest }) }),
  manifestApply: (manifest, projectId) => j("/api/manifest/apply", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, project_id: projectId }) }),
  jobStatus: (id) => j(`/api/jobs/${id}`),
  jobStreamUrl: (id) => `/api/jobs/${id}/stream`,
  // Conversion Health (dev 전용) — 변환 검증
  projectHealth: (pid) => j(`/api/projects/${pid}/health`),
  projectJobs: (pid) => j(`/api/projects/${pid}/jobs`),
  smokeRun: (pid, source) => j(`/api/projects/${pid}/smoke`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: source || null }) }),
  reapply: (pid, source) => j(`/api/projects/${pid}/reapply`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: source || null }) }),
  // 프로젝트별 온톨로지/매핑 — withProject 로 project_id 자동 부착
  ontology: () => j("/api/ontology"),
  ontologyView: (view) => j(`/api/ontology/${view}`),
  ontologyClear: () => j("/api/ontology/clear", { method: "POST" }),
  ontologyAddRelationship: (label, domain, range, description = "") => j("/api/ontology/relationship", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, domain, range, description }) }),
  ontologyUpdateRelationship: (uri, label, domain, range, description = "") => j("/api/ontology/relationship", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri, label, domain, range, description }) }),
  ontologyAddProperty: (label, domain, range = "xsd:string", description = "") => j("/api/ontology/property", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, domain, range, description }) }),
  ontologyUpdateProperty: (uri, label, range = null, description = null) => j("/api/ontology/property", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri, label, range, description }) }),
  ontologyDeleteProperty: (uri) => j("/api/ontology/property/delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }) }),
  ontologyAddClass: (label, parent = null, description = "") => j("/api/ontology/class", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, parent, description }) }),
  ontologyMergeClasses: (uris, label) => j("/api/ontology/class/merge", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uris, label }) }),
  ontologyReviewRelationships: () => j("/api/ontology/relationship/review", { method: "POST" }).then(notifyJob),
  reviewStatus: () => j("/api/ontology/relationship/review/status"),
  reviewCancel: () => j("/api/ontology/relationship/review/cancel", { method: "POST" }),
  ontologyInstantiate: () => j("/api/ontology/instantiate", { method: "POST" }).then(notifyJob),
  instantiateStatus: () => j("/api/ontology/instantiate/status"),
  instantiateCancel: () => j("/api/ontology/instantiate/cancel", { method: "POST" }),
  ontologyInstancesClear: () => j("/api/ontology/instances/clear", { method: "POST" }),
  // 엔티티 해소 — 문서 인스턴스(inst:) ↔ DB 행(dat:) owl:sameAs
  resolveRun: () => j("/api/ontology/resolve", { method: "POST" }),
  resolveList: () => j("/api/ontology/resolve"),
  resolveDecide: (inst, dat, decision) => j("/api/ontology/resolve/decide", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inst, dat, decision }) }),
  ontologyExportTtlUrl: () => withProject("/api/ontology/export.ttl"),   // T-Box+A-Box Turtle 다운로드
  // 프로젝트 이전 — TTL 과 달리 매핑·인스턴스·CQ·규칙까지 통째로 오간다(로컬 → ACA)
  ontologyExportProjectUrl: () => withProject("/api/ontology/export-project?download=1"),
  ontologyImportProject: (file, overwrite = false) => {
    const fd = new FormData();
    fd.append("file", file);
    return j(`/api/ontology/import-project/file?overwrite=${overwrite ? "true" : "false"}`,
      { method: "POST", body: fd }).then((r) => {
        if (!r.error) window.dispatchEvent(new Event(ONTOLOGY_EVENT));   // 화면 즉시 갱신
        return r;
      });
  },
  ontologyStorage: () => j("/api/ontology/storage"),   // 영속 백엔드 진단(sqlite/PG)
  ontologyExportR2rmlUrl: () => withProject("/api/ontology/export.r2rml"),   // 표준 R2RML 매핑 다운로드
  setRowMaterialize: (enabled) => j("/api/ontology/materialize-rows", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }) }),
  setRowAccess: (mode) => j("/api/ontology/row-access", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }) }),
  ontologyQuery: (question, mode = "auto") => j("/api/ontology/query", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode }) }),
  ontologyQueryStatus: () => j("/api/ontology/query/status"),
  ontologyTraverse: (question, engine = "classic") => j("/api/ontology/traverse", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, mode: "graph", engine }) }),
  ontologyTraverseStatus: () => j("/api/ontology/traverse/status"),
  ontologyTraverseCancel: () => j("/api/ontology/traverse/cancel", { method: "POST" }),
  ontologyDeleteRelationship: (uri) => j("/api/ontology/relationship/delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }) }),
  ontologyUpdateEntity: (uri, label, group, parent) => j("/api/ontology/entity", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri, label, group, parent }) }),
  ontologyDeleteEntity: (uri) => j("/api/ontology/entity/delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri }) }),
  guidelines: () => j("/api/ontology/guidelines"),
  saveGuidelines: (text) => j("/api/ontology/guidelines", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }) }),
  ontologyGroups: () => j("/api/ontology/groups"),
  ontologyCreateGroup: (label, color) => j("/api/ontology/group", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, color }) }),
  ontologyUpdateGroup: (id, label, color) => j("/api/ontology/group", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, label, color }) }),
  ontologyDeleteGroup: (id) => j("/api/ontology/group/delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }) }),
  ontologyAssignGroup: (classUri, groupId) => j("/api/ontology/group/assign", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ class_uri: classUri, group_id: groupId }) }),
  ontologyImport: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return j("/api/ontology/import", { method: "POST", body: fd });
  },
  cqList: () => j("/api/ontology/cq"),
  cqAdd: (question) => j("/api/ontology/cq", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }),
  cqUpdate: (id, question) => j(`/api/ontology/cq/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) }),
  cqDelete: (id) => j(`/api/ontology/cq/${id}`, { method: "DELETE" }),
  cqImport: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return j("/api/ontology/cq/import", { method: "POST", body: fd });
  },
  genSources: () => j("/api/ontology/generate/sources"),
  genDocuments: () => j("/api/ontology/generate/documents"),
  ontologyGenerate: (tables, docs) => j("/api/ontology/generate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tables, docs }) }).then(notifyJob),
  genStatus: () => j("/api/ontology/generate/status"),
  genCancel: () => j("/api/ontology/generate/cancel", { method: "POST" }),
  genRetryFailed: () => j("/api/ontology/generate/retry-failed", { method: "POST" }).then(notifyJob),
  genState: () => j("/api/ontology/generate/state"),
  ontologyGenerateClear: () => j("/api/ontology/generate/clear", { method: "POST" }),
  ontologyDecideBulk: (ids, decision) => j("/api/ontology/generate/decide-bulk", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, decision }) }),
  ontologyGenerateDecide: (id, decision) => j("/api/ontology/generate/decide", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, decision }) }),
  mapping: () => j("/api/mapping"),
  mappingView: (view) => j(`/api/mapping/${view}`),
  mappingAutoRun: () => j("/api/mapping/auto-run", { method: "POST" }).then(notifyJob),
  automapStatus: () => j("/api/mapping/auto-run/status"),
  automapCancel: () => j("/api/mapping/auto-run/cancel", { method: "POST" }),
  mappingDecide: (source, decision) => j("/api/mapping/decide", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, decision }) }),
  mappingSchema: () => j("/api/mapping/schema"),
  shaclRun: () => j("/api/mapping/shacl/run", { method: "POST" }),
  // 오답 케이스(진단·조치 폐루프)
  failuresList: () => j("/api/ontology/failures"),
  failuresAnalyze: () => j("/api/ontology/failures/analyze", { method: "POST" }),
  failureAct: (fid) => j(`/api/ontology/failures/${fid}/act`, { method: "POST" }),
  failureSetStatus: (fid, status) => j(`/api/ontology/failures/${fid}/status`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
  failureDelete: (fid) => j(`/api/ontology/failures/${fid}`, { method: "DELETE" }),
  mappingAddLink: (kind, target, source, confidence) => j("/api/mapping/link", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, target, source, confidence }) }),
  mappingDeleteLink: (kind, target, source) => j("/api/mapping/link/delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, target, source }) }),
  // DATA RESOURCE — 변환 前 레거시 원천. project_id 는 withProject 가 붙인다.
  dbSources: () => j("/api/db-sources"),
  createDbSource: (body) => j("/api/db-sources", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  checkDbSource: (body) => j("/api/db-sources/check", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  deleteDbSource: (sid) => j(`/api/db-sources/${sid}`, { method: "DELETE" }),
  dbSchema: (sid, expand = []) => j(`/api/db-sources/${sid}/schema${expand.length ? `?expand=${encodeURIComponent(expand.join(","))}` : ""}`),
  dbDesign: (sid, body) => j(`/api/db-sources/${sid}/design`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  dbDryRun: (sid, body) => j(`/api/db-sources/${sid}/dry-run`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  dbCreateTools: (sid, drafts) => j(`/api/db-sources/${sid}/tools`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drafts }) }),
  dbAutoTools: (sid, tables = []) => j(`/api/db-sources/${sid}/auto-tools${tables.length ? `?tables=${encodeURIComponent(tables.join(","))}` : ""}`, { method: "POST" }),
  apiSources: () => j("/api/api-sources"),
  createApiSource: (body) => j("/api/api-sources", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  checkApiSource: (body) => j("/api/api-sources/check", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  resolveApiSpec: (host, auth) => j("/api/api-sources/resolve-spec", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, auth }) }),
  deleteApiSource: (sid) => j(`/api/api-sources/${sid}`, { method: "DELETE" }),
  apiEndpoints: (sid) => j(`/api/api-sources/${sid}/endpoints`),
  projects: () => j("/api/projects"),
  createProject: (payload) => j("/api/projects", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) }),
  uploadRagDocument: (projectId, file, options) => {
    const form = new FormData();
    form.append("file", file);
    const workspace = typeof options === "string" ? options : options?.workspace;
    const query = new URLSearchParams();
    if (workspace) query.set("workspace", workspace);
    if (options?.target) query.set("target", options.target);
    const suffix = query.size ? `?${query}` : "";
    return j(`/api/projects/${projectId}/rag-pipeline-uploads${suffix}`, { method: "POST", body: form });
  },
  createRagPipelineExecution: (projectId, payload) => j(`/api/projects/${projectId}/rag-pipeline-executions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) }),
  ragPipelineExecutions: (projectId, filters = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.phase) query.set("phase", filters.phase);
    if (filters.filename) query.set("filename", filters.filename);
    if (filters.cursor) query.set("cursor", filters.cursor);
    query.set("limit", String(filters.limit || 20));
    return je(`/api/projects/${projectId}/rag-pipeline-executions?${query}`);
  },
  recentRagPipelineExecutions: (limit = 4) =>
    je(`/api/rag-pipeline-executions?project_id=&limit=${limit}`),
  ragPipelineResultDocuments: (filters = {}) => {
    const query = new URLSearchParams();
    // An explicit empty value prevents withProject() from silently narrowing
    // the completed-result picker to the currently selected project.
    query.set("project_id", filters.projectId || "");
    if (filters.filename) query.set("filename", filters.filename);
    if (filters.cursor) query.set("cursor", filters.cursor);
    query.set("limit", String(filters.limit || 50));
    return je(`/api/rag-pipeline-result-documents?${query}`);
  },
  ragPipelineExecution: (executionId) => je(`/api/rag-pipeline-executions/${executionId}`),
  ragPipelineDocuments: (executionId, filters = {}) => {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.phase) query.set("phase", filters.phase);
    if (filters.filename) query.set("filename", filters.filename);
    if (filters.cursor) query.set("cursor", filters.cursor);
    query.set("limit", String(filters.limit || 50));
    return je(`/api/rag-pipeline-executions/${executionId}/documents?${query}`);
  },
  ragPipelineDocument: (executionId, documentExecutionId) =>
    je(`/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}`),
  ragVisualization: (executionId, documentExecutionId, referenceId, suffix = "", filters = {}) => {
    const query = new URLSearchParams();
    if (filters.cursor) query.set("cursor", filters.cursor);
    if (filters.limit) query.set("limit", String(filters.limit));
    const tail = query.size ? `?${query}` : "";
    const url = `/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}/runs/${referenceId}/visualization${suffix}${tail}`;
    return suffix === "/graph"
      ? cachedGraph(`${executionId}/${documentExecutionId}/${referenceId}`, url)
      : je(url);
  },
  ragTermDetail: (executionId, documentExecutionId, referenceId, ordinal) => je(
    `/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}`
    + `/runs/${referenceId}/visualization/terms/${encodeURIComponent(ordinal)}`,
  ),
  ragCandidatePageChunks: (
    executionId, documentExecutionId, referenceId, candidate, pageNumber,
  ) => je(
    `/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}`
    + `/runs/${referenceId}/visualization/candidates/${encodeURIComponent(candidate)}`
    + `/pages/${encodeURIComponent(pageNumber)}/chunks`,
  ),
  ragArtifactAccess: (executionId, documentExecutionId, referenceId, artifactRef) =>
    j(`/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}/runs/${referenceId}/artifacts/${encodeURIComponent(artifactRef)}/access`, { method: "POST" }),
  ragArtifactContentUrl: (
    executionId, documentExecutionId, referenceId, artifactRef, projectId = null,
  ) => {
    const url = `/api/rag-pipeline-executions/${executionId}/documents/${documentExecutionId}`
      + `/runs/${referenceId}/artifacts/${encodeURIComponent(artifactRef)}/content`;
    return projectId
      ? `${url}?project_id=${encodeURIComponent(projectId)}`
      : withProject(url);
  },
  updateProject: (pid, patch) => j(`/api/projects/${pid}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch) }),
  deleteProject: (pid) => j(`/api/projects/${pid}`, { method: "DELETE" }),
  projectResources: (pid) => j(`/api/projects/${pid}/resources`),
  attachResource: (pid, rid, role = "shared") => j(`/api/projects/${pid}/resources`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource_id: rid, role }) }),
  detachResource: (pid, rid) => j(`/api/projects/${pid}/resources/${rid}`, { method: "DELETE" }),
  allResources: () => j("/api/resources"),
  // MCP Asset Registry — 공유 원본(asset)과 프로젝트별 binding을 분리한다.
  projectResourceRegistry: (pid, { view = "attached", query = "" } = {}, opts = {}) => {
    const p = new URLSearchParams({ view });
    if (query.trim()) p.set("query", query.trim());
    return j(`/api/projects/${pid}/resource-registry?${p.toString()}`, { signal: opts.signal });
  },
  mcpRegistryAsset: (assetId, pid, opts = {}) =>
    j(`/api/mcp-registry/${encodeURIComponent(assetId)}?project_id=${encodeURIComponent(pid)}`, { signal: opts.signal }),
  setMcpVisibility: (assetId, visibility) => j(`/api/mcp-registry/${encodeURIComponent(assetId)}/visibility`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility }),
  }),
  deleteMcpAsset: (assetId) => j(`/api/mcp-registry/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
  }),
  attachMcpBinding: (pid, assetId) => j(`/api/projects/${pid}/mcp-bindings`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset_id: assetId }),
  }),
  updateMcpBinding: (pid, bindingId, patch) => j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }),
  detachMcpBinding: (pid, bindingId) =>
    j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}`, { method: "DELETE" }),
  mcpBindingImpact: (pid, bindingId, candidateVersionId, opts = {}) => {
    const p = new URLSearchParams();
    if (candidateVersionId) p.set("candidate_version_id", candidateVersionId);
    const q = p.toString();
    return j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}/impact${q ? `?${q}` : ""}`, { signal: opts.signal });
  },
  validateMcpBinding: (pid, bindingId) =>
    j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}/validate`, { method: "POST" }),
  publishMcpBinding: (pid, bindingId) =>
    j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}/releases`, { method: "POST" }),
  mcpBindingReleases: (pid, bindingId, opts = {}) =>
    j(`/api/projects/${pid}/mcp-bindings/${encodeURIComponent(bindingId)}/releases`, { signal: opts.signal }),
  verify: (body) => j("/api/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  verifyBySourceId: (sourceId, baseUrl, auth) => j("/api/verify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: sourceId, base_url: baseUrl || "", auth: auth || null }) }),
  verifyDecision: (body) => j("/api/verify/decision", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body) }),
  // 접근권한(RBAC) — 설정 > 접근 권한 탭
  roles: () => j("/api/roles"),
  createRole: (payload) => j("/api/roles", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload) }),
  deleteRole: (rid) => j(`/api/roles/${rid}`, { method: "DELETE" }),
  rolePermissions: (rid) => j(`/api/roles/${rid}/permissions`),
  saveRolePermissions: (rid, perms) => j(`/api/roles/${rid}/permissions`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(perms) }),
  menus: () => j("/api/menus"),
  dataSources: () => j("/api/data-sources"),

  // ── SSO 로그인 + 접근 허가(화이트리스트) ──
  // 데모: {email} 전송. 운영(MSAL): {id_token} 전송 → 백엔드가 검증.
  login: (payload) => {
    _etagCache.clear();
    _graphCache.clear();
    _graphRequests.clear();
    return j("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  authConfig: () => j("/api/auth/config").then(requireAuthMode),
  logout: () => j("/api/auth/logout", { method: "POST" })
    .finally(() => { _etagCache.clear(); _graphCache.clear(); _graphRequests.clear(); }),
  // Member 관리(admin 전용) — 서버가 HttpOnly 로그인 세션을 검증한다.
  members: () => j("/api/members"),
  addMember: (email, role = "member") => j("/api/members", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }) }),
  setMemberRole: (email, role) => j(`/api/members/${encodeURIComponent(email)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }) }),
  deleteMember: (email) => j(`/api/members/${encodeURIComponent(email)}`, {
    method: "DELETE" }),
  // 온프렘 탐색 대상 기본값 — 호스트는 서버(APIMCP_DISCOVERY_BASE)가 정한다.
  discoverDefaults: () => j("/api/discover/defaults"),
};
