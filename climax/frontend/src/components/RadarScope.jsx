// 온프렘 대역 스윕 레이더 — canvas 로 그린다.
//
// DOM/SVG 로는 못 하는 두 가지 때문에 canvas 를 쓴다.
//  1) 인광 잔상: 매 프레임 화면을 지우는 대신 반투명 검정을 덧칠해 이전 프레임을 남긴다.
//  2) 접점 점화: 스윕 암이 접점 각도를 지나는 순간에만 밝아지고 이후 감쇠한다.
// 이 둘이 있어야 "돌고 있다" 가 아니라 "훑어서 찾아낸다" 로 읽힌다.
//
// 클라우드 리소스는 여기 그리지 않는다 — 구독 API 를 읽는 일이라 대역 스윕과 성격이 다르고,
// 같은 스코프에 얹으면 "클라우드를 스캔한다" 는 오해를 준다.
import { useEffect, useRef } from "react";

const TEAL = "45,212,191", AMBER = "245,165,36";

// 접점 좌표 — 원 위 고른 각도 + 링별 거리 변주(기존 blipXY 와 같은 규칙)
export function contactAngle(i, total) {
  return (-90 + (360 / Math.max(total, 1)) * i) * Math.PI / 180;
}
export function contactRadius(i) {
  return 0.34 + (i % 3) * 0.19;
}

export default function RadarScope({ contacts = [], scanning = true, size = 210 }) {
  const ref = useRef(null);
  // 애니메이션 루프가 매 렌더마다 재시작하지 않도록 최신 props 를 ref 로 전달
  const state = useRef({ contacts, scanning });
  state.current = { contacts, scanning };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = cv.getContext("2d");
    const W = cv.width, C = W / 2, R = W * 0.43;
    const lit = new Map();   // key -> 점화 강도(0~1)
    let sweep = -Math.PI / 2, raf = 0;

    const norm = (x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    function chrome() {
      ctx.strokeStyle = "rgba(45,212,191,.06)"; ctx.lineWidth = 1;
      for (let i = 0; i <= W; i += W / 12) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, W); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
      }
      [0.34, 0.62, 0.88, 1].forEach((f, i) => {
        ctx.beginPath(); ctx.arc(C, C, R * f, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(45,212,191,${i === 3 ? 0.28 : 0.13})`;
        ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.strokeStyle = "rgba(45,212,191,.12)";
      ctx.beginPath(); ctx.moveTo(C - R, C); ctx.lineTo(C + R, C); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(C, C - R); ctx.lineTo(C, C + R); ctx.stroke();
      // 방위 눈금 — 5° 미세 / 30° 굵게 + 각도 숫자
      for (let d = 0; d < 360; d += 5) {
        const a = (d - 90) * Math.PI / 180, major = d % 30 === 0, l = major ? 10 : 5;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(a) * R, C + Math.sin(a) * R);
        ctx.lineTo(C + Math.cos(a) * (R - l), C + Math.sin(a) * (R - l));
        ctx.strokeStyle = `rgba(45,212,191,${major ? 0.42 : 0.18})`;
        ctx.lineWidth = major ? 1.5 : 1; ctx.stroke();
        if (major) {
          ctx.fillStyle = "rgba(120,140,165,.7)";
          ctx.font = "600 14px ui-monospace, monospace";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(d).padStart(3, "0"), C + Math.cos(a) * (R + 16), C + Math.sin(a) * (R + 16));
        }
      }
    }

    function frame() {
      const { contacts: cs, scanning: sc } = state.current;
      if (sc && !reduce) sweep += 0.026;

      // 지우지 않고 덧칠 — 이 한 줄이 인광 잔상을 만든다
      ctx.fillStyle = "rgba(8,13,20,.17)";
      ctx.fillRect(0, 0, W, W);
      chrome();

      if (sc) {
        const TAIL = 50;
        for (let i = 0; i < TAIL; i++) {
          const a = sweep - i * 0.021, al = (1 - i / TAIL) ** 2.1 * 0.28;
          ctx.beginPath(); ctx.moveTo(C, C);
          ctx.arc(C, C, R, a - 0.021, a); ctx.closePath();
          ctx.fillStyle = `rgba(${TEAL},${al})`; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(C, C);
        ctx.lineTo(C + Math.cos(sweep) * R, C + Math.sin(sweep) * R);
        ctx.strokeStyle = `rgba(${TEAL},.8)`; ctx.lineWidth = 2; ctx.stroke();
      }

      cs.forEach((c) => {
        const k = c.key;
        let v = lit.get(k) ?? 0;
        if (!sc || reduce) v = 0.85;
        else {
          const diff = Math.abs(norm(sweep) - norm(c.a));
          v = (diff < 0.06 || diff > Math.PI * 2 - 0.06) ? 1 : Math.max(0, v - 0.011);
        }
        lit.set(k, v);

        const x = C + Math.cos(c.a) * R * c.r, y = C + Math.sin(c.a) * R * c.r;
        const col = c.kind === "db" ? AMBER : TEAL;
        const dead = c.state === "dead";

        ctx.beginPath(); ctx.arc(x, y, dead ? 3.5 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = dead ? "rgba(74,85,104,.5)" : `rgba(${col},${0.28 + v * 0.72})`;
        ctx.shadowBlur = dead ? 0 : 16 * v;
        ctx.shadowColor = `rgba(${col},.9)`;
        ctx.fill(); ctx.shadowBlur = 0;

        // 조준 브래킷 — 식별된 접점에만. locked 가 true 로 바뀌면 축소하며 씌워진다.
        if (c.locked && !dead) {
          const s = 15, g = s * 0.42;
          ctx.strokeStyle = `rgba(${col},.7)`; ctx.lineWidth = 1.7;
          [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(x + sx * s, y + sy * s - sy * g);
            ctx.lineTo(x + sx * s, y + sy * s);
            ctx.lineTo(x + sx * s - sx * g, y + sy * s);
            ctx.stroke();
          });
          if (c.label) {
            const dir = x > C ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(x + dir * s, y - s);
            ctx.lineTo(x + dir * (s + 16), y - s - 12);
            ctx.lineTo(x + dir * (s + 44), y - s - 12);
            ctx.strokeStyle = `rgba(${col},.45)`; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = `rgba(${col},.9)`;
            ctx.font = "600 13px ui-monospace, monospace";
            ctx.textAlign = dir > 0 ? "left" : "right";
            ctx.fillText(c.label, x + dir * (s + 20), y - s - 18);
          }
        }
      });

      // 중심 코어
      ctx.beginPath(); ctx.arc(C, C, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL},1)`;
      ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${TEAL},1)`;
      ctx.fill(); ctx.shadowBlur = 0;

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    ctx.fillStyle = "#080d14"; ctx.fillRect(0, 0, W, W);
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);

  // 내부 해상도는 고정(레티나 대응), 표시 크기만 props 로 조절
  return (
    <canvas ref={ref} width={536} height={536} aria-label="온프렘 스펙 경로 탐지"
      style={{ display: "block", width: "100%", maxWidth: size, aspectRatio: "1", height: "auto", margin: "0 auto", borderRadius: 11, border: "1px solid #1a2432", background: "#080d14" }} />
  );
}
