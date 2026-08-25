/** MCP 탐색의 검색줄 — 목록 화면 맨 위, 중앙 정렬로 앉는다.
 *
 * 예전엔 "검색 화면"과 "결과 화면"이 따로 있었는데, 검색은 결과를 보면서 고쳐 던지는
 * 동작이라 화면을 오가는 비용만 남았다. 그래서 입력줄을 결과 위로 올리고 화면을 하나로 합쳤다.
 * 최근 질의는 칩으로 항상 펼쳐두지 않고, 입력창을 눌렀을 때만 드롭다운으로 연다 —
 * 목록이 주인공인 화면에서 상시 노출은 자리만 먹는다.
 */
import { useRef, useState } from "react";
import { modeLabel } from "./explorerSearch";

const Glass = ({ s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>
);

const EXAMPLES = (ko) => (ko
  ? ["만기 다가온 계약 찾아서 안내하고 싶어", "method:GET"]
  : ["expiring contracts", "method:GET"]);

export default function ExplorerHero({ ko, q, setQ, mode, onSubmit, busy, asking, onStop, recentQueries }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const items = recentQueries.length ? recentQueries : EXAMPLES(ko);
  const isRecent = recentQueries.length > 0;
  const pick = (v) => { setOpen(false); onSubmit(v); };

  return (
    <div className="exp-hero">
      <div className="exp-hero-in">
        {/* blur 로 닫되, 드롭다운 안을 눌렀을 땐 닫지 않는다 — mousedown 이 blur 보다 먼저라
            버튼 클릭이 먹히지 않는 흔한 함정을 relatedTarget 검사로 피한다 */}
        <div ref={box} className="exp-askwrap"
          onBlur={(e) => { if (!box.current?.contains(e.relatedTarget)) setOpen(false); }}>
          <div className={`exp-askbar big${open ? " is-open" : ""}`}>
            {/* 좌측 돋보기 — 여기가 검색창임을 한눈에 알리는 표식. 검색 중엔 스피너로 바뀐다 */}
            <span className="sp">{busy ? <i className="exp-spin lg" /> : <Glass />}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { setOpen(false); onSubmit(); }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={ko ? "이름·설명으로 찾거나, 문장으로 물어보세요" : "search by name, or ask in a sentence"} />
            <span className={`exp-mode ${mode}`}>{modeLabel(mode, ko)}</span>
            {/* 맥락 검색은 수 초 걸리므로 그 구간에서만 중지로 바뀐다. 그 외엔 항상 검색 버튼 */}
            {asking ? (
              <button className="exp-searchbtn is-stop" onClick={onStop} title={ko ? "중지" : "Stop"}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                {ko ? "중지" : "Stop"}
              </button>
            ) : (
              <button className="exp-searchbtn" onClick={() => { setOpen(false); onSubmit(); }} disabled={busy}>
                <Glass s={15} />{ko ? "검색" : "Search"}
              </button>
            )}
          </div>

          {open && (
            <div className="exp-drop">
              <div className="lb">{isRecent ? (ko ? "최근 질의" : "recent") : (ko ? "이렇게 물어보세요" : "try")}</div>
              {items.map((r) => (
                <button key={r} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                  <span className="ic">{isRecent ? "◷" : "✦"}</span>{r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
