import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useProjects } from "../ProjectContext";

// Skill 관리 — 목록/검색/태그필터 + 선택 상세(미니 플로우·수정·삭제). 생성/수정은 SkillBuilder(go).
export default function SkillManager({ t, lang, go }) {
  const ko = lang === "ko";
  const { activeId } = useProjects();
  const [skills, setSkills] = useState([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [selId, setSelId] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    api.listSkills(q, tag)
      .then((d) => setSkills(d.results))
      .catch(() => setSkills([]));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [activeId, q, tag]);

  // 태그 칩 — 현재 로드된 skill 들에서 수집(활성 필터는 서버가 처리)
  const tags = useMemo(() => {
    const c = {};
    skills.forEach((s) => (s.tags || []).forEach((x) => (c[x] = (c[x] || 0) + 1)));
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [skills]);

  const sel = skills.find((s) => s.id === selId) || null;

  const del = async (s) => {
    if (!window.confirm(ko ? `'${s.name}' Skill을 삭제할까요?` : `Delete skill '${s.name}'?`)) return;
    setBusy(true);
    try { await api.deleteSkill(s.id); setSelId(null); reload(); }
    finally { setBusy(false); }
  };

  const stepDots = (steps) => (
    <div className="skl-dots">
      {steps.map((st, i) => <i key={i} className={st.type === "mcp" ? "m" : "p"} />)}
    </div>
  );

  return (
    <div className="skl-page">
      <div className="skl-head">
        <div className="skl-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </div>
        <div>
          <h1>{t.navSkillManage}</h1>
          <p>{ko ? "등록된 Skill을 검색·수정·삭제합니다" : "Search, edit and delete registered skills"}</p>
        </div>
        <div className="sp">
          <button className="skl-btn pri" onClick={() => go("skillCreate")}>＋ {t.navSkillCreate}</button>
        </div>
      </div>

      <div className="skl-toolbar">
        <div className="find">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={ko ? "이름 · /slug · 설명 · 태그 검색" : "Search name · /slug · description · tag"} />
        </div>
        <button className={`skl-chip ${!tag ? "on" : ""}`} onClick={() => setTag("")}>
          {ko ? "전체" : "All"} {skills.length}
        </button>
        {tags.map(([tg, n]) => (
          <button key={tg} className={`skl-chip ${tag === tg ? "on" : ""}`} onClick={() => setTag(tag === tg ? "" : tg)}>
            {tg} {n}
          </button>
        ))}
      </div>

      {skills.length === 0 ? (
        <div className="skl-empty" style={{ background: "var(--card)", borderRadius: 16, padding: 44 }}>
          {ko ? "등록된 Skill이 없습니다. 새 Skill을 만들어보세요." : "No skills yet. Create one to get started."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: sel ? "1.4fr 1fr" : "1fr", gap: 14, alignItems: "start" }}>
          <div className="skl-grid">
            {skills.map((s) => (
              <div key={s.id} className={`skl-card ${selId === s.id ? "sel" : ""}`} onClick={() => setSelId(s.id)}>
                <div className="top">
                  <b>{s.name}</b>
                  <span className="skl-slugmini">/{s.slug}</span>
                  {!s.enabled && <span className="skl-tagx" style={{ color: "var(--amber)" }}>{ko ? "비노출" : "hidden"}</span>}
                </div>
                {s.description && <div className="desc">{s.description}</div>}
                <div className="meta">
                  {stepDots(s.steps)}
                  {(s.tags || []).map((tg) => <span key={tg} className="skl-tagx">#{tg}</span>)}
                  <span className="stat">{s.steps.length} steps · {(s.updated_at || "").slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>

          {sel && (
            <div className="skl-detail">
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <b style={{ fontSize: 15, color: "var(--navy)" }}>{sel.name}</b>
                <span className="skl-slugmini">/{sel.slug}</span>
              </div>
              {sel.description && <p style={{ fontSize: 12.5, color: "var(--text)", margin: "9px 0 4px", lineHeight: 1.55 }}>{sel.description}</p>}
              <div className="skl-lbl">{ko ? "파이프라인" : "Pipeline"} ({sel.steps.length} steps)</div>
              <div className="skl-mini">
                {sel.steps.map((st, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {i > 0 && <span className="skl-miniarr">→</span>}
                    <span className={`skl-mininode ${st.type === "mcp" ? "m" : "p"}`}>
                      {st.type === "mcp" ? st.tool_id : "💬 prompt"}
                    </span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button className="skl-btn pri" style={{ flex: 1 }} onClick={() => go("skillCreate", { editId: sel.id })}>
                  ✏️ {ko ? "수정" : "Edit"}
                </button>
                <button className="skl-btn danger" disabled={busy} onClick={() => del(sel)}>
                  {ko ? "삭제" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
