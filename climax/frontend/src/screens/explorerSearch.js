/** 탐색 입력 한 줄을 세 가지로 나눠 읽는다 — 모드를 사용자가 고르지 않게 하기 위한 규칙.
 *
 * 키워드: 지금과 동일하게 타이핑 즉시 검색(디바운스).
 * 맥락  : 문장형. LLM 2콜이 나가므로 자동 검색을 멈추고 Enter 를 기다린다.
 * 조건  : key:value 문법. 파서가 필터로 바꿔 서버에 그대로 넘긴다.
 */
export const COND_KEYS = ["method", "service", "source", "mutating", "enabled", "sort"];

const COND_RE = new RegExp(`(${COND_KEYS.join("|")})\\s*:\\s*([^\\s]+)`, "gi");
const ASK_HINT = /(찾아|알려|하고\s*싶|해줘|하는|어떻게|무엇|뭐가|뽑아|정리)/;

export function detectMode(v) {
  const t = (v || "").trim();
  if (!t) return "kw";
  if (new RegExp(`(${COND_KEYS.join("|")})\\s*:`, "i").test(t)) return "cond";
  return (t.split(/\s+/).length >= 4 || ASK_HINT.test(t)) ? "ask" : "kw";
}

export function modeLabel(mode, ko) {
  if (mode === "ask") return ko ? "맥락 · Enter" : "ask · Enter";
  if (mode === "cond") return ko ? "조건" : "condition";
  return ko ? "키워드" : "keyword";
}

/** "method:GET service:계약 만기" → {filters, rest}. rest 는 남은 자유 검색어. */
export function parseCond(v) {
  const filters = {};
  const rest = (v || "").replace(COND_RE, (_, k, val) => {
    const key = k.toLowerCase();
    if (key === "method") filters.method = val.toUpperCase().split(",").filter(Boolean);
    else if (key === "source") filters.source = val.toLowerCase().split(",").filter(Boolean);
    else if (key === "mutating") filters.mutating = val === "true";
    else if (key === "enabled") filters.enabled = val === "true";
    else if (key === "sort") filters.sort = val;
    else filters.service = val;
    return "";
  }).trim();
  return { filters, rest };
}

/** 적용된 조건을 칩으로 펼친다. origin='query' 면 질의에서 자동 추출된 것 — 배지로 표시한다. */
export function filterChips(filters, origin, ko) {
  const out = [];
  (filters.method || []).forEach((m) => out.push({ key: `method:${m}`, label: m, origin }));
  (filters.source || []).forEach((s) => out.push({ key: `source:${s}`, label: s, origin }));
  if (filters.service) out.push({ key: "service", label: filters.service, origin });
  if (filters.mutating === false) out.push({ key: "mutating", label: ko ? "읽기전용" : "read-only", origin });
  if (filters.enabled === true) out.push({ key: "enabled", label: ko ? "노출 중" : "enabled", origin });
  return out;
}

/** 최근 질의 — 서버에 둘 만한 값이 아니라 브라우저에 남긴다. */
const RQ = "ember_recent_q";

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 용량 초과는 무시 */ } };

export const recentQueries = () => read(RQ).slice(0, 6);   // 드롭다운에 펼치므로 칩 시절보다 넉넉히
export function pushQuery(q) {
  const t = (q || "").trim();
  if (!t) return;
  write(RQ, [t, ...read(RQ).filter((x) => x !== t)].slice(0, 6));
}
