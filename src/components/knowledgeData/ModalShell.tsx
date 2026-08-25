import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  size?: 'md' | 'lg';
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}

/** 공통 모달 셸 — overlay 클릭 닫기, ESC 닫기, body scroll lock. */
export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
  bodyClassName,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'bg-white rounded-md shadow-xl border border-line-soft flex flex-col max-h-[90vh] w-full',
          size === 'lg' ? 'max-w-[920px]' : 'max-w-[640px]',
        )}
      >
        <div className="flex items-start justify-between gap-3.5 py-3.5 px-[18px] border-b border-line-soft">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-ink">{title}</div>
            {subtitle && <div className="text-[11.5px] text-ink-mid mt-0.5">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            title="닫기"
            className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface hover:text-ink-dark text-base"
          >
            ✕
          </button>
        </div>
        <div className={cn('overflow-auto py-3.5 px-[18px] flex-1', bodyClassName)}>{children}</div>
        {footer && (
          <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-t border-line-soft bg-surface-soft">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
