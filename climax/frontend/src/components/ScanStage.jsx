// 탐색 스테이지 — CLOUD · ON-PREM 채널 2열 + 그 아래 공용 로그.
//
// 출처 하나당 표현 하나. 예전엔 온프렘이 좌측 스택(카드 낙하)과 우측 채널에
// 두 번 나와 중복이었다. 중복은 없애되 남길 쪽은 '채널' — 같은 생김새의 카드
// 두 개가 나란히 서야 클라우드/온프렘을 같은 기준으로 비교할 수 있다.
// (좌측 스택만 남겼더니 좌우 형태가 달라 균형이 깨졌다.)
//
// 패널 높이는 3행에서 고정하고 이후 스크롤 — 한쪽만 계속 늘어나면 두 열의
// 밑변이 어긋나 화면이 무너진다.

const PRI_HI = "#2dd4bf", PRI_SOFT = "#0d2b28", PRI_LINE = "#1d4a45";
const CLOUD = "#4aa3ff", CLOUD_HI = "#8ec5ff", CLOUD_SOFT = "#0f2337";
const ONPREM = "#f5a524", ONPREM_HI = "#ffc76b", AMBER_SOFT = "#2a2010";

const ROW_H = 44;               // 발견 행 1개 높이(패딩 포함)
const VISIBLE_ROWS = 3;         // 이 이상은 스크롤

const chip = (bg, fg, bd) => ({
  display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999,
  fontSize: 9.5, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap",
  fontFamily: "var(--mono)", letterSpacing: ".03em",
  background: bg, color: fg, border: `1px solid ${bd}`,
});
const CHIP_C = chip(CLOUD_SOFT, CLOUD_HI, `color-mix(in srgb,${CLOUD} 42%,transparent)`);
const CHIP_O = chip(AMBER_SOFT, ONPREM, `color-mix(in srgb,${ONPREM} 42%,transparent)`);
const CHIP_OK = chip(PRI_SOFT, PRI_HI, PRI_LINE);
const CHIP_WAIT = chip("rgba(255,255,255,.05)", "#6f8098", "var(--line2)");

const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

function Tag({ kind }) {
  const c = kind === "db" ? [ONPREM, "rgba(245,165,36,.2)"]
    : kind === "vm" ? [CLOUD_HI, "rgba(74,163,255,.2)"]
      : [PRI_HI, PRI_SOFT];
  return (
    <span style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 4, flex: "none", color: c[0], background: c[1] }}>
      {kind.toUpperCase()}
    </span>
  );
}

function Channel({ tone, label, sub, progress, progressText, items, busy, emptyText }) {
  const isCloud = tone === "c";
  const accent = isCloud ? CLOUD : ONPREM;
  const accentHi = isCloud ? CLOUD_HI : ONPREM_HI;
  return (
    <div style={{ borderRadius: 12, border: `1px solid color-mix(in srgb,${accent} 42%,var(--line2))`, background: "rgba(9,15,23,.72)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: `linear-gradient(90deg,color-mix(in srgb,${accent} 14%,transparent),transparent)`, flexWrap: "wrap" }}>
        <span style={isCloud ? CHIP_C : CHIP_O}>{label}</span>
        {sub && <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--muted)", ...ellipsis, flex: 1, minWidth: 0 }} title={sub}>{sub}</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {busy && <span className="sc-spin" style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,.12)", borderTopColor: accentHi, flex: "none" }} />}
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{progressText}</span>
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,.07)", margin: "0 11px 9px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${Math.round(progress * 100)}%`, background: `linear-gradient(90deg,${accent},${accentHi})`, transition: "width .25s linear" }} />
      </div>
      {/* 3행까지만 보이고 이후 스크롤 — 좌측 레이더와 밑변을 맞춘다 */}
      <div style={{ padding: "0 11px 11px", maxHeight: ROW_H * VISIBLE_ROWS, overflowY: "auto", overflowX: "hidden" }}>
        {items.length === 0
          ? <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)", padding: "8px 2px" }}>{emptyText}</div>
          : items.map((it) => (
            <div key={it.key} className="sc-pop" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 8, background: "rgba(255,255,255,.035)", marginBottom: 5 }}>
              <Tag kind={it.kind} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--navy)", display: "block", ...ellipsis }} title={it.name}>{it.name}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", display: "block", ...ellipsis }} title={it.meta}>{it.meta}</span>
              </span>
              <span style={it.pending ? CHIP_WAIT : CHIP_OK}>{it.pending ? "연결정보" : "✓"}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function ScanStage({
  contacts, scanning, logs,
  cloudItems, cloudProgress, cloudProgressText, cloudSub, cloudBusy, cloudEnabled,
  onpremItems, onpremProgress, onpremProgressText, onpremRange, onpremBusy, onpremEnabled,
}) {
  return (
    <div style={{ background: "radial-gradient(120% 120% at 30% 0%,#0f1a24,#0a1017 70%)", borderRadius: 13, padding: "16px 18px" }}>
      <style>{`
        @keyframes sc-spin{to{transform:rotate(360deg)}}
        .sc-spin{animation:sc-spin .8s linear infinite}
        @keyframes sc-pop{from{opacity:0;transform:translateX(9px)}to{opacity:1;transform:none}}
        .sc-pop{animation:sc-pop .34s cubic-bezier(.2,.9,.3,1.35)}
        @media (prefers-reduced-motion: reduce){.sc-spin,.sc-pop{animation:none}}
      `}</style>

      {/* 채널 2열 — 같은 생김새의 카드가 나란히 서야 두 출처를 같은 기준으로 읽는다.
          폭이 모자라면 눌리는 대신 세로로 접는다(auto-fit). */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, alignItems: "stretch", marginBottom: 10 }}>
        {cloudEnabled && (
          <Channel tone="c" label="CLOUD" sub={cloudSub} busy={cloudBusy}
            progress={cloudProgress} progressText={cloudProgressText}
            items={cloudItems} emptyText="구독 조회 중…" />
        )}

        {onpremEnabled ? (
          <Channel tone="o" label="ON-PREM" sub={onpremRange} busy={onpremBusy}
            progress={onpremProgress} progressText={onpremProgressText}
            items={onpremItems} emptyText={onpremBusy ? "지정한 호스트 확인 중…" : "발견된 대상 없음"} />
        ) : (
          // 범위에서 뺀 경우 — 칸을 비우면 좌우 균형이 깨지므로 같은 자리에 이유를 적는다
          <div style={{ borderRadius: 12, border: "1px dashed #1a2432", background: "rgba(9,15,23,.72)", display: "grid", placeItems: "center", padding: 24, textAlign: "center", minHeight: 120 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)", lineHeight: 1.8 }}>
              ON-PREM<br />범위에서 제외됨<br /><span style={{ color: "var(--muted)" }}>클라우드만 탐색합니다</span>
            </div>
          </div>
        )}
      </div>

      {/* 공용 로그 — 채널별로 나누면 시간 순서가 깨지므로 한 줄기로 흘리고 레인 색으로 구분 */}
      <div style={{ background: "#080d14", borderRadius: 10, padding: "9px 11px", fontFamily: "var(--mono)", fontSize: 10, lineHeight: 1.9, color: "#8592a6", height: 104, overflowY: "auto" }}>
        {logs.length === 0 && <span style={{ color: "#3f4a5c" }}>탐색을 준비하는 중…</span>}
        {logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline" }}>
            <span style={{ color: "#3f4a5c", flex: "none" }}>[{l.t}]</span>
            <span style={{ width: 3, borderRadius: 2, alignSelf: "stretch", flex: "none", margin: "3px 0", background: l.ch === "c" ? CLOUD : l.ch === "k" ? "#a78bfa" : ONPREM }} />
            <span style={{ color: l.cls === "found" ? (l.ch === "c" ? CLOUD_HI : l.ch === "k" ? "#c4b5fd" : PRI_HI) : l.cls === "nope" ? "#5b667a" : "#c9d4e3", fontWeight: l.cls === "found" ? 700 : 400, ...ellipsis }}>
              {l.txt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
