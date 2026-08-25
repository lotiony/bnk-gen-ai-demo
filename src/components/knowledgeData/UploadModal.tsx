import { useEffect, useRef, useState } from 'react';
import ModalShell from './ModalShell';
import { cn } from '@/lib/utils';
import type { FileRow } from './storageData';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 업로드 완료 — 저장소 목록에 추가할 새 파일들을 전달. */
  onUploaded?: (files: FileRow[]) => void;
}

type QueueItem = {
  id: string;
  name: string;
  ext: 'PDF' | 'DOCX' | 'HWPX' | 'XLSX';
  sizeMB: number;
  status: 'queued' | 'uploading' | 'done';
  progress: number;
};

const SAMPLE: QueueItem[] = [
  { id: 'u1', name: '시장동향_2025_연간보고서.pdf', ext: 'PDF', sizeMB: 4.2, status: 'done', progress: 100 },
  { id: 'u2', name: '콜센터_사례공유_2026Q1.pdf', ext: 'PDF', sizeMB: 5.6, status: 'uploading', progress: 68 },
  { id: 'u3', name: 'PB_상담체크리스트_v1.docx', ext: 'DOCX', sizeMB: 0.9, status: 'queued', progress: 0 },
];

const EXT_BADGE: Record<QueueItem['ext'], string> = {
  PDF: 'bg-bad-bg border-bad-border text-bad',
  DOCX: 'bg-info-bg border-info-border text-info',
  HWPX: 'bg-brand-tint border-brand-dark text-ink-dark',
  XLSX: 'bg-ok-bg border-ok-border text-ok',
};

/** 파일 업로드 모달 — 실제 업로드 없이 시뮬레이션. 파일 선택/드롭 시 큐를 채워진 상태로 전환. */
export default function UploadModal({ open, onClose, onUploaded }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      // 닫힐 때 큐 리셋
      setQueue([]);
      setDragOver(false);
    }
  }, [open]);

  const simulatePick = () => setQueue(SAMPLE);
  const removeRow = (id: string) => setQueue((q) => q.filter((r) => r.id !== id));

  const totalMB = queue.reduce((s, r) => s + r.sizeMB, 0);
  const doneCount = queue.filter((r) => r.status === 'done').length;
  const upCount = queue.filter((r) => r.status === 'uploading').length;
  const waitCount = queue.filter((r) => r.status === 'queued').length;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="파일 업로드"
      subtitle={
        <>
          저장소 › 사례매뉴얼 › <b className="text-ink font-extrabold">2026Q1</b> 폴더에 추가
        </>
      }
      footer={
        <>
          <span className="text-[11.5px] text-ink-mid">파일은 자동으로 현재 폴더에 저장됩니다</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-3.5 bg-white border border-line rounded text-[12.5px] font-bold text-ink-dark hover:bg-surface"
            >
              취소
            </button>
            <button
              disabled={queue.length === 0}
              onClick={() => {
                const now = new Date().getTime();
                const uploaded: FileRow[] = queue.map((r, i) => ({
                  id: `up-${now}-${i}`,
                  name: r.name,
                  ext: r.ext,
                  sizeMB: r.sizeMB,
                  updatedBy: '나',
                  updatedAt: '방금 전',
                  isNew: true,
                }));
                onUploaded?.(uploaded);
                onClose();
              }}
              className="py-2 px-3.5 bg-brand border border-brand-dark rounded text-[12.5px] font-extrabold text-white hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              업로드 시작
            </button>
          </div>
        </>
      }
    >
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          simulatePick();
        }}
        className={cn(
          'border border-dashed rounded p-5 text-center bg-surface-soft cursor-pointer transition-colors',
          dragOver ? 'border-brand-dark bg-brand-tint' : 'border-line',
        )}
      >
        <div className="w-10 h-10 rounded-full bg-white border border-line-soft inline-flex items-center justify-center mb-2 text-lg text-brand-dark">
          ↑
        </div>
        <div className="text-[13px] font-extrabold text-ink mb-1">파일 또는 폴더를 여기로 드롭하세요</div>
        <div className="text-[11px] text-ink-mid mb-2.5 leading-relaxed">
          허용 형식: <b className="text-ink-dark">PDF · DOCX · HWPX · TXT · MD · XLSX · CSV</b>
          <br />
          개별 최대 <b className="text-ink-dark">50 MB</b> · 작업당 최대 <b className="text-ink-dark">500 MB</b>
        </div>
        <div className="inline-flex gap-1.5 items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
              simulatePick();
            }}
            className="h-[30px] px-3.5 bg-brand border border-brand-dark rounded text-xs font-extrabold text-white hover:bg-brand-dark"
          >
            파일 선택
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              folderInputRef.current?.click();
              simulatePick();
            }}
            className="h-[30px] px-3.5 bg-white border border-line rounded text-xs font-bold text-ink-dark hover:bg-surface"
          >
            폴더 선택
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple hidden onChange={simulatePick} />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          hidden
          /* webkitdirectory는 폴더 선택용 비표준 속성 */
          // @ts-expect-error 비표준 속성
          webkitdirectory=""
          onChange={simulatePick}
        />
      </div>

      {queue.length === 0 ? (
        <div className="mt-3.5 py-3 text-center text-[11.5px] text-ink-light font-semibold border border-dashed border-line-soft rounded bg-surface-soft">
          선택된 파일이 없습니다 · 위 영역에서 파일을 추가하세요
        </div>
      ) : (
        <div className="mt-3.5">
          <div className="flex flex-col gap-1.5">
            {queue.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2.5 py-2 px-3 bg-white border border-line-soft rounded"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 text-[12.5px] font-bold text-ink">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-8 rounded border text-[9.5px] font-extrabold flex-shrink-0',
                      EXT_BADGE[r.ext],
                    )}
                  >
                    {r.ext}
                  </span>
                  <span className="truncate">{r.name}</span>
                </div>
                <div className="text-[11.5px] text-ink-mid tabular-nums w-16 text-right font-semibold">
                  {r.sizeMB.toFixed(1)} MB
                </div>
                <div className="w-44 flex flex-col gap-0.5">
                  <div className="h-1.5 bg-surface rounded overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-[width]',
                        r.status === 'done' ? 'bg-ok' : 'bg-info',
                      )}
                      style={{ width: `${r.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10.5px] text-ink-mid font-semibold">
                    <span className={cn(r.status === 'queued' && 'text-ink-light')}>
                      {r.status === 'done' ? '완료' : r.status === 'uploading' ? '업로드 중' : '대기'}
                    </span>
                    <b className="text-ink-dark tabular-nums">{r.progress}%</b>
                  </div>
                </div>
                <button
                  onClick={() => removeRow(r.id)}
                  title="제거"
                  className="w-6 h-6 inline-flex items-center justify-center text-ink-mid hover:text-bad hover:bg-bad-bg rounded"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2.5 py-2 px-3 bg-surface-soft border border-line-soft rounded text-[11.5px] text-ink-mid">
            <span>
              <b className="text-ink-dark">{queue.length}</b>개 파일 ·{' '}
              <b className="text-ink-dark">{totalMB.toFixed(1)}</b> MB
            </span>
            <span>
              완료 <b className="text-ink-dark">{doneCount}</b> · 진행{' '}
              <b className="text-ink-dark">{upCount}</b> · 대기 <b className="text-ink-dark">{waitCount}</b>
            </span>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
