// 연결할 소스 종류 — 복수 선택 카드 + 수확량 게이지.
//
// 이전 화면은 라디오 3택이라 "코드도 보고 DB 도 본다" 를 표현할 수 없었다. 체크박스로 바꾸고,
// 고른 종류마다 입력 화면이 하나씩 붙는 구조로 간다(서브스텝이 선택에 따라 늘어난다).
//
// 카드에 일러스트와 **수확량 게이지**를 넣는다. 사용자가 실제로 궁금한 건 설명이 아니라
// "이걸 고르면 무엇을 얼마나 얻나" 인데, 이전엔 그게 맨 아래 한 줄 텍스트였다.

/** 카드 일러스트 — 제품 라인아트 문법(stroke .75/1.25/2, 8px 그리드, 면은 그라디언트). */
const IL = {
  code: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      <g opacity=".55">
        {[24, 42, 60].map((y) => [16, 34].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="4" fill="var(--card)" stroke="var(--faint)" strokeWidth=".75" />
        )))}
      </g>
      <path d="M56 48h26" stroke="var(--blue)" strokeWidth="2" />
      <circle cx="88" cy="48" r="2.5" fill="var(--blue)" />
      <path d="M94 48h14" stroke="var(--blue)" strokeWidth="2" />
      <rect x="112" y="24" width="72" height="20" rx="6" fill="url(#obTeal)" stroke="var(--blue)" strokeWidth="1.5" />
      <rect x="112" y="52" width="72" height="20" rx="6" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.5" />
      <path d="M122 34h26M122 62h34" stroke="var(--blue)" strokeWidth="1.25" opacity=".55" />
    </svg>
  ),
  openapi: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      {[22, 46, 70].map((y, i) => (
        <g key={y}>
          <rect x="30" y={y} width={i === 2 ? 96 : 140} height="18" rx="6" fill="url(#obGrey)" stroke="var(--muted)" strokeWidth="1.5" />
          <circle cx="42" cy={y + 9} r="2.5" fill="var(--muted)" />
          <path d={`M54 ${y + 9}h${[58, 44, 34][i]}`} stroke="var(--faint)" strokeWidth="1.25" />
        </g>
      ))}
    </svg>
  ),
  db: (
    <svg viewBox="0 0 200 96" fill="none" style={{ width: 150, height: "auto" }}>
      <ellipse cx="72" cy="26" rx="34" ry="11" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.75" />
      <path d="M38 26v40c0 6 15 11 34 11s34-5 34-11V26" stroke="var(--purple)" strokeWidth="1.75" fill="none" />
      <path d="M38 46c0 6 15 11 34 11s34-5 34-11" stroke="var(--purple)" strokeWidth="1.25" opacity=".6" />
      <path d="M110 52h20" stroke="var(--purple)" strokeWidth="2" />
      <circle cx="136" cy="52" r="2.5" fill="var(--purple)" />
      <path d="M142 52h10" stroke="var(--purple)" strokeWidth="2" />
      <rect x="152" y="40" width="32" height="24" rx="7" fill="url(#obPur)" stroke="var(--purple)" strokeWidth="1.5" />
    </svg>
  ),
};

/** 카드 정의. `ready:false` 는 노출하되 못 고르게 한다 — 숨기면 "이 제품은 못 한다"로 읽힌다. */
export const SOURCES = [
  {
    id: "code", title: "소스 코드", illust: IL.code, ready: false,
    desc: "사내 Git 서버의 저장소를 읽습니다. API 와 데이터베이스를 한 번에 얻습니다.",
    chips: [["api", "⇄ API 도구"], ["db", "▤ DB 도구"]],
    gauge: 92, gaugeTone: "hi", gaugeText: "가장 많음", rec: "가장 많이 얻습니다",
    soon: "코드 읽기 기능 준비 중",
  },
  {
    id: "openapi", title: "이미 열려 있는 API", illust: IL.openapi, ready: true,
    desc: "API 설명서가 이미 공개된 서버 주소를 넣습니다.",
    chips: [["api", "⇄ API 도구"]],
    gauge: 48, gaugeTone: "mid", gaugeText: "보통",
  },
  {
    id: "db", title: "데이터베이스", illust: IL.db, ready: true,
    desc: "코드가 남아 있지 않은 오래된 시스템의 DB 에 직접 연결합니다.",
    chips: [["db", "▤ 조회 도구"]],
    gauge: 36, gaugeTone: "low", gaugeText: "표 개수만큼",
  },
];

const CHIP = {
  api: { bg: "var(--blue-bg)", fg: "var(--blue)", bd: "color-mix(in srgb,var(--blue) 32%,transparent)" },
  db: { bg: "var(--purple-bg)", fg: "var(--purple)", bd: "color-mix(in srgb,var(--purple) 32%,transparent)" },
};

/** 카드 그리드. 선택은 배열이며 토글이다. */
export function SourcePicker({ selected, onToggle }) {
  return (
    <>
      {/* 그라디언트는 한 번만 정의하고 카드들이 참조한다 — id 중복 시 브라우저마다 다른 걸 집는다. */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="obTeal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00b5a6" stopOpacity=".18" /><stop offset="1" stopColor="#00b5a6" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="obPur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a5cff" stopOpacity=".18" /><stop offset="1" stopColor="#7a5cff" stopOpacity=".04" />
          </linearGradient>
          <linearGradient id="obGrey" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#767d92" stopOpacity=".14" /><stop offset="1" stopColor="#767d92" stopOpacity=".03" />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 1140 }}>
        {SOURCES.map((s, i) => {
          const on = selected.includes(s.id);
          const disabled = !s.ready;
          return (
            <div key={s.id} onClick={disabled ? undefined : () => onToggle(s.id)} style={{
              border: `1.5px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
              background: on ? "var(--sel)" : "var(--card)",
              borderRadius: 18, overflow: "hidden", position: "relative",
              display: "flex", flexDirection: "column",
              cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
              boxShadow: on ? "var(--sel-ring)" : "none",
              transform: on ? "translateY(-3px)" : "none",
              transition: "transform .18s ease,border-color .18s,box-shadow .18s",
              animation: "popIn .32s ease-out both", animationDelay: `${i * 0.05}s`,
            }}>
              {s.rec && !disabled && (
                <span style={{
                  position: "absolute", top: 16, left: 18, zIndex: 2, fontSize: 10.5, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 7, background: "var(--blue)", color: "#06231f",
                }}>{s.rec}</span>
              )}
              {disabled && (
                <span style={{
                  position: "absolute", top: 16, left: 18, zIndex: 2, fontSize: 10.5, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 7, background: "var(--main)",
                  border: "1px solid var(--line2)", color: "var(--muted)",
                }}>{s.soon}</span>
              )}
              {/* 체크는 사각형이다 — 원형은 "하나만" 을 뜻한다. 모양만으로 복수 선택이 읽힌다. */}
              <span style={{
                position: "absolute", top: 16, right: 16, width: 22, height: 22, borderRadius: 7, zIndex: 2,
                border: `2px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                background: on ? "var(--sel-border)" : "var(--main)",
                display: "grid", placeItems: "center",
              }}>
                {on && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>

              <div style={{
                height: 118, display: "grid", placeItems: "center", borderBottom: "1px solid var(--line)",
                background: on
                  ? "linear-gradient(170deg,color-mix(in srgb,var(--blue) 10%,transparent),transparent 72%)"
                  : "linear-gradient(170deg,rgba(255,255,255,.035),transparent 70%)",
              }}>{s.illust}</div>

              <div style={{ padding: "16px 20px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.015em" }}>{s.title}</div>
                <div style={{ fontSize: 12.8, color: "var(--text)", lineHeight: 1.58 }}>{s.desc}</div>
                <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px dashed var(--line2)" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 650, marginBottom: 7, letterSpacing: ".04em" }}>얻는 것</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 9 }}>
                    {s.chips.map(([k, label]) => (
                      <span key={label} style={{
                        fontSize: 11, fontWeight: 700, padding: "3.5px 9px", borderRadius: 8,
                        background: CHIP[k].bg, color: CHIP[k].fg, border: `1px solid ${CHIP[k].bd}`,
                      }}>{label}</span>
                    ))}
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "var(--main)", overflow: "hidden" }}>
                    <span style={{
                      display: "block", height: "100%", width: `${s.gauge}%`, borderRadius: 3,
                      background: s.gaugeTone === "hi"
                        ? "linear-gradient(90deg,var(--blue-d),#2dd4bf)"
                        : "linear-gradient(90deg,#4a4f68,#767d92)",
                    }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                    <span>수확량</span><b style={{ color: "var(--navy)" }}>{s.gaugeText}</b>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** 선택 요약 바 — 복수 선택은 "지금 몇 개 골랐지"가 흐려진다. 합계를 상시 노출한다. */
export function SelectionSummary({ selected, onRemove, estimate }) {
  if (!selected.length) return null;
  return (
    <div style={{
      marginTop: 20, maxWidth: 1140, display: "flex", alignItems: "center", gap: 16,
      padding: "15px 20px", borderRadius: 15, background: "var(--card)",
      border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
      boxShadow: "0 10px 30px rgba(0,0,0,.28)", animation: "fadeUp .3s ease-out",
    }}>
      <div>
        <div style={{ fontFamily: "var(--disp)", fontSize: 30, fontWeight: 700, color: "var(--blue)", lineHeight: 1 }}>
          {selected.length}
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>가지 선택</div>
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flex: 1 }}>
        {selected.map((id) => {
          const s = SOURCES.find((x) => x.id === id);
          return (
            <span key={id} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 10,
              background: "var(--main)", border: "1px solid var(--line2)", fontSize: 12,
              color: "var(--navy)", fontWeight: 650,
            }}>
              {s?.title}
              <span onClick={(e) => { e.stopPropagation(); onRemove(id); }}
                style={{ color: "var(--faint)", fontSize: 13, cursor: "pointer" }}>✕</span>
            </span>
          );
        })}
      </div>
      {estimate != null && (
        <div style={{ textAlign: "right", paddingLeft: 16, borderLeft: "1px solid var(--line2)" }}>
          <div style={{ fontFamily: "var(--disp)", fontSize: 26, fontWeight: 700, color: "var(--navy)", lineHeight: 1 }}>
            ~{estimate}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>예상 도구 수</div>
        </div>
      )}
    </div>
  );
}
