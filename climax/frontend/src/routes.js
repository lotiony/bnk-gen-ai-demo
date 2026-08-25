// 화면 id ↔ 주소 대응표.
//
// 화면 id("skillCreate" 등)는 앱 전체가 이미 go(id) 로 쓰고 있는 이름이라 그대로 두고,
// 주소만 새로 붙인다. 화면 코드를 한 줄도 건드리지 않고 히스토리를 얻는 게 목적이다.
//
// 여기 없는 화면은 대시보드로 떨어진다 — 오타난 주소가 흰 화면이 되는 것보다 낫다.
export const DEFAULT_SCREEN = "dashboard";

export const SCREEN_PATH = {
  dashboard: "/",
  projects: "/projects",
  projectSettings: "/projects/settings",

  apiResource: "/resources/api",
  dbResource: "/resources/db",
  rag: "/resources/rag",
  ragExecution: "/resources/rag/execution",

  explorer: "/mcp/explorer",
  mcpMonitor: "/mcp/monitor",

  skillCreate: "/skills/create",
  skillManage: "/skills/manage",

  playground: "/playground",
  members: "/members",
  health: "/health",
  audit: "/audit",
  query: "/query",

  ont_information: "/ontology/information",
  ont_import: "/ontology/import",
  ont_generate: "/ontology/generate",
  ont_designer: "/ontology/designer",
  ont_entities: "/ontology/entities",
  ont_relationships: "/ontology/relationships",

  map_information: "/mapping/information",
  map_import: "/mapping/import",
  map_designer: "/mapping/designer",
  map_manual: "/mapping/manual",
  map_automap: "/mapping/automap",
  map_materialize: "/mapping/materialize",
  map_diagnostics: "/mapping/diagnostics",
};

const PATH_SCREEN = Object.fromEntries(
  Object.entries(SCREEN_PATH).map(([screen, path]) => [path, screen]),
);

// 「MCP 변환 마법사」는 은퇴했지만 ?screen=wizard&src=… 딥링크가 문서·북마크에 남아 있다.
// 죽은 링크로 두는 대신 대응하는 DATA RESOURCE 화면으로 넘긴다.
export const LEGACY_WIZARD_SCREEN = { db: "dbResource", openapi: "apiResource", image: "apiResource" };

/** 끝의 "/" 는 같은 화면으로 본다 — 링크를 손으로 옮겨 적을 때 흔히 붙는다. */
function normalize(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function pathForScreen(screen) {
  return SCREEN_PATH[screen] || SCREEN_PATH[DEFAULT_SCREEN];
}

export function screenForPath(pathname) {
  return PATH_SCREEN[normalize(pathname)] || DEFAULT_SCREEN;
}

/**
 * 예전 딥링크(?screen=…)를 새 주소로 옮긴다. 해당 없으면 null.
 *
 * 앱이 뜨기 전에 replaceState 로 한 번 갈아끼워, 라우터가 처음부터 새 주소를 보게 한다
 * — 대시보드가 한 프레임 비쳤다가 바뀌는 깜빡임을 없앤다.
 */
export function legacyRedirect(search) {
  const q = new URLSearchParams(search || "");
  const s = q.get("screen");
  if (!s) return null;
  const screen = s === "wizard" ? (LEGACY_WIZARD_SCREEN[q.get("src")] || "apiResource") : s;
  if (!SCREEN_PATH[screen]) return null;
  q.delete("screen");
  q.delete("src");
  const rest = q.toString();
  return rest ? `${SCREEN_PATH[screen]}?${rest}` : SCREEN_PATH[screen];
}
