import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import AuthPicker from "../components/AuthPicker";
import VerificationModal from "../components/VerificationModal";

const wsvg = (children) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
const SRC = {
  image: { accent: "#e8841e", bg: "var(--amber-bg)", titleKo: "명세 이미지/문서", titleEn: "Doc / image", descKo: "Swagger 캡처·API 문서 이미지 → gpt-5.2 vision 추출", descEn: "Swagger capture / API doc image → gpt-5.2 vision", icon: <g><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15-5-5L5 21" /></g> },
  openapi: { accent: "#00BEAC", bg: "var(--blue-bg)", titleKo: "OpenAPI / Swagger", titleEn: "OpenAPI / Swagger", descKo: "실 API 서버의 Swagger URL·스펙 파일 직접 변환 (가장 정확)", descEn: "Convert a live Swagger URL / spec file (most accurate)", icon: <g><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M7 6.5h.01M7 13.5h.01" /></g> },
  db: { accent: "#7a5cff", bg: "var(--blue-bg)", titleKo: "레거시 DB", titleEn: "Legacy DB", descKo: "DB 스키마 자동 분석 → 테이블별 조회 tool 자동생성 (PostgreSQL·SQLite)", descEn: "Introspect DB schema → per-table query tools", icon: <g><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" /></g> },
};
const WFEED = [
  { tag: "scan", c: "#9aa3bd", text: "resolve source · scanning" }, { tag: "collect", c: "#1faf6b", text: "discover endpoints" },
  { tag: "ir", c: "#e8841e", text: "normalize operations → IR" }, { tag: "convert", c: "#00b5a6", text: "IR → mcp.tool" },
  { tag: "index", c: "#7a5cff", text: "embed docs · vector + bm25" }, { tag: "ok", c: "#1faf6b", text: "registry updated" },
];
const STAGES = [["수집", "Collect"], ["IR 정규화", "Normalize"], ["MCP 변환", "Convert"], ["인덱싱", "Index"]];

export default function Wizard({ t, lang, go }) {
  const ko = lang === "ko";
  const [srcType, setSrcType] = useState(() => {
    const q = new URLSearchParams(location.search).get("src");
    return SRC[q] ? q : "openapi";   // 소스코드(code) 소스는 제거됨 — 미지원 값이면 openapi 로
  });
  const [url, setUrl] = useState("");
  const [db, setDb] = useState({ dsn: "", name: "", tables: "" });
  const [auth, setAuth] = useState({ type: "none" });
  const [img, setImg] = useState(null); const [imgFile, setImgFile] = useState(null);
  const [scan, setScan] = useState("idle"); const [pct, setPct] = useState(0);
  const [result, setResult] = useState(null); const [err, setErr] = useState("");
  const [vrep, setVrep] = useState(null); const [vloading, setVloading] = useState(false);
  const timer = useRef();
  const ac = SRC[srcType].accent;

  const animate = () => { setPct(0); clearInterval(timer.current); timer.current = setInterval(() => setPct((p) => Math.min(92, p + 2.4)), 55); };
  const done = (r) => { clearInterval(timer.current); setPct(100); setResult(r); setScan("done"); };
  const fail = (m) => { clearInterval(timer.current); setErr(m); setScan("idle"); };

  const convert = async () => {
    setErr(""); setResult(null); setScan("running"); animate();
    try {
      let d;
      if (srcType === "image") {
        if (!imgFile) return fail(ko ? "이미지를 선택하세요" : "pick image");
        d = await api.scanImage(imgFile);
      } else if (srcType === "openapi") {
        d = await api.scanOpenapi({ url, auth: auth.type === "none" ? undefined : auth });
      } else if (srcType === "db") {
        if (!db.dsn) return fail(ko ? "DSN을 입력하세요" : "enter DSN");
        const tables = db.tables.split(",").map((s) => s.trim()).filter(Boolean);
        d = await api.scanDb({ dsn: db.dsn, name: db.name || "db", tables: tables.length ? tables : undefined });
      }
      done(d);
    } catch (e) { fail(String(e.message)); }
  };
  const pickImg = (e) => { const f = e.target.files[0]; if (!f) return; setImgFile(f); const rd = new FileReader(); rd.onload = () => setImg(rd.result); rd.readAsDataURL(f); };

  const runVerify = async () => {
    if (!result?.sourceId) return;
    setVloading(true);
    try {
      // sourceId 기반으로 검증 — 백엔드가 state.specs[sourceId] 에서 spec 조회
      // auth 는 openapi 소스일 때만 전달(image/code 경우 null)
      const authPayload = (srcType === "openapi" && auth.type !== "none") ? auth : null;
      const rep = await api.verifyBySourceId(result.sourceId, url, authPayload);
      setVrep(rep);
    } catch (e) {
      setErr(String(e.message));
    } finally {
      setVloading(false);
    }
  };

  const wActive = pct < 25 ? 0 : pct < 55 ? 1 : pct < 85 ? 2 : 3;
  const feedN = Math.round((pct / 100) * WFEED.length);

  return (
    <div style={{ animation: "fadeUp .3s ease-out", maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: "var(--blue-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--blue)" }}>{wsvg(<g><path d="M10 2v6l-6 11a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-11V2" /><path d="M8 2h8" /></g>)}</div>
        <div><h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>{t.wizTitle}</h1><div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{t.wizSub}</div></div>
      </div>

      {/* STEP 1 */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}><span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>1</span><span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{t.wizStep1}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 6 }}>
        {["openapi", "image", "db"].map((id) => {
          const m = SRC[id]; const on = srcType === id;
          return (
            <div key={id} onClick={() => { setSrcType(id); setScan("idle"); setResult(null); setUrl(""); }} style={{ background: on ? `color-mix(in srgb,${m.accent} 12%,var(--card))` : "var(--card)", border: "2px solid " + (on ? m.accent : "var(--line2)"), borderRadius: 18, padding: "18px 20px", cursor: "pointer", boxShadow: on ? `0 0 0 3px color-mix(in srgb,${m.accent} 20%,transparent),0 14px 30px rgba(0,0,0,.14)` : "0 6px 16px rgba(0,0,0,.05)", transform: on ? "translateY(-2px)" : "none", transition: "background .18s,border-color .18s,box-shadow .18s,transform .18s" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, color: m.accent }}>{wsvg(m.icon)}</div>
                <span style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid " + (on ? m.accent : "var(--line2)"), background: on ? `radial-gradient(circle,${m.accent} 0 5px,transparent 6px)` : "transparent" }} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--navy)" }}>{ko ? m.titleKo : m.titleEn}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>{ko ? m.descKo : m.descEn}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7" /></svg></div>

      {/* STEP 2 */}
      <div style={{ background: "var(--card)", border: "2px solid " + ac, borderRadius: 20, padding: "22px 24px", boxShadow: "0 12px 30px rgba(54,64,120,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}><span style={{ width: 24, height: 24, borderRadius: "50%", background: ac, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>2</span><span style={{ fontSize: 14, fontWeight: 700, color: "var(--navy)" }}>{t.wizStep2}</span></div>

        {srcType === "image" && (
          <label style={{ display: "block", cursor: "pointer" }}>
            <input type="file" accept="image/*" onChange={pickImg} style={{ display: "none" }} />
            {!img ? (<div style={{ border: "1.5px dashed var(--amber-bg)", borderRadius: 16, padding: "38px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center", background: "var(--amber-bg)" }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0-12 4 4m-4-4-4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></svg><div style={{ fontSize: 13, fontWeight: 700, color: "var(--navy)" }}>{t.scDrop}</div><div className="mono" style={{ fontSize: 10, color: "var(--amber)" }}>PNG · JPG · Swagger/문서 캡처</div></div>) : (<div style={{ border: "1px solid var(--line2)", borderRadius: 16, padding: 12, background: "var(--main)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><img src={img} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, objectFit: "contain" }} /><span className="mono" style={{ fontSize: 10, color: "var(--amber)" }}>다른 이미지 선택</span></div>)}
          </label>
        )}
        {srcType === "openapi" && (
          <div>
            <label className="mono" style={lab}>{t.scUrlLabel}</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://20.39.193.7:8000/openapi.json" style={{ ...inp, borderColor: "var(--line2)" }} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>{ko ? "실 API 서버의 swagger를 그대로 변환 — 가장 정확. 예: 한화 tool server openapi.json" : "Convert a live API server swagger directly."}</div>

            <AuthPicker value={auth} onChange={setAuth} lab={lab} inp={inp} />
          </div>
        )}
        {srcType === "db" && (
          <div>
            <label className="mono" style={lab}>DSN (SQLAlchemy)</label>
            <input value={db.dsn} onChange={(e) => setDb({ ...db, dsn: e.target.value })}
              placeholder="postgresql+psycopg://user:pass@host:5432/dbname  또는  ${env:HANWHA_DB_DSN}"
              style={{ ...inp, borderColor: "var(--line2)" }} />
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
              {ko ? "스키마를 자동 분석해 테이블마다 목록/단건 조회 tool을 만듭니다. 비밀번호는 ${env:...} 참조 권장 (레지스트리에 평문 저장 방지)."
                  : "Introspects schema → per-table list/get tools. Prefer ${env:...} for secrets."}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ width: 200 }}>
                <label className="mono" style={lab}>{ko ? "이름 접두어" : "name prefix"}</label>
                <input value={db.name} onChange={(e) => setDb({ ...db, name: e.target.value })} placeholder="hanwha" style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="mono" style={lab}>{ko ? "테이블 (쉼표구분, 비우면 전체)" : "tables (comma, empty=all)"}</label>
                <input value={db.tables} onChange={(e) => setDb({ ...db, tables: e.target.value })} placeholder="customers, contracts, bills" style={inp} />
              </div>
            </div>
          </div>
        )}

        {scan === "idle" && (
          <div style={{ marginTop: 18 }}>
            <button onClick={convert} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 13, border: "none", background: ac, color: "#fff", fontWeight: 700, fontSize: 13.5, fontFamily: "var(--sans)", cursor: "pointer", boxShadow: `0 10px 22px ${ac}44` }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v6l-6 11a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-11V2" /><path d="M8 2h8" /></svg>{t.wizConvert}</button>
            {err && <span style={{ marginLeft: 12, fontSize: 12, color: "var(--red)" }}>⚠ {err}</span>}
          </div>
        )}

        {scan !== "idle" && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", background: "var(--main)", borderRadius: 14, padding: "16px 18px", marginBottom: 12 }}>
              {STAGES.map(([koL, enL], i) => {
                const isDone = scan === "done" || i < wActive; const act = scan !== "done" && i === wActive;
                return (
                  <div key={i} style={{ display: "contents" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, background: isDone || act ? ac : "var(--main)", color: isDone || act ? "#fff" : "var(--muted)", border: isDone || act ? "none" : "1px solid var(--line2)", animation: act ? "pulseRing 1.4s infinite" : "none" }}>{isDone ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg> : i + 1}</span>
                      <span style={{ fontSize: 11.5, color: isDone || act ? "var(--navy)" : "var(--muted)", fontWeight: act ? 700 : 500 }}>{ko ? koL : enL}</span>
                    </div>
                    {i < 3 && <div style={{ flex: 1, height: 2, margin: "0 8px", borderRadius: 2, background: i < wActive || scan === "done" ? ac : "var(--line2)" }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
              {[["OPERATIONS", result?.discovered ?? Math.round((pct / 100) * 12), "var(--blue)"], ["MCP TOOLS", result?.added?.length ?? (pct < 50 ? 0 : Math.round((pct - 50) / 50 * 12)), "var(--amber)"], ["STRATEGY", result?.strategy || "…", "var(--navy)"]].map(([labl, v, col]) => (
                <div key={labl} style={{ background: "var(--main)", borderRadius: 14, padding: "14px 16px" }}><div className="mono" style={{ fontSize: 10, color: "var(--muted)" }}>{labl}</div><div className="mono" style={{ fontSize: typeof v === "string" ? 14 : 24, fontWeight: 800, color: col, marginTop: 3 }}>{v}</div></div>
              ))}
            </div>
            <div style={{ background: "var(--code)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 15px", borderBottom: "1px solid #25304d" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: ac, boxShadow: `0 0 8px ${ac}` }} /><span className="mono" style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#8a93b0" }}>변환 엔진 로그</span><span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "#5a6488" }}>{Math.round(pct)}%</span></div>
              <div className="mono" style={{ padding: "14px 16px", minHeight: 120, fontSize: 11.5, lineHeight: 1.85, color: "var(--code-text)" }}>
                {WFEED.slice(0, feedN).map((f, i) => <div key={i} style={{ animation: "stepIn .2s ease-out" }}><span style={{ color: f.c, fontWeight: 700 }}>[{f.tag}]</span> {f.text}</div>)}
                {scan === "running" && <div style={{ color: ac }}>▍</div>}
              </div>
            </div>
            {scan === "done" && result && (
              <div style={{ marginTop: 12, background: "var(--blue-bg)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 38, height: 38, borderRadius: "50%", background: ac, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)" }}>{ko ? "변환 완료" : "Done"}</div><div style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>{ko ? `${result.added?.length ?? 0}개 API를 MCP tool로 변환 · 전략 ${result.strategy} · 레지스트리 총 ${result.total}개` : `${result.added?.length ?? 0} converted · ${result.strategy} · ${result.total} total`}</div></div>
                <button
                  onClick={runVerify}
                  disabled={vloading}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: "1px solid var(--navy)", background: "transparent", color: "var(--navy)", fontWeight: 700, fontSize: 13, fontFamily: "var(--sans)", cursor: vloading ? "not-allowed" : "pointer", opacity: vloading ? 0.6 : 1 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  {vloading ? "검증 중…" : "실서버 검증"}
                </button>
                <button onClick={() => go("explorer")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: "none", background: ac, color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "var(--sans)", cursor: "pointer" }}>{ko ? "MCP 탐색으로" : "Explore"} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
              </div>
            )}
          </div>
        )}
      </div>
      <VerificationModal open={!!vrep} report={vrep} onClose={() => setVrep(null)} />
    </div>
  );
}

const lab = { display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", marginBottom: 6 };
const inp = { width: "100%", border: "1px solid var(--line2)", borderRadius: 12, padding: "11px 14px", fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--navy)", outline: "none", background: "var(--card)" };
