// 온보딩 위자드 v2 — 상단 스텝 · 전폭 · 복수 선택 · 작은 스텝.
//
// 기존 Onboarding.jsx 는 그대로 둔다(롤백 대비). App 이 어느 쪽을 띄울지만 고른다.
//
// 이전 위자드와 달라진 점 넷:
//   ① 좌측 180px 스텝 레일 제거 → 상단 가로. 본문 폭이 그만큼 넓어진다.
//   ② 큰 스텝 안을 작은 스텝으로 쪼갠다. 한 화면 한 질문이 원칙이다.
//   ③ 소스 종류가 복수 선택이다. 고른 개수만큼 입력 화면이 늘어난다(서브스텝 동적).
//   ④ 화면 문구에서 개발 용어를 뺀다(스키마→표 구조, 자격→접속 키 …).
//
// 소스 코드(사내 Git) 는 백엔드 수집기가 아직 없어 카드만 노출하고 고를 수 없다.
// 지금 실제로 도는 경로는 API 스펙 주소와 데이터베이스 둘이다.
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";
import { blank, toResource } from "../lib/manifestRows";
import { JOB_SOURCE, setJob } from "../jobStore";
import { dropDraft, newDraftId, readDraft, saveDraft, setActiveDraft } from "../onboardingDrafts";
import { Agent, Ask, Btn, Eq, Field, ICO, OkLine, Shell, SubDots } from "./onboarding/steps";
import { SOURCES, SelectionSummary, SourcePicker } from "./onboarding/sources";

const BIG = ["프로젝트", "연결", "확인", "도구 만들기", "완료"];

// 프로젝트 목록의 "진행중" 카드와 대시보드가 같은 라벨을 쓴다 — 두 벌로 관리하지 않는다.
// (구 Onboarding.jsx 가 같은 이름으로 내보내던 것을 여기로 옮겼다.)
export const STEPS = BIG.map((label) => ({ label }));

// 종류별 예상 도구 수 — 요약 바의 "~104" 를 만드는 대략값이다. 정확한 수는 읽어봐야 안다.
const EST = { code: 60, openapi: 20, db: 24 };

/** 선택한 종류 → 연결 단계의 작은 스텝 목록. 마지막은 항상 "함께 읽기". */
function buildSubSteps(selected) {
  const steps = [{ id: "pick", label: "무엇을 연결할까" }];
  selected.forEach((id) => {
    const s = SOURCES.find((x) => x.id === id);
    steps.push({ id: `in:${id}`, label: `${s.title} 입력` });
  });
  if (selected.length) steps.push({ id: "run", label: "함께 읽기" });
  return steps;
}

export default function OnboardingV2({ go, draftId, onClose }) {
  const { switchTo, refresh } = useProjects();
  const [did] = useState(() => draftId || newDraftId());
  const [snap] = useState(() => readDraft(did));

  const [big, setBig] = useState(snap?.big ?? 0);          // 큰 스텝 0~4
  const [subIdx, setSubIdx] = useState(snap?.subIdx ?? 0); // 연결 단계의 작은 스텝
  const [name, setName] = useState(snap?.name ?? "");
  const [desc, setDesc] = useState(snap?.desc ?? "");
  const [selected, setSelected] = useState(snap?.selected ?? []);
  const [openapi, setOpenapi] = useState(snap?.openapi ?? { name: "", url: "" });
  const [db, setDb] = useState(snap?.db ?? { name: "", driver: "postgres", hostDb: "", user: "", secret: "" });
  const [checked, setChecked] = useState(snap?.checked ?? {});   // {소스id: 확인 결과 문구}
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [pid, setPid] = useState(snap?.pid ?? null);
  const pidRef = useRef(snap?.pid ?? null);
  const doneRef = useRef(false);

  const subs = useMemo(() => buildSubSteps(selected), [selected]);
  const estimate = selected.reduce((n, id) => n + (EST[id] || 0), 0);

  // 진행분 저장 — 닫아도 프로젝트 목록의 "진행중" 카드로 이어진다.
  useEffect(() => {
    if (doneRef.current) return;
    if (big === 0 && !name.trim() && !selected.length) return;   // 열자마자 닫은 빈 위자드는 남기지 않는다
    // step 은 목록·대시보드의 "진행중" 카드가 읽는 키다. big 과 같은 값을 함께 저장해
    // 그 화면들을 건드리지 않고도 진행도가 맞게 보이도록 한다.
    saveDraft(did, { v2: true, big, step: big, subIdx, name, desc, selected, openapi, db, checked, pid });
  }, [did, big, subIdx, name, desc, selected, openapi, db, checked, pid]);

  const toggle = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSubIdx(0);   // 선택이 바뀌면 뒤 스텝 구성이 달라진다 — 첫 칸으로 되돌린다
  };

  // ── 연결 확인 ───────────────────────────────────────────
  // "저장됨" 이 아니라 실제로 한 번 다녀온다. 설정만 받아두면 변환 단계에서 터진다.
  const checkOpenapi = async () => {
    setErr(""); setBusy("openapi");
    try {
      const r = await api.scanOpenapi({ url: openapi.url, dry_run: true });
      const n = r?.discovered ?? r?.added?.length ?? 0;
      setChecked((c) => ({ ...c, openapi: `기능 ${n}개를 찾았습니다` }));
    } catch (e) {
      setErr(e.message || "주소를 확인하지 못했습니다");
    } finally { setBusy(""); }
  };

  const rows = () => {
    const out = [];
    if (selected.includes("openapi") && openapi.url) {
      out.push({ ...blank("openapi"), name: openapi.name || openapi.url, url: openapi.url });
    }
    if (selected.includes("db") && db.hostDb) {
      out.push({
        ...blank("db"), name: db.name || db.hostDb, driver: db.driver,
        dsn: db.hostDb, dbUser: db.user, dbSecret: db.secret,
      });
    }
    return out;
  };

  // ── 변환 시작 ───────────────────────────────────────────
  const start = async () => {
    setErr(""); setBusy("run");
    try {
      let projectId = pidRef.current;
      if (!projectId) {
        const p = await api.createProject({ name: name.trim(), description: desc });
        projectId = p.id; pidRef.current = projectId; setPid(projectId);
      }
      const manifest = { project: name.trim(), resources: rows().map(toResource) };
      const { jobId } = await api.manifestApply(manifest, projectId);
      doneRef.current = true;
      dropDraft(did); setActiveDraft(null);
      setJob(projectId, jobId, JOB_SOURCE.ONBOARDING);
      setBig(3);
    } catch (e) {
      setErr(e.message || "시작하지 못했습니다");
    } finally { setBusy(""); }
  };

  const enter = async () => {
    try { await refresh(); } catch { /* 목록 갱신 실패해도 진입은 진행 */ }
    if (pidRef.current) switchTo(pidRef.current);
    go("dashboard");
    onClose?.();
  };

  // ── 현재 화면 결정 ─────────────────────────────────────
  const cur = subs[Math.min(subIdx, subs.length - 1)];
  const canNext = big === 0 ? !!name.trim()
    : big === 1 && cur.id === "pick" ? selected.length > 0
      : true;

  const goNext = () => {
    setErr("");
    if (big === 0) return setBig(1);
    if (big === 1) {
      if (subIdx < subs.length - 2) return setSubIdx(subIdx + 1);
      return start();                       // 마지막 입력 뒤 = 함께 읽기
    }
    if (big === 3) return setBig(4);
  };
  const goPrev = () => {
    setErr("");
    if (big === 1 && subIdx > 0) return setSubIdx(subIdx - 1);
    if (big > 0) return setBig(big - 1);
  };

  // ── 렌더 조각 ──────────────────────────────────────────
  const subBar = (
    <>
      <SubDots
        index={big === 0 ? 0 : subIdx}
        total={big === 0 ? 1 : Math.max(subs.length, 1)}
        pending={big === 1 && !selected.length ? 2 : 0}
        label={big === 0 ? "프로젝트 · 1 / 1"
          : `연결 · ${subIdx + 1} / ${subs.length}${cur ? ` — ${cur.label}` : ""}`}
      />
      <span style={{ flex: 1 }} />
      <span className="mono" style={{
        fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
        background: "var(--blue-bg)", color: "var(--blue)",
        border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
      }}>외부와 완전히 차단됨</span>
    </>
  );

  const footer = (
    <>
      <Btn kind="ghost" onClick={goPrev} style={{ visibility: big === 0 && subIdx === 0 ? "hidden" : "visible" }}>← 이전</Btn>
      {err
        ? <span style={{ fontSize: 12, color: "var(--red)" }}>⚠ {err}</span>
        : <span style={{ fontSize: 12, color: "var(--muted)" }}>{footHint(big, cur, selected)}</span>}
      <span style={{ flex: 1 }} />
      {big === 4
        ? <Btn onClick={enter}>플랫폼 들어가기 →</Btn>
        : big === 3
          ? <Btn onClick={() => setBig(4)}>결과 보기 →</Btn>
          : <Btn onClick={goNext} disabled={!canNext || !!busy}>{nextLabel(big, cur, subs, selected, busy)}</Btn>}
    </>
  );

  return (
    <Shell steps={BIG} step={big} sub={subBar} footer={footer} onClose={onClose}
      agent={<AgentFor big={big} cur={cur} selected={selected} checked={checked} name={name} />}>
      {big === 0 && (
        <>
          <Ask q="이 환경을 뭐라고 부를까요?"
            why={<>연결한 시스템과 만들어진 도구가 이 이름 아래 모입니다. 나중에 바꿀 수 있습니다.</>} />
          <div style={{ maxWidth: 720 }}>
            <Field label="프로젝트 이름" value={name} onChange={setName} mono={false}
              placeholder="예) 계약 시스템" />
            <Field label="설명" hint="건너뛰어도 됩니다" value={desc} onChange={setDesc} mono={false}
              placeholder="예) 계약·고객 조회를 담당하는 사내 시스템" />
          </div>
        </>
      )}

      {big === 1 && cur.id === "pick" && (
        <>
          <Ask q="무엇을 연결할까요?"
            why={<>기존 시스템을 읽어서 <b style={{ color: "var(--navy)" }}>AI 가 쓸 수 있는 도구</b>로 바꿉니다.
              이 서버와 같은 사내망에 있는 것만 연결됩니다.</>}
            badge={
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "5px 12px",
                borderRadius: 999, background: "var(--purple-bg)",
                border: "1px solid color-mix(in srgb,var(--purple) 32%,transparent)",
                color: "var(--purple)", fontSize: 11.5, fontWeight: 700,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                여러 개를 함께 고를 수 있습니다 — 한 번에 진행됩니다
              </span>
            } />
          <SourcePicker selected={selected} onToggle={toggle} />
          <SelectionSummary selected={selected} onRemove={toggle} estimate={estimate || null} />
        </>
      )}

      {big === 1 && cur.id === "in:openapi" && (
        <>
          <Ask q="API 주소를 알려주세요"
            why={<>API 설명서(Swagger)가 열려 있는 주소입니다. 그 안의 기능들이 도구로 바뀝니다.</>} />
          <Queue subs={subs} subIdx={subIdx} checked={checked} />
          <div style={{ maxWidth: 760, marginTop: 22 }}>
            <Field label="API 설명서 주소" value={openapi.url}
              onChange={(v) => setOpenapi({ ...openapi, url: v })}
              placeholder="http://contract-api.local:8080/openapi.json"
              help={<>보통 <b>/openapi.json</b> 또는 <b>/v3/api-docs</b> 로 끝납니다.</>} />
            <Field label="이 시스템을 뭐라고 부를까요" hint="비워두면 주소를 씁니다" mono={false}
              value={openapi.name} onChange={(v) => setOpenapi({ ...openapi, name: v })}
              placeholder="예) 계약 서비스" />
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <Btn kind="ghost" onClick={checkOpenapi} disabled={!openapi.url || busy === "openapi"}>
                {busy === "openapi" ? "확인하는 중…" : "연결 확인"}
              </Btn>
              {busy === "openapi" && <Eq />}
            </div>
            {checked.openapi && <OkLine>{checked.openapi}</OkLine>}
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:db" && (
        <>
          <Ask q="데이터베이스에 어떻게 접속하나요?"
            why={<>표 구조를 읽어 조회 도구를 만듭니다. <b style={{ color: "var(--navy)" }}>데이터를 꺼내 보지는 않습니다.</b></>} />
          <Queue subs={subs} subIdx={subIdx} checked={checked} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 26px", maxWidth: 940, marginTop: 22 }}>
            <Field label="데이터베이스 주소" value={db.hostDb} onChange={(v) => setDb({ ...db, hostDb: v })}
              placeholder="postgres.local:5432/contract_db"
              help="인프라 팀에서 알려줄 수 있습니다." />
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12.5, color: "var(--text)", marginBottom: 7, fontWeight: 650 }}>
                종류
              </label>
              <select value={db.driver} onChange={(e) => setDb({ ...db, driver: e.target.value })} style={{
                background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 11,
                padding: "12px 15px", fontSize: 13.5, color: "var(--navy)", width: "100%",
                fontFamily: "var(--sans)", outline: "none",
              }}>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL / MariaDB</option>
                <option value="oracle">Oracle</option>
                <option value="mssql">SQL Server</option>
              </select>
            </div>
            <Field label="접속 계정" hint="읽기 권한만 있으면 됩니다" value={db.user}
              onChange={(v) => setDb({ ...db, user: v })} placeholder="emberlink_reader" />
            <Field label="비밀번호" hint="이름만 적습니다" value={db.secret}
              onChange={(v) => setDb({ ...db, secret: v })} placeholder="${vault:db#password}"
              help={<><b style={{ color: "var(--text)" }}>비밀번호를 직접 적지 않습니다.</b> 이 서버에 보관된 값의 이름만 적으면, 쓸 때만 꺼내 씁니다.</>} />
          </div>
        </>
      )}

      {big === 1 && cur.id === "run" && (
        <>
          <Ask q="다 넣으셨습니다" why={<>고르신 {selected.length}가지를 한 번에 읽고 도구로 바꿉니다.</>} />
          <Queue subs={subs} subIdx={subs.length - 1} checked={checked} />
        </>
      )}

      {big === 3 && (
        <>
          <Ask q="도구를 만들고 있습니다"
            why={<>창을 닫아도 계속됩니다. 우측 위 알림에서 이어서 볼 수 있습니다.</>} />
          <div style={{ display: "flex", alignItems: "center", gap: 14, maxWidth: 760, padding: "16px 20px",
            borderRadius: 14, background: "var(--card)", border: "1px solid var(--line2)" }}>
            <Eq />
            <span style={{ fontSize: 13.5 }}>읽은 내용을 도구로 바꾸는 중입니다</span>
          </div>
        </>
      )}

      {big === 4 && (
        <>
          <Ask q="준비됐습니다" why={<>{name} 환경이 만들어졌습니다. 지금부터 도구를 쓰거나 더 연결할 수 있습니다.</>} />
          <OkLine>도구 목록은 <b>MCP Explorer</b> 에서 확인할 수 있습니다.</OkLine>
        </>
      )}
    </Shell>
  );
}

/** 입력 큐 — 복수 선택의 가장 흔한 실패가 "지금 몇 번째지" 다. */
function Queue({ subs, subIdx, checked }) {
  const items = subs.filter((s) => s.id.startsWith("in:"));
  if (items.length < 2) return null;   // 하나뿐이면 큐가 정보를 더하지 않는다
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 1140 }}>
      {items.map((s) => {
        const i = subs.indexOf(s);
        const state = i < subIdx ? "done" : i === subIdx ? "now" : "todo";
        const sid = s.id.slice(3);
        return (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 14,
            border: `1px solid ${state === "now" ? "var(--sel-border)" : state === "done" ? "#1c4a30" : "var(--line2)"}`,
            background: state === "now" ? "var(--sel)" : "var(--card)",
            opacity: state === "todo" ? 0.55 : 1,
            boxShadow: state === "now" ? "var(--sel-ring)" : "none",
          }}>
            <span style={{
              width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center",
              background: state === "done" ? "var(--green)" : state === "now" ? "var(--blue)" : "var(--main)",
              border: `1px solid ${state === "todo" ? "var(--line2)" : "transparent"}`,
            }}>
              {state === "done" && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 750, color: "var(--navy)" }}>{s.label}</span>
              <span style={{ display: "block", fontSize: 11.8, color: "var(--muted)", marginTop: 2 }}>
                {checked[sid] || (state === "now" ? "지금 입력하는 중" : state === "done" ? "입력함" : "다음에 입력")}
              </span>
            </span>
            {state === "now" && <Eq />}
          </div>
        );
      })}
    </div>
  );
}

function AgentFor({ big, cur, selected, checked, name }) {
  if (big === 0) {
    return <Agent headline="이름부터 정하고 시작합니다"
      facts={[
        { icon: ICO.ok, text: <>연결한 시스템과 도구가 <b>이 이름 아래</b> 모입니다</> },
        { icon: ICO.info, text: <>나중에 언제든 바꿀 수 있습니다</> },
      ]}
      note="프로젝트를 여러 개 만들어 시스템별로 나눠 담아도 됩니다." />;
  }
  if (big === 1 && cur?.id === "pick") {
    return <Agent headline={selected.length > 1 ? `${selected.length}가지를 함께 읽습니다` : "여러 개를 함께 고를 수 있습니다"}
      facts={[
        { icon: ICO.ok, text: <>각각 주소를 넣은 뒤 <b>한 번에 진행</b>됩니다</> },
        { icon: ICO.ok, text: <>겹치는 도구는 <b>자동으로 합쳐집니다</b></> },
        selected.length
          ? { icon: ICO.info, text: <>입력 화면이 <b>{selected.length}개</b> 이어집니다</> }
          : { icon: ICO.info, text: <>하나 이상 골라야 다음으로 갑니다</> },
      ]}
      note="소스 코드 읽기는 준비 중입니다. 지금은 API 주소와 데이터베이스를 연결할 수 있습니다." />;
  }
  if (big === 1 && cur?.id === "in:openapi") {
    return <Agent status="입력 대기" headline="주소만 있으면 됩니다"
      facts={[
        { icon: ICO.ok, text: <>설명서에 적힌 기능이 <b>그대로 도구</b>가 됩니다</> },
        { icon: ICO.info, text: <>[연결 확인] 을 누르면 <b>실제로 한 번 다녀옵니다</b></> },
      ]}
      note="확인하지 않고 넘어가도 됩니다. 다만 잘못된 주소는 만드는 단계에서 실패합니다." />;
  }
  if (big === 1 && cur?.id === "in:db") {
    return <Agent status="입력 대기" headline="표 구조만 읽습니다"
      facts={[
        { icon: ICO.ok, text: <><b>읽기 권한</b>만 있으면 됩니다</> },
        { icon: ICO.no, text: <>데이터를 꺼내 보지 <b>않습니다</b></> },
        { icon: ICO.info, text: <>비밀번호는 <b>이름만</b> 저장합니다</> },
      ]}
      note="표 이름과 칸 구조만 확인해 조회 도구를 만듭니다." />;
  }
  if (big === 1 && cur?.id === "run") {
    return <Agent status="준비됨" headline="이제 읽기 시작합니다"
      facts={[
        { icon: ICO.ok, text: <>고르신 <b>{selected.length}가지</b>를 동시에 읽습니다</> },
        { icon: ICO.no, text: <>데이터를 <b>바꾸는 기능</b>은 자동으로 뺍니다</> },
      ]}
      note="잘못 불리면 되돌릴 수 없는 기능이라 자동으로 만들지 않습니다." />;
  }
  if (big === 3) {
    return <Agent status="진행 중" headline="도구를 만들고 있습니다"
      facts={[{ icon: ICO.info, text: <>창을 닫아도 <b>계속됩니다</b></> }]}
      note="우측 위 알림에서 진행 상황을 이어서 볼 수 있습니다." />;
  }
  return <Agent status="완료" headline={`${name || "새 환경"} 준비 완료`}
    facts={[
      { icon: ICO.ok, text: <>도구는 <b>MCP Explorer</b> 에서 볼 수 있습니다</> },
      { icon: ICO.info, text: <>더 연결하려면 <b>Data Resource</b> 화면에서 추가합니다</> },
    ]} />;
}

function footHint(big, cur, selected) {
  if (big === 0) return "이름만 정하면 다음으로 갈 수 있습니다";
  if (big === 1 && cur?.id === "pick") return selected.length ? "나중에 다른 것도 추가할 수 있습니다" : "하나 이상 골라주세요";
  if (big === 1 && cur?.id === "run") return "창을 닫아도 계속 진행됩니다";
  if (big === 1) return "확인하지 않고 넘어가도 됩니다";
  return "";
}

function nextLabel(big, cur, subs, selected, busy) {
  if (busy === "run") return "시작하는 중…";
  if (big === 0) return "다음 →";
  if (cur?.id === "pick") return selected.length ? `${selected.length}가지 연결하기 →` : "다음 →";
  const isLastInput = subs.indexOf(cur) === subs.length - 2;
  if (isLastInput) return `${selected.length}가지 함께 읽기 →`;
  const next = subs[subs.indexOf(cur) + 1];
  return next ? `다음 → ${next.label}` : "다음 →";
}
