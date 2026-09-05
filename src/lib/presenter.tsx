/**
 * 프리젠터 내비게이션 — 가이드 §3 M5-2.
 *
 * 발표 중 3막을 끊김 없이 순회하기 위한 장치다. 기본은 **꺼져 있다** —
 * 켜져 있으면 화살표 키가 일반 조작을 가로채고, 제안서용 스크린샷에도 찍힌다.
 *   P        프리젠터 모드 토글
 *   ← →     이전 / 다음 화면
 *   1 2 3   해당 막의 첫 화면으로 점프
 *   T        트랙 전환 (요건 트랙 ↔ 외환 트랙)
 *   Esc      끄기
 *
 * 입력 중(input·textarea·contenteditable)에는 단축키를 먹지 않는다 —
 * Chat 화면에서 질문을 타이핑하다 화면이 넘어가면 시연이 무너진다.
 *
 * 상태는 메모리만 쓴다(CLAUDE.md 절대 규칙).
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { setStoredPersona } from '@/lib/persona';
import { DEMO_TRACKS, actStart, type Act } from '@/data/demoScript';

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  const tag = t.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export default function PresenterNav() {
  const [on, setOn] = useState(false);
  const [idx, setIdx] = useState(0);
  /** 어느 대본을 도는가 — 요건 트랙(0) / 외환 트랙(1). */
  const [trackIdx, setTrackIdx] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const track = DEMO_TRACKS[trackIdx];
  const stops = track.stops;

  const goto = useCallback(
    (next: number, t = trackIdx) => {
      const list = DEMO_TRACKS[t].stops;
      const i = Math.max(0, Math.min(list.length - 1, next));
      const stop = list[i];
      setTrackIdx(t);
      setIdx(i);
      // 정거장마다 페르소나가 바뀐다 — 페르소나를 바꾸면 계열사도 함께 바뀐다.
      setStoredPersona(stop.persona);
      navigate(stop.path);
    },
    [navigate, trackIdx],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();

      if (k === 'p') {
        e.preventDefault();
        setOn((v) => !v);
        return;
      }
      if (!on) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setOn(false);
      } else if (k === 't') {
        // 트랙 전환 — 바뀐 트랙의 첫 정거장으로 간다(중간에서 갈아타면 맥락이 끊긴다).
        e.preventDefault();
        goto(0, (trackIdx + 1) % DEMO_TRACKS.length);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goto(idx + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goto(idx - 1);
      } else if (['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        goto(actStart(stops)[Number(e.key) as Act]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on, idx, goto, stops, trackIdx]);

  if (!on) return null;

  const stop = stops[idx];
  const starts = actStart(stops);
  /*
   * 위치 비교는 **경로 부분만** 본다. 외환 트랙은 `?agent=GRP-009` 처럼 쿼리를
   * 달고 다니는데, 전체 문자열로 비교하면 정상 위치에서도 "대본과 다름" 이 뜬다.
   */
  const offPath = stop.path.split('?')[0] !== pathname;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[70] w-[min(1080px,calc(100vw-48px))]">
      <div className="card border-2 border-brand-dark shadow-lg bg-white px-4 py-2.5 flex items-center gap-3">
        {/* 막 표시 */}
        <div className="flex flex-col flex-shrink-0">
          <span className="text-[9.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
            {track.label} · {track.actLabel[stop.act]}
          </span>
          <span className="text-[12.5px] font-extrabold text-ink">
            화면 {stop.screen} · {stop.title}
          </span>
        </div>

        <span className="w-px h-8 bg-line-soft flex-shrink-0" />

        {/* 시연 지시 */}
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold text-ink-dark leading-snug truncate" title={stop.cue}>
            {stop.cue}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {stop.reqs.map((r) => (
              <span key={r} className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
                {r}
              </span>
            ))}
            {offPath && (
              <span className="pill bg-warn-bg text-warn border border-warn-border">
                현재 위치가 대본과 다름 · → 로 이동
              </span>
            )}
          </div>
        </div>

        {/* 진행 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => goto(0, (trackIdx + 1) % DEMO_TRACKS.length)}
            title={`T — ${DEMO_TRACKS[(trackIdx + 1) % DEMO_TRACKS.length].hint}`}
            className="h-8 px-2.5 rounded border border-line bg-white text-[11px] font-extrabold text-ink-mid hover:border-brand-dark hover:text-brand"
          >
            트랙 전환
          </button>
          <button
            onClick={() => goto(idx - 1)}
            disabled={idx === 0}
            className="w-8 h-8 rounded border border-line bg-white text-[13px] font-extrabold text-ink-dark hover:border-brand hover:text-brand disabled:opacity-35"
            aria-label="이전 화면"
          >
            ←
          </button>
          <span className="text-[11.5px] font-extrabold text-ink-mid tabular-nums w-[48px] text-center">
            {idx + 1} / {stops.length}
          </span>
          <button
            onClick={() => goto(idx + 1)}
            disabled={idx === stops.length - 1}
            className="w-8 h-8 rounded bg-brand border border-brand-dark text-white text-[13px] font-extrabold hover:bg-brand-dark disabled:opacity-35"
            aria-label="다음 화면"
          >
            →
          </button>
          <button
            onClick={() => setOn(false)}
            className="ml-1 w-8 h-8 rounded border border-line bg-white text-[11px] font-extrabold text-ink-mid hover:text-ink-dark"
            aria-label="프리젠터 모드 끄기"
            title="Esc"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 진행 막대 — 3막 경계를 눈에 보이게 둔다 */}
      <div className="flex gap-[3px] mt-1.5 px-0.5">
        {stops.map((s, i) => (
          <button
            key={s.screen}
            onClick={() => goto(i)}
            title={`화면 ${s.screen} · ${s.title}`}
            className={cn(
              'flex-1 h-[5px] rounded-full transition-colors',
              i === idx ? 'bg-brand' : i < idx ? 'bg-brand-tint' : 'bg-line',
              s.act === 2 && i === starts[2] && 'ml-1.5',
              s.act === 3 && i === starts[3] ? 'ml-1.5' : '',
            )}
          />
        ))}
      </div>
    </div>
  );
}
