/**
 * DATA RESOURCE 공용 셸 — 왼쪽 레일(연결된 레거시) + 오른쪽 작업 영역.
 *
 * DB 화면과 API 화면은 "무엇을 재료로 보느냐"만 다르고 골격이 같다. 두 벌로 만들면 상태
 * 뱃지·빈 상태·에러 처리가 서서히 어긋나므로 셸을 하나로 두고 재료 패널만 주입받는다.
 */
import { useEffect, useState } from "react";

export const STATUS = {
  connected: { ko: "미변환", en: "Not converted", c: "var(--muted)", bg: "var(--main)" },
  introspected: { ko: "스키마 수집됨", en: "Introspected", c: "var(--amber)", bg: "var(--amber-bg)" },
  converted: { ko: "변환됨", en: "Converted", c: "var(--green)", bg: "var(--green-bg)" },
};

export const panel = {
  background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 16,
  padding: "16px 18px",
};
export const lab = { display: "block", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text)", marginBottom: 6 };
export const inp = {
  width: "100%", border: "1px solid var(--line2)", borderRadius: 11, padding: "10px 13px",
  fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--navy)", outline: "none", background: "var(--card)",
};

export function StepHead({ n, title, hint, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11 }}>
      <span style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 7, background: "var(--navy)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700 }}>{n}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)" }}>{title}</span>
      {hint && <span style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

export function Btn({ children, onClick, tone = "ghost", disabled, style, title }) {
  const tones = {
    pri: { background: "var(--blue)", color: "#fff", border: "1px solid var(--blue)" },
    ghost: { background: "var(--card)", color: "var(--text)", border: "1px solid var(--line2)" },
    danger: { background: "transparent", color: "var(--red)", border: "1px solid var(--red-bg)" },
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10,
        fontFamily: "var(--sans)", fontSize: 12, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, ...tones[tone], ...style }}>{children}</button>
  );
}

/** 목록/스키마 로드처럼 "부르면 상태 3종이 따라오는" 호출의 반복 제거. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fn().then(
      (data) => alive && setState({ loading: false, data, error: "" }),
      (e) => alive && setState({ loading: false, data: null, error: String(e.message || e) }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

function SourceCard({ src, ko, selected, onSelect, onDelete, meta }) {
  const st = STATUS[src.status] || STATUS.connected;
  return (
    <div onClick={() => onSelect(src.id)}
      style={{ border: `1px solid ${selected ? "var(--blue)" : "var(--line2)"}`, borderRadius: 13,
        padding: "11px 12px", marginBottom: 8, cursor: "pointer", background: "var(--card)",
        boxShadow: selected ? "0 0 0 3px color-mix(in srgb,var(--blue) 18%,transparent)" : "none" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--navy)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{src.name}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta(src)}</div>
        </div>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(src); }} title={ko ? "연결 해제" : "Disconnect"}
            style={{ border: "none", background: "transparent", color: "var(--faint)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 2 }}>×</button>
        )}
      </div>
      <span style={{ display: "inline-block", marginTop: 7, fontSize: 9.5, fontWeight: 700, padding: "2px 8px",
        borderRadius: 6, color: st.c, background: st.bg }}>
        {(ko ? st.ko : st.en)}{src.tool_count > 0 ? ` ${src.tool_count} tool` : ""}
      </span>
    </div>
  );
}

export default function ResourceWorkbench({
  ko, title, subtitle, icon, count,
  sources, loading, error, selectedId, onSelect, onDelete, meta,
  emptyTitle, emptyHint, addLabel, addForm, children,
}) {
  const [adding, setAdding] = useState(false);
  const empty = !loading && !error && sources.length === 0;

  return (
    <div style={{ animation: "fadeUp .3s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--blue-bg)", color: "var(--blue)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>{title}</h1>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>
        </div>
        {count != null && (
          <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", background: "var(--main)", padding: "5px 11px", borderRadius: 9 }}>{count}</span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,236px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div>
          <div className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "var(--faint)", margin: "0 0 8px 2px" }}>
            {ko ? "연결된 레거시" : "CONNECTED"}
          </div>
          {loading && <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>{ko ? "불러오는 중…" : "Loading…"}</div>}
          {error && <div style={{ fontSize: 11.5, color: "var(--red)", padding: "10px 2px", lineHeight: 1.6 }}>{error}</div>}
          {sources.map((s) => (
            <SourceCard key={s.id} src={s} ko={ko} meta={meta}
              selected={s.id === selectedId} onSelect={onSelect} onDelete={onDelete} />
          ))}
          {addForm && (
            adding
              ? <div style={{ ...panel, padding: "13px 14px" }}>{addForm(() => setAdding(false))}</div>
              : <Btn onClick={() => setAdding(true)} style={{ width: "100%", justifyContent: "center" }}>+ {addLabel}</Btn>
          )}
        </div>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {empty ? (
            <div style={{ ...panel, padding: "44px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--navy)" }}>{emptyTitle}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, lineHeight: 1.7 }}>{emptyHint}</div>
            </div>
          ) : !selectedId ? (
            <div style={{ ...panel, padding: "44px 24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
              {ko ? "왼쪽에서 레거시를 선택하세요" : "Select a resource on the left"}
            </div>
          ) : children}
        </div>
      </div>
    </div>
  );
}
