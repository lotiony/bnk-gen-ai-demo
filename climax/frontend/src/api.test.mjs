import assert from "node:assert/strict";
import test from "node:test";

globalThis.localStorage = { getItem: () => null };
globalThis.window = new EventTarget();

const {
  api, ApiError, requireAuthMode, setActiveProjectId, PROJECT_MISSING_EVENT,
} = await import("./api.js");

test("Docker의 Azure client 설정과 무관하게 서버 demo auth mode를 따른다", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ mode: "demo" }),
      headers: { get: () => null },
    };
  };

  try {
    assert.equal(await api.authConfig(), "demo");
    assert.equal(requestedUrl, "/api/auth/config");
    assert.throws(() => requireAuthMode({ mode: "unknown" }), /인증 모드/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API 오류에 HTTP status와 응답 본문을 보존한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ detail: "job not found" }),
  });

  try {
    await assert.rejects(api.jobStatus("missing-job"), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 404);
      assert.equal(error.message, "job not found");
      assert.deepEqual(error.body, { detail: "job not found" });
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("organization MCP Asset deletion uses the admin session endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options = {}) => {
    request = { url: String(url), options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, asset_id: "mcp-asset/1" }),
      headers: { get: () => null },
    };
  };

  try {
    await api.deleteMcpAsset("mcp-asset/1");
    assert.equal(request.url, "/api/mcp-registry/mcp-asset%2F1");
    assert.equal(request.options.method, "DELETE");
    assert.equal(request.options.headers?.["X-Emberlink-Email"], undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("completed result picker stays global across the active project", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  setActiveProjectId("proj-current");
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [], next_cursor: null }),
      headers: { get: () => null },
    };
  };

  try {
    await api.ragPipelineResultDocuments({ limit: 100 });
    assert.equal(
      requestedUrl,
      "/api/rag-pipeline-result-documents?project_id=&limit=100",
    );
  } finally {
    setActiveProjectId(null);
    globalThis.fetch = originalFetch;
  }
});

test("completed result home can scope results to the selected project", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  setActiveProjectId("proj-other");
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [], next_cursor: null }),
      headers: { get: () => null },
    };
  };

  try {
    await api.ragPipelineResultDocuments({ projectId: "proj-current", limit: 12 });
    assert.equal(
      requestedUrl,
      "/api/rag-pipeline-result-documents?project_id=proj-current&limit=12",
    );
  } finally {
    setActiveProjectId(null);
    globalThis.fetch = originalFetch;
  }
});

test("PDF artifact URL stays on the BFF and includes the result project", () => {
  const url = api.ragArtifactContentUrl(
    "exec-1", "doc-1", "run-1", "normalized/pdf", "proj-current",
  );
  assert.equal(
    url,
    "/api/rag-pipeline-executions/exec-1/documents/doc-1/runs/run-1"
    + "/artifacts/normalized%2Fpdf/content?project_id=proj-current",
  );
  assert.equal(url.includes("blob.core.windows.net"), false);
});

test("candidate page chunks use the dedicated encoded page route", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ items: [], page: { returned: 0, total: 0 } }),
      headers: { get: () => null },
    };
  };

  try {
    await api.ragCandidatePageChunks("exec-1", "doc-1", "run-1", "A/B chunker", 7);
    assert.equal(
      requestedUrl,
      "/api/rag-pipeline-executions/exec-1/documents/doc-1/runs/run-1"
      + "/visualization/candidates/A%2FB%20chunker/pages/7/chunks",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("complete graph request is deduplicated and cached by run", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => ({ entities: [{ id: "1" }], relations: [] }),
      headers: { get: (name) => name === "ETag" ? '"graph"' : null },
    };
  };

  try {
    const args = ["graph-exec", "graph-doc", "graph-run", "/graph"];
    const [first, concurrent] = await Promise.all([
      api.ragVisualization(...args),
      api.ragVisualization(...args),
    ]);
    const cached = await api.ragVisualization(...args);
    assert.deepEqual(first, concurrent);
    assert.equal(cached, first);
    assert.deepEqual(requestedUrls, [
      "/api/rag-pipeline-executions/graph-exec/documents/graph-doc/runs/graph-run"
      + "/visualization/graph",
    ]);

    await api.ragVisualization("graph-exec", "graph-doc", "other-run", "/graph");
    assert.equal(requestedUrls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("evicted graph sends its cached ETag on revalidation", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    if (options.headers?.["If-None-Match"]) {
      return { ok: false, status: 304, json: async () => ({}), headers: { get: () => null } };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ entities: [{ id: String(url) }], relations: [] }),
      headers: { get: (name) => name === "ETag" ? '"graph-etag"' : null },
    };
  };

  try {
    const target = ["etag-exec", "etag-doc", "etag-run", "/graph"];
    const first = await api.ragVisualization(...target);
    for (let index = 0; index < 4; index += 1) {
      await api.ragVisualization("etag-exec", "etag-doc", `filler-${index}`, "/graph");
    }
    assert.equal(await api.ragVisualization(...target), first);
    const targetRequests = requests.filter(({ url }) => url.includes("/runs/etag-run/"));
    assert.equal(targetRequests.length, 2);
    assert.equal(targetRequests[1].headers["If-None-Match"], '"graph-etag"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed complete graph response is not cached", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? {
        ok: false,
        status: 503,
        json: async () => ({ detail: "not ready" }),
        headers: { get: () => null },
      }
      : {
        ok: true,
        status: 200,
        json: async () => ({ entities: [], relations: [] }),
        headers: { get: () => null },
      };
  };

  try {
    const args = ["failed-exec", "failed-doc", "failed-run", "/graph"];
    await assert.rejects(api.ragVisualization(...args));
    assert.deepEqual(await api.ragVisualization(...args), { entities: [], relations: [] });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resource registry request carries view and encoded search", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ view: "pool", assets: [], metrics: {} }),
      headers: { get: () => null },
    };
  };

  try {
    await api.projectResourceRegistry("proj-sales", { view: "pool", query: "Product MCP" });
    assert.equal(
      requestedUrl,
      "/api/projects/proj-sales/resource-registry?view=pool&query=Product+MCP",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("binding mutations use the server session and do not send localStorage identity", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  let request = null;
  globalThis.localStorage = {
    getItem: (key) => (key === "ember_email" ? "editor@example.com" : null),
  };
  globalThis.fetch = async (url, opts) => {
    request = { url: String(url), opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      headers: { get: () => null },
    };
  };

  try {
    await api.attachMcpBinding("proj-sales", "mcp-product");
    assert.equal(request.url, "/api/projects/proj-sales/mcp-bindings");
    assert.equal(request.opts.method, "POST");
    assert.equal(request.opts.headers["X-Emberlink-Email"], undefined);
    assert.deepEqual(JSON.parse(request.opts.body), { asset_id: "mcp-product" });
  } finally {
    globalThis.localStorage = originalStorage;
    globalThis.fetch = originalFetch;
  }
});

test("binding update uses the binding id and preserves draft fields", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, opts) => {
    request = { url: String(url), opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      headers: { get: () => null },
    };
  };

  try {
    const patch = {
      pinned_version_id: "ver-4",
      environment: "stage",
      credential_ref: "vault://sales/product-ro",
      enabled: true,
    };
    await api.updateMcpBinding("proj-sales", "binding/product", patch);
    assert.equal(request.url, "/api/projects/proj-sales/mcp-bindings/binding%2Fproduct");
    assert.deepEqual(JSON.parse(request.opts.body), patch);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Explorer enabled mutation returns the authoritative server state", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  let request = null;
  globalThis.localStorage = {
    getItem: (key) => (key === "ember_email" ? "editor@example.com" : null),
  };
  globalThis.fetch = async (url, opts) => {
    request = { url: String(url), opts };
    return {
      ok: true,
      status: 200,
      json: async () => ({ tool_id: "getProduct", enabled: false }),
      headers: { get: () => null },
    };
  };

  try {
    const result = await api.setMcpEnabled("getProduct", true);
    assert.equal(request.url, "/api/apis/getProduct/enabled");
    assert.equal(request.opts.headers["X-Emberlink-Email"], undefined);
    assert.deepEqual(JSON.parse(request.opts.body), { enabled: true });
    assert.equal(result.enabled, false, "UI must reconcile to the server response");
  } finally {
    globalThis.localStorage = originalStorage;
    globalThis.fetch = originalFetch;
  }
});

test("binding conflict preserves structured impact for the safety dialog", async () => {
  const originalFetch = globalThis.fetch;
  const impact = { projects: [{ id: "proj-other", name: "Other" }], skills: [{ id: "skill-1", name: "만기 안내" }] };
  globalThis.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({ detail: { code: "binding_has_dependencies", message: "dependencies remain", impact } }),
  });

  try {
    await assert.rejects(api.detachMcpBinding("proj-sales", "binding-1"), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "dependencies remain");
      assert.deepEqual(error.body.detail.impact, impact);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validation failure preserves 422 blockers", async () => {
  const originalFetch = globalThis.fetch;
  const blockers = [{ code: "credential_missing", message: "credential reference is required" }];
  globalThis.fetch = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ detail: { code: "validation_blocked", message: "draft is blocked", blockers } }),
  });

  try {
    await assert.rejects(api.validateMcpBinding("proj-sales", "binding-1"), (error) => {
      assert.equal(error.status, 422);
      assert.equal(error.message, "draft is blocked");
      assert.deepEqual(error.body.detail.blockers, blockers);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("활성 프로젝트가 사라지면 project-missing 이벤트를 발행한다 (#274)", async () => {
  const originalFetch = globalThis.fetch;
  const events = [];
  const listener = (event) => events.push(event.detail?.projectId);
  window.addEventListener(PROJECT_MISSING_EVENT, listener);
  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ detail: "project not found" }),
  });

  try {
    setActiveProjectId("proj-gone");
    await assert.rejects(api.stats());
    assert.deepEqual(events, ["proj-gone"]);

    events.length = 0;
    await assert.rejects(api.describe("some-tool", "proj-other"));
    assert.deepEqual(events, [], "명시 pid 404 로 활성 프로젝트를 갈아치우면 안 된다");

    setActiveProjectId(null);
    await assert.rejects(api.stats());
    assert.deepEqual(events, []);
  } finally {
    window.removeEventListener(PROJECT_MISSING_EVENT, listener);
    setActiveProjectId(null);
    globalThis.fetch = originalFetch;
  }
});

test("local completed graph uses the selected LightRAG workspace", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    return {
      ok: true,
      status: 200,
      json: async () => requestedUrls.length === 1
        ? ["Insurance Company"]
        : { nodes: [{ id: "1" }], edges: [] },
      headers: { get: () => null },
    };
  };

  try {
    const graph = await api.ragLiveGraph("proj_local");
    assert.equal(graph.nodes[0].id, "1");
    assert.deepEqual(requestedUrls, [
      "/api/graphrag/graph/label/popular?workspace=proj_local&limit=1",
      "/api/graphrag/graphs?workspace=proj_local&label=Insurance%20Company&max_depth=3&max_nodes=100",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local/dev Playground GraphRAG returns answer and evidence from one complete request", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const controller = new AbortController();
  const response = {
    answer: "## 보험금 지급방법\n계좌로 지급합니다. [1]",
    evidence: {
      references: [{ reference_id: 1, file_path: "약관.pdf" }],
      entities: [{ entity_name: "보험금" }],
      relationships: [{ src_id: "보험금", tgt_id: "계좌" }],
      chunks: [{ chunk_id: "chunk-1" }],
    },
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return { ok: true, status: 200, json: async () => response, headers: { get: () => null } };
  };

  try {
    assert.deepEqual(await api.playgroundGraphRagQuery({
      query: "보험금 지급방법", workspace: "climax_ko", projectId: "project-1",
      appMode: "dev", signal: controller.signal,
    }), { ...response, apiCalls: 1 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/graphrag/query/complete");
    assert.equal(requests[0].options.signal, controller.signal);
    assert.deepEqual(JSON.parse(requests[0].options.body), {
      query: "보험금 지급방법",
      workspace: "climax_ko",
      mode: "mix",
      top_k: 40,
      chunk_top_k: 20,
      max_entity_tokens: 6000,
      max_relation_tokens: 8000,
      max_total_tokens: 30000,
      enable_rerank: true,
      include_references: true,
      user_prompt: "답변은 Markdown으로 작성하세요. 첫 줄은 질문에 맞는 구체적인 '## 제목', 다음은 1~2문장의 결론, 이어서 '### 핵심 내용' 아래 bullet 목록을 작성하세요. 추가 설명이 필요할 때만 '### 상세 설명'을 사용하세요. 근거가 있는 각 문장 끝에 [n] 인용을 붙이고 별도 References 목록은 작성하지 마세요.",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("aborting GraphRAG query aborts its only complete request", async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (_url, options = {}) => {
    calls += 1;
    return new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"));
    }, { once: true }));
  };

  try {
    const pending = api.playgroundGraphRagQuery({
      query: "보험금", workspace: "climax_ko", projectId: "project-1",
      appMode: "local", signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preview Playground GraphRAG keeps the project MCP and evidence flow", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const evidence = {
    references: [{ reference_id: 1, file_path: "약관.pdf" }],
    entities: [{ entity_name: "보험금" }], relationships: [], chunks: [],
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    const data = String(url).startsWith("/api/playground/rag-query")
      ? {
        response: { body: { response: "preview answer", references: evidence.references } },
        profile: { projection: "terms" }, document: { filename: "약관.pdf" }, tool_id: "preview-tool",
      }
      : { data: evidence };
    return { ok: true, status: 200, json: async () => data, headers: { get: () => null } };
  };

  try {
    assert.deepEqual(await api.playgroundGraphRagQuery({
      query: "보험금", workspace: "ignored", projectId: "project-1", appMode: "preview",
    }), {
      answer: "preview answer", evidence, references: evidence.references,
      documentName: "약관.pdf", toolId: "preview-tool", apiCalls: 2,
    });
    assert.deepEqual(requests.map(({ url }) => url), [
      "/api/playground/rag-query?project_id=project-1",
      "/api/graphrag/query/data?workspace=climax_ko",
    ]);
    assert.deepEqual(JSON.parse(requests[0].options.body), { target: "graphrag", query: "보험금" });
    assert.equal(JSON.parse(requests[1].options.body).only_need_context, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI Search query keeps the existing playground route", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options = {}) => {
    request = { url: String(url), options };
    return { ok: true, status: 200, json: async () => ({ answer: "ok" }), headers: { get: () => null } };
  };

  try {
    await api.projectRagQuery("ai_search", "보험금", "project-1");
    assert.equal(request.url, "/api/playground/rag-query?project_id=project-1");
    assert.deepEqual(JSON.parse(request.options.body), { target: "ai_search", query: "보험금" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
