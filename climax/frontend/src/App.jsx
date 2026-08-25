import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { STR } from "./i18n";
import Dashboard from "./screens/Dashboard";
import Explorer from "./screens/Explorer";
import Projects from "./screens/Projects";
import ProjectSettings from "./screens/ProjectSettings";
import Login from "./screens/Login";
import Members from "./screens/Members";
import RagVector from "./screens/RagVector";
import RagPipelineExecution from "./screens/RagPipelineExecution";
import ApiResource from "./screens/ApiResource";
import DbResource from "./screens/DbResource";
import McpMonitor from "./screens/McpMonitor";
import ConversionHealth from "./screens/ConversionHealth";
import AuditLog from "./screens/AuditLog";
import Onboarding from "./screens/OnboardingV2";
import { activeDraftId, setActiveDraft, newDraftId } from "./onboardingDrafts";
import OntologyDesign from "./screens/OntologyDesign";
import MappingDesign from "./screens/MappingDesign";
import SkillBuilder from "./screens/SkillBuilder";
import SkillManager from "./screens/SkillManager";
import Playground from "./screens/Playground";
import Chat from "./components/Chat";
import ProjectSwitcher from "./components/ProjectSwitcher";
import TaskStatus from "./components/TaskStatus";
import JobsBell from "./components/JobsBell";
import PricingModal from "./components/PricingModal";
import { useProjects } from "./ProjectContext";
import { ONTOLOGY_VERSION } from "./version";
import { api } from "./api";
import { pathForScreen, screenForPath } from "./routes";

// onboarding은 라우팅 화면이 아니라 모달로 전환했으므로 SCREENS에서 제외
const ONT_SCREENS = ["ont_information", "ont_import", "ont_generate", "ont_designer", "ont_entities", "ont_relationships"];
const MAP_SCREENS = ["map_information", "map_import", "map_designer", "map_manual", "map_automap", "map_materialize", "map_diagnostics"];
// 「MCP 변환 마법사」 은퇴 — 변환 진입점이 DATA RESOURCE 의 타입별 화면으로 옮겨갔다.
// 화면 자체는 SCREENS 에서 내렸고, 남아 있는 딥링크(?screen=wizard&src=…)는 routes.js 의
// legacyRedirect 가, 앱 내부의 go("wizard") 호출은 아래 go() 가 대응 화면으로 흘려보낸다.
const SCREENS = {
  dashboard: Dashboard, explorer: Explorer, projects: Projects, projectSettings: ProjectSettings, rag: RagVector, ragExecution: RagPipelineExecution, mcpMonitor: McpMonitor, health: ConversionHealth, audit: AuditLog, members: Members,
  apiResource: ApiResource, dbResource: DbResource,
  skillCreate: SkillBuilder, skillManage: SkillManager, playground: Playground,
  query: OntologyDesign,   // 검증(Query) — 온톨로지·매핑을 모두 다루는 최종 단계라 최상위로 승격
  ...Object.fromEntries(ONT_SCREENS.map((k) => [k, OntologyDesign])),
  ...Object.fromEntries(MAP_SCREENS.map((k) => [k, MappingDesign])),
};

const Svg = ({ d, sw = 1.9, size = 18, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children || <path d={d} />}
  </svg>
);
const ICO = {
  dash: <Svg><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>,
  proj: <Svg><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></Svg>,
  exp: <Svg><rect x="14" y="3" width="7" height="7" rx="1.5" /><path d="M10 21V8a2 2 0 0 0-2-2H3v15h15v-5a2 2 0 0 0-2-2Z" /></Svg>,
  wiz: <Svg><path d="M10 2v6l-6 11a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-11V2" /><path d="M8 2h8" /></Svg>,
  monitor: <Svg sw={1.7}><rect x="2" y="3" width="20" height="6" rx="2" /><rect x="2" y="13" width="20" height="6" rx="2" /><path d="M6 6h.01M6 16h.01" /></Svg>,
  rag: <Svg sw={1.7}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></Svg>,
  // DATA RESOURCE — API(중괄호=엔드포인트 스펙) / DB(원통 + 격자=테이블)
  api: <Svg sw={1.7}><path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5v3A2.5 2.5 0 0 1 2.5 12 2.5 2.5 0 0 1 5 14.5v3A2.5 2.5 0 0 0 7.5 20H9" /><path d="M15 4h1.5A2.5 2.5 0 0 1 19 6.5v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H15" /></Svg>,
  db: <Svg sw={1.7}><ellipse cx="12" cy="5.5" rx="8" ry="2.8" /><path d="M4 5.5v13c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8v-13" /><path d="M4 12c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8" /></Svg>,
  audit: <Svg sw={1.7}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></Svg>,
  set: <Svg sw={1.7}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5 2 2 0 0 1-4 0 1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1 2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5 2 2 0 0 1 4 0 1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1 2 2 0 0 1 0 4 1.6 1.6 0 0 0-1.5 1Z" /></Svg>,
  ontology: <Svg sw={1.7}><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M8.3 7.1 15.7 10.9" /><path d="M8.3 16.9 15.7 13.1" /></Svg>,
  mapping: <Svg sw={1.7}><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" /><path d="m18 2 4 4-4 4" /><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" /><path d="M14.5 15.8c.7 1.3 2.1 2.2 3.6 2.2H22" /><path d="m18 14 4 4-4 4" /></Svg>,
  info: <Svg sw={1.7}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Svg>,
  imp: <Svg sw={1.7}><path d="M12 3v10" /><path d="m8 9 4 4 4-4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Svg>,
  generate: <Svg sw={1.7}><path d="m9 3 1.4 3.9L14 8l-3.6 1.1L9 13 7.6 9.1 4 8l3.6-1.1Z" /><path d="M17 13l.8 2.2 2.2.8-2.2.8L17 19l-.8-2.2-2.2-.8 2.2-.8Z" /></Svg>,
  designer: <Svg sw={1.7}><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4" /><path d="M6 16v-2h12v2" /></Svg>,
  groups: <Svg sw={1.7}><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><path d="M10 13h4" /></Svg>,
  bizviews: <Svg sw={1.7}><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" /><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4Z" /></Svg>,
  entities: <Svg sw={1.7}><path d="M12 2 3 7v10l9 5 9-5V7Z" /><path d="m3 7 9 5 9-5" /><path d="M12 12v10" /></Svg>,
  rel: <Svg sw={1.7}><path d="M7 8h14" /><path d="m17 4 4 4-4 4" /><path d="M17 16H3" /><path d="m7 20-4-4 4-4" /></Svg>,
  manual: <Svg sw={1.7}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" /></Svg>,
  zap: <Svg sw={1.7}><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></Svg>,
  query: <Svg sw={1.7}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Svg>,
  compare: <Svg sw={1.7}><rect x="3" y="4" width="7.5" height="16" rx="1.5" /><rect x="13.5" y="4" width="7.5" height="16" rx="1.5" /><path d="M6.75 9v6M17.25 9v6" /></Svg>,
  shield: <Svg sw={1.7}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></Svg>,
  skills: <Svg sw={1.7}><path d="m12 3 2.4 5.3L20 9l-4 4 1 6-5-2.8L7 19l1-6-4-4 5.6-.7Z" /></Svg>,
  skillAdd: <Svg sw={1.7}><path d="M12 5v14M5 12h14" /></Svg>,
  skillList: <Svg sw={1.7}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></Svg>,
  play: <Svg sw={1.7}><path d="M8 5v14l11-7Z" /></Svg>,
  member: <Svg sw={1.7}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>,
};

const ONT_ITEMS = [
  ["ont_information", ICO.info, "Information"],
  ["ont_generate", ICO.generate, "Generate"],
  ["ont_designer", ICO.designer, "Graph Design"],
  ["ont_entities", ICO.entities, "Entities"],
  ["ont_relationships", ICO.rel, "Relationships"],
  ["ont_import", ICO.imp, "Import"],
];
// 사용 순서대로 배치: 자동 매핑 → 수동 보완(Designer/Manual) → 실체화 → 점검. Import(준비 중)는 맨 뒤.
const MAP_ITEMS = [
  ["map_information", ICO.info, "Information"],
  ["map_automap", ICO.zap, "Auto-Map"],
  ["map_designer", ICO.designer, "Graph Design"],
  ["map_manual", ICO.manual, "Manual"],
  ["map_materialize", ICO.rag, "Materialize"],
  ["map_diagnostics", ICO.shield, "Diagnostics"],
  ["map_import", ICO.imp, "Import"],
];
// [id, icon, i18n키] — 라벨은 t[key] 로 해석
const SKILL_ITEMS = [
  ["skillCreate", null, "navSkillCreate"],
  ["skillManage", null, "navSkillManage"],
];

// SSO 로그인 상태 — Login 이 화이트리스트 검증 후 저장한 값을 복원. email 있으면 로그인 상태.
function readAuth() {
  const email = localStorage.getItem("ember_email");
  if (!email) return null;
  const isAdmin = localStorage.getItem("ember_role_admin") === "1";
  // 표시 이름은 이메일 로컬파트에서 뽑는다 — Entra 로그인 응답(/api/auth/login)이
  // email·role·is_admin 만 주고 displayName 은 없다. 클레임에서 이름을 꺼내오게 되면
  // 여기만 바꾸면 된다(소비처는 auth.name 하나뿐).
  const local = email.split("@")[0];
  return {
    user: email,
    email,
    name: local,
    initial: (local[0] || "?").toUpperCase(),
    role: localStorage.getItem("ember_role") || "member",
    // 저장 값은 기존 member 를 유지하되 제품 화면에서는 운영 역할을 "편집자"로 설명한다.
    roleName: isAdmin ? "관리자" : "편집자",
    isAdmin,
  };
}

export default function App() {
  const [auth, setAuth] = useState(readAuth);
  const [menuAllow, setMenuAllow] = useState(null);   // Set(허용메뉴) | null(=전체, admin)
  // 한국어 고정 — 우측 상단 KO/EN 토글을 제거했다. STR.en 사전과 화면들의 lang prop 은
  // 그대로 둔다. 화면 코드가 전부 `ko ? … : …` 로 분기하고 있어 걷어내면 앱 전체가 바뀐다.
  const lang = "ko";
  const [theme, setTheme] = useState(() => localStorage.getItem("ember_theme") || "dark");   // 블랙 default
  const [brand, setBrand] = useState(() => localStorage.getItem("ember_brand") || "ember");   // 화이트라벨 시연: ember | kt (로고 더블클릭 전환)
  // 화면과 화면에 넘기는 payload 는 주소에서 파생시킨다. 예전엔 useState 로만 들고 있어
  // 화면을 바꿔도 주소가 그대로였고, 그래서 히스토리가 쌓이지 않아 뒤로가기가 앱 밖으로
  // 나갔다. payload 를 history state 에 실으면 뒤로/앞으로가 그 화면의 맥락까지 되살린다.
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const screen = screenForPath(routerLocation.pathname);
  const nav = routerLocation.state?.nav ?? null;
  const [chatOpen, setChatOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);     // 요금제 모달
  const [sidebarView, setSidebarView] = useState("main");   // main | ontology | mapping
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ember_sidebar") === "1");   // 사이드바 접힘
  const [tip, setTip] = useState(null);   // 접힘 시 아이콘 hover 툴팁 {text, top, left}
  // 접힘 상태에서만 아이콘 옆에 메뉴명 노출. nav 가 overflow 로 CSS 툴팁을 자르므로 fixed 로 띄운다.
  const tipHandlers = (label) => collapsed ? {
    "aria-label": label,
    onMouseEnter: (e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ text: label, top: r.top + r.height / 2, left: r.right + 10 }); },
    onMouseLeave: () => setTip(null),
  } : {};
  // 사이드바 토글 + Cmd/Ctrl+B 단축키 (VS Code 관습). 접힘 상태는 localStorage 기억.
  const toggleSidebar = () => setCollapsed((c) => { localStorage.setItem("ember_sidebar", c ? "" : "1"); return !c; });
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); toggleSidebar(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // 온보딩 모달 상태 — null=닫힘, 문자열=그 draftId 로 열림.
  // 초기값은 이 탭의 활성 draft — SSO 팝업이 앱을 리로드해도 위자드가 닫히지 않고 그 스텝에서 재개된다.
  const [onbDraft, setOnbDraft] = useState(activeDraftId);
  const go = (s, payload = null) => {
    // onboarding은 라우팅 화면 대신 모달로 열림 — 기존 go("onboarding") 호출 모두 자동 대응.
    // payload 에 draftId 가 오면 그 진행분을 이어서(프로젝트 목록의 "진행중" 카드), 없으면 새로 시작.
    if (s === "onboarding") { const id = payload || newDraftId(); setActiveDraft(id); setOnbDraft(id); return; }
    // 대시보드 등에 남아 있는 go("wizard") — 은퇴한 화면 대신 API 리소스 화면으로.
    if (s === "wizard") s = "apiResource";
    // 같은 화면을 다시 누른 건(사이드바 재클릭) 히스토리에 쌓지 않는다 — 뒤로가기를
    // 여러 번 눌러야 실제로 이전 화면이 나오는 상황을 만들지 않기 위해.
    const to = pathForScreen(s);
    const state = payload == null ? null : { nav: payload };
    navigate(to, { state, replace: to === routerLocation.pathname && payload == null });
  };
  // 화면↔사이드바 동기화 — 파이프라인 바로가기 등으로 화면이 바뀌면 해당 서브메뉴로 전환
  // (query 는 모든 뷰에 노출되므로 유지)
  useEffect(() => {
    if (screen.startsWith("ont_")) setSidebarView("ontology");
    else if (screen.startsWith("map_")) setSidebarView("mapping");
  }, [screen]);
  const { active, activeId } = useProjects();
  // 사이드바 카운트 배지는 화면별 수치와 기준이 달라 혼동을 일으켜 표시하지 않는다 — 수치는 각 화면에서 확인.
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("ember_theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("ember_brand", brand); }, [brand]);
  // Ontology는 KT 브랜드 전용 — ember로 전환 시 온톨로지/매핑 드릴다운에 머물러 있으면 메인으로 복귀
  useEffect(() => { if (brand !== "kt" && (sidebarView === "ontology" || sidebarView === "mapping")) setSidebarView("main"); }, [brand, sidebarView]);
  const t = STR[lang];
  // screen이 SCREENS에 없으면 dashboard 폴백
  const Screen = SCREENS[screen] || SCREENS["dashboard"];

  // SSO 모델: 일반 기능 메뉴는 관리자/편집자 동일 노출. 조직 전역 변경은 API가 admin을 재검증한다.
  const canMenu = () => !menuAllow;   // menuAllow=null → 전체 허용
  const logout = async () => {
    try {
      await api.logout();
    } finally {
      ["ember_user", "ember_email", "ember_role", "ember_role_admin"].forEach((k) => localStorage.removeItem(k));
      setAuth(null); setMenuAllow(null);
    }
  };

  const navItem = (id, icon, label, count, payload = null) => {
    const active = screen === id;
    return (
      <div onClick={() => { setTip(null); go(id, payload); }} {...tipHandlers(label)}
        style={{ display: "flex", alignItems: "center", gap: 11, margin: "2px 12px", padding: "11px 14px", borderRadius: 13, cursor: "pointer",
          justifyContent: collapsed ? "center" : "flex-start",
          background: active ? "var(--blue)" : "transparent", color: active ? "#fff" : "var(--text)", fontWeight: active ? 700 : 600,
          boxShadow: active ? "0 10px 22px rgba(0,181,166,.30)" : "none" }}>
        {icon}
        {!collapsed && <span style={{ flex: 1, fontSize: 13.5 }}>{label}</span>}
        {!collapsed && count != null && <span className="mono" style={{ fontSize: 11, background: active ? "rgba(255,255,255,.22)" : "var(--main)", color: active ? "#fff" : "var(--muted)", padding: "1px 8px", borderRadius: 9 }}>{count}</span>}
      </div>
    );
  };
  const navDisabled = (icon, label, badge) => (
    <div {...tipHandlers(label)}
      style={{ display: "flex", alignItems: "center", gap: 11, margin: "2px 12px", padding: "11px 14px", borderRadius: 13, color: "var(--muted)", cursor: "default", justifyContent: collapsed ? "center" : "flex-start" }}>
      {icon}
      {!collapsed && <span style={{ flex: 1, fontSize: 13.5 }}>{label}</span>}
      {!collapsed && badge && <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--muted)", background: "var(--main)", padding: "2px 8px", borderRadius: 9 }}>{badge}</span>}
    </div>
  );
  // 접힘 시 그룹 헤더는 얇은 구분선으로 대체
  const grp = (txt) => collapsed
    ? <div style={{ height: 1, background: "var(--line2)", margin: "10px 16px" }} />
    : <p style={{ margin: 0, padding: "14px 24px 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--faint)" }}>{txt}</p>;
  // 드릴다운: 클릭 시 사이드바를 서브메뉴로 전환하고 기본 화면으로 이동
  const navDrill = (icon, label, view, first) => (
    <div onClick={() => { setTip(null); setSidebarView(view); go(first); }} {...tipHandlers(label)}
      style={{ display: "flex", alignItems: "center", gap: 11, margin: "2px 12px", padding: "11px 14px", borderRadius: 13, cursor: "pointer", background: "transparent", color: "var(--text)", fontWeight: 600, justifyContent: collapsed ? "center" : "flex-start" }}>
      {icon}
      {!collapsed && <span style={{ flex: 1, fontSize: 13.5 }}>{label}</span>}
    </div>
  );
  // 현재 온톨로지/매핑이 어느 프로젝트 것인지 표시 (프로젝트별임을 시각화)
  // 서브메뉴 → 전체 메뉴 복귀
  const backRow = (label) => (
    <div onClick={() => setSidebarView("main")} title={collapsed ? label : undefined}
      style={{ display: "flex", alignItems: "center", gap: 7, margin: "2px 12px 4px", padding: "9px 14px", borderRadius: 11, cursor: "pointer", color: "var(--muted)", fontSize: 12.5, fontWeight: 700, justifyContent: collapsed ? "center" : "flex-start" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      {!collapsed && <span>{label}</span>}
    </div>
  );
  if (!auth) return <Login onLogin={() => setAuth(readAuth())} />;

  return (
    // onbOpen이면 온보딩 모달을 app-shell 위에 fixed로 올림 — app-shell 바깥에 마운트해야 z-index 충돌 없음
    <div className="app-root" style={{ height: "100vh", padding: 18, background: "var(--lav)" }}>
      <div className="app-shell" style={{ height: "100%", display: "flex", background: "var(--app)", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 70px rgba(54,64,120,.16)" }}>
        {/* SIDEBAR */}
        <aside className="app-sidebar" style={{ width: collapsed ? 76 : 248, flexShrink: 0, background: "var(--app)", borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", padding: "22px 0", transition: "width .16s ease" }}>
          {/* 로고 + 접기 토글. 로고 더블클릭 시 화이트라벨 전환. 토글(또는 ⌘/Ctrl+B)로 사이드바 접기/펴기. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 8, padding: collapsed ? "0 0 14px" : "0 18px 16px" }}>
          {!collapsed && (
          <div onDoubleClick={() => setBrand((b) => (b === "ember" ? "kt" : "ember"))}
               title="더블클릭: 브랜드 전환"
               style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer", userSelect: "none", minWidth: 0 }}>
            {brand === "kt" ? (
              <>
                {/* KT CI 워드마크: 다크 테마=White, 라이트 테마=Standard(블랙+레드) */}
                <img className="kt-wordmark" alt="KT"
                     src={theme === "dark" ? "/kt-wordmark-white.png" : "/kt-wordmark-standard.png"}
                     style={{ height: 26, width: "auto", flexShrink: 0, display: "block" }} />
                <div style={{ width: 1.5, height: 30, background: "var(--line2)", borderRadius: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>Ontology Platform</div>
              </>
            ) : (
              <>
                {/* dev: EmberLink 워드마크 SVG (테마별 CSS 토글) */}
                <img className="ember-logo-light" src="/ember-logo-light.svg" alt="Ember Link" style={{ height: 40, width: "auto" }} />
                <img className="ember-logo-dark" src="/ember-logo-dark.svg" alt="Ember Link" style={{ height: 40, width: "auto" }} />
              </>
            )}
          </div>
          )}
          <button onClick={toggleSidebar} title="사이드바 접기/펴기 (⌘/Ctrl+B)"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, flexShrink: 0, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 9, cursor: "pointer", color: "var(--muted)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
            </svg>
          </button>
          </div>
          {/* 프로젝트 스위처 — 로고 직후, nav 이전 */}
          {!collapsed && <ProjectSwitcher t={t} go={go} />}

          <nav className="app-nav" style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {sidebarView === "main" && (<>
              {grp(t.gCommon)}
              {/* 프로젝트 메뉴는 COMMON 에서 뺐다 — 로고 아래 ProjectSwitcher 의
                  "전체 프로젝트 관리" 가 같은 화면으로 가고, 스위처가 현재 프로젝트까지 보여준다 */}
              {canMenu("dashboard") && navItem("dashboard", ICO.dash, t.navDash)}
              {navItem("projectSettings", ICO.set, t.projResources)}
              {/* DATA RESOURCE = 변환 前 레거시. 타입별 메뉴가 그대로 변환 진입점이고,
                  변환 결과물은 아래 MCP 그룹에서 본다. 서브카테고리 헤더 3줄(API/DATABASE/
                  KNOWLEDGE)은 클릭할 메뉴가 없어 자리만 차지했으므로 없애고 1depth 로 폈다. */}
              {grp(t.gDatasource)}
              {canMenu("apiResource") && navItem("apiResource", ICO.api, t.navApiRes)}
              {canMenu("dbResource") && navItem("dbResource", ICO.db, t.navDbRes)}
              {canMenu("rag") && navItem("rag", ICO.rag, t.navRag)}
              {/* Ontology 그룹은 KT 브랜드에서만 노출(로고 더블클릭 전환) — line 142 sidebarView 리셋과 일관 */}
              {brand === "kt" && (<>
                {grp(t.gOntology)}
                {canMenu("ontology") && navDrill(ICO.ontology, t.navOntology, "ontology", "ont_information")}
                {canMenu("mapping") && navDrill(ICO.mapping, t.navMapping, "mapping", "map_information")}
                {navItem("query", ICO.query, "Query")}
              </>)}
              {grp(t.gRegistry)}
              {/* 카운트 배지는 정책상 미표시 — mcpCount 배지는 취하지 않고 RBAC 게이팅만 유지 */}
              {canMenu("explorer") && navItem("explorer", ICO.exp, t.navExplorer)}
              {canMenu("mcpMonitor") && ((active?.resource_count > 0)
                ? navItem("mcpMonitor", ICO.monitor, t.navMonitor)
                : navDisabled(ICO.monitor, t.navMonitor, lang === "ko" ? "변환 후" : "after convert"))}
              {/* 「MCP 변환 마법사」는 이 그룹에서 은퇴 — 변환은 DATA RESOURCE 쪽 진입점으로 옮겼다.
                  라우트(screen=wizard)는 기존 북마크·문서 링크를 위해 남기고 리다이렉트한다. */}
              {/* Skill 생성·관리를 1depth 로 폈다. 항목이 둘뿐이라 드릴다운을 한 단계 두는 값이
                  없었다 — Skills 를 누르고 사이드바가 갈아끼워진 뒤에야 목표 메뉴가 보였다. */}
              {grp(t.gSkills)}
              {SKILL_ITEMS.map(([id, ic, key]) => (canMenu(id) &&
                <div key={id}>{navItem(id, ic || (id === "skillCreate" ? ICO.skillAdd : ICO.skillList), t[key])}</div>))}
              {grp(t.gSystem)}
              {auth.isAdmin && navItem("members", ICO.member, "Member")}
              {canMenu("playground") && navItem("playground", ICO.play, t.navPlayground)}
              {canMenu("health") && navItem("health", ICO.shield, t.navHealth)}
              {canMenu("audit") && navItem("audit", ICO.audit, t.navAudit)}
              {navDisabled(ICO.set, t.navSettings)}
            </>)}
            {sidebarView === "ontology" && (<>
              {backRow(t.navBackMenu)}
              {navDrill(ICO.mapping, t.navMapping, "mapping", "map_information")}
              {grp(t.gOntDesign)}
              {ONT_ITEMS.map(([id, ic, lb]) => <div key={id}>{navItem(id, ic, lb)}</div>)}
              {grp("VALIDATE")}
              {navItem("query", ICO.query, "Query")}
            </>)}
            {sidebarView === "mapping" && (<>
              {backRow(t.navBackMenu)}
              {navDrill(ICO.ontology, t.navOntology, "ontology", "ont_information")}
              {grp(t.gMapDesign)}
              {MAP_ITEMS.map(([id, ic, lb]) => <div key={id}>{navItem(id, ic, lb)}</div>)}
              {grp("VALIDATE")}
              {navItem("query", ICO.query, "Query")}
            </>)}
          </nav>

          {!collapsed && (
          /* 계정 · 플랜 (사이드바 하단) — 이름/이메일/역할은 SSO 로그인 정보에서 온다.
             예전엔 여기에 특정인의 이름·메일이 하드코딩돼 있어 누가 로그인하든 같은 사람으로
             보였다. 우측 상단에 있던 계정 배지와 로그아웃도 이 카드로 합쳤다. */
          <div style={{ margin: "8px 16px 0", padding: "12px 13px", background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div title={auth.email} style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1b2440,#3a456b)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0, textTransform: "uppercase" }}>{auth.initial}</div>
              <div style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.name}</div>
                <div title={auth.email} style={{ fontSize: 10.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth.email}</div>
              </div>
              <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: "var(--blue)", background: "var(--blue-bg)", padding: "3px 8px", borderRadius: 8 }}>{auth.roleName}</span>
              <button onClick={logout} title="로그아웃" aria-label="로그아웃"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, flexShrink: 0, background: "var(--main)", border: "none", borderRadius: 9, cursor: "pointer", color: "var(--muted)" }}>
                <Svg size={14}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>
              </button>
            </div>
            <button onClick={() => setPricingOpen(true)}
              style={{ marginTop: 10, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#00b5a6,#6b8cff)", boxShadow: "0 8px 18px rgba(0,181,166,.28)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9Z" /></svg>
              요금제 업그레이드
            </button>
          </div>
          )}

          {/* 접힘(76px) 상태 — 계정 카드는 폭이 모자라 감추지만 로그아웃 경로는 남겨야 한다.
              예전엔 로그아웃이 상단바에 있어 접어도 눌렀는데, 상단바 계정 배지를 없앤 뒤로
              여기가 유일한 출구가 됐다. */}
          {collapsed && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <button onClick={logout} title={`${auth.email} · 로그아웃`} aria-label="로그아웃"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 11, cursor: "pointer", color: "var(--muted)" }}>
              <Svg size={15}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Svg>
            </button>
          </div>
          )}

          {/* 온톨로지 엔진 버전 (사이드바 최하단) — 브랜치에서 자동 도출, 못 뽑으면 미표시.
              KT 브랜드(Ontology Platform, 로고 더블클릭 전환)에서만 노출 — line 280 온톨로지 그룹 게이팅과 일관.
              접힘(76px) 상태에선 폭이 모자라 "v3.1" 만 남기고 전체는 툴팁으로 보여준다. */}
          {brand === "kt" && ONTOLOGY_VERSION && (
            <div title={ONTOLOGY_VERSION}
              style={{ marginTop: 10, padding: collapsed ? "0 6px" : "0 18px", textAlign: "center", fontSize: 10, fontWeight: 600, letterSpacing: ".01em", color: "var(--muted)", opacity: .7, userSelect: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {collapsed ? ONTOLOGY_VERSION.replace("ontology-", "") : ONTOLOGY_VERSION}
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main className="app-main" style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--main)", minWidth: 0 }}>
          <div className="app-topbar" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, padding: "16px 26px 0" }}>
            <JobsBell />
            <TaskStatus onOpen={(execution) => {
              if (execution) go("ragExecution", { executionId: execution.id });
              else { setSidebarView("ontology"); go("ont_generate"); }
            }} />
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "라이트 모드" : "다크 모드"} aria-label="테마 전환"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 34, background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 11, cursor: "pointer", color: "var(--text)" }}>
              {theme === "dark"
                ? <Svg size={16}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M17 7l1.4-1.4M5.6 18.4L7 17" /></Svg>
                : <Svg size={16} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />}
            </button>
            {/* 한/영 토글과 계정 배지는 제거했다. 전자는 영문 사전이 미완이라 전환해도 화면이
                반쯤 한국어로 남고, 후자는 사이드바 하단 프로필과 같은 정보를 두 번 보여줬다.
                계정·로그아웃은 사이드바 하단 한 곳으로 모았다. */}
          </div>
          <div className="app-content" style={{ flex: 1, overflowY: "auto", padding: "18px 26px 30px", minHeight: 0 }}>
            <Screen t={t} lang={lang} go={go} nav={nav} screen={screen} openChat={() => setChatOpen(true)} />
          </div>
        </main>
      </div>

      {/* 에이전트도 브랜드를 따른다 — ember(EmberLink)에서는 온톨로지 기능·문구를 아예 노출하지 않는다
          (사이드바 Ontology 그룹이 kt 에서만 보이는 것과 같은 원칙, line 142/258 참고) */}
      <Chat t={t} lang={lang} open={chatOpen} setOpen={setChatOpen} brand={brand} />
      <PricingModal open={pricingOpen} onClose={() => setPricingOpen(false)} brand={brand} />

      {/* 온보딩 모달 — app-shell 밖에서 position:fixed로 렌더하므로 사이드바/헤더에 가리지 않음 */}
      {onbDraft && (
        /* 닫아도 draft 는 지우지 않는다 — 프로젝트 목록의 "온보딩 진행중" 카드로 이어서 진행 */
        <Onboarding t={t} lang={lang} go={go} draftId={onbDraft}
          onClose={() => { setActiveDraft(null); setOnbDraft(null); }} />
      )}
      {/* 접힘 사이드바 아이콘 hover 툴팁 — nav overflow 를 넘기려 fixed */}
      {tip && (
        <div style={{ position: "fixed", top: tip.top, left: tip.left, transform: "translateY(-50%)", zIndex: 9999, pointerEvents: "none",
          background: "var(--navy)", color: "var(--app)", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap",
          padding: "6px 11px", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,.28)" }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}
