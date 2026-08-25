import { useEffect, useRef, useState } from "react";
import { api, JOB_EVENT } from "../api";
import { useProjects } from "../ProjectContext";
import { JOB_SOURCE, setJob } from "../jobStore";
import { readDraft, saveDraft, dropDraft, newDraftId, setActiveDraft } from "../onboardingDrafts";
import { startPipelineJobs } from "../pipelineJobStore";
import { blank, toResource } from "../lib/manifestRows.jsx";
import { createOnboardingRagExecution } from "../lib/onboardingRag";
import ConversionMonitor from "../components/ConversionMonitor";
import DiscoveryScan from "../components/DiscoveryScan";
import CloudConnect from "../components/CloudConnect";

// ─── 로컬 디자인 토큰 (딥 네이비 레일 + teal 프라이머리 — 모달 전체 다크 고정)
// 앱 CSS 변수가 --blue:#00b5a6 이므로 탭·레일만 로컬 상수로 보정
const NAVY = "#141d33";
const PRI = "#0d9488";       // solid teal (버튼)
const PRI_HI = "#2dd4bf";    // 다크 배경 위 teal 강조 텍스트·아이콘
const PRI_SOFT = "#0d2b28";  // teal 소프트 배경 (다크)
const PRI_LINE = "#1d4a45";  // teal 계열 보더 (다크)
// 문서 칸 강조색 — 클라우드(#4aa3ff)·호스트(#f5a524)와 한눈에 구분되는 계열로 둔다
const DOC = "#a78bfa";

// ─── 공용 입력 스타일
const lab = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  color: "var(--text)",
  marginBottom: 6,
  display: "block",
  letterSpacing: ".03em",
  textTransform: "uppercase",
};
const inp = {
  width: "100%",
  border: "1px solid var(--line2)",
  borderRadius: 10,
  padding: "10px 13px",
  fontSize: 12.5,
  fontFamily: "var(--sans)",
  color: "var(--navy)",
  background: "var(--main)",
  outline: "none",
  boxSizing: "border-box",
};

// ─── 5단계 스텝 정의 (인덱스 0~4)
// 프로젝트 목록의 "온보딩 진행중" 카드가 같은 라벨을 쓴다 — 라벨을 두 벌 관리하지 않는다.
export const STEPS = [
  { label: "프로젝트 정보", desc: "환경 이름 정하기" },
  { label: "레거시 위치", desc: "리소스가 어디 있는지" },
  { label: "레거시 소스 등록", desc: "API·문서·코드·DB 담기" },
  { label: "변환 진행", desc: "소스별 자동 변환" },
  { label: "플랫폼 입장", desc: "완성된 환경으로" },
];

// climax-rag DynamicMainInput 조합: method(rag|graphrag) × terms(false|true)
const PIPELINE_OPTIONS = [
  { id: "rag-ai-search", label: "RAG → AI Search", source: "RAG", target: "Azure AI Search", desc: "청크·임베딩을 검색 인덱스로 적재" },
  { id: "rag-graphrag", label: "RAG → GraphRAG", source: "RAG", target: "GraphRAG", desc: "문서에서 엔티티·관계 그래프 구성" },
  { id: "terms-ai-search", label: "Terms → AI Search", source: "Terms", target: "Azure AI Search", desc: "용어·정의 데이터를 검색 인덱스로 적재" },
  { id: "terms-graphrag", label: "Terms → GraphRAG", source: "Terms", target: "GraphRAG", desc: "용어 간 의미 관계 그래프 구성" },
];

// ─── 레거시 위치 → 뒷단 수집 transport 분기. defMode = 소스등록 스텝의 기본 입력모드.
const LOCS = [
  { id: "internal", accent: "#0d9488", defMode: "discover", titleKo: "같은 내부망", subKo: "바로 닿는 곳", descKo: "사내 Git·API 서버가 같은 네트워크 안. 직접 clone·fetch.", transKo: "직접 접근 · 인증 최소",
    illust: (<g><rect x="52" y="34" width="96" height="82" rx="8" fill="var(--card)" stroke="#0d9488" strokeWidth="2.5"/><path d="M52 52H148" stroke="#0d9488" strokeWidth="2" opacity=".4"/><circle cx="63" cy="43" r="2.4" fill="#0d9488"/><circle cx="72" cy="43" r="2.4" fill="#0d9488" opacity=".5"/><rect x="66" y="62" width="68" height="14" rx="3" fill="color-mix(in srgb,#0d9488 18%,var(--card))" stroke="#0d9488" strokeWidth="1.6"/><rect x="66" y="82" width="68" height="14" rx="3" fill="color-mix(in srgb,#0d9488 18%,var(--card))" stroke="#0d9488" strokeWidth="1.6"/><circle cx="74" cy="69" r="2.2" fill="#0d9488"/><circle cx="74" cy="89" r="2.2" fill="#0d9488"/><path d="M100 116V132" stroke="#0d9488" strokeWidth="2" strokeDasharray="3 3"/><circle cx="100" cy="134" r="6" fill="#0d9488"/><path d="M97 134l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></g>) },
  { id: "closed", accent: "#ef5350", defMode: "discover", roadmap: true, titleKo: "분리 폐쇄망", subKo: "망분리 · 반입", descKo: "네트워크 차단 구역. 공유 반입 경로 또는 스펙 붙여넣기로 수집.", transKo: "공유 FS 경로 반입",
    illust: (<g><rect x="30" y="48" width="54" height="54" rx="7" fill="var(--card)" stroke="#ef5350" strokeWidth="2.5"/><rect x="42" y="62" width="30" height="9" rx="2" fill="color-mix(in srgb,#ef5350 16%,var(--card))" stroke="#ef5350" strokeWidth="1.4"/><rect x="42" y="78" width="30" height="9" rx="2" fill="color-mix(in srgb,#ef5350 16%,var(--card))" stroke="#ef5350" strokeWidth="1.4"/><path d="M100 34V116" stroke="#ef5350" strokeWidth="2.5" strokeDasharray="5 5"/><rect x="116" y="48" width="54" height="54" rx="7" fill="var(--card)" stroke="#9aa3bd" strokeWidth="2.5"/><path d="M143 60v20M133 70h20" stroke="#9aa3bd" strokeWidth="2" strokeLinecap="round"/><rect x="90" y="66" width="20" height="16" rx="3" fill="var(--card)" stroke="#ef5350" strokeWidth="2"/><path d="M92 66v-4a4 4 0 0 1 8 0v4" stroke="#ef5350" strokeWidth="2" fill="none"/></g>) },
  { id: "cloud", accent: "#1faf6b", defMode: "discover", titleKo: "클라우드", subKo: "Azure · AWS 등", descKo: "공인 엔드포인트의 API·리소스. 클라우드 인증으로 접근.", transKo: "원격 fetch + 인증",
    illust: (<g><path d="M64 84a20 20 0 0 1 3-39 26 26 0 0 1 49-6 19 19 0 0 1 20 45Z" fill="var(--card)" stroke="#1faf6b" strokeWidth="2.5"/><rect x="80" y="60" width="18" height="16" rx="2.5" fill="color-mix(in srgb,#1faf6b 16%,var(--card))" stroke="#1faf6b" strokeWidth="1.6"/><rect x="103" y="60" width="18" height="16" rx="2.5" fill="color-mix(in srgb,#1faf6b 16%,var(--card))" stroke="#1faf6b" strokeWidth="1.6"/><path d="M100 90V128" stroke="#1faf6b" strokeWidth="2" strokeDasharray="3 4"/><circle cx="100" cy="90" r="3" fill="#1faf6b"/><path d="M100 118l-8 10m8-10l8 10" stroke="#1faf6b" strokeWidth="2"/><circle cx="92" cy="132" r="3.4" fill="var(--card)" stroke="#1faf6b" strokeWidth="1.8"/><circle cx="108" cy="132" r="3.4" fill="var(--card)" stroke="#1faf6b" strokeWidth="1.8"/></g>) },
  { id: "hybrid", accent: "#7a5cff", defMode: "discover", titleKo: "클라우드 + 온프레미스", subKo: "하이브리드 환경", descKo: "리소스마다 위치가 다름. 각 리소스에 맞는 경로로 나눠 수집.", transKo: "리소스별 경로 분기",
    illust: (<g><rect x="30" y="72" width="46" height="44" rx="6" fill="var(--card)" stroke="#7a5cff" strokeWidth="2.5"/><rect x="40" y="84" width="26" height="8" rx="2" fill="color-mix(in srgb,#7a5cff 16%,var(--card))" stroke="#7a5cff" strokeWidth="1.3"/><rect x="40" y="98" width="26" height="8" rx="2" fill="color-mix(in srgb,#7a5cff 16%,var(--card))" stroke="#7a5cff" strokeWidth="1.3"/><path d="M128 60a15 15 0 0 1 2-29 19 19 0 0 1 36-4 14 14 0 0 1 14 33Z" fill="var(--card)" stroke="#7a5cff" strokeWidth="2.5"/><path d="M76 92C100 92 108 52 150 52" stroke="#7a5cff" strokeWidth="2.5" strokeDasharray="5 4"/><circle cx="76" cy="92" r="3.4" fill="#7a5cff"/><circle cx="150" cy="52" r="3.4" fill="#7a5cff"/><circle cx="113" cy="72" r="8" fill="#7a5cff"/><path d="M110 72l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></g>) },
];

// DB 행은 host 칸에 포트를 같이 적을 수 있다 — 안 적었을 때 붙일 드라이버별 기본 포트.
const DB_PORT = { postgres: 5432, mysql: 3306, oracle: 1521, mssql: 1433, mongo: 27017 };

// ─── 위자드 진행상태는 draft 로 보관 (onboardingDrafts.js)
// SSO 로그인은 redirectUri 가 앱 origin 이라 팝업이 메인 창까지 리로드시킨다. 그 순간
// 모달 state(step·입력값)가 통째로 날아가 대시보드로 튕겼다(#71).
// 예전엔 sessionStorage 단일 스냅샷이라 (1) 모달을 닫으면 진행분이 삭제됐고
// (2) 동시에 하나만 진행할 수 있었다. 이제 localStorage 에 draft 를 여러 벌 쌓아
// 나갔다 와도 프로젝트 목록의 "진행중" 카드로 이어서 진행한다.

// ─── 아이콘 헬퍼
const CheckIco = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);
const ArrowIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);
const InboxIco = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-6l-2 3h-4l-2-3H2"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
  </svg>
);
 const SparkIco = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>
  </svg>
);
 // ─── 문서 디렉토리 수집 모달 (좌: 디렉토리 로드/선택 ↔ 우: 담은 바구니, 반복 담기)
// 데모: 경로별 목업 파일 목록. 실제 구현 시 /api/scan/docs?dir= 로 교체.
const DOC_MOCK = {
  "/mnt/legacy/docs/약관": [
    { name: "약관_운전자보험_표지.png", type: "PNG", meta: "대상 아님", ok: false },
    { name: "약관_실손의료_표지.png", type: "PNG", meta: "대상 아님", ok: false },
    { name: "개인용공동물건_자동차보험.pdf", type: "PDF", meta: "100p", ok: true, blob_url: "/api/rag-data/pdf/personal-common-auto-insurance.pdf" },
    { name: "약관_구버전_표지.png", type: "PNG", meta: "대상 아님", ok: false },
    { name: "표지_스캔.png", type: "PNG", meta: "대상 아님", ok: false },
  ],
  "/mnt/legacy/docs/지침": [
    { name: "인수지침_2024.pdf", type: "PDF", meta: "22p", ok: true },
    { name: "담보코드_정의서.xlsx", type: "XLSX", meta: "6시트", ok: true },
    { name: "상품설명서_실손.docx", type: "DOCX", meta: "890KB", ok: true },
  ],
};

// 커넥터는 화면 검증용 목업. 실제 인증·동기화는 붙이지 않고 선택 상태만 표시한다.
const CONNECTOR_MOCK = [
  { id: "sharepoint", name: "SharePoint", desc: "사이트 · 문서 라이브러리", mark: "SP", color: "#4c8bf5" },
  { id: "fileserver", name: "파일서버", desc: "SMB · NFS 공유 폴더", mark: "FS", color: "#f5a524" },
  { id: "confluence", name: "Confluence", desc: "스페이스 · 페이지", mark: "CF", color: "#579dff" },
  { id: "googledrive", name: "Google Drive", desc: "공유 드라이브 · 문서", mark: "GD", color: "#34a853" },
];

function ConnectorMock({ selected = [], onToggle }) {
  return (
    <div style={{ marginTop: 12, border: "1px solid rgba(167,139,250,.42)", borderRadius: 14, padding: "14px 16px", background: "rgba(167,139,250,.045)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(167,139,250,.16)", color: DOC }}>DATA CONNECT</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>커넥터로 연결</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: selected.length ? DOC : "var(--muted)" }}>{selected.length}개 선택</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginBottom: 9 }}>SharePoint·파일서버·Confluence·Drive의 문서를 한 번에 연결합니다.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
        {CONNECTOR_MOCK.map((connector) => {
          const on = selected.includes(connector.id);
          return (
            <button key={connector.id} type="button" aria-pressed={on} onClick={() => onToggle(connector.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: "8px 9px", border: `1px solid ${on ? connector.color : "var(--line2)"}`, borderRadius: 9, background: on ? `color-mix(in srgb,${connector.color} 11%,var(--card))` : "var(--main)", color: "var(--navy)", textAlign: "left", cursor: "pointer" }}>
              <span style={{ width: 26, height: 26, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 7, background: `color-mix(in srgb,${connector.color} 18%,var(--card))`, color: connector.color, fontFamily: "var(--mono)", fontSize: 9, fontWeight: 800 }}>{connector.mark}</span>
              <span style={{ minWidth: 0, overflow: "hidden" }}><b style={{ display: "block", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{connector.name}</b><small style={{ display: "block", marginTop: 2, color: "var(--muted)", fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{connector.desc}</small></span>
              <span style={{ marginLeft: "auto", color: on ? connector.color : "var(--faint)", fontSize: 13, lineHeight: 1 }}>{on ? "✓" : "+"}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, color: "var(--faint)", fontSize: 10 }}>연결 준비 화면 · 계정 인증과 파일 동기화는 다음 단계에서 연결합니다.</div>
    </div>
  );
}

function DocCollect({ onClose, onConfirm }) {
  const [dir, setDir] = useState("/mnt/legacy/docs/약관");
  const [loadedDir, setLoadedDir] = useState("/mnt/legacy/docs/약관");
  const [sel, setSel] = useState(() => new Set());   // 좌측 현재 목록에서 체크된 파일명
  const [basket, setBasket] = useState([]);          // [{dir, name, type}]
  const files = DOC_MOCK[loadedDir] || [];
  const load = () => { setLoadedDir(dir); setSel(new Set()); };
  const toggle = (n) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const addFiles = (picked) => {
    const add = picked.filter((f) => f.ok).map((f) => ({ ...f, dir: loadedDir }));
    setBasket((b) => {
      const key = (x) => x.dir + "/" + x.name;
      const known = new Set(b.map(key));
      return [...b, ...add.filter((x) => !known.has(key(x)))];
    });
    setSel(new Set());
  };
  const addSel = () => addFiles(files.filter((f) => sel.has(f.name)));
  const addAll = () => addFiles(files);
  const rmBasket = (i) => setBasket((b) => b.filter((_, idx) => idx !== i));
  // 바구니를 디렉토리별로 그룹
  const groups = basket.reduce((acc, it) => { (acc[it.dir] ||= []).push(it); return acc; }, {});
  const ftBg = (t) => ({ PDF: "rgba(91,157,255,.15)", XLSX: "rgba(63,206,154,.15)", DOCX: "rgba(124,140,255,.15)" }[t] || "var(--main)");
  const ftFg = (t) => ({ PDF: "#5b9dff", XLSX: "#3fce9a", DOCX: "#a78bfa" }[t] || "var(--muted)");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(4,6,12,.66)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 820, background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 40px 90px rgba(0,0,0,.55)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", margin: 0 }}>문서 디렉토리에서 불러오기</h3>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>폴더를 바꿔가며 반복해서 담을 수 있어요</span>
          <button onClick={onClose} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {/* 좌: 디렉토리 로드/선택 */}
          <div style={{ borderRight: "1px solid var(--line)", padding: "16px 18px" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={dir} onChange={(e) => setDir(e.target.value)} style={{ ...inp, fontFamily: "var(--mono)", flex: 1 }} placeholder="/mnt/legacy/docs" />
              <button onClick={load} style={{ border: `1px solid ${PRI_LINE}`, background: PRI_SOFT, color: PRI_HI, borderRadius: 9, padding: "0 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>불러오기</button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>현재: <span style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>{loadedDir}</span></div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {files.map((f) => (
                <div key={f.name} onClick={() => f.ok && toggle(f.name)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, fontSize: 12, opacity: f.ok ? 1 : 0.5, cursor: f.ok ? "pointer" : "default" }}>
                  <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${sel.has(f.name) ? PRI : "var(--line2)"}`, background: sel.has(f.name) ? PRI : "transparent", display: "grid", placeItems: "center", color: "#fff", fontSize: 10, fontWeight: 800, flex: "none" }}>{sel.has(f.name) ? "✓" : ""}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: ftBg(f.type), color: ftFg(f.type) }}>{f.type}</span>
                  <span style={{ color: "var(--navy)", fontWeight: 600 }}>{f.name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>{f.meta}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={addAll} disabled={!files.some((f) => f.ok)} style={{ flex: 1, padding: 9, borderRadius: 9, border: `1px solid ${PRI_LINE}`, background: PRI_SOFT, color: PRI_HI, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>현재 폴더 전체 담기</button>
              <button onClick={addSel} disabled={!sel.size} style={{ flex: 1, padding: 9, borderRadius: 9, border: `1px solid ${PRI_LINE}`, background: sel.size ? PRI_SOFT : "var(--card)", color: sel.size ? PRI_HI : "var(--muted)", fontSize: 11.5, fontWeight: 700, cursor: sel.size ? "pointer" : "not-allowed" }}>선택 파일만 담기</button>
            </div>
          </div>
          {/* 우: 담은 바구니 */}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>담은 문서<span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10, color: PRI_HI }}>{basket.length}개</span></div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {basket.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 11.5, padding: "40px 10px", lineHeight: 1.6 }}>왼쪽에서 문서를 골라<br/>여기에 담으세요</div>
              ) : Object.entries(groups).map(([g, items]) => (
                <div key={g}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--faint)", margin: "8px 0 4px" }}>{g}</div>
                  {items.map((it) => {
                    const gi = basket.indexOf(it);
                    return (
                      <div key={it.name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, fontSize: 11.5, background: "var(--card)", marginBottom: 5 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: ftBg(it.type), color: ftFg(it.type) }}>{it.type}</span>
                        <span style={{ color: "var(--navy)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                        <button onClick={() => rmBasket(gi)} style={{ marginLeft: "auto", width: 22, height: 22, borderRadius: 7, border: "1px solid var(--line2)", background: "var(--card2)", color: "var(--muted)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 11, padding: "14px 20px", borderTop: "1px solid var(--line)" }}>
          <button onClick={onClose} style={{ padding: "12px 20px", borderRadius: 11, background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>취소</button>
          <button onClick={() => { onConfirm(basket); onClose(); }} disabled={!basket.length}
            style={{ flex: 1, padding: 12, borderRadius: 11, background: basket.length ? PRI : "var(--muted)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13.5, cursor: basket.length ? "pointer" : "not-allowed" }}>
            선택한 {basket.length}개 문서 담기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 닫기(X) 버튼 아이콘
const CloseIco = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

// ─── 메인 컴포넌트
// onClose: 모달을 닫는 콜백 — App에서 주입, 이전엔 없었으나 모달 전환으로 필수화
export default function Onboarding({ t, lang, go, onClose, draftId }) {
  const { switchTo, refresh } = useProjects();

  // 이 위자드 인스턴스가 쓰는 draft. App 이 넘겨주면(목록의 "진행중" 카드 클릭·SSO 리로드)
  // 그 진행분을 이어받고, 없으면 새 draft 를 판다.
  const [did] = useState(() => draftId || newDraftId());
  // 마운트 시 1회만 로드 — 이어서 진행/SSO 팝업 리로드인 경우에만 값이 들어있다.
  const [snap] = useState(() => readDraft(did));
  // loc 는 illust(JSX)를 품고 있어 직렬화 불가 — id 만 저장하고 LOCS 에서 되찾는다.
  const [loc, setLoc] = useState(() => LOCS.find((l) => l.id === snap?.locId) ?? null); // STEP1: 레거시 위치. 선택만, 입력은 다음 스텝.

  // 폼 상태
  const [name, setName] = useState(snap?.name ?? "");
  const [desc, setDesc] = useState(snap?.desc ?? "");
  const [rows, setRows] = useState(snap?.rows ?? []);
  const [connectorIds, setConnectorIds] = useState(snap?.connectorIds ?? []); // 화면 검증용 mock 선택 상태
  const [appMode, setAppMode] = useState(null);
  const localDocInputRef = useRef(null);
  // 소스등록 스텝 내부 서브스텝: gate(자동탐색 시작 게이트) → scan(탐색·결과)
  const [srcSub, setSrcSub] = useState(snap?.srcSub === "scan" ? "scan" : "gate");
  // 온프렘 탐색 대상 — API 서버(호스트+포트) / DB(드라이버+host:port+db) 를 여러 개 등록.
  // 여기 적힌 대상'만' 실제로 확인한다(대역 스캔 아님). 시연에서 한 자씩 칠 시간이
  // 없어 레거시 3종을 미리 채워둔다 — 지우거나 고치면 그대로 탐색 범위에 반영된다.
  // 호스트는 서버가 정한다(APIMCP_DISCOVERY_BASE) — 아래 값은 응답 전까지의 자리표시자다.
  // 프론트에 폐쇄망 주소를 박아두면 로컬에서 레거시 시뮬레이터를 띄워도 그쪽만 찔러 '발견 0' 이 된다.
  const [onpremTargets, setOnpremTargets] = useState(snap?.onpremTargets ?? [
    { type: "api", host: "10.60.1.10", port: "8001" },
    { type: "api", host: "10.60.1.10", port: "8002" },
    { type: "api", host: "10.60.1.10", port: "8003" },
  ]);
  useEffect(() => {
    api.runtime().then((value) => setAppMode(value.app_mode)).catch(() => setAppMode("local"));
  }, []);
  // 사용자가 아직 손대지 않은 기본 3종일 때만 서버 기본값으로 교체한다.
  useEffect(() => {
    if (snap?.onpremTargets) return;                       // 이어하기 — 사용자 입력 보존
    api.discoverDefaults().then((d) => {
      if (!d?.targets?.length) return;
      setOnpremTargets((cur) => (cur.every((t) => t.host === "10.60.1.10") ? d.targets : cur));
    }).catch(() => { /* 기본값 유지 */ });
  }, []);
  const updTarget = (i, patch) => setOnpremTargets((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const rmTarget = (i) => setOnpremTargets((ts) => ts.filter((_, idx) => idx !== i));
  const addTarget = (type) => setOnpremTargets((ts) => [...ts, type === "db" ? { type: "db", driver: "postgres", host: "", db: "" } : { type: "api", host: "", port: "" }]);
  const [docOpen, setDocOpen] = useState(false);   // 문서 디렉토리 수집 모달
  const [discoveryCache, setDiscoveryCache] = useState(snap?.discoveryCache ?? null);   // 스캔 결과 캐시 — [이전] 재진입 시 재탐색 방지
  // 클라우드 연결 결과 — 레거시 위치 스텝에서 로그인만 하고, 구독 선택은 탐색 범위에서.
  // acct/subs 는 순수 데이터라 스냅샷에 실어 SSO 팝업 리로드 후에도 복원된다.
  const [azureAcct, setAzureAcct] = useState(snap?.azureAcct ?? null);
  const [azureSubs, setAzureSubs] = useState(snap?.azureSubs ?? []);
  const [pickedSubs, setPickedSubs] = useState(() => new Set(snap?.pickedSubs ?? []));
  const [onpremOn, setOnpremOn] = useState(snap?.onpremOn ?? true);   // 온프렘 대역을 탐색 범위에 포함할지
  // ─── phase 제거, step으로 단일화 (0~4)
  // 이전엔 phase("form"|"running"|"done") + phaseToStep 매핑으로 레일과 콘텐츠가 따로 놀았다.
  // 이제 step 하나가 레일 하이라이트 + 우측 콘텐츠를 모두 결정해 동기화 보장.
  const [step, setStep] = useState(snap?.step ?? 0);

  // 클라우드 '전용' 위치를 골라 왔으면 직접지정(온프렘/VM) 칸은 노출하지 않는다.
  // 게이트의 열 수는 노출된 칸 수에 따라 CSS(auto-fit)가 정한다 — 예전 twoScope 계산은 그래서 삭제.
  // (loc 선언 이후에 둬야 함 — 위에서 참조하면 TDZ "Cannot access 'loc' before initialization")
  const isCloudOnly = loc?.id === "cloud";

  // ── 온프렘 입력 → 실제 탐색 스펙. 채워진 행만 대상이 된다.
  // 예전엔 온프렘을 '켜짐=1개'로 세고 백엔드는 서버 seed 를 훑어, 입력이 비어도
  // 결과가 나오고 버튼 숫자도 실입력과 어긋났다. 여기서 한 벌로 계산해 둘 다 고친다.
  const onpremApi = onpremTargets
    .filter((t) => t.type === "api" && (t.host || "").trim() && String(t.port || "").trim())
    .map((t) => `${t.host.trim()}:${String(t.port).trim()}`);
  const onpremDb = onpremTargets
    .filter((t) => t.type === "db" && (t.host || "").trim())
    .map((t) => (t.host.includes(":") ? t.host.trim() : `${t.host.trim()}:${DB_PORT[t.driver || "postgres"]}`));
  const onpremSpecs = [...onpremApi, ...onpremDb];
  const onpremScan = onpremOn && onpremSpecs.length > 0;
  // 탐색 범위가 바뀌면 이전 결과 복원은 무효 — 범위 서명을 캐시에 함께 저장한다.
  const scanSig = `${[...pickedSubs].sort().join("|")}#${onpremScan ? onpremSpecs.join("|") : ""}`;

  const [pid, setPid] = useState(snap?.pid ?? null);
  const projectIdRef = useRef(snap?.pid ?? null);
  const [jobId, setJobId] = useState(snap?.jobId ?? null);
  const [err, setErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionRef = useRef(false);
  const onboardingCompletedRef = useRef(false);

  // 상태가 바뀔 때마다 draft 갱신 — 나갔다 와도, SSO 팝업이 리로드해도 이 지점에서 재개된다.
  // 순간 UI(docOpen·err·submitting)는 복원 가치가 없어 제외.
  useEffect(() => {
    // manifest 성공 뒤의 setJobId/setStep 렌더가 이미 삭제한 draft를 되살리면 안 된다.
    if (onboardingCompletedRef.current) return;
    // 열자마자 닫은 빈 위자드까지 목록에 카드로 남기지는 않는다 — 아무것도 안 건드린 상태는 건너뛴다.
    if (step === 0 && !name.trim() && !desc.trim() && rows.length === 0 && !loc) return;
    saveDraft(did, {
      step, name, desc, rows: rows.filter((row) => !row.file), locId: loc?.id ?? null, srcSub, onpremTargets, discoveryCache, pid, jobId,
      azureAcct, azureSubs, pickedSubs: [...pickedSubs], onpremOn, connectorIds,
    });
  }, [did, step, name, desc, rows, loc, srcSub, onpremTargets, discoveryCache, pid, jobId, azureAcct, azureSubs, pickedSubs, onpremOn, connectorIds]);

  // 행 업데이트 헬퍼
  const updateRow = (i, patch) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  // 문서 수집 모달에서 확정한 파일들을 document 소스 행으로 추가 (경로 기준 중복 제외)
  const addDocs = (documents) => {
    setRows((prev) => {
      const known = new Set(prev.filter((r) => r.type === "document").map((r) => r.path));
      const fresh = documents.map((document) => ({ ...document, path: `${document.dir}/${document.name}` }))
        .filter((document) => !known.has(document.path));
      return [...prev, ...fresh.map((document) => ({
        ...blank("document"), name: document.name, path: document.path,
        pipelineId: document.pipelineId || "",
        ...(document.blob_url ? { blob_url: document.blob_url } : {}),
        ...(document.file ? { file: document.file } : {}),
      }))];
    });
  };
  const addLocalDocs = (fileList) => addDocs([...fileList]
    .filter((file) => ["pdf", "docx", "xlsx"].includes(file.name.split(".").pop()?.toLowerCase()))
    .map((file) => {
      const relative = file.webkitRelativePath || file.name;
      const slash = relative.lastIndexOf("/");
      return {
        name: file.name,
        dir: slash >= 0 ? `local/${relative.slice(0, slash)}` : "local",
        type: file.name.split(".").pop()?.toUpperCase() || "DOC",
        meta: file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(file.size / 1024))}KB`,
        ok: true,
        file,
      };
    }));
  const documentRows = rows.filter((row) => row.type === "document");

  // 탭별 카운트
  // - API(openapi): "API 서버 대수"가 아니라 "변환될 API(엔드포인트) 수" 합계.
  //   발견분은 확인된 endpoint 수(apiCount), 수동 등록분은 아직 미탐색이라 서버당 최소 1로 셈.
  // - DB/문서: 소스(리소스) 자체 개수. - 전체: 등록 소스 총 개수.
  const apiEndpointCount = () => rows.filter((r) => r.type === "openapi").reduce((s, r) => s + (r.apiCount ?? 1), 0);
  const applyManifest = async (sourceRows, assignments = []) => {
    let projectId = projectIdRef.current;
    if (!projectId) {
      const proj = await api.createProject({ name: name.trim(), description: desc });
      projectId = proj.id;
      projectIdRef.current = projectId;
      setPid(projectId);
    }
    const manifest = { project: name.trim(), resources: sourceRows.map(toResource) };
    const { jobId: jid } = await api.manifestApply(manifest, projectId);
    onboardingCompletedRef.current = true;
    dropDraft(did);
    setActiveDraft(null);
    setJobId(jid);

    if (assignments.length) {
      await createOnboardingRagExecution({
        apiClient: api,
        projectId,
        projectName: name.trim(),
        documents: sourceRows.filter((row) => row.type === "document"),
      });
      startPipelineJobs(projectId, name.trim(), assignments);
      window.dispatchEvent(new Event(JOB_EVENT));
      setStep(4);
    } else {
      setJob(projectId, jid, JOB_SOURCE.ONBOARDING);
      setStep(3);
    }
  };

  const handlePick = async (items = [], cloudFound = []) => {
    if (submissionRef.current) return;
    submissionRef.current = true;
    if (!name.trim()) {
      setErr("프로젝트 이름을 입력해주세요.");
      submissionRef.current = false;
      return;
    }
    setErr(null);
    setSubmitting(true);
    try {
      const sourceRows = [
        ...documentRows,
        ...items.filter((item) => item.spec_url).map((item) => ({
          ...blank("openapi"), name: item.name || `API :${item.port}`, url: item.spec_url,
          ...(item.auth_cred ? { auth: item.auth_cred } : {}),
          apiCount: item.api_count ?? (item.endpoints ? item.endpoints.length : undefined),
        })),
        // 발견 결과로 DSN 을 조립하면 비밀번호·DB명을 알 수 없어 스키마 조회가 인증에서 죽는다.
        // 서버가 자격을 이미 쥐고 있는 서버는 dsn_ref(참조)를 함께 내려주므로 그대로 쓴다.
        ...cloudFound.filter((item) => item.kind !== "vm" && (item.dsn_ref || item.fqdn)).map((item) => ({
          ...blank("db"), name: item.name, driver: "postgres",
          dsn: item.dsn_ref
            || `postgresql+psycopg://${item.admin || "user"}:\${env:PG_PW}@${item.fqdn}:5432/postgres`,
        })),
      ];
      const assignments = sourceRows.filter((row) => row.type === "document").map((row) => ({
        documentName: row.name, documentPath: row.path, pipelineId: row.pipelineId,
      }));
      setRows(sourceRows);
      await applyManifest(sourceRows, assignments);
    } catch (e) {
      setErr(e.message || "변환 시작 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
      submissionRef.current = false;
    }
  };

  // 완료 후 플랫폼 입장 — 목록 갱신(refresh) 후 활성 전환, 대시보드 이동, 모달 닫기.
  // refresh 없이 switchTo 만 하면 projects 배열에 신규 프로젝트가 안 담겨 목록에서 누락된다.
  const handleEnter = async () => {
    try { await refresh(); } catch { /* 목록 갱신 실패해도 진입은 진행 */ }
    if (pid) switchTo(pid);
    go("dashboard");
    onClose?.();
  };

  // ─── 레일 하단 텍스트 — 스텝별로 진행 상황을 한 줄 요약
  // 이전엔 phase 문자열로 분기했으나, 이제 step 숫자 하나로 결정
  // ─── 상단 진행률 필 텍스트 — 입력 단계(0~2)는 퍼센트, 변환/완료는 별도 표현
  const progressPill = () => {
    if (step <= 2) return `${Math.round((step / 4) * 100)}% · ${step + 1}/5`;
    if (step === 3) return "변환 중 · 진행중";
    return "완료 · 100%";
  };

  // ─── 레이아웃 — dim 배경 모달 (플랫폼이 뒤에 보이도록 반투명 어둠)
  // 이전엔 불투명 그라디언트로 전체 화면을 덮었으나, 이제 모달로 전환했으므로
  // 뒷배경 플랫폼 UI가 비쳐야 컨텍스트 인식이 유지됨
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(4,6,12,.62)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
        // 온보딩 모달은 항상 다크 디자인 — 앱 테마와 무관하게 CSS 변수를 다크값으로 고정.
        // 좌측 레일(딥네이비 그라데이션)과 같은 휴로 맞춘 네이비 계열 — 명도 차로 영역 구분.
        "--lav": "#090d16", "--app": "#101728", "--main": "#131a2c", "--card": "#1a2337",
        "--line": "#26304a", "--line2": "#33405e",
        "--navy": "#e9ecf5", "--text": "#aeb6c8", "--muted": "#767d92", "--faint": "#565d6f",
        "--green": "#34d399", "--green-bg": "#0f2a1e", "--red": "#f87171", "--red-bg": "#2c1618",
        "--sel": "#213c39", "--sel-border": "#00c9b8",
      }}
      // dim 영역 클릭 시 모달 닫기 — 카드 안 클릭은 stopPropagation으로 차단
      onClick={() => onClose?.()}
    >
      <div
        style={{
          // 1180 이던 시절 소스 등록 스텝이 3열(클라우드·온프렘·문서)이라 열당 290px 로 눌려
          // host 입력이 `10.6…` 로 잘렸다. 1360 이면 열당 약 420px 로 주소가 온전히 보인다.
          // 화면이 그보다 좁으면 width:100% 가 먼저 걸려 그대로 줄어든다.
          width: "100%", maxWidth: 1360, height: "min(880px, 94vh)",
          // 배경은 레일과 같은 딥네이비 — 흰 배경이면 borderRadius+overflow:hidden 클리핑
          // 경계의 안티앨리어싱으로 모서리에 1px 흰 호(arc)가 비쳐 보인다.
          // 스텝 상단배치를 위해 세로(column) 레이아웃 — 상단 헤더/스테퍼 + 하단 콘텐츠
          display: "flex", flexDirection: "column", background: "var(--main)",
          borderRadius: 24, overflow: "hidden",
          border: "1px solid rgba(255,255,255,.07)",
          boxShadow: "0 40px 90px rgba(0,0,0,.55)",
          position: "relative",
        }}
        // 카드 내부 클릭이 dim의 onClick으로 버블링되지 않도록 차단
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 X 버튼 — 우상단 고정. 언제든 닫을 수 있어야 함 (중간 단계는 일시중지로 보존) */}
        <button
          onClick={() => onClose?.()}
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 10,
            width: 30, height: 30, borderRadius: 9,
            background: "rgba(255,255,255,.06)", border: "none",
            cursor: "pointer", color: "#98a4c4",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
        >
          <CloseIco />
        </button>

        {/* ── 상단 헤더 + 수평 스테퍼 (좌측 레일에서 상단배치로 이동) ── */}
        <div style={{ flexShrink: 0, padding: "18px 32px 0", borderBottom: "1px solid var(--line)", background: "rgba(255,255,255,.015)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <img src="/ember-logo-dark.svg" alt="Ember Link" style={{ height: 30, display: "block" }} />
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />Local · 127.0.0.1
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: PRI_HI, background: PRI_SOFT, border: `1px solid ${PRI_LINE}`, padding: "4px 11px", borderRadius: 20, fontWeight: 700 }}>
              {progressPill()}
            </span>
            {/* 진행 폐기 — X(닫아도 draft 유지·이어하기 가능)와 달리 draft 를 지우고 처음부터 시작할 수 있게 한다.
                pid 생성(=변환 시작) 후엔 draft 가 이미 폐기되므로 입력 단계에서만 노출.
                marginRight로 우상단 absolute X와의 겹침을 피한다 */}
            {step >= 1 && step <= 3 && !pid && (
              <button
                onClick={() => {
                  if (window.confirm("진행 중인 프로젝트 생성을 그만둘까요? 입력한 내용이 사라집니다.")) {
                    dropDraft(did);
                    setActiveDraft(null);
                    onClose?.();
                  }
                }}
                style={{
                  height: 28, padding: "0 12px", borderRadius: 9,
                  background: "rgba(255,255,255,.06)", border: "none",
                  cursor: "pointer", color: "#98a4c4", fontSize: 12, fontWeight: 700,
                  marginRight: 24, flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.14)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; }}
              >
                그만두기
              </button>
            )}
          </div>
          {/* 수평 스테퍼 */}
          <div style={{ display: "flex", alignItems: "center", overflowX: "auto" }}>
            {STEPS.map((s, si) => {
              const done = si < step;
              const now = si === step;
              return (
                <div key={si} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 15, position: "relative" }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center",
                      fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, flexShrink: 0,
                      background: done ? PRI_SOFT : now ? PRI : "var(--card)",
                      border: done ? `1px solid ${PRI_LINE}` : now ? "none" : "1px solid var(--line2)",
                      color: done ? PRI_HI : now ? "#03251f" : "var(--faint)",
                    }}>
                      {done ? <CheckIco /> : si + 1}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: now ? 700 : 600, whiteSpace: "nowrap", color: now ? "var(--navy)" : done ? "var(--muted)" : "var(--faint)" }}>{s.label}</span>
                    {now && <span style={{ position: "absolute", left: 0, right: 12, bottom: -1, height: 2, background: PRI }} />}
                  </div>
                  {si < STEPS.length - 1 && <span style={{ width: 24, height: 1.5, background: si < step ? PRI_LINE : "var(--line2)", margin: "0 12px 15px" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 콘텐츠 패널 (스크롤) — minHeight:0 이라야 flex column 에서 자식 스크롤 활성화 ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--main)", minWidth: 0, minHeight: 0 }}>
          {/* 스크롤 영역 — 내부 콘텐츠는 stage 컨테이너로 중앙정렬 */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "30px 32px 32px" }}>
            <div style={{ maxWidth: 900, margin: "0 auto" }}>

            {/* ═══ STEP 0: 프로젝트 정보 ═══
                이전 form 페이즈에 프로젝트 카드 + 소스 바스켓이 함께 있었으나
                step0는 이름/설명만 입력받아 사용자 혼란을 줄임 */}
            {step === 0 && (
              <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: "clamp(8px, 5vh, 56px)" }}>
                {/* 히어로 헤더 — 중앙 정렬, 큰 아이콘 + 글로우 */}
                <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", width: 220, height: 120, background: "radial-gradient(closest-side, rgba(45,212,191,.15), transparent)", pointerEvents: "none" }} />
                  <div style={{ width: 62, height: 62, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", background: PRI_SOFT, color: PRI_HI, border: `1px solid ${PRI_LINE}`, margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(45,212,191,.14)", position: "relative" }}>
                    <SparkIco />
                  </div>
                  <h1 style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1.2, color: "var(--navy)", margin: 0, position: "relative" }}>프로젝트 이름을 정해요</h1>
                  <p style={{ fontSize: 13.5, color: "var(--text)", margin: "9px 0 0", lineHeight: 1.6, position: "relative" }}>
                    Legacy 리소스를 AI 도구로 바꿀 MCP 플랫폼 환경입니다.<br/>프로젝트 정보를 입력 후 생성을 시작합니다.
                  </p>
                </div>

                {/* 프로젝트 정보 카드 */}
                <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 18, padding: 6, marginBottom: 15, boxShadow: "0 8px 28px rgba(0,0,0,.28)" }}>
                  <div style={{ padding: "20px 22px" }}>
                    <label style={lab}>프로젝트 이름 *</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="예: 한화 보상심사 환경"
                      style={inp}
                      // 엔터 키로 다음 단계로 빠르게 이동할 수 있도록
                      onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(1)}
                    />
                    <label style={{ ...lab, marginTop: 10 }}>설명 (선택)</label>
                    <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="이 MCP 플랫폼 환경의 역할을 한 줄로 설명하세요" style={inp} />
                  </div>
                </div>

                {/* 오류 메시지 */}
                {err && (
                  <div style={{ background: "var(--red-bg)", border: "1px solid #5f2120", borderRadius: 11, padding: "10px 14px", fontSize: 12.5, color: "var(--red)", marginBottom: 12 }}>
                    {err}
                  </div>
                )}

                {/* 푸터 네비 — step0: 이전 없음, 다음(이름 비어있으면 비활성) */}
                <div style={{ display: "flex", gap: 11, alignItems: "center", marginTop: 4 }}>
                  <button
                    onClick={() => {
                      // 이름이 없으면 진행 불가 — 에러 표시
                      if (!name.trim()) { setErr("프로젝트 이름을 입력해주세요."); return; }
                      setErr(null);
                      setStep(1);
                    }}
                    disabled={!name.trim()}
                    style={{
                      flex: 1, padding: 14, borderRadius: 12,
                      background: name.trim() ? PRI : "var(--muted)",
                      color: "#fff", border: "none",
                      fontWeight: 700, fontSize: 13.5,
                      cursor: name.trim() ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      boxShadow: name.trim() ? "0 10px 22px rgba(13,148,136,.26)" : "none",
                    }}
                  >
                    다음<ArrowIco />
                  </button>
                </div>

                {/* 건너뛰기 */}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); go("dashboard"); onClose?.(); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 13, fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
                >
                  건너뛰고 빈 플랫폼으로<ArrowIco />
                </a>
              </div>
            )}

            {/* ═══ STEP 1: 레거시 위치 (선택만, 입력 없음) ═══
                위치 선택 → 뒷단 수집 transport 결정. 선택 시 소스등록의 기본 입력모드(defMode)도 세팅. */}
            {step === 1 && (
              <>
                <div style={{ display: "flex", gap: 15, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: PRI_SOFT, color: PRI_HI, border: `1px solid ${PRI_LINE}` }}>
                    <SparkIco />
                  </div>
                  <div>
                    <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--navy)", margin: 0 }}>레거시 리소스가 어디에 있나요?</h1>
                    <p style={{ fontSize: 13, color: "var(--text)", marginTop: 3, margin: "3px 0 0" }}>위치에 따라 뒷단이 끌어오는 방식이 달라집니다. 경로·인증 입력은 다음 스텝에서.</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13, margin: "18px 0 6px" }}>
                  {LOCS.map((l) => {
                    const on = loc?.id === l.id;
                    return (
                      <div key={l.id} onClick={() => setLoc(l)} style={{ border: `2px solid ${on ? l.accent : "var(--line2)"}`, borderRadius: 18, background: "var(--card)", cursor: "pointer", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: on ? `0 0 0 3px color-mix(in srgb,${l.accent} 18%,transparent),0 14px 30px rgba(0,0,0,.25)` : "0 3px 10px rgba(0,0,0,.18)", transform: on ? "translateY(-2px)" : "none", transition: ".18s", position: "relative" }}>
                        <span style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderRadius: "50%", border: `2px solid ${on ? l.accent : "var(--line2)"}`, background: on ? `radial-gradient(circle,${l.accent} 0 4.5px,var(--card) 5.5px)` : "var(--card)", zIndex: 2 }} />
                        <div style={{ height: 92, background: `linear-gradient(160deg, color-mix(in srgb,${l.accent} 12%,var(--card)), var(--card))`, borderBottom: "1px solid var(--line2)" }}><svg viewBox="0 0 200 150" width="100%" height="100%" fill="none">{l.illust}</svg></div>
                        <div style={{ padding: "12px 15px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>{l.titleKo}</span>{l.roadmap && <span style={{ fontSize: 9, fontWeight: 700, background: "color-mix(in srgb,#e8841e 16%,var(--card))", color: "#e8841e", padding: "1px 6px", borderRadius: 5 }}>A안</span>}</div>
                          <div style={{ fontSize: 10.5, color: "var(--muted)", margin: "1px 0 7px" }}>{l.subKo}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.5, minHeight: 34 }}>{l.descKo}</div>
                          <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px dashed var(--line2)", fontSize: 10.5, color: l.accent, fontWeight: 700 }}>수집: {l.transKo}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 클라우드·혼재 위치 선택 시 — Entra SSO 로그인(연결)까지만.
                    구독을 골라 리소스를 찾는 일은 다음 스텝의 자동탐색이 담당한다. */}
                {(loc?.id === "cloud" || loc?.id === "hybrid") && (
                  <div style={{ marginTop: 14 }}>
                    <CloudConnect
                      acct={azureAcct} subs={azureSubs}
                      onConnected={({ acct, subs }) => {
                        setAzureAcct(acct); setAzureSubs(subs);
                        // 기본은 전체 구독 선택 — 탐색 범위 화면에서 빼면 된다.
                        setPickedSubs(new Set((subs || []).map((s) => s.id)));
                      }}
                    />
                  </div>
                )}

                {/* 푸터 네비 — 이전(프로젝트정보) / 다음(위치 미선택 시 비활성) */}
                <div style={{ display: "flex", gap: 11, alignItems: "center", marginTop: 16 }}>
                  <button onClick={() => setStep(0)} style={{ padding: "14px 20px", borderRadius: 12, background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>이전</button>
                  <button
                    onClick={() => {
                      if (!loc) return;
                      setSrcSub("gate");
                      // 클라우드 전용 위치는 사내 대역이 없다 — 기본 범위에서 온프렘을 뺀다.
                      setOnpremOn(loc.id !== "cloud");
                      setStep(2);
                    }}
                    disabled={!loc}
                    style={{ flex: 1, padding: 14, borderRadius: 12, background: loc ? PRI : "var(--muted)", color: "#fff", border: "none", fontWeight: 700, fontSize: 13.5, cursor: loc ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: loc ? "0 10px 22px rgba(13,148,136,.26)" : "none" }}
                  >
                    소스 등록으로<ArrowIco />
                  </button>
                </div>
              </>
            )}

            {/* ═══ STEP 2: 레거시 소스 등록 ═══
                이전 form 페이즈에서 소스 바스켓 + 프로젝트 카드가 섞여 있었으나
                step2는 소스 등록에만 집중. 인증 callout도 여기서만 표시. */}
            {step === 2 && (
              <>
                {/* 헤드라인 */}
                <div style={{ display: "flex", gap: 15, alignItems: "center", marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: PRI_SOFT, color: PRI_HI, border: `1px solid ${PRI_LINE}` }}>
                    <InboxIco />
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
                      <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--navy)", margin: 0 }}>레거시 소스를 담아주세요</h1>
                      {loc && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: loc.accent, background: `color-mix(in srgb, ${loc.accent} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${loc.accent} 40%, transparent)`, borderRadius: 20, padding: "4px 11px", whiteSpace: "nowrap" }}>
                          {loc.titleKo} · {loc.transKo}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text)", margin: "3px 0 0" }}>
                      {loc?.defMode === "manual"
                        ? <>공인 엔드포인트라 대역 스캔이 통하지 않습니다. <b>API·DB·문서를 직접 등록</b>하면 다음 단계에서 <b>한 번에</b> AI용 도구로 변환합니다.</>
                        : <>API·DB는 <b>자동 탐색</b>으로 확인하고, 비정형 문서는 <b>경로를 지정해 담습니다</b>. 여기서 모두 담으면 다음 단계에서 <b>한 번에</b> 변환합니다.</>}
                    </p>
                  </div>
                </div>

                {/* ═══ 서브스텝 A · 자동탐색 시작 게이트 ═══ */}
                {srcSub === "gate" && (<>
                  {/* 안내는 한 줄 배너로 — 범위 선택 카드가 스크롤 없이 같이 보여야 한다 */}
                  <div style={{ background: "var(--card)", border: `1px solid ${PRI_LINE}`, borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", gap: 13, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, background: PRI_SOFT, border: `1px solid ${PRI_LINE}`, display: "flex", alignItems: "center", justifyContent: "center", color: PRI_HI }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/><path d="M11 8v6M8 11h6"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 300 }}>
                      <h3 style={{ fontSize: 13.5, fontWeight: 800, color: "var(--navy)", margin: "0 0 2px" }}>자동 탐색이란?</h3>
                      <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5, margin: 0 }}>
                        알려준 호스트에서 <b style={{ color: "var(--navy)" }}>표준 스펙 경로</b>(<span style={{ fontFamily: "var(--mono)" }}>/openapi.json</span> 등)를 확인해 API·DB를 식별합니다. 게이트웨이·레지스트리가 있으면 <b style={{ color: "var(--navy)" }}>등록 목록을 그대로</b> 가져옵니다.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[["1", "스펙 경로 확인"], ["2", "종류 식별"], ["3", "변환 가능 확인"]].map(([n, t]) => (
                        <span key={n} style={{ fontSize: 10.5, color: "var(--text)", background: "var(--main)", border: "1px solid var(--line)", borderRadius: 20, padding: "5px 11px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                          <b style={{ color: PRI_HI, fontFamily: "var(--mono)", fontSize: 9.5 }}>{n}</b>{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 클라우드 · 온프렘 · 문서를 대등한 열로 — 담을 수 있는 것 전부를 한 화면에 편다.
                      문서는 예전에 탐색이 끝난 뒤 바스켓 화면에서야 담을 수 있어, API·DB 변환을
                      마치고 다시 문서를 고르러 돌아가는 순서가 됐다.
                      auto-fit 인 이유: 3열이 되면 host·port 입력칸이 눌린다. 폭이 모자라면
                      칸을 찌그러뜨리는 대신 다음 줄로 접는다(노출된 칸 수에 따라 1~3열). */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 12, alignItems: "stretch", marginBottom: 12 }}>

                  {/* ── 클라우드 범위 — 연결된 계정의 구독을 골라 담는다(다중) ── */}
                  {azureSubs.length > 0 && (
                    <div style={{ background: "var(--card)", border: "1px solid color-mix(in srgb,#4aa3ff 42%,var(--line2))", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb,#4aa3ff 16%,var(--card))", color: "#8ec5ff" }}>CLOUD</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>탐색할 Azure 구독</span>
                        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)" }}>
                          {pickedSubs.size} / {azureSubs.length} 선택
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{azureAcct?.username} 계정이 접근 가능한 구독입니다. 뺀 구독은 이번 탐색에서 조회하지 않습니다.</div>
                      {/* 카드 높이는 옆(온프렘) 칸에 맞춰 stretch — 구독이 많으면 목록만 스크롤 */}
                      <div style={{ flex: 1, minHeight: 0, maxHeight: 260, overflowY: "auto" }}>
                      {azureSubs.map((s) => {
                        const on = pickedSubs.has(s.id);
                        return (
                          <div key={s.id}
                            onClick={() => setPickedSubs((p) => { const n = new Set(p); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", marginBottom: 6, borderRadius: 9, cursor: "pointer", border: `1px solid ${on ? "#4aa3ff" : "var(--line2)"}`, background: on ? "color-mix(in srgb,#4aa3ff 8%,var(--card))" : "var(--main)", opacity: on ? 1 : 0.6 }}>
                            <span style={{ width: 17, height: 17, borderRadius: 5, flex: "none", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", border: `2px solid ${on ? "#4aa3ff" : "var(--line2)"}`, background: on ? "#4aa3ff" : "transparent" }}>{on ? "✓" : ""}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.name}>{s.name}</span>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)" }}>{on ? "탐색 포함" : "제외"}</span>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}

                  {/* ── 온프렘/직접지정 범위 — 클라우드 전용이면 통째로 숨김 ── */}
                  {!isCloudOnly && (
                  <div style={{ background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, padding: "14px 16px", opacity: onpremOn ? 1 : 0.55 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      {/* 클라우드 구독이 있을 때만 온프렘을 끌 수 있다 — 둘 다 끄면 탐색할 게 없다 */}
                      {azureSubs.length > 0 && (
                        <span onClick={() => setOnpremOn((v) => !v)}
                          style={{ width: 17, height: 17, borderRadius: 5, flex: "none", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, color: "#fff", cursor: "pointer", border: `2px solid ${onpremOn ? "#f5a524" : "var(--line2)"}`, background: onpremOn ? "#f5a524" : "transparent" }}>{onpremOn ? "✓" : ""}</span>
                      )}
                      {/* 좌측 CLOUD 칸과 같은 자리·같은 형태의 배지로 출처를 대비시킨다.
                          예전 "직접 지정"은 수집 방식을 가리켜, 옆 칸이 CLOUD(출처)인 것과 층위가 어긋났다. */}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "color-mix(in srgb,#f5a524 16%,var(--card))", color: "#f5a524" }}>ON-PREMISE</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>탐색할 호스트 <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 11 }}>온프렘 서버 · 클라우드 VM</span></span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>온프렘 서버·게이트웨이는 물론 <b style={{ color: "var(--text)" }}>클라우드 VM 안의 API</b>도 host:port로 지정해 확인합니다. (구독 조회는 VM 겉면·관리형 DB만 자동)</div>
                    <style>{`.onprem-targets input::placeholder{color:var(--faint);opacity:.55}`}</style>
                    <div className="onprem-targets" style={{ display: "flex", flexDirection: "column", gap: 8, opacity: onpremOn ? 1 : 0.5, pointerEvents: onpremOn ? "auto" : "none" }}>
                      {onpremTargets.map((tg, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {/* 종류는 아래 '＋ API 서버 / ＋ DB' 로 이미 정해져 들어온다 — 행에서 다시 고를 이유가
                              없어 토글(2칸) 대신 정적 태그(1칸)로 둔다. 바꾸려면 지우고 다시 추가.
                              토글이 먹던 폭이 host 입력으로 넘어가 좁은 열에서 주소가 덜 잘린다. */}
                          <span title="종류를 바꾸려면 이 행을 지우고 아래 버튼으로 다시 추가하세요"
                            style={{
                              fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".03em",
                              padding: "6px 8px", borderRadius: 7, flexShrink: 0, cursor: "default",
                              background: tg.type === "db" ? "#241a30" : PRI_SOFT,
                              color: tg.type === "db" ? "#c88ff0" : PRI_HI,
                              border: `1px solid ${tg.type === "db" ? "#3a2a4a" : PRI_LINE}`,
                            }}>
                            {tg.type === "db" ? "DB" : "API"}
                          </span>
                          {tg.type === "api" ? (
                            <>
                              <input value={tg.host} onChange={(e) => updTarget(i, { host: e.target.value })} placeholder="예: apim.internal · 10.60.1.10" style={{ ...inp, fontFamily: "var(--mono)", flex: 1, minWidth: 0 }} />
                              <input value={tg.port} onChange={(e) => updTarget(i, { port: e.target.value })} placeholder="예: 8080" style={{ ...inp, fontFamily: "var(--mono)", width: 74, flexShrink: 0 }} />
                            </>
                          ) : (
                            <>
                              <select value={tg.driver || "postgres"} onChange={(e) => updTarget(i, { driver: e.target.value })} style={{ ...inp, width: 108, flexShrink: 0, cursor: "pointer" }}>
                                <option value="postgres">PostgreSQL</option><option value="mysql">MySQL</option><option value="oracle">Oracle</option><option value="mssql">SQL Server</option><option value="mongo">MongoDB</option>
                              </select>
                              <input value={tg.host} onChange={(e) => updTarget(i, { host: e.target.value })} placeholder="예: db.internal:5432" style={{ ...inp, fontFamily: "var(--mono)", flex: 1, minWidth: 0 }} />
                              <input value={tg.db} onChange={(e) => updTarget(i, { db: e.target.value })} placeholder="예: policy_db" style={{ ...inp, fontFamily: "var(--mono)", width: 96, flexShrink: 0 }} />
                            </>
                          )}
                          <button onClick={() => rmTarget(i)} title="삭제" style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--line2)", background: "transparent", color: "var(--faint)", cursor: "pointer", flexShrink: 0, fontSize: 15, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                      <button onClick={() => addTarget("api")} style={{ flex: 1, padding: 8, border: "1px dashed var(--line2)", borderRadius: 9, background: "transparent", color: PRI_HI, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>＋ API 서버</button>
                      <button onClick={() => addTarget("db")} style={{ flex: 1, padding: 8, border: "1px dashed var(--line2)", borderRadius: 9, background: "transparent", color: "#c88ff0", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>＋ DB</button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 9 }}>ℹ API는 <b style={{ color: "var(--muted)" }}>표준 스펙 경로</b>(<span style={{ fontFamily: "var(--mono)" }}>/openapi.json 등</span>), DB는 <b style={{ color: "var(--muted)" }}>스키마 introspection</b>으로 읽기전용 조회 tool을 만듭니다. 대역·포트 스캔이 아니라 <b style={{ color: "var(--muted)" }}>지정한 대상만</b> 확인합니다.</div>
                  </div>
                  )}

                  {/* ── 비정형 문서 — 여기서 '담는다'. 호스트만 알려주면 시스템이 찾아오는 API·DB 와
                       달리 사용자가 경로를 골라야 해서, 같은 '탐색' 버튼에 묶지 않고 칸을 나눴다. ── */}
                  <div style={{ background: "var(--card)", border: `1px solid color-mix(in srgb,${DOC} 46%,var(--line2))`, borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `color-mix(in srgb,${DOC} 16%,var(--card))`, color: DOC }}>문서</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--navy)" }}>비정형 문서</span>
                      <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, color: documentRows.length ? DOC : "var(--muted)" }}>
                        {documentRows.length}건 담김
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>PDF·DOCX·XLSX 등. 탐색 대상이 아니라 <b style={{ color: "var(--text)" }}>경로를 지정해 담습니다</b>.</div>

                    <input ref={localDocInputRef} type="file" multiple accept=".pdf,.docx,.xlsx" hidden onChange={(event) => { addLocalDocs(event.target.files || []); event.target.value = ""; }} />
                    <button disabled={!appMode} onClick={() => appMode === "preview" ? setDocOpen(true) : localDocInputRef.current?.click()}
                      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: appMode ? "pointer" : "wait", opacity: appMode ? 1 : .65,
                        border: `1.5px dashed color-mix(in srgb,${DOC} 50%,var(--line2))`, borderRadius: 12, padding: 14,
                        background: `color-mix(in srgb,${DOC} 6%,transparent)` }}>
                      <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: `color-mix(in srgb,${DOC} 14%,var(--card))`, color: DOC }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                        </svg>
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <b style={{ display: "block", fontSize: 12.5, color: "var(--navy)" }}>{appMode === "preview" ? "문서 폴더에서 고르기" : "내 컴퓨터에서 문서 고르기"}</b>
                        <small style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "var(--muted)", fontFamily: "var(--mono)" }}>{appMode === "preview" ? "폴더를 바꿔가며 반복해서 담을 수 있어요" : "PDF·DOCX·XLSX 파일을 여러 개 선택할 수 있어요"}</small>
                      </span>
                    </button>

                    {/* 담은 문서 — 무엇이 들어갔는지 여기서 바로 확인·제외한다(다음 화면까지 안 가도 되게) */}
                    <div style={{ flex: 1, minHeight: 0, maxHeight: 168, overflowY: "auto", marginTop: 9 }}>
                      {documentRows.length === 0 ? (
                        <div style={{ fontSize: 11, color: "var(--faint)", lineHeight: 1.7, padding: "6px 2px" }}>
                          아직 담은 문서가 없습니다. 문서가 없으면 <b style={{ color: "var(--muted)" }}>비워둔 채 진행</b>해도 됩니다.
                        </div>
                      ) : documentRows.map((row) => (
                        <div key={row.path || row.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, background: "var(--main)", marginBottom: 5 }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, padding: "2px 6px", borderRadius: 5, flexShrink: 0, background: `color-mix(in srgb,${DOC} 16%,var(--card))`, color: DOC }}>
                            {/* 확장자가 없는 파일명이면 태그가 이름 전체로 늘어난다 — 그때는 DOC 로 */}
                            {((row.name || "").includes(".") ? row.name.split(".").pop().slice(0, 4) : "DOC").toUpperCase()}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 600, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.path || row.name}>{row.name}</span>
                          <select value={row.pipelineId || ""} onChange={(e) => updateRow(rows.indexOf(row), { pipelineId: e.target.value })} aria-label={`${row.name} 활용 경로`}
                            style={{ ...inp, width: 148, padding: "6px 8px", fontSize: 10.5, cursor: "pointer", flexShrink: 0 }}>
                            <option value="">활용 경로 선택</option>
                            {PIPELINE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                          </select>
                          <button onClick={() => removeRow(rows.indexOf(row))} title="제외"
                            style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--line2)", background: "transparent", color: "var(--faint)", cursor: "pointer", flexShrink: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 9 }}>ℹ 문서마다 활용 경로를 정하면 탐색과 Blob 업로드를 함께 시작합니다.</div>
                  </div>
                  </div>

                  <ConnectorMock
                    selected={connectorIds}
                    onToggle={(id) => setConnectorIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])}
                  />

                  {/* 담긴 게 하나도 없으면 다음으로 갈 수 없다 — 시작 자체를 막는다 */}
                  {(() => {
                    // 온프렘은 '켜짐'이 아니라 실제로 채워진 대상 수로 센다 — 버튼 숫자 = 진짜 탐색 대상 수.
                    const nScope = (onpremOn ? onpremSpecs.length : 0) + pickedSubs.size;
                    const nDoc = documentRows.length;
                    const docOnly = !nScope && nDoc > 0;
                    const docsReady = documentRows.every((row) => row.pipelineId);
                    const ready = (nScope > 0 || docOnly) && docsReady;
                    return (
                      <button
                        onClick={() => {
                          if (!ready) return;
                          setSrcSub("scan");
                        }}
                        disabled={!ready}
                        style={{ width: "100%", padding: 15, border: "none", borderRadius: 12, background: ready ? PRI : "var(--line2)", color: ready ? "#fff" : "var(--faint)", fontSize: 14, fontWeight: 800, cursor: ready ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: ready ? "0 10px 22px rgba(13,148,136,.26)" : "none" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m5 3 14 9-14 9V3z" /></svg>
                        {!docsReady ? "모든 문서의 활용 경로를 선택해주세요"
                          : nScope ? <>{nScope}개 대상 탐색 시작{nDoc > 0 && <span style={{ fontWeight: 700, fontSize: 11.5, opacity: .78 }}>· 문서 {nDoc}건 Blob 업로드</span>}</>
                            : docOnly ? `문서 ${nDoc}건 업로드 시작`
                              : "탐색할 대상을 고르거나 문서를 담아주세요"}
                      </button>
                    );
                  })()}
                  <div style={{ display: "flex", gap: 11, marginTop: 11 }}>
                    <button onClick={() => setStep(1)} style={{ padding: "12px 20px", borderRadius: 12, background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>이전</button>
                  </div>
                </>)}

                {/* ═══ 서브스텝 B · 탐색·결과 ═══ */}
                {srcSub === "scan" && (
                  <DiscoveryScan
                    onPick={handlePick}
                    submitting={submitting}
                    submissionError={err}
                    onCancel={() => setSrcSub("gate")}
                    cached={discoveryCache?.sig === scanSig ? discoveryCache.found : null}
                    onScanned={(found) => setDiscoveryCache({ sig: scanSig, found })}
                    cloudSubs={azureSubs.filter((s) => pickedSubs.has(s.id))}
                    documents={documentRows}
                    connectors={CONNECTOR_MOCK.filter((connector) => connectorIds.includes(connector.id))}
                    onpremEnabled={onpremScan}
                    onpremApiSpec={onpremApi.join(",")}
                    onpremDbSpec={onpremDb.join(",")}
                    onpremRange={onpremSpecs.join(", ") || "대상 없음"}
                  />
                )}
              </>
            )}

            {/* ═══ STEP 3: 변환 진행 ═══
                이전 running 페이즈와 동일 — ConversionMonitor inline 모드 사용.
                완료/닫기 시 setStep(4)로 이동 */}
            {step === 3 && (
              <>
                {/* 변환 중 헤드라인 */}
                <div style={{ display: "flex", gap: 15, alignItems: "center", marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1e2140", color: "#8a91e8", border: "1px solid #2c3060" }}>
                    <SparkIco />
                  </div>
                  <div>
                    <h1 style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25, color: "var(--navy)", margin: 0 }}>레거시를 변환하고 있어요</h1>
                    <p style={{ fontSize: 13, color: "var(--text)", marginTop: 3, margin: "3px 0 0" }}>
                      각 소스를 <b>백그라운드 작업</b>으로 따로 변환합니다. 하나가 실패해도 나머지는 계속되고, <b>일부만 성공해도</b> 입장할 수 있어요.
                    </p>
                  </div>
                </div>

                {/* ConversionMonitor inline 모드 — 모달 안에 이미 있으므로 자체 오버레이 불필요.
                    inline 없이 쓰면 position:fixed 다이얼로그가 이 모달 위에 다시 열려 이중 dim이 된다.
                    onDone/onClose 모두 step4(플랫폼 입장)로 이동 */}
                <ConversionMonitor
                  jobId={jobId}
                  projectName={name}
                  inline
                  onDone={() => setStep(4)}
                  onClose={() => setStep(4)}
                />
                {/* 백그라운드 전환 — 변환은 jobStore 에 등록돼 계속 돌고, 사용자는 플랫폼을 먼저 둘러본다.
                    진행 상황은 플랫폼 우상단 '변환 중' 작업 알림에서 확인. */}
                <a href="#" onClick={(e) => { e.preventDefault(); if (pid) switchTo(pid); go("dashboard"); onClose?.(); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, fontSize: 12.5, color: "var(--muted)", textDecoration: "none" }}>
                  변환은 백그라운드에서 계속됩니다 — 먼저 플랫폼 둘러보기<ArrowIco />
                </a>
              </>
            )}

            {/* ═══ STEP 4: 플랫폼 입장 ═══
                이전 done 페이즈와 동일 — 성공 씰 + 통계 + 입장 버튼 */}
            {step === 4 && (
              <>
                {/* 완료 씰 */}
                <div style={{ textAlign: "center", padding: "14px 0 4px" }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--green-bg)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px", border: "1px solid #1d4a30" }}>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                  <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>온보딩 완료</h1>
                  <p style={{ fontSize: 13, color: "var(--text)", marginTop: 5 }}>"{name}" 환경이 만들어졌습니다. 요약을 확인하고 입장하세요.</p>
                </div>

                {/* 간단 통계 — 등록 소스(리소스 수) · API(엔드포인트 수) · DB(개수) */}
                <div style={{ display: "flex", gap: 11, margin: "20px 0" }}>
                  {[
                    { v: rows.length, l: "등록 소스", c: "var(--green)" },
                    { v: apiEndpointCount(), l: "API 변환", c: "var(--navy)" },
                    { v: rows.filter((r) => r.type === "db").length, l: "DB 변환", c: "var(--navy)" },
                  ].map(({ v, l, c }) => (
                    <div key={l} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14, padding: 16, textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>
                      <div style={{ fontSize: 23, fontWeight: 800, color: c, fontFamily: "var(--mono)" }}>{v}</div>
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* 입장 버튼 */}
                <button
                  onClick={handleEnter}
                  style={{ width: "100%", padding: 15, border: "none", borderRadius: 13, background: PRI, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 12px 24px rgba(13,148,136,.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {name} 환경으로 입장<ArrowIco />
                </button>

                {documentRows.length > 0 ? (
                  <p style={{ margin: "13px 0 0", textAlign: "center", fontSize: 12, color: "var(--muted)" }}>
                    문서 파일은 앞 단계에서 Blob Storage 업로드가 완료되었습니다. RAG 및 GraphRAG 작업은 백그라운드에서 계속 진행됩니다.
                  </p>
                ) : (
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); go("dashboard"); onClose?.(); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 13, fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
                  >
                    남은 소스는 플랫폼 안 '변환 마법사'에서 이어서<ArrowIco />
                  </a>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* 문서 디렉토리 수집 모달 */}
      {docOpen && appMode === "preview" && (
        <DocCollect onClose={() => setDocOpen(false)} onConfirm={addDocs} />
      )}
    </div>
  );
}
