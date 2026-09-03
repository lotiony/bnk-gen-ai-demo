/*
 * 전 화면 공통 푸터.
 *
 * 왜 두는가 — 데모 시연 영상에는 하단에 자막이 burn-in 된다. 화면 맨 아래에
 * **가려도 되는 띠**를 하나 깔아 두면 자막이 실제 콘텐츠(표 마지막 행 · 그래프
 * 범례 · 하단 액션바)를 먹지 않는다.
 *
 * 고정(fixed)이 아니라 **문서 흐름의 맨 끝**에 있다 — 스크롤을 끝까지 내려야
 * 나오고, 그만큼 화면 높이를 상시로 잡아먹지 않는다. 내용이 짧은 화면에서
 * 푸터가 중간에 떠 보이지 않도록 `mt-auto` 로 뷰포트 바닥까지 민다
 * (#root 를 세로 flex 로 둔 이유 — src/index.css).
 *
 * 위쪽 여백(pt-16)은 본문과 푸터가 붙어 한 덩어리로 읽히지 않게 하는 몫이다.
 * 아래쪽 여백은 기안·결재처럼 **하단 고정 액션바가 있는 화면에서만** 붙는다
 * (`demo-footer-block` · src/index.css) — 없으면 스크롤 끝에서 바가 푸터를 덮는다.
 *
 * 푸터는 제안서 스크린샷에도 자막 없이 찍히므로 정보로서도 말이 되게 둔다 —
 * 워드마크 + 가상 데이터 고지. BNK 로고 이미지는 쓰지 않는다(CLAUDE.md 절대
 * 규칙) — 텍스트 워드마크만.
 */
export default function DemoFooter() {
  return (
    <div className="demo-footer-block sticky top-[100vh] pt-16">
      <footer className="border-t border-line bg-white px-6 py-5 flex items-center justify-between gap-6 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-black text-brand text-[15px] leading-none tracking-tight">BNK</span>
          <span className="w-px h-3.5 bg-line-soft" />
          <span className="text-[11.5px] font-bold text-ink-mid truncate">
            그룹 공동 생성형 AI 플랫폼
          </span>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-[10.5px] font-semibold text-ink-light">
            제안 시연 데모 · 화면의 모든 데이터는 가상입니다
          </span>
          <span className="w-px h-3.5 bg-line-soft" />
          <span className="text-[10.5px] font-bold text-ink-light tabular-nums">
            2026 제안설명회
          </span>
        </div>
      </footer>
    </div>
  );
}
