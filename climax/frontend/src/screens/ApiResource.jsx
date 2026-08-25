/**
 * DATA RESOURCE › API — 연결된 레거시 API 서버와 거기서 변환된 endpoint 를 관리한다.
 *
 * DB 화면과 같은 셸(ResourceWorkbench)을 쓰고 재료만 다르다: 스키마 대신 endpoint 목록.
 * 스펙 URL 을 등록하면 1:1 변환이 함께 돌고, 개별 endpoint 는 MCP 노출을 껐다 켤 수 있다.
 *
 * 의도 기반 설계(여러 endpoint 를 엮은 합성 tool·응답 필드 축소)는 아직 없다 — IR 이
 * 단일 호출(kind: http|db)만 표현하므로 다중 홉 실행 경로가 먼저 생겨야 한다.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { methodStyle } from "../i18n";
import { toManifestAuth } from "../lib/manifestRows";
import AuthPicker from "../components/AuthPicker";
import { useProjects } from "../ProjectContext";
import ResourceWorkbench, { Btn, StepHead, inp, lab, panel, useAsync } from "../components/ResourceWorkbench";

const ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5v3A2.5 2.5 0 0 1 2.5 12 2.5 2.5 0 0 1 5 14.5v3A2.5 2.5 0 0 0 7.5 20H9" />
    <path d="M15 4h1.5A2.5 2.5 0 0 1 19 6.5v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H15" />
  </svg>
);

export default function ApiResource({ lang }) {
  const ko = lang !== "en";
  const { activeId } = useProjects();
  const list = useAsync(() => api.apiSources(), [activeId]);
  const sources = list.data?.sources || [];

  const [sid, setSid] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (!sid && sources.length) setSid(sources[0].id); }, [sources, sid]);

  const eps = useAsync(() => (sid ? api.apiEndpoints(sid) : Promise.resolve(null)), [sid]);
  const all = eps.data?.endpoints || [];
  // 자연어로 적어도 걸리도록 경로·요약·operationId 를 한 덩어리로 보고 부분일치시킨다.
  const shown = q.trim()
    ? all.filter((e) => `${e.operation_id} ${e.method} ${e.path} ${e.summary}`.toLowerCase().includes(q.trim().toLowerCase()))
    : all;

  const toggleEnabled = async (e, next) => {
    setErr("");
    try { await api.setMcpEnabled(e.operation_id, next); eps.reload(); }
    catch (x) { setErr(String(x.message || x)); }
  };

  return (
    <ResourceWorkbench
      ko={ko} icon={ICON}
      title="API"
      subtitle={ko ? "연결된 레거시 API 서버와 변환된 endpoint 를 관리합니다."
                   : "Manage connected legacy API servers and their converted endpoints."}
      count={ko ? `연결된 서버 ${sources.length}` : `${sources.length} servers`}
      sources={sources} loading={list.loading} error={list.error}
      selectedId={sid} onSelect={(id) => { setSid(id); setQ(""); setErr(""); }}
      onDelete={async (s) => {
        if (!window.confirm(ko ? `${s.name} 연결을 목록에서 제거할까요? (이미 변환된 MCP 는 남습니다)` : `Remove ${s.name}?`)) return;
        await api.deleteApiSource(s.id);
        if (s.id === sid) setSid(null);
        list.reload();
      }}
      meta={(s) => s.config?.url || s.config?.base_url || ""}
      addLabel={ko ? "API 연결 추가" : "Add API server"}
      addForm={(close) => <AddApiForm ko={ko} onDone={() => { close(); list.reload(); }} onCancel={close} />}
      emptyTitle={ko ? "연결된 레거시 API 서버가 없습니다" : "No API server connected"}
      emptyHint={ko ? "온보딩에서 등록한 API 서버가 여기 나타납니다. 스펙 URL 을 알고 있다면 왼쪽의 [API 연결 추가] 로 바로 붙일 수 있습니다."
                    : "API servers registered during onboarding appear here."}
    >
      <div style={panel}>
        <StepHead n="1" title={ko ? "변환된 endpoint" : "Converted endpoints"}
          hint={ko ? "체크를 끄면 MCP 목록에서 감춰집니다(삭제 아님)" : "Uncheck to hide from MCP"}
          right={<span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
            {eps.loading ? (ko ? "읽는 중…" : "loading…") : `${shown.length}/${all.length}`}
          </span>} />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={ko ? "예: 상품 검색 · /product · POST" : "filter endpoints…"}
          style={{ ...inp, fontFamily: "var(--sans)", fontSize: 12.5, marginBottom: 10 }} />
        {eps.error && <div style={{ fontSize: 12, color: "var(--red)" }}>{eps.error}</div>}
        {err && <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>⚠ {err}</div>}
        {!eps.loading && all.length === 0 && (
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.7 }}>
            {ko ? "아직 변환된 endpoint 가 없습니다. 스펙 URL 로 다시 등록하면 1:1 변환이 함께 돕니다."
                : "No converted endpoints yet."}
          </div>
        )}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {shown.map((e) => (
            <div key={e.operation_id}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 4px", borderBottom: "1px solid var(--line)" }}>
              <input type="checkbox" checked={e.enabled !== false} onChange={(ev) => toggleEnabled(e, ev.target.checked)} />
              <span style={methodStyle(e.method)}>{e.method}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mono" style={{ fontSize: 11.5, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.path}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.summary || e.operation_id}
                </div>
              </div>
              {!e.safe && (
                <span title={ko ? "부수효과가 있는 메서드 — 호출 가드레일에서 기본 차단됩니다" : "Mutating — blocked by default"}
                  style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, color: "var(--amber)", background: "var(--amber-bg)" }}>
                  {ko ? "쓰기" : "MUTATING"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panel, background: "var(--main)" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
          {ko ? "여러 endpoint 를 엮은 합성 tool(검색→상세 연속 호출, 응답 필드 축소)은 준비 중입니다 — 지금 IR 은 호출 1회만 표현합니다."
              : "Composite tools (multi-hop calls, response projection) are not available yet."}
        </div>
      </div>
    </ResourceWorkbench>
  );
}

/**
 * 개별 API 서버 추가 — 탐색 없음. 스펙 URL 을 알면 그대로 넣고, 호스트만 알면 그 호스트
 * 한 곳의 표준 스펙 경로만 순서대로 확인한다(대역 스캔이 아니다).
 * 인증은 온보딩과 같은 AuthPicker 를 쓴다 — 폐쇄망 레거시는 스펙 자체가 보호돼 있어
 * 인증 없이는 등록 첫 단계에서 401 로 죽는다.
 */
function AddApiForm({ ko, onDone, onCancel }) {
  const [f, setF] = useState({ name: "", mode: "url", url: "", host: "" });
  const [auth, setAuth] = useState({ type: "none" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [checked, setChecked] = useState(null);    // {url, endpoints, title}

  const set = (patch) => { setF((v) => ({ ...v, ...patch })); setChecked(null); setErr(""); };
  const mAuth = toManifestAuth(auth);
  const ready = f.mode === "url" ? !!f.url.trim() : !!f.host.trim();
  // 호스트 모드는 확인 단계에서 찾아낸 URL 을 쓴다 — 못 찾았으면 등록할 대상이 없다.
  const specUrl = f.mode === "url" ? f.url.trim() : (checked?.url || "");

  const run = async (fn) => { setBusy(true); setErr(""); try { await fn(); } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); } };
  const check = () => run(async () => {
    setChecked(f.mode === "url"
      ? { url: f.url.trim(), ...(await api.checkApiSource({ name: f.name || "x", url: f.url.trim(), auth: mAuth })) }
      : await api.resolveApiSpec(f.host.trim(), mAuth));
  });
  const submit = () => run(async () => {
    await api.createApiSource({ name: f.name.trim(), url: specUrl, auth: mAuth, convert: true });
    onDone();
  });

  return (
    <div>
      <label className="mono" style={lab}>{ko ? "이름 (tool 태그)" : "name"}</label>
      <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="extg" style={inp} />

      <div style={{ display: "flex", gap: 4, marginTop: 10, marginBottom: 8 }}>
        {[["url", ko ? "스펙 URL" : "Spec URL"], ["host", ko ? "호스트만 알아요" : "Host only"]].map(([m, label]) => (
          <button key={m} onClick={() => set({ mode: m })}
            style={{ flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 11, fontWeight: 700,
              cursor: "pointer", fontFamily: "var(--sans)",
              border: `1px solid ${f.mode === m ? "var(--blue)" : "var(--line2)"}`,
              background: f.mode === m ? "var(--blue-bg)" : "var(--card)",
              color: f.mode === m ? "var(--blue)" : "var(--muted)" }}>{label}</button>
        ))}
      </div>

      {f.mode === "url" ? (
        <input value={f.url} onChange={(e) => set({ url: e.target.value })}
          placeholder="http://10.60.1.10:8002/openapi.json" style={inp} />
      ) : (
        <>
          <input value={f.host} onChange={(e) => set({ host: e.target.value })}
            placeholder="10.60.1.10:8002" style={inp} />
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
            {ko ? "이 호스트 한 곳의 표준 스펙 경로(/openapi.json · /v3/api-docs · /swagger.json …)만 확인합니다."
                : "Probes standard spec paths on this host only."}
          </div>
        </>
      )}

      <AuthPicker value={auth} onChange={(v) => { setAuth(v); setChecked(null); setErr(""); }} lab={lab} inp={inp} />

      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
        {ko ? "토큰·시크릿은 ${env:...} · ${vault:...} 참조로만 저장됩니다. 평문은 거부됩니다."
            : "Secrets must be ${env:...} / ${vault:...} references."}
      </div>

      {checked && (
        <div style={{ fontSize: 11.5, color: "var(--green)", marginTop: 8, lineHeight: 1.6 }}>
          ✓ {ko ? `endpoint ${checked.endpoints}개 확인` : `${checked.endpoints} endpoints`}
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{checked.url}</div>
        </div>
      )}
      {err && <div style={{ fontSize: 11.5, color: "var(--red)", marginTop: 8, lineHeight: 1.5 }}>⚠ {err}</div>}

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <Btn onClick={check} disabled={busy || !ready}>
          {busy ? (ko ? "확인 중…" : "…") : (ko ? "연결 확인" : "Check")}
        </Btn>
        <Btn tone="pri" onClick={submit} disabled={busy || !f.name.trim() || !specUrl}
          title={f.mode === "host" && !specUrl ? (ko ? "먼저 [연결 확인] 으로 스펙 경로를 찾으세요" : "Run check first") : undefined}>
          {ko ? "등록 + 변환" : "Add & convert"}
        </Btn>
        <Btn onClick={onCancel}>{ko ? "취소" : "Cancel"}</Btn>
      </div>
    </div>
  );
}
