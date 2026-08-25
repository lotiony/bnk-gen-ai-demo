// 온보딩 위자드 뼈대 — 상단 스텝바 · 서브스텝 · 전폭 셸.
//
// 이전 위자드는 좌측에 180px 스텝 레일을 두어 본문이 좁았다. 스텝을 상단 가로로 올리면
// 그 폭이 그대로 본문으로 돌아온다. 상단 스텝은 채워진 알약·글로우 없이 **헤어라인 레일 +
// 소형 도트**로 그린다 — 배경을 덮는 음영은 관리 도구 화면에서 값싸 보인다.
import { useEffect, useRef, useState } from "react";

/** 상단 큰 스텝바. 진행선은 하나의 레일이고, 지나온 구간만 색이 찬다. */
export function StepBar({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0, justifyContent: "center" }}>
      {steps.map((label, i) => {
        const done = i < current, now = i === current;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {i > 0 && (
              <span style={{
                width: 34, height: 1, margin: "0 12px", borderRadius: 1,
                background: done || now ? "var(--blue)" : "var(--line2)",
                opacity: done || now ? 0.55 : 1, transition: "background .2s",
              }} />
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: done ? "var(--blue)" : now ? "var(--blue)" : "var(--line2)",
                // 현재 스텝만 얇은 링. box-shadow 글로우 대신 outline 이라 배경을 물들이지 않는다.
                outline: now ? "3px solid color-mix(in srgb,var(--blue) 22%,transparent)" : "none",
                transition: "background .2s",
              }} />
              <span style={{
                fontSize: 12.5, whiteSpace: "nowrap",
                color: now ? "var(--navy)" : done ? "var(--text)" : "var(--faint)",
                fontWeight: now ? 750 : 500,
              }}>{label}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** 서브스텝 점. total 이 유동적이라(선택 개수에 따라) 확정 안 된 자리는 점선으로 비워 둔다. */
export function SubDots({ index, total, pending = 0, label }) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    const done = i < index, now = i === index;
    dots.push(<span key={i} style={{
      width: 7, height: 7, borderRadius: "50%",
      background: done ? "var(--blue-d)" : now ? "var(--blue)" : "var(--line2)",
      outline: now ? "3px solid color-mix(in srgb,var(--blue) 20%,transparent)" : "none",
    }} />);
  }
  for (let i = 0; i < pending; i++) {
    dots.push(<span key={`g${i}`} style={{
      width: 7, height: 7, borderRadius: "50%", background: "transparent",
      border: "1px dashed var(--line2)", boxSizing: "border-box",
    }} />);
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>{dots}</div>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".06em" }}>{label}</span>
    </div>
  );
}

/** 질문 + 이유. 화면당 질문 하나가 원칙이라 크게 묻고 이유를 바로 밑에 둔다. */
export function Ask({ q, why, badge }) {
  return (
    <div style={{ marginBottom: 20, maxWidth: 980, animation: "fadeUp .3s ease-out" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.03em", lineHeight: 1.28 }}>{q}</div>
      {why && <div style={{ fontSize: 13.8, color: "var(--text)", marginTop: 9, lineHeight: 1.7 }}>{why}</div>}
      {badge}
    </div>
  );
}

/** 위자드 셸 — 상단바(브랜드+스텝) / 서브바 / 본문+도우미 / 하단바. */
export function Shell({ steps, step, sub, agent, footer, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000, background: "rgba(5,7,11,.72)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 1640, height: "100%", maxHeight: 940, display: "flex", flexDirection: "column",
        background: "var(--app)", border: "1px solid var(--line2)", borderRadius: 18, overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,.55)", position: "relative",
      }}>
        {/* 아주 옅은 배경 메시 — 카드가 바닥에서 떠 보이게 하는 최소한. 눈에 띄면 실패다. */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(680px 320px at 22% 0%,rgba(0,181,166,.05),transparent 62%),"
                    + "radial-gradient(520px 280px at 88% 6%,rgba(122,92,255,.045),transparent 62%)",
        }} />

        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 20, padding: "0 24px",
          height: 60, borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#00c9b8,#009387)" }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.02em" }}>Ember Link</span>
          </div>
          <StepBar steps={steps} current={step} />
          <button onClick={onClose} style={{
            flexShrink: 0, fontSize: 11.5, color: "var(--muted)", padding: "6px 12px",
            border: "1px solid var(--line2)", borderRadius: 9, background: "transparent", cursor: "pointer",
          }}>그만두기</button>
        </div>

        {/* 서브바 — 배경 톤을 깔지 않는다. 상단에 음영 띠가 겹치면 화면이 무겁고 값싸 보인다.
            구분은 헤어라인 하나로 충분하다. */}
        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "11px 24px",
          borderBottom: "1px solid var(--line)", flexShrink: 0,
        }}>{sub}</div>

        <div style={{ position: "relative", flex: 1, display: "flex", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px 40px 24px" }}>{children}</div>
          {agent && (
            <div style={{
              width: 320, flexShrink: 0, borderLeft: "1px solid var(--line)",
              background: "color-mix(in srgb,var(--app) 55%,transparent)",
              display: "flex", flexDirection: "column",
            }}>{agent}</div>
          )}
        </div>

        <div style={{
          position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "14px 24px",
          borderTop: "1px solid var(--line)", flexShrink: 0,
        }}>{footer}</div>
      </div>
    </div>
  );
}

/** 도우미 패널 — 일러스트 → 헤드라인 → 사실 최대 3개 → 액션. 분량 상한을 컴포넌트가 강제한다. */
export function Agent({ status = "대기중", illust, headline, facts = [], note, actions = [] }) {
  return (
    <>
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--purple)" }}>
          온보딩 도우미
        </span>
        <span className="mono" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--green)" }}>
          <i style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "block" }} />{status}
        </span>
      </div>
      {illust && <div style={{ padding: "10px 20px 4px" }}>{illust}</div>}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.02em", lineHeight: 1.44, marginBottom: 12 }}>
          {headline}
        </div>
        {facts.slice(0, 3).map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 0",
            borderTop: i ? "1px solid var(--line)" : "none",
            animation: "stepIn .3s ease-out both", animationDelay: `${i * 0.06}s`,
          }}>
            <span style={{ width: 15, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
            <span style={{ fontSize: 12.8, color: "var(--text)", lineHeight: 1.56 }}>{f.text}</span>
          </div>
        ))}
        {note && (
          <div style={{
            marginTop: 13, padding: "11px 13px", borderRadius: 10, background: "var(--main)",
            borderLeft: "2px solid var(--purple)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6,
          }}>{note}</div>
        )}
        {!!actions.length && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {actions.map((a, i) => (
              <button key={i} onClick={a.onClick} style={{
                borderRadius: 10, padding: "10px 13px", fontSize: 12.5, fontWeight: a.ghost ? 600 : 700,
                textAlign: "center", cursor: "pointer", fontFamily: "var(--sans)",
                background: a.ghost ? "transparent" : "var(--purple)",
                border: a.ghost ? "1px solid var(--line2)" : "none",
                color: a.ghost ? "var(--muted)" : "#fff",
              }}>{a.label}</button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export const ICO = {
  ok: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00b5a6" strokeWidth="2" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>,
  info: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#767d92" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" /></svg>,
  warn: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8841e" strokeWidth="2" strokeLinecap="round"><path d="M12 9v5M12 17h.01" /><path d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>,
  no: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef5350" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
};

/** 버튼 — 위자드 안에서만 쓰는 최소 세트. */
export function Btn({ children, onClick, kind = "primary", disabled, style }) {
  const base = {
    borderRadius: 11, padding: "12px 22px", fontSize: 13.5, fontWeight: 700,
    fontFamily: "var(--sans)", whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1, border: "none", ...style,
  };
  const skin = kind === "ghost"
    ? { background: "transparent", border: "1px solid var(--line2)", color: "var(--text)" }
    : { background: "var(--blue)", color: "#fff", boxShadow: "0 10px 24px rgba(0,181,166,.20)" };
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...skin }}>{children}</button>;
}

/** 라벨 + 입력 + 도움말. 도움말이 있어야 담당자가 인프라 팀에 되묻지 않는다. */
export function Field({ label, hint, help, value, onChange, placeholder, mono = true }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "var(--text)", marginBottom: 7, fontWeight: 650 }}>
        {label}
        {hint && <span style={{ fontSize: 11.5, color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>{hint}</span>}
      </label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{
        background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 11, padding: "12px 15px",
        fontFamily: mono ? "var(--mono)" : "var(--sans)", fontSize: 13.5, color: "var(--navy)",
        width: "100%", outline: "none",
      }} />
      {help && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>{help}</div>}
    </div>
  );
}

/** 확인 결과 줄 — "저장됨" 이 아니라 "실제로 해봤다" 를 말하는 자리. */
export function OkLine({ children, tone = "ok" }) {
  const c = tone === "ok"
    ? { bg: "var(--green-bg)", bd: "#1c4a30", dot: "var(--green)" }
    : { bg: "var(--amber-bg)", bd: "#4a3a12", dot: "var(--amber)" };
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderRadius: 12,
      background: c.bg, border: `1px solid ${c.bd}`, fontSize: 13, maxWidth: 980, color: "var(--text)",
    }}>
      <span style={{
        width: 24, height: 24, borderRadius: "50%", background: c.dot, display: "grid",
        placeItems: "center", flexShrink: 0, color: "#fff", fontSize: 12,
      }}>{tone === "ok" ? "✓" : "!"}</span>
      <span>{children}</span>
    </div>
  );
}

/** 진행 애니메이션용 이퀄라이저 — "지금 돌고 있다"를 말하는 최소 장치. */
export function Eq({ color = "var(--blue)" }) {
  return (
    <span style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 14 }}>
      {[0, 0.15, 0.3].map((d) => (
        <i key={d} style={{
          width: 3, height: "100%", borderRadius: 2, background: color, display: "block",
          transformOrigin: "bottom", animation: `dashEq 1.1s ease-in-out ${d}s infinite`,
        }} />
      ))}
    </span>
  );
}

/** 값이 바뀔 때만 부드럽게 올라오는 카운터 — 계기판 폰트를 쓰는 자리. */
export function Num({ value, size = 26, color = "var(--navy)" }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setShown(value);
  }, [value]);
  return (
    <span key={shown} style={{
      fontFamily: "var(--disp)", fontSize: size, fontWeight: 700, color, lineHeight: 1,
      display: "inline-block", animation: "popIn .28s ease-out",
    }}>{shown}</span>
  );
}
