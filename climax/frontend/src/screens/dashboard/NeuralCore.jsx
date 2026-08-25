import { useMemo } from "react";
import { PanelHead, REDUCED, sx } from "./bits";

/* ── 코어 — 자산 라이프사이클을 뉴런 네트워크 비주얼로 표현하는 중앙 패널.
   기존 Pipeline 리본과 기능 동일: 단계별 자산 개수 표시 + 클릭 시 해당 화면 이동.
   역할 분리 원칙:
   · 순서(수집→변환→검증→개선→서빙→플랫폼)는 단계 칩의 순차 글로우가 표현한다
     — 요소 6개 + delay 6개뿐이라 순서가 어긋날 수 없다 (SCANNING 배지와 같은 문법).
   · 신경망은 순서 의미가 없는 순수 장식이다 — 여정 경로를 따라 산포된 뉴런을
     깊이(z) 레이어로 나누고 곡선 시냅스로 엮어, 잔잔한 트윙클만 반복한다.
   모션은 2단: 대기(STANDBY)는 느린 주기, 호출이 있으면(ACTIVE) 주기를 줄인다. */

/* 시드 고정 PRNG — 리렌더에도 항상 같은 망을 그린다 (Math.random 지터 방지) */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 640, H = 426;
/* 실루엣 경로 — 수집(좌하)에서 정수리를 넘어 서빙(우하)까지, 이어 줄기를 타고
   플랫폼 위까지. 뉴런은 이 경로 주변에 산포된다 (뇌 아치 + 신경삭 실루엣) */
const PATH = [
  [112, 264], [176, 160], [228, 104], [320, 80], [412, 104], [464, 160],
  [490, 262], [420, 300], [334, 306], [316, 342], [320, 378],
];
const SEG = PATH.slice(1).map((p, i) => Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]));
const LEN = SEG.reduce((a, b) => a + b, 0);
/* 줄기 시작 진행도 — 이 지점부터 산포 폭을 좁혀 신경삭으로 모은다 */
const T_TRUNK = SEG.slice(0, 8).reduce((a, b) => a + b, 0) / LEN;

/* 경로 위 s(0~LEN) 지점의 좌표와 법선 */
function pathAt(s) {
  let acc = 0;
  for (let i = 0; i < SEG.length; i++) {
    if (s <= acc + SEG[i] || i === SEG.length - 1) {
      const u = Math.min(1, Math.max(0, (s - acc) / SEG[i]));
      const [ax, ay] = PATH[i], [bx, by] = PATH[i + 1];
      const dx = (bx - ax) / SEG[i], dy = (by - ay) / SEG[i];
      return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, nx: -dy, ny: dx };
    }
    acc += SEG[i];
  }
}

function buildNet(nodeCount) {
  const rand = mulberry32(20260810);
  const dots = [];
  /* ① 경로 산포 — 뇌 구간은 폭 ±60으로 넓게, 줄기 구간은 ±13으로 좁혀 신경삭.
     각 뉴런은 깊이 z(0 원경~1 근경)를 가져 크기·밝기에 원근감이 생긴다 */
  for (let i = 0; i < nodeCount; i++) {
    const t = i / (nodeCount - 1);
    const fade = Math.min(1, Math.max(0, (t - (T_TRUNK - 0.08)) / 0.1));
    const width = 60 * (1 - fade) + 13 * fade;
    for (let tr = 0; tr < 14; tr++) {
      const s = (t + (rand() - 0.5) * 0.018) * LEN;
      const p = pathAt(Math.min(LEN, Math.max(0, s)));
      const off = (rand() * 2 - 1) * width;
      const x = p.x + p.nx * off, y = p.y + p.ny * off;
      if (y < 52 || y > 386) continue;
      if (dots.some((d) => Math.hypot(d.x - x, d.y - y) < 12)) continue;
      const z = rand();
      dots.push({ x, y, z, t: Math.min(1, Math.max(0, t + (rand() - 0.5) * 0.02)),
        r: 0.9 + z * 1.5 + rand() * 0.4, core: rand() < 0.14,
        dur: 2.6 + rand() * 4, del: -rand() * 7 });
      break;
    }
  }
  /* ② 근접 4-NN 연결 — 여정상 이웃(Δt≤0.22)끼리만. 이보다 먼 시점을 잇는 선은
     반드시 빈 계곡(아치 안쪽·줄기 옆)을 가로지르는 거슬리는 직선이 되기 때문.
     키는 중복 방지용 "i-j" 문자열, 노드쌍·길이는 Map에 함께 기록해 재파싱을 없앤다 */
  const kept = new Set(), pairOf = new Map(), lenOf = new Map();
  const link = (i, j, d) => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (kept.has(k)) return false;
    kept.add(k); pairOf.set(k, i < j ? [i, j] : [j, i]); lenOf.set(k, d);
    return true;
  };
  dots.forEach((p, i) => {
    dots.map((q, j) => [Math.hypot(p.x - q.x, p.y - q.y), j])
      .filter(([d, j]) => j !== i && d < 96 && Math.abs(p.t - dots[j].t) <= 0.22)
      .sort((a, b) => a[0] - b[0]).slice(0, 4)
      .forEach(([d, j]) => link(i, j, d));
  });
  /* ③ 근평행 중복 정리 — 한 노드에서 뻗는 두 시냅스의 방향각 차가 아주 작으면(≈14° 미만)
     사실상 겹쳐 보이는 이중선이므로 긴 쪽을 버린다 */
  const adj = new Map();
  for (const k of kept) {
    for (const n of pairOf.get(k)) {
      if (!adj.has(n)) adj.set(n, []);
      adj.get(n).push(k);
    }
  }
  dots.forEach((_, i) => {
    const mine = adj.get(i) || [];
    for (let a = 0; a < mine.length; a++) {
      for (let b = a + 1; b < mine.length; b++) {
        if (!kept.has(mine[a]) || !kept.has(mine[b])) continue;
        const oa = pairOf.get(mine[a]).find((n) => n !== i);
        const ob = pairOf.get(mine[b]).find((n) => n !== i);
        let d = Math.abs(
          Math.atan2(dots[oa].y - dots[i].y, dots[oa].x - dots[i].x) -
          Math.atan2(dots[ob].y - dots[i].y, dots[ob].x - dots[i].x));
        if (d > Math.PI) d = 2 * Math.PI - d;
        if (d < 0.24) kept.delete(lenOf.get(mine[a]) >= lenOf.get(mine[b]) ? mine[a] : mine[b]);
      }
    }
  });
  /* ④ 장거리 축삭 — 공간상 먼 뉴런끼리 잇는 긴 시냅스로 복잡계 인상을 더한다.
     단 여정상으로는 이웃(Δt≤0.22)이어야 한다 — 계곡 횡단 방지는 ②와 동일 원리 */
  let axons = 0, tries = 0;
  while (axons < 10 && tries++ < 300) {
    const i = Math.floor(rand() * dots.length), j = Math.floor(rand() * dots.length);
    if (i === j || Math.abs(dots[i].t - dots[j].t) > 0.22) continue;
    const d = Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y);
    if (d < 108 || d > 190) continue;
    if (link(i, j, d)) axons++;
  }
  /* ⑤ 곡선 시냅스 — 직선 대신 살짝 휘는 2차 베지어. 깊이 평균으로 굵기·밝기를 정해
     근경은 또렷하게, 원경은 흐릿하게 원근감을 만든다.
     t(여정 진행도 평균)와 dt(양끝 차)는 발화 웨이브용 — dt가 큰 시냅스(축삭 등)는
     전파 전선 밖에서 점등돼 무작위 번쩍임으로 보이므로 웨이브에서 제외된다 */
  const edges = [...kept].map((k) => {
    const [a, b] = pairOf.get(k);
    const A = dots[a], B = dots[b];
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    const bow = Math.max(-14, Math.min(14, (rand() - 0.5) * len * 0.36));
    const mx = (A.x + B.x) / 2 - ((B.y - A.y) / len) * bow;
    const my = (A.y + B.y) / 2 + ((B.x - A.x) / len) * bow;
    const z = (A.z + B.z) / 2;
    return { d: `M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}`,
      t: (A.t + B.t) / 2, dt: Math.abs(A.t - B.t),
      w: 0.4 + z * 0.8, o: 0.1 + z * 0.28, dur: 3 + rand() * 4.5, del: -rand() * 7 };
  });
  return { dots, edges };
}

/* 단계 뉴런 칩 — 망 주위 시계방향 아치 궤도. 배열 순서가 곧 라이프사이클 순서
   (수집 → 변환 → 검증 → 개선 → 서빙)로, 좌하단에서 출발해 정상단을 지나
   우하단으로 흘러간다. dest는 기존 Pipeline과 동일 */
const STAGES = [
  { key: "discover", dest: "explorer", x: 76, y: 252 },
  { key: "convert", dest: "wizard", x: 136, y: 76 },
  { key: "qualify", dest: "health", x: 320, y: 34 },
  { key: "improve", dest: "health", x: 504, y: 76 },
  { key: "serve", dest: "explorer", x: 564, y: 252 },
];
/* 글로우 슬롯 수 — 단계 칩 + 플랫폼(종점). 칩을 늘리거나 줄여도 웨이브·플랫폼 타이밍이 따라온다 */
const SLOTS = STAGES.length + 1;
/* 플랫폼(홀로그램 투영대) 중심 — 줄기 끝(PATH 마지막 점)이 이 위로 떨어진다 */
const PLAT = { x: 320, y: 396 };

export default function NeuralCore({ c, life, go, calls }) {
  const density = (life.discover || 0) + (life.convert || 0);
  const nodeCount = Math.max(140, Math.min(180, 140 + density));
  const { dots, edges } = useMemo(() => buildNet(nodeCount), [nodeCount]);
  const alive = calls > 0;
  const flow = !REDUCED;
  /* 순차 글로우 타이밍 — 칩 01→05, 이어 플랫폼까지 SLOTS개 슬롯이 waveJ를 균등 분할해
     순서대로 빛나고, 남은 시간은 휴지기. delay는 음수로 즉시 위상 진입.
     발화 웨이브는 같은 시간축을 공유한다: 망 진행도 t(0~1)를 칩 슬롯 폭(STAGES.length칸)에
     사상하면 경로 설계상(수집 0, 검증 1/3, 서빙 2/3) 전선이 칩 글로우와 나란히 가고,
     t=1(줄기 끝)은 플랫폼 슬롯에 맞춰 함께 점등하며 끝난다 */
  const waveP = alive ? 5.5 : 9, waveJ = alive ? 3.6 : 5.6;
  const seqDelay = (i) => `${((i / SLOTS) * waveJ - waveP).toFixed(2)}s`;
  const fireDelay = (t) => seqDelay(t * STAGES.length);
  /* 무거운 레이어(후광·플랫폼·망 ~1,000개 요소)는 망 데이터·모드가 바뀔 때만 다시 그린다
     — 대시보드의 1초 시계 리렌더마다 diff 대상이 되지 않게 한다.
     (waveP·waveJ·delay 함수·flow는 모두 alive 또는 상수에서 파생) */
  const layers = useMemo(() => (
    <>
      <defs>
        <radialGradient id="neuroGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: "var(--hud)", stopOpacity: alive ? 0.16 : 0.1 }} />
          <stop offset="68%" style={{ stopColor: "var(--hud)", stopOpacity: 0.05 }} />
          <stop offset="100%" style={{ stopColor: "var(--hud)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      {/* 후광 + 받침 플랫폼 (홀로그램 투영대) — 순차 글로우의 종점으로 맥동 */}
      <ellipse cx="320" cy="190" rx="248" ry="160" fill="url(#neuroGlow)" />
      <g style={flow ? { animation: `platFire ${waveP}s ease-in-out infinite`, animationDelay: seqDelay(STAGES.length),
        transformBox: "view-box", transformOrigin: `${PLAT.x}px ${PLAT.y}px` } : undefined}>
        {[[150, 26, 0.42], [104, 18, 0.3], [60, 11, 0.2]].map(([rx, ry, o], i) => (
          <ellipse key={i} cx={PLAT.x} cy={PLAT.y} rx={rx} ry={ry} fill="none"
            stroke="var(--hud)" opacity={o} strokeWidth={i === 0 ? 1.4 : 1} />
        ))}
        <ellipse cx={PLAT.x} cy={PLAT.y} rx="32" ry="6.5" fill="var(--hud)" opacity=".22" />
      </g>
      {/* 신경망 — 순수 장식 레이어. 깊이별 곡선 시냅스와 뉴런이 저마다의 주기로
          잔잔하게 트윙클한다 (순서 의미 없음) */}
      <g>
        {edges.map(({ d, w, o, dur, del }, i) => (
          <path key={i} d={d} fill="none" stroke="var(--hud-node)" strokeWidth={w}
            style={flow
              ? { "--o0": o, "--o1": Math.min(1, o * 2.6), animation: `neuroTw ${dur.toFixed(1)}s ease-in-out ${del.toFixed(1)}s infinite` }
              : { opacity: o }} />
        ))}
        {dots.map(({ x, y, z, r, core, dur, del }, i) => {
          const base = core ? 0.5 + z * 0.35 : 0.28 + z * 0.38;
          return (
            <circle key={i} cx={x} cy={y} r={r} fill={core ? "var(--hud)" : "var(--hud-node)"}
              style={flow
                ? { "--o0": base, "--o1": Math.min(1, base + 0.45), animation: `neuroTw ${dur.toFixed(1)}s ease-in-out ${del.toFixed(1)}s infinite` }
                : { opacity: base }} />
          );
        })}
      </g>
      {/* 발화 웨이브 — 밝은 사본이 여정 진행도 순서로 잠깐 나타났다 사라지며,
          칩 글로우와 같은 시간축 위에서 수집→검증→서빙→줄기로 번져 플랫폼과
          함께 끝난다. dt가 큰 시냅스(축삭)는 제외해 전선 밖 점등을 막는다 */}
      {flow && (
        <g style={{ filter: "drop-shadow(0 0 5px var(--hud))" }}>
          {edges.filter((e) => e.dt <= 0.1).map(({ d, t, w }, i) => (
            <path key={i} d={d} fill="none" stroke="var(--hud)" strokeWidth={w + 0.8} opacity="0"
              style={{ animation: `neuroFire ${waveP}s linear infinite`, animationDelay: fireDelay(t) }} />
          ))}
          {dots.map(({ x, y, t, r }, i) => (
            <circle key={i} cx={x} cy={y} r={r + 0.8} fill="var(--hud)" opacity="0"
              style={{ animation: `neuroFireDot ${waveP}s linear infinite`, animationDelay: fireDelay(t),
                transformBox: "fill-box", transformOrigin: "center" }} />
          ))}
        </g>
      )}
    </>
  ), [dots, edges, alive]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="hud-panel hud-row2" style={sx.panelCol}>
      <PanelHead title={c.lifecycle} sub={c.subLifecycle}
        right={
          <span className="mono" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 10, letterSpacing: ".14em", fontWeight: 700, color: alive ? "var(--green)" : "var(--muted)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: alive ? "var(--green)" : "var(--faint)",
              boxShadow: alive ? "0 0 8px var(--green)" : "none",
              animation: alive && flow ? "dashBlink 1.8s ease-in-out infinite" : "none" }} />
            {alive ? "ACTIVE" : "STANDBY"}
          </span>
        } />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", margin: "auto 0" }}>
        {layers}
        {/* 단계 뉴런 칩 — 라이프사이클 순서(01→05)대로 글로우가 흐른다.
            클릭 시 해당 화면 이동 (기존 라이프사이클 리본과 동일 동작) */}
        {STAGES.map(({ key, dest, x, y }, i) => {
          const val = life[key] ?? 0;
          const warn = key === "improve" && val > 0;
          return (
            <g key={key} className="neuro-chip" role="button" tabIndex={0} aria-label={`${i + 1}. ${c[key]} ${val}`}
              onClick={() => go(dest)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(dest); } }}
              style={flow ? { animation: `chipFire ${waveP}s ease-in-out infinite`, animationDelay: seqDelay(i) } : undefined}>
              <rect className={warn ? "neuro-box" : "neuro-box neuro-seq"}
                x={x - 44} y={y - 22} width="88" height="44" rx="9"
                fill="var(--hud-panel-bg)" stroke={warn ? "var(--amber)" : "var(--hud-line)"} strokeWidth="1.2"
                style={!warn && flow ? { animationDuration: `${waveP}s`, animationDelay: seqDelay(i) } : undefined} />
              {/* 단계 번호 — 궤도 순서를 명시하는 오버라인 */}
              <text x={x - 37} y={y - 12} fill="var(--hud)" opacity="0.8"
                style={{ font: "700 7.5px var(--mono)", letterSpacing: ".1em" }}>{`0${i + 1}`}</text>
              <text x={x} y={y + 2} textAnchor="middle" fill={warn ? "var(--amber)" : "var(--navy)"}
                style={{ font: "700 18px var(--disp)" }}>{val}</text>
              <text x={x} y={y + 16} textAnchor="middle" fill="var(--muted)"
                style={{ font: "600 9px var(--mono)", letterSpacing: ".14em" }}>{c[key]}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
