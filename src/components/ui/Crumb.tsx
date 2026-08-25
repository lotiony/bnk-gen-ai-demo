import { Fragment } from 'react';
import { Link } from 'react-router-dom';

interface CrumbItem {
  label: string;
  to?: string;
}

interface Props {
  items: CrumbItem[];
  trailing?: React.ReactNode;
}

/** 페이지 상단 브레드크럼 — 마지막 항목은 강조, 우측에 trailing 자유 슬롯 */
export default function Crumb({ items, trailing }: Props) {
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-ink-mid mb-2.5">
      {items.map((it, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {it.to && !isLast ? (
              <Link to={it.to} className="hover:text-ink-dark">
                {it.label}
              </Link>
            ) : (
              <b className={isLast ? 'text-ink-dark font-bold' : ''}>{it.label}</b>
            )}
            {!isLast && <span className="text-ink-light">›</span>}
          </Fragment>
        );
      })}
      {trailing && <span className="ml-auto text-ink-light">{trailing}</span>}
    </div>
  );
}
