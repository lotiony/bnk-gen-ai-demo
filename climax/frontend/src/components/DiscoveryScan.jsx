import { useEffect, useRef, useState } from "react";
import ScanStage from "./ScanStage";
import { contactAngle, contactRadius } from "./RadarScope";
import { api } from "../api";
import { getArmToken } from "../lib/azureAuth";

// 온보딩 자동 탐색 — 두 채널을 함께 돈다.
//   · 온프렘: 대역을 SSE(/api/discover/stream)로 스윕. 레이더로 표현.
//   · 클라우드: 선택한 Azure 구독의 VM·관리형 DB 를 ARM API 로 조회.
// 클라우드 조회는 대역 스캔이 아니라 목록 읽기라 레이더에 얹지 않고 별도 채널로 계측한다.
// 발견분(convertible)을 골라 onPick 으로 넘긴다.
const TEAL = "#0d9488", TEAL2 = "#14b8a6", AMBER = "#d97706";
const CLOUD = "#4aa3ff", CLOUD_HI = "#8ec5ff", ONPREM = "#f5a524";
const CONNECTOR = "#a78bfa", CONNECTOR_HI = "#c4b5fd";
const CONNECTOR_ACTIONS = {
  sharepoint: "문서 라이브러리 조회",
  fileserver: "공유 폴더 스캔",
  confluence: "스페이스·페이지 수집",
  googledrive: "공유 드라이브 조회",
};
const CONNECTOR_DATA = {
  sharepoint: { source: "보상심사 문서 라이브러리", detail: "약관·상품설명서 · 128건", count: "128건" },
  fileserver: { source: "\\\\fileserver01\\legacy\\보험", detail: "PDF·DOCX · 214건", count: "214건" },
  confluence: { source: "보상심사 운영 스페이스", detail: "페이지 · 86건", count: "86건" },
  googledrive: { source: "차세대 보험 설계 드라이브", detail: "문서 · 64건", count: "64건" },
};

const nowT = () => new Date().toTimeString().slice(0, 8);

// 출처 배지 — 스테이지의 채널 색과 같은 색을 써서 위아래가 같은 것을 가리킨다는 걸 보여준다
const badge = (accent, fg) => ({
  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".04em",
  padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap",
  background: `color-mix(in srgb,${accent} 16%,var(--card))`, color: fg,
  border: `1px solid color-mix(in srgb,${accent} 40%,transparent)`,
});

export default function DiscoveryScan({
  onPick, onCancel, onManual, onVmApi, registered, cached, onScanned,
  cloudSubs = [], onpremEnabled = true, onpremRange,
  onpremApiSpec = "", onpremDbSpec = "",
  documents = [], connectors = [], submitting = false, submissionError = null,
}) {
  // VM 내부 API 확인 상태 — vmKey → {status:'idle'|'probing'|'found'|'notfound', ...}
  const [vmProbe, setVmProbe] = useState({});
  const [total, setTotal] = useState(0);
  const [swept, setSwept] = useState(0);                 // 스윕한 호스트 수
  const [logs, setLogs] = useState([]);
  const [found, setFound] = useState([]);                // 온프렘 발견분
  const [cloud, setCloud] = useState([]);                // 클라우드 발견분
  const [cloudDone, setCloudDone] = useState(0);         // 조회 끝난 구독 수
  const [cloudSel, setCloudSel] = useState(() => new Set());   // 담을 클라우드 리소스
  const [sel, setSel] = useState(() => new Set());
  const [done, setDone] = useState(false);
  const [scanning, setScanning] = useState(onpremEnabled);
  const [expanded, setExpanded] = useState(() => new Set());
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadsDone, setUploadsDone] = useState(() => !documents.length);
  const [connectorStatus, setConnectorStatus] = useState({});
  const [connectorProgress, setConnectorProgress] = useState({});
  const esRef = useRef(null);
  const [nonce, setNonce] = useState(0);                 // 재스캔 트리거

  const cloudEnabled = cloudSubs.length > 0;
  const cloudBusy = cloudEnabled && cloudDone < cloudSubs.length;
  const documentKey = documents.map((doc) => doc.path || doc.name).join("|");
  const uploadsBusy = documents.length > 0 && !uploadsDone;
  const connectorDone = connectors.filter((connector) => connectorStatus[connector.id] === "done").length;
  const connectorsBusy = connectors.length > 0 && connectorDone < connectors.length;
  const readyToPick = done && !cloudBusy && !uploadsBusy && !connectorsBusy;
  const canManual = typeof onManual === "function";
  const canAddVmApi = typeof onVmApi === "function";

  // 로그는 두 채널이 공유한다 — 채널별로 나누면 시간 순서가 깨진다.
  const pushLog = (ch, cls, txt) => setLogs((p) => [...p.slice(-60), { ch, cls, txt, t: nowT() }]);

  // 문서 업로드는 API/DB 탐색을 기다리지 않는다. 기존 Blob 목업과 같은 진행률을
  // 이 단계에 붙여, 모든 소스가 준비된 뒤에만 다음 단계로 이동시킨다.
  useEffect(() => {
    let cancelled = false;
    if (!documents.length) {
      setUploadProgress(0);
      setUploadsDone(true);
      return undefined;
    }
    setUploadProgress(0);
    setUploadsDone(false);
    (async () => {
      for (const progress of [12, 40, 72, 100]) {
        await new Promise((resolve) => setTimeout(resolve, progress === 100 ? 500 : 420));
        if (cancelled) return;
        setUploadProgress(progress);
      }
      setUploadsDone(true);
    })();
    return () => { cancelled = true; };
  }, [documentKey]);

  // ── 클라우드 채널 — 구독을 하나씩 돌며 VM·PG 를 모은다 ──
  useEffect(() => {
    if (!cloudEnabled) return;
    let cancelled = false;
    (async () => {
      setCloud([]); setCloudDone(0); setCloudSel(new Set());
      let token;
      try {
        token = await getArmToken();
      } catch {
        // 토큰 만료·소실. 온프렘 탐색은 계속되므로 중단하지 않고 알리기만 한다.
        if (!cancelled) {
          pushLog("c", "nope", "⚠ Azure 인증 만료 — 이전 단계에서 다시 로그인해주세요");
          setCloudDone(cloudSubs.length);
        }
        return;
      }
      for (const s of cloudSubs) {
        if (cancelled) return;
        pushLog("c", "t", `구독 조회 · ${s.name}`);
        const [v, d] = await Promise.all([
          api.azureVms(token, s.id).catch(() => ({ vms: [] })),
          api.azurePostgres(token, s.id).catch(() => ({ databases: [] })),
        ]);
        if (cancelled) return;
        const items = [
          ...(v.vms || []).map((x) => ({ ...x, kind: "vm", sub: s.name })),
          ...(d.databases || []).map((x) => ({ ...x, kind: "cdb", sub: s.name })),
        ];
        items.forEach((it) => pushLog("c", "found", `✔ ${it.kind === "vm" ? "VM" : "PostgreSQL"} 감지 → ${it.name}`));
        setCloud((p) => [...p, ...items]);
        // 찾은 건 기본으로 담아둔다 — 빼고 싶으면 목록에서 체크를 해제하면 된다.
        // VM 자체는 변환 대상이 아니라 정보성 표시(그 위 API 는 온프렘 대역 스캔이 담당)이므로 담기에서 제외.
        setCloudSel((p) => { const n = new Set(p); items.forEach((it) => { if (it.kind !== "vm") n.add(it.id || it.name); }); return n; });
        setCloudDone((n) => n + 1);
      }
    })();
    return () => { cancelled = true; };
  }, [nonce, cloudSubs.length]);

  // ── 온프렘 채널 — 대역 SSE 스윕 ──
  useEffect(() => {
    if (!onpremEnabled) { setScanning(false); setDone(true); return; }
    // [이전]→[다음] 재진입 시 이미 스캔한 결과가 있으면 재스캔 없이 복원(nonce 0 = 첫 진입)
    if (nonce === 0 && cached && cached.length) {
      setFound(cached); setDone(true); setScanning(false); setTotal(cached.length); setSwept(cached.length);
      setSel(new Set(cached.filter((c) => c.convertible && !registered?.has(c.spec_url)).map((c) => `${c.host}:${c.port}`)));
      setLogs([{ ch: "o", cls: "ok", txt: `이전 스캔 결과 복원 · ${cached.length} found`, t: nowT() }]);
      return;
    }
    setTotal(0); setSwept(0); setLogs([]); setFound([]); setSel(new Set()); setDone(false); setScanning(true);
    const log = (cls, txt) => pushLog("o", cls, txt);
    const queue = [];         // SSE 이벤트를 쌓아두고 타이머가 천천히 소비(연출 페이싱)
    let timer = null, closed = false;

    const handle = (d) => {
      if (d.phase === "start") { setTotal(d.total); log("t", `discover · ${d.total} targets`); log("t", "스펙 경로 확인 시작…"); }
      else if (d.phase === "probing") { setSwept((n) => n + 1); log("probe", `확인 ${d.host}:${d.port} · 스펙 경로 …`); }
      else if (d.phase === "dead") { log("nope", `:${d.port} · no response`); }
      else if (d.phase === "spec_found") {
        log("found", `✔ ${d.spec_type} 감지 → ${d.name}`);
        setFound((f) => [...f, d]);
        if (!registered?.has(d.spec_url)) setSel((s) => new Set(s).add(`${d.host}:${d.port}`));
      } else if (d.phase === "no_spec") {
        log("nope", `⚠ 스펙 없음 → 수동 필요 (${d.name})`);
        setFound((f) => [...f, d]);
      } else if (d.phase === "db_found") {
        // DB 감지: 무자격으로 엔진·버전까지만 확인. 스키마는 자격 입력 후 introspection.
        log("found", `✔ ${d.label} 감지 → 연결 정보 필요`);
        setFound((f) => [...f, d]);
      } else if (d.phase === "done") {
        setScanning(false); setDone(true);
        log("ok", `done · ${d.found.length} found · ${d.convertible} convertible`);
        onScanned?.(d.found);     // 결과를 상위에 캐시 → [이전]/[다음] 재진입 시 재사용
        esRef.current?.close();   // 스트림 종료 후 EventSource 재연결(재스캔) 방지
      }
    };
    // 가변 페이싱: probing 후 긴장감(길게), 발견 임팩트, dead 는 빠르게
    const paceOf = (p) => (p === "probing" ? 640 : p === "spec_found" ? 560 : p === "no_spec" ? 480 : p === "dead" ? 320 : 400);
    const drain = () => {
      if (closed) return;
      if (!queue.length) { timer = setTimeout(drain, 120); return; }   // 이벤트 대기
      const d = queue.shift();
      handle(d);
      if (d.phase === "done") return;                                  // 완료 → 페이싱 종료
      timer = setTimeout(drain, paceOf(d.phase));
    };

    // 이전 스텝에서 지정한 host:port 만 넘긴다 — 안 넘기면 백엔드가 seed 를 훑어
    // 입력과 무관한 결과(더미)가 나온다.
    const qs = new URLSearchParams({ targets: onpremApiSpec, db: onpremDbSpec });
    const es = new EventSource(`/api/discover/stream?${qs}`);
    esRef.current = es;
    es.onmessage = (e) => { queue.push(JSON.parse(e.data)); };
    es.onerror = () => { es.close(); if (!queue.some((q) => q.phase === "done")) { setScanning(false); setDone(true); } };
    timer = setTimeout(drain, 700);   // 초기 부팅 딜레이 — 레이더가 먼저 돌기 시작

    return () => { closed = true; clearTimeout(timer); es.close(); };
  }, [nonce, onpremEnabled, onpremApiSpec, onpremDbSpec]);

  // 커넥터 액션 목업 — 선택된 커넥터마다 목록 확인 단계를 연출하지만 외부 호출은 하지 않는다.
  const connectorKey = connectors.map((connector) => connector.id).join("|");
  useEffect(() => {
    if (!connectors.length) { setConnectorStatus({}); setConnectorProgress({}); return undefined; }
    let cancelled = false;
    const timers = [];
    setConnectorStatus(Object.fromEntries(connectors.map((connector) => [connector.id, "waiting"])));
    setConnectorProgress(Object.fromEntries(connectors.map((connector) => [connector.id, 0])));
    pushLog("k", "t", `data-connect · ${connectors.length} connectors`);
    connectors.forEach((connector, index) => {
      const action = CONNECTOR_ACTIONS[connector.id] || "문서 목록 확인";
      const data = CONNECTOR_DATA[connector.id] || { source: connector.name, detail: "문서 목록 · 32건", count: "32건" };
      [12, 38, 64, 86, 100].forEach((progress, step) => {
        timers.push(setTimeout(() => {
          if (cancelled) return;
          setConnectorProgress((state) => ({ ...state, [connector.id]: progress }));
          setConnectorStatus((state) => ({ ...state, [connector.id]: progress === 100 ? "done" : "running" }));
          if (step === 0) pushLog("k", "probe", `${connector.name} · ${data.source} · ${action} …`);
          if (progress === 100) pushLog("k", "found", `✔ ${connector.name} · ${data.source} · ${data.count} 확인`);
        }, 180 + index * 520 + step * 150));
      });
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [connectorKey, nonce]);

  const key = (f) => `${f.host}:${f.port}`;
  const ckey = (c) => c.id || c.name;
  const toggle = (f) => { if (!f.convertible) return; setSel((s) => { const n = new Set(s); n.has(key(f)) ? n.delete(key(f)) : n.add(key(f)); return n; }); };
  const toggleExp = (f) => setExpanded((s) => { const n = new Set(s); n.has(key(f)) ? n.delete(key(f)) : n.add(key(f)); return n; });
  const toggleCloud = (c) => { if (c.kind === "vm") return; setCloudSel((s) => { const n = new Set(s); n.has(ckey(c)) ? n.delete(ckey(c)) : n.add(ckey(c)); return n; }); };
  // VM 내부 API 확인 — 구독에서 이미 아는 VM 주소로 표준 스펙 경로만 프로브.
  // port 를 주면 그 포트만 확인 — 관례 포트에서 못 찾았을 때 사용자가 아는 포트로 보완.
  const probeVm = async (c, port) => {
    setVmProbe((p) => ({ ...p, [ckey(c)]: { status: "probing", portInput: port || "" } }));
    try {
      const token = await getArmToken();
      const r = await api.azureVmProbe(token, c.id, port);
      if (r.found) {
        setVmProbe((p) => ({ ...p, [ckey(c)]: { status: "found", spec_url: `${r.scheme}://${r.address}:${r.port}${r.spec_path}`, port: r.port, spec_type: r.spec_type, address: r.address, endpoints: r.endpoints || [], api_count: r.api_count ?? (r.endpoints ? r.endpoints.length : 0), expanded: false } }));
      } else {
        setVmProbe((p) => ({ ...p, [ckey(c)]: { status: "notfound", reason: r.reason, address: r.address, triedPorts: r.tried_ports || [], canRetry: r.can_retry_with_port !== false, portInput: port || "" } }));
      }
    } catch (e) {
      setVmProbe((p) => ({ ...p, [ckey(c)]: { status: "notfound", reason: String(e.message), canRetry: true, portInput: port || "" } }));
    }
  };
  const convertibleN = found.filter((f) => f.convertible).length;
  const pick = () => {
    if (!submitting) onPick(found.filter((f) => sel.has(key(f))), cloud.filter((c) => cloudSel.has(ckey(c))));
  };
  const pickedN = sel.size + cloudSel.size;

  // 레이더 접점 — 온프렘 발견분만. 식별된 것에 조준 브래킷이 씌워진다.
  const contacts = found.map((f, i) => ({
    key: key(f),
    a: contactAngle(i, Math.max(total, found.length, 1)),
    r: contactRadius(i),
    kind: f.kind === "db" ? "db" : "api",
    locked: !!(f.convertible || f.kind === "db"),
    label: `${f.host}:${f.port}`,
  }));

  const cloudItems = cloud.map((c) => ({
    key: c.id || c.name,
    kind: c.kind === "vm" ? "vm" : "db",
    name: c.name,
    meta: c.kind === "vm" ? `${c.location || ""}${c.os ? " · " + c.os : ""}` : c.fqdn || "",
    pending: c.kind !== "vm",   // 관리형 DB 는 자격 입력이 남아 있다
  }));
  const onpremItems = found.map((f) => ({
    key: key(f),
    kind: f.kind === "db" ? "db" : "api",
    name: f.name,
    meta: `${f.host}:${f.port}${f.spec_type ? " · " + f.spec_type : ""}${f.label ? " · " + f.label : ""}`,
    pending: !f.convertible,
  }));

  return (
    <div style={{ border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 3px 10px rgba(20,29,51,.055)" }}>
      <style>{`
        @keyframes dsc-pop{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes dsc-fade{from{opacity:0}to{opacity:1}}
        @keyframes dsc-pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>

      <div style={{ padding: "16px 18px 12px", background: "var(--main)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: TEAL2, boxShadow: `0 0 10px ${TEAL2}`, animation: scanning || cloudBusy || uploadsBusy || connectorsBusy ? "dsc-pulse 1.3s infinite" : "none" }} />
          {scanning || cloudBusy || uploadsBusy || connectorsBusy ? "탐색·업로드 중" : "준비 완료"}
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
            · {found.length + cloud.length}개 발견
          </span>
        </div>
      </div>

      <div style={{ padding: "0 18px 14px", background: "var(--main)" }}>
        <ScanStage
          contacts={contacts} scanning={scanning} logs={logs}
          cloudEnabled={cloudEnabled} cloudItems={cloudItems} cloudBusy={cloudBusy}
          cloudProgress={cloudSubs.length ? cloudDone / cloudSubs.length : 0}
          cloudProgressText={`${cloudDone} / ${cloudSubs.length} 구독`}
          cloudSub={cloudSubs.map((s) => s.name).join(", ")}
          onpremEnabled={onpremEnabled} onpremItems={onpremItems} onpremBusy={scanning}
          onpremProgress={total ? Math.min(1, swept / total) : 0}
          onpremProgressText={`${Math.min(swept, total || swept)} / ${total || "–"} 호스트`}
          onpremRange={onpremRange}
        />
      </div>

      {connectors.length > 0 && (
        <div style={{ margin: "0 18px 14px", padding: "13px 14px", borderRadius: 12, background: "var(--card)", border: `1px solid color-mix(in srgb,${CONNECTOR} 45%,var(--line2))` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `color-mix(in srgb,${CONNECTOR} 16%,var(--card))`, color: CONNECTOR_HI }}>DATA CONNECT</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--navy)" }}>커넥터 액션</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, color: connectorsBusy ? "var(--muted)" : CONNECTOR_HI }}>{connectorDone} / {connectors.length} 완료</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 7 }}>
            {connectors.map((connector) => {
              const status = connectorStatus[connector.id] || "waiting";
              const action = CONNECTOR_ACTIONS[connector.id] || "문서 목록 확인";
              const data = CONNECTOR_DATA[connector.id] || { source: connector.name, detail: "문서 목록 · 32건" };
              const progress = connectorProgress[connector.id] || 0;
              return (
                <div key={connector.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, background: "var(--main)", border: `1px solid ${status === "done" ? "color-mix(in srgb," + CONNECTOR + " 50%,var(--line2))" : "var(--line2)"}` }}>
                  <span style={{ width: 27, height: 27, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 7, background: `color-mix(in srgb,${connector.color || CONNECTOR} 18%,var(--card))`, color: connector.color || CONNECTOR_HI, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 800 }}>{connector.mark || "DC"}</span>
                  <span style={{ minWidth: 0, flex: 1 }}><b style={{ display: "block", fontSize: 10.5, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{connector.name} · {data.source}</b><small style={{ display: "block", marginTop: 2, overflow: "hidden", color: "var(--muted)", fontSize: 9.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status === "waiting" ? action : data.detail}</small><span style={{ display: "block", height: 3, marginTop: 6, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.08)" }}><span style={{ display: "block", width: `${progress}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg,${CONNECTOR},${CONNECTOR_HI})`, transition: "width .2s ease" }} /></span></span>
                  <span style={{ color: status === "done" ? CONNECTOR_HI : "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{status === "done" ? "✓ 완료" : status === "running" ? `${progress}%` : "대기"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div style={{ margin: "0 18px 14px", padding: "13px 14px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--line2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "var(--navy)" }}>Azure Blob Storage</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>legacy-source</span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 800, color: TEAL2 }}>{uploadProgress}%</span>
          </div>
          <div role="progressbar" aria-label="Blob 업로드 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress} style={{ height: 6, borderRadius: 999, overflow: "hidden", background: "var(--main)" }}>
            <div style={{ width: `${uploadProgress}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#0d9488,#2dd4bf)", transition: "width .35s ease" }} />
          </div>
          <div style={{ marginTop: 9 }}>
            {documents.map((doc, i) => {
              const type = (doc.name || "").split(".").pop()?.toUpperCase() || "DOC";
              return <div key={doc.path || `${doc.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", fontSize: 11.5 }}>
                <span style={{ width: 15, height: 15, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", background: uploadsDone ? TEAL : "transparent", border: uploadsDone ? "none" : `2px solid ${TEAL2}`, fontSize: 9, animation: uploadsBusy ? "dsc-pulse 1.1s infinite" : "none" }}>{uploadsDone ? "✓" : ""}</span>
                <span style={badge("#8a91e8", "#b6bcff")}>{type}</span>
                <span style={{ minWidth: 0, flex: 1, fontWeight: 700, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</span>
                <span style={{ color: uploadsDone ? "var(--green)" : TEAL2, whiteSpace: "nowrap", fontSize: 10.5 }}>{uploadsDone ? "업로드 완료" : "업로드 중"}</span>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* ── 발견 목록 — 두 출처를 한 목록에. 출처는 배지로 구분한다. ── */}
      <div style={{ padding: "4px 20px 16px", background: "var(--main)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", letterSpacing: ".04em" }}>
            발견된 리소스 <span style={{ fontFamily: "var(--mono)", color: TEAL }}>{found.length + cloud.length}</span>
          </span>
          {cloud.length > 0 && <span style={badge(CLOUD, CLOUD_HI)}>클라우드 {cloud.length}</span>}
          {found.length > 0 && <span style={badge(ONPREM, ONPREM)}>온프렘 {found.length}</span>}
        </div>
        {found.length + cloud.length === 0 && (scanning || cloudBusy) && <div style={{ fontSize: 12.5, color: "var(--muted)" }}>탐색 중…</div>}

        {/* 클라우드 발견분 — 구독 API 로 읽어온 것이라 펼침 상세가 없다(엔드포인트 개념 없음) */}
        {cloud.map((c) => {
          const isVm = c.kind === "vm";
          const on = !isVm && cloudSel.has(ckey(c));
          // VM 은 구독에서 '겉면'만 발견됨 — [API 확인]으로 그 VM 의 표준 스펙 경로를 프로브해
          // 안의 API 를 찾으면 담기 대상으로 승격한다(호스트 재입력 없이 구독에서 아는 주소 사용).
          const vp = isVm ? (vmProbe[ckey(c)] || { status: "idle" }) : null;
          const vmFound = vp && vp.status === "found";
          const vmExp = vmFound && vp.expanded && (vp.endpoints || []).length > 0;
          // 관례 포트에서 못 찾음 → 후보를 넓히는 대신 사용자가 아는 포트 1개를 받아 재확인한다.
          const vmMiss = isVm && vp.status === "notfound" && vp.canRetry !== false;
          return (
            <div key={ckey(c)} style={{ border: `1.5px solid ${vmFound ? TEAL : vmMiss ? "color-mix(in srgb,#d97706 45%,var(--line2))" : on ? CLOUD : "var(--line2)"}`, borderRadius: 11, marginBottom: 6, overflow: "hidden", animation: "dsc-pop .4s cubic-bezier(.2,.9,.3,1.3)", background: on ? `color-mix(in srgb,${CLOUD} 10%,var(--card))` : vmFound ? `color-mix(in srgb,${TEAL} 8%,var(--card))` : "var(--card)", opacity: isVm && !vmFound && !vmMiss ? 0.62 : 1 }}>
            <div onClick={isVm ? undefined : () => toggleCloud(c)}
              style={{ padding: "9px 13px", cursor: isVm ? "default" : "pointer", display: "flex", alignItems: "center", gap: 11 }}>
              {isVm
                ? <div title="구독에서 발견한 VM — [API 확인]으로 안의 API 를 가져옴" style={{ width: 18, height: 18, borderRadius: 5, border: `1px ${vmFound ? "solid " + TEAL : "dashed var(--line2)"}`, display: "grid", placeItems: "center", color: vmFound ? TEAL2 : "var(--muted)", flex: "none", fontSize: 8.5, fontWeight: 800 }}>VM</div>
                : <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? CLOUD : "var(--line2)"}`, background: on ? CLOUD : "transparent", display: "grid", placeItems: "center", color: "#fff", flex: "none", fontSize: 11, fontWeight: 800 }}>{on ? "✓" : ""}</div>}
              <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "30%" }} title={c.name}>{c.name}</span>
              <span style={badge(CLOUD, CLOUD_HI)}>CLOUD</span>
              {!isVm
                ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "color-mix(in srgb,#5b9dff 16%,var(--card))", color: "#5b9dff" }}>DB · 연결 정보 필요</span>
                : vmFound
                  ? <span style={badge(TEAL, TEAL2)}>API 발견 · {vp.spec_type} :{vp.port}{vp.api_count ? ` · API ${vp.api_count}` : ""}</span>
                  : vp.status === "probing"
                    ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "var(--main)", color: TEAL2, border: `1px solid ${TEAL}`, animation: "dsc-pulse 1.2s infinite" }}>확인 중…</span>
                    : vp.status === "notfound"
                      ? <span title={vp.reason} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "var(--main)", color: "var(--muted)", border: "1px solid var(--line2)" }}>API 없음</span>
                      : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "var(--main)", color: "var(--muted)", border: "1px solid var(--line2)" }}>VM</span>}
              <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={isVm ? c.location : c.fqdn}>
                {isVm ? `${c.location || ""}${c.os ? " · " + c.os : ""}` : c.fqdn}{c.version ? ` · PostgreSQL ${c.version}` : ""}{!isVm ? " · 연결 정보는 다음 단계에서" : ""}
              </span>
              {!isVm
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: CLOUD_HI, fontWeight: 700, whiteSpace: "nowrap" }} title={c.sub ? `구독에서 확인 · ${c.sub}` : "구독에서 확인"}><span style={{ width: 6, height: 6, borderRadius: "50%", background: CLOUD, boxShadow: `0 0 5px ${CLOUD}` }} />구독에서 확인</span>
                : vmFound
                  ? <>
                      {(vp.endpoints || []).length > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); setVmProbe((p) => ({ ...p, [ckey(c)]: { ...vp, expanded: !vp.expanded } })); }} style={{ fontSize: 11.5, fontWeight: 700, color: TEAL2, background: "color-mix(in srgb,#0d9488 15%,var(--card))", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>API 상세 <span style={{ display: "inline-block", transition: "transform .2s", transform: vmExp ? "rotate(180deg)" : "none" }}>▾</span></button>
                      )}
                      {canAddVmApi && <button onClick={(e) => { e.stopPropagation(); onVmApi({ name: c.name, spec_url: vp.spec_url, port: vp.port, api_count: vp.api_count, endpoints: vp.endpoints }); }} style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", background: TEAL, border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>이 API 담기 →</button>}
                    </>
                  : vp.status === "probing"
                    ? <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>표준 경로 확인 중…</span>
                    : vp.status === "notfound"
                      ? canManual && <button onClick={(e) => { e.stopPropagation(); onManual({ name: c.name, host: vp.address || "", port: "" }, []); }} title={vp.reason} style={{ fontSize: 11.5, fontWeight: 700, color: AMBER, background: "color-mix(in srgb,#d97706 15%,var(--card))", border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>직접 입력 →</button>
                      : <button onClick={(e) => { e.stopPropagation(); probeVm(c); }} style={{ fontSize: 11.5, fontWeight: 800, color: TEAL2, background: "color-mix(in srgb,#0d9488 15%,var(--card))", border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>API 확인</button>}
            </div>
            {vmExp && (
              <div style={{ borderTop: "1px solid var(--line)", background: "var(--main)", padding: "10px 14px 12px", animation: "dsc-fade .25s" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "var(--faint)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span>ENDPOINTS · {(vp.endpoints || []).length}</span><span>{vp.address}:{vp.port} · 스펙에서 자동 추출</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {(vp.endpoints || []).slice(0, 50).map((e, i) => (
                      <tr key={i}>
                        <td style={{ padding: "7px 6px", borderBottom: i < Math.min(vp.endpoints.length, 50) - 1 ? "1px solid var(--line)" : "none", fontSize: 12 }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, borderRadius: 4, padding: "2px 7px", marginRight: 7, background: e.m === "POST" ? "color-mix(in srgb,#d97706 15%,var(--card))" : "color-mix(in srgb,#0d9488 15%,var(--card))", color: e.m === "POST" ? AMBER : TEAL }}>{e.m}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--navy)" }}>{e.p}</span>
                        </td>
                        <td style={{ padding: "7px 6px", borderBottom: i < Math.min(vp.endpoints.length, 50) - 1 ? "1px solid var(--line)" : "none", textAlign: "right", color: "var(--faint)", fontSize: 11, whiteSpace: "nowrap" }}>{e.d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {vmMiss && (
              <div style={{ borderTop: "1px dashed color-mix(in srgb,#d97706 45%,var(--line2))", background: "color-mix(in srgb,#d97706 7%,var(--card))", padding: "11px 14px 12px", animation: "dsc-fade .25s" }}>
                <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.55, marginBottom: 9 }}>
                  <b style={{ color: AMBER }}>⚠ {vp.reason}</b>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap" }}>{vp.address || "이 VM"} :</span>
                  <input
                    value={vp.portInput || ""}
                    onChange={(e) => setVmProbe((p) => ({ ...p, [ckey(c)]: { ...vp, portInput: e.target.value.replace(/[^0-9]/g, "") } }))}
                    onKeyDown={(e) => { if (e.key === "Enter" && vp.portInput) probeVm(c, vp.portInput); }}
                    placeholder="예: 8001"
                    style={{ width: 92, border: "1px solid var(--line2)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "var(--mono)", color: "var(--navy)", background: "var(--main)", outline: "none" }} />
                  <button onClick={(e) => { e.stopPropagation(); if (vp.portInput) probeVm(c, vp.portInput); }} disabled={!vp.portInput}
                    style={{ fontSize: 11.5, fontWeight: 800, color: vp.portInput ? "#fff" : "var(--faint)", background: vp.portInput ? TEAL : "var(--line2)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: vp.portInput ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}>
                    이 포트로 확인
                  </button>
                  <span style={{ fontSize: 10.5, color: "var(--faint)", marginLeft: 2 }}>지정한 포트의 표준 스펙 경로만 확인합니다 (4회)</span>
                </div>
              </div>
            )}
            </div>
          );
        })}
        {found.map((f) => {
          const on = sel.has(key(f));
          const conv = f.convertible;
          const isDb = f.kind === "db";   // DB 감지분 — 자격 후 introspection
          const exp = expanded.has(key(f));
          const isSwagger = (f.spec_type || "").startsWith("Swagger");
          return (
            <div key={key(f)} style={{ border: `1.5px ${conv ? "solid" : "dashed"} ${on ? TEAL : conv ? "var(--line2)" : "color-mix(in srgb,#d97706 45%,var(--line2))"}`, borderRadius: 13, marginBottom: 6, overflow: "hidden", animation: "dsc-pop .4s cubic-bezier(.2,.9,.3,1.3)", background: on ? "color-mix(in srgb,#0d9488 10%,var(--card))" : conv ? "var(--card)" : "color-mix(in srgb,#d97706 8%,var(--card))" }}>
              {/* 헤더 (클릭=펼침, 체크박스=선택) */}
              <div onClick={() => toggleExp(f)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", cursor: "pointer", flexWrap: "wrap" }}>
                {conv
                  ? <div onClick={(e) => { e.stopPropagation(); toggle(f); }} style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? TEAL : "var(--line2)"}`, background: on ? TEAL : "transparent", display: "grid", placeItems: "center", color: "#fff", flex: "none", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>{on ? "✓" : ""}</div>
                  : <div style={{ width: 18, height: 18, borderRadius: 5, background: "color-mix(in srgb,#d97706 15%,var(--card))", color: AMBER, display: "grid", placeItems: "center", flex: "none", fontSize: 11, fontWeight: 800 }}>!</div>}
                {/* 한 줄 요약 — 변환 가능한 리소스는 이 줄만으로 판단이 끝난다 */}
                <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--navy)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "34%" }} title={f.name}>{f.name}</span>
                <span style={badge(ONPREM, ONPREM)}>ON-PREM</span>
                {conv
                  ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "color-mix(in srgb,#0d9488 15%,var(--card))", color: TEAL }}>바로 변환 가능</span>
                  : isDb
                    ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "color-mix(in srgb,#5b9dff 16%,var(--card))", color: "#5b9dff" }}>DB · 연결 정보 필요</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", background: "color-mix(in srgb,#d97706 15%,var(--card))", color: AMBER }}>수동 등록 필요</span>}
                {registered?.has(f.spec_url) && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", border: `1px solid ${TEAL}`, color: TEAL }}>담김</span>}
                <span style={{ flex: 1, minWidth: 90, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  title={`${f.host}:${f.port}`}>
                  {f.host}:{f.port}{isDb ? ` · ${f.label}${f.version ? " " + f.version : ""}` : ""}{f.auth ? ` · ${f.auth}` : ""}{conv ? ` · ${f.spec_type}` : ""}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: TEAL, fontWeight: 700, whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TEAL2, boxShadow: `0 0 5px ${TEAL2}` }} />{f.ms != null ? `${f.ms}ms` : "응답 확인"}
                </span>
                {conv
                  ? <span style={{ fontSize: 11.5, color: "var(--text)", whiteSpace: "nowrap" }}>API <b style={{ color: "var(--navy)" }}>{f.api_count ?? "–"}</b></span>
                  : isDb
                    ? <span style={{ fontSize: 11.5, color: "#5b9dff", fontWeight: 700, whiteSpace: "nowrap" }}>테이블은 연결 후 확인</span>
                    : <span style={{ fontSize: 11.5, color: AMBER, fontWeight: 700, whiteSpace: "nowrap" }}>스펙 없음</span>}
                {/* 스펙없음/DB: 직접입력(자격) 버튼을 접힘 상태에도 헤더에 상시 노출 */}
                {!conv && canManual && (
                  <button onClick={(e) => { e.stopPropagation(); onManual(f, found.filter((x) => x.convertible && sel.has(key(x)))); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 800, color: "#fff", background: isDb ? "#5b9dff" : AMBER, border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer", whiteSpace: "nowrap" }}>
                    {isDb ? "연결 정보 입력 →" : "직접 입력으로 등록 →"}
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); toggleExp(f); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: conv ? TEAL : AMBER, background: conv ? "color-mix(in srgb,#0d9488 15%,var(--card))" : "color-mix(in srgb,#d97706 15%,var(--card))", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {conv ? "API 상세" : "상세"} <span style={{ display: "inline-block", transition: "transform .2s", transform: exp ? "rotate(180deg)" : "none" }}>▾</span>
                </button>
              </div>

              {/* 펼침 상세 */}
              {exp && conv && (
                <div style={{ borderTop: "1px solid var(--line)", background: "var(--main)", padding: "14px 16px 16px", animation: "dsc-fade .25s" }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", padding: "10px 13px", background: "#0f1724", borderRadius: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: isSwagger ? "rgba(121,192,255,.15)" : "rgba(63,185,80,.15)", color: isSwagger ? "#79c0ff" : "#3fd07f" }}>{f.spec_type}</span>
                    <span><span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#5f6b82" }}>SPEC</span> <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "#79c0ff" }}>{f.spec_path}</span></span>
                    <span><span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#5f6b82" }}>FETCH</span> <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "#c9d4e3" }}>200{f.ms != null ? ` · ${f.ms}ms` : ""}</span></span>
                    <span><span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#5f6b82" }}>AUTH</span> <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "#c9d4e3" }}>{f.auth || "-"}</span></span>
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "var(--faint)", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>ENDPOINTS · {(f.endpoints || []).length}</span><span>스펙에서 자동 추출</span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <tbody>
                      {(f.endpoints || []).map((e, i) => (
                        <tr key={i}>
                          <td style={{ padding: "8px 6px", borderBottom: i < f.endpoints.length - 1 ? "1px solid var(--line)" : "none", fontSize: 12 }}>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, borderRadius: 4, padding: "2px 7px", marginRight: 7, background: e.m === "POST" ? "color-mix(in srgb,#d97706 15%,var(--card))" : "color-mix(in srgb,#0d9488 15%,var(--card))", color: e.m === "POST" ? AMBER : TEAL }}>{e.m}</span>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--navy)" }}>{e.p}</span>
                          </td>
                          <td style={{ padding: "8px 6px", borderBottom: i < f.endpoints.length - 1 ? "1px solid var(--line)" : "none", textAlign: "right", color: "var(--faint)", fontSize: 11, whiteSpace: "nowrap" }}>{e.d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {exp && !conv && (
                <div style={{ borderTop: "1px dashed color-mix(in srgb,#d97706 45%,var(--line2))", background: "color-mix(in srgb,#d97706 8%,var(--card))", padding: "14px 16px 16px", animation: "dsc-fade .25s" }}>
                  <div style={{ background: "color-mix(in srgb,#d97706 12%,var(--card))", border: "1px solid color-mix(in srgb,#d97706 40%,var(--line2))", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "var(--text)", lineHeight: 1.6 }}>
                    <b style={{ color: AMBER }}>⚠ 기계가독 스펙(OpenAPI/Swagger)이 없습니다.</b><br />
                    서버는 응답하지만(포트 {f.port} 정상), API 목차 역할을 하는 스펙 문서가 없어 API를 자동으로 추출할 수 없습니다. 엑셀 인터페이스정의서 등으로만 관리되는 시스템이라, 직접 입력으로 스펙을 보강해 등록하세요.
                    {canManual && <button onClick={(e) => { e.stopPropagation(); onManual(f, found.filter((x) => x.convertible && sel.has(key(x)))); }} style={{ display: "block", marginTop: 11, background: AMBER, color: "#fff", fontWeight: 700, fontSize: 12.5, border: "none", borderRadius: 9, padding: "9px 15px", cursor: "pointer" }}>직접 입력으로 등록 →</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 푸터 ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--main)", flexWrap: "wrap" }}>
        {submissionError && <div role="alert" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, color: "var(--red)", background: "var(--red-bg)", border: "1px solid #5f2120", fontSize: 12.5 }}>{submissionError}</div>}
        {canManual && <button onClick={onCancel} style={{ border: "1.5px solid var(--line2)", background: "transparent", color: "var(--muted)", borderRadius: 11, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>직접 입력으로</button>}
        {done && !cloudBusy && <button onClick={() => setNonce((n) => n + 1)} style={{ background: "var(--card)", border: "1px solid var(--line2)", color: "var(--navy)", borderRadius: 11, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>⟳ 재탐색</button>}
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {readyToPick && <><b style={{ color: "var(--navy)" }}>{convertibleN}</b>개 변환 가능 · 온프렘 {sel.size}개{cloud.length ? ` · 클라우드 ${cloudSel.size}개` : ""}{documents.length ? ` · 문서 ${documents.length}건 업로드 완료` : ""}{connectors.length ? ` · 커넥터 ${connectors.length}개` : ""}</>}
        </span>
        <button onClick={pick} disabled={submitting || !readyToPick || (!pickedN && !documents.length)}
          style={{ background: TEAL, color: "#fff", border: "none", borderRadius: 11, padding: "12px 20px", fontSize: 13.5, fontWeight: 700, cursor: !submitting && readyToPick && (pickedN || documents.length) ? "pointer" : "default", opacity: !submitting && readyToPick && (pickedN || documents.length) ? 1 : .45, boxShadow: !submitting && readyToPick && (pickedN || documents.length) ? "0 10px 22px -8px rgba(13,148,136,.5)" : "none" }}>
          {submitting ? "변환 시작 중…" : documents.length ? `선택 ${pickedN}개 · 문서 ${documents.length}건 담기 →` : `선택 ${pickedN}개 담기 →`}
        </button>
      </div>
    </div>
  );
}
