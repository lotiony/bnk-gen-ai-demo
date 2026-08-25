import { useEffect, useState } from 'react';
import ModalShell from './ModalShell';
import type { FileRow } from './storageData';

interface Props {
  row: FileRow | null;
  onClose: () => void;
}

/** 원본 미리보기 모달 — 더미 페이지 콘텐츠 + 페이지 네비. */
export default function OriginViewerModal({ row, onClose }: Props) {
  const open = !!row;
  const total = row?.pages ?? 1;
  const [page, setPage] = useState(34);

  useEffect(() => {
    if (open) {
      // 새 파일을 열 때 첫 페이지로 (PDF면 34, 그 외엔 1)
      setPage(row?.ext === 'PDF' ? Math.min(34, total) : 1);
    }
  }, [open, row, total]);

  if (!row) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={row.name}
      subtitle={
        <>
          {row.ext} · {row.sizeMB.toFixed(1)} MB{row.pages ? ` · ${row.pages} 페이지` : ''}
        </>
      }
      size="lg"
      bodyClassName="p-0 bg-surface-soft"
      footer={
        <>
          <span className="text-[11.5px] text-ink-mid">
            {row.ext} · {row.sizeMB.toFixed(1)} MB
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.alert('원본 파일을 다운로드합니다 (목업).')}
              className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
            >
              ↓ 다운로드
            </button>
            <button
              onClick={onClose}
              className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
            >
              닫기
            </button>
          </div>
        </>
      }
    >
      <div className="bg-surface-soft p-6 min-h-[420px]">
        <div className="max-w-[700px] mx-auto bg-white border border-line-soft rounded shadow-sm p-8 text-[13px] leading-[1.7] text-ink-dark">
          <div className="text-center text-[11px] text-ink-mid font-semibold mb-4">
            — page {page} of {total} —
          </div>
          <h2 className="text-base font-extrabold text-ink mb-3">
            3.2 예·적금 상품 라인업 — 우대금리 조건
          </h2>
          <p className="mb-3">
            대표 예·적금 상품의 기본금리와 우대금리 조건을 정리한다. 우대금리는 급여이체·자동이체·
            카드실적 등 조건 충족 여부에 따라 차등 적용되며, PB는 고객 거래 현황을 확인해{' '}
            <mark className="bg-kb-yellow-tint px-1 rounded">적용 가능한 우대 조건</mark>을 안내한다.
          </p>
          <h3 className="text-sm font-extrabold text-ink mb-2 mt-4">
            표 3.2.1 — 상품별 금리·조건 (2026년)
          </h3>
          <table className="w-full border-collapse text-xs mb-3">
            <thead>
              <tr className="bg-surface-soft">
                <th className="border border-line-soft p-2 text-left font-bold">상품</th>
                <th className="border border-line-soft p-2 text-right font-bold">기본금리</th>
                <th className="border border-line-soft p-2 text-right font-bold">최고금리</th>
                <th className="border border-line-soft p-2 text-right font-bold">가입한도</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-line-soft p-2">KB 정기예금</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">3.10%</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">3.55%</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">제한 없음</td>
              </tr>
              <tr>
                <td className="border border-line-soft p-2">KB 자유적금</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">3.40%</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">4.20%</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">월 300만원</td>
              </tr>
              <tr>
                <td className="border border-line-soft p-2">ISA (일임형)</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">-</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">비과세</td>
                <td className="border border-line-soft p-2 text-right tabular-nums">연 2,000만원</td>
              </tr>
            </tbody>
          </table>
          <h3 className="text-sm font-extrabold text-ink mb-2 mt-4">PB 상담 활용 가이드</h3>
          <p>
            고객이 "어떤 상품이 저에게 맞나요"라고 물으면 자산 성향·목표를 확인한 뒤{' '}
            <mark className="bg-kb-yellow-tint px-1 rounded">적합 상품 매칭 가이드 PB-007</mark>에 따라
            적합 상품을 조회·요약해 답변 초안을 제공한다.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 py-3 bg-ink text-white text-[12px]">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="py-1.5 px-3 bg-white/10 hover:bg-white/20 rounded text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹ 이전
        </button>
        <span>
          페이지 <b>{page}</b> / {total}
        </span>
        <button
          disabled={page >= total}
          onClick={() => setPage((p) => Math.min(total, p + 1))}
          className="py-1.5 px-3 bg-white/10 hover:bg-white/20 rounded text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          다음 ›
        </button>
      </div>
    </ModalShell>
  );
}
