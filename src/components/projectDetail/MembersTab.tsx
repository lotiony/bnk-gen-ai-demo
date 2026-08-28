import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MemberGroup, RoleKey } from '@/types';
import { cn } from '@/lib/utils';
import Button from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { canAccessAdminConsole } from '@/lib/personaView';

interface Props {
  groups: MemberGroup[];
  totalCount: number;
  approvalGroupCount: number;
}

const AVATAR_STYLE: Record<RoleKey, string> = {
  pm: 'bg-brand text-white outline outline-1 outline-brand-dark',
  dev: 'bg-info-bg text-info outline outline-1 outline-info-border',
  data: 'bg-ok-bg text-ok outline outline-1 outline-ok-border',
  gov: 'bg-accent-purple-bg text-accent-purple outline outline-1 outline-accent-purple-border',
  pmo: 'bg-surface-soft text-ink-mid outline outline-1 outline-line-soft',
  platform: 'bg-accent-brown-bg text-accent-brown outline outline-1 outline-accent-brown-border',
};

/** 멤버 탭 — 그룹별 멤버 리스트 + 케밥 메뉴(활성/비활성·권한 변경·제거). */
export default function MembersTab({ groups, totalCount, approvalGroupCount }: Props) {
  // 초기 상태를 prop으로부터 가져와 in-memory로 관리. 새로고침 시 초기 상태로 돌아감.
  const [state, setState] = useState<MemberGroup[]>(groups);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  /** 역할·권한 변경은 관리 콘솔의 기능이다 — 권한이 있을 때만 링크로 연결한다. */
  const persona = useCurrentPersona();
  const canOpenAdmin = canAccessAdminConsole(persona);

  // prop이 갱신되면 (다른 프로젝트 진입 등) 상태도 따라 갱신.
  useEffect(() => {
    setState(groups);
  }, [groups]);

  // 메뉴 바깥 클릭 또는 ESC 시 닫기.
  useEffect(() => {
    if (!openMenuId) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-member-menu]')) setOpenMenuId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId]);

  const toggleActive = (memberId: string) => {
    setState((prev) =>
      prev.map((g) => ({
        ...g,
        members: g.members.map((m) => (m.id === memberId ? { ...m, active: !m.active } : m)),
      })),
    );
  };

  const activeCount = useMemo(
    () => state.reduce((sum, g) => sum + g.members.filter((m) => m.active).length, 0),
    [state],
  );
  const inactiveCount = totalCount - activeCount;

  return (
    <section className="card px-5 py-4 mb-3.5">
      <div className="flex items-baseline gap-2.5 mb-3.5 flex-wrap">
        <span className="text-[15px] font-extrabold text-ink tracking-tight">멤버</span>
        <span className="text-xs text-ink-mid font-semibold">
          총 {totalCount}명 · 활성 <b className="text-ok-dark">{activeCount}</b>
          {inactiveCount > 0 && (
            <>
              {' '}· 비활성 <b className="text-bad">{inactiveCount}</b>
            </>
          )}
          {' '}· 프로젝트 오너 그룹 {approvalGroupCount}명
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button>＋ 멤버 추가</Button>
          {/*
            `href="#"` 는 HashRouter 에서 홈으로 튕긴다. 실제 목적지는 관리 콘솔의
            멤버 관리(/admin/members)이므로, 권한이 있으면 그리로 보내고
            없으면 이동시키지 않고 절차만 알린다(RFP 2-1 권한 기반 화면 구성).
          */}
          {canOpenAdmin ? (
            <Link
              to="/admin/members"
              className="text-[11.5px] font-bold text-info py-1 px-2 rounded hover:underline"
            >
              권한 관리 →
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                toast(
                  '권한 관리는 관리 콘솔에서 이뤄집니다',
                  '역할·결재라인·이용권한 변경은 관리자 권한과 결재를 거칩니다.\n' +
                    '현재 계정에는 관리 콘솔 접근 권한이 없습니다.',
                  'warn',
                )
              }
              className="text-[11.5px] font-bold text-info py-1 px-2 rounded hover:underline"
            >
              권한 관리 →
            </button>
          )}
        </div>
      </div>

      <div>
        {state.map((g) => (
          <div key={g.title} className="mb-3 last:mb-0">
            <h5 className="text-[11px] font-extrabold tracking-[0.4px] uppercase text-ink-mid mb-2 flex items-center gap-2">
              {g.title}
              {g.groupTag && (
                <span className="bg-brand-tint text-ink border border-brand-dark py-[2px] px-2 rounded-lg text-[9.5px] font-extrabold tracking-[0.3px]">
                  {g.groupTag}
                </span>
              )}
              <span className="bg-surface py-[2px] px-1.5 rounded-lg text-ink-dark text-2xs">
                {g.members.length}
              </span>
            </h5>
            {g.members.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'grid grid-cols-[32px_1fr_auto_88px_28px] gap-2.5 items-center py-2 px-2.5 border-b border-line-soft last:border-0',
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full inline-flex items-center justify-center text-xs font-extrabold border-2 border-white',
                    m.active
                      ? AVATAR_STYLE[m.roleKey]
                      : 'bg-surface-soft text-ink-light outline outline-1 outline-line-soft',
                  )}
                >
                  {m.initial}
                </span>
                <div>
                  <div
                    className={cn(
                      'text-[12.5px] font-bold',
                      m.active ? 'text-ink' : 'text-ink-mid',
                    )}
                  >
                    {m.name}
                    {m.isLead && (
                      <span className="text-[9.5px] font-extrabold text-warn bg-warn-bg border border-warn-border px-1.5 py-[1px] rounded-[7px] ml-1.5 tracking-[0.2px]">
                        책임자
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-mid font-semibold mt-px">
                    {m.dept}
                    {m.empNo && ` · ${m.empNo}`}
                  </div>
                </div>
                <span
                  className={cn(
                    'text-2xs font-bold text-right',
                    m.active ? 'text-ink-mid' : 'text-ink-light',
                  )}
                >
                  {m.roleLabel}
                </span>
                <StatusChip active={m.active} />
                <MemberMenu
                  open={openMenuId === m.id}
                  onOpenChange={(o) => setOpenMenuId(o ? m.id : null)}
                  active={m.active}
                  isLead={!!m.isLead}
                  memberName={m.name}
                  onToggleActive={() => {
                    if (m.active) {
                      const msg = m.isLead
                        ? `${m.name}님은 PM 책임자입니다. 비활성화 시 결재 그룹에서 즉시 제외되어 진행 중인 결재 흐름에 영향이 갈 수 있습니다. 계속하시겠습니까?`
                        : `${m.name}님을 비활성화하시겠습니까? 결재·작업 권한이 즉시 제거됩니다.`;
                      if (!window.confirm(msg)) return;
                    }
                    toggleActive(m.id);
                    setOpenMenuId(null);
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 text-[10.5px] font-extrabold py-[3px] px-2 rounded-full border w-[64px]',
        active
          ? 'bg-ok-bg text-ok border-ok-border'
          : 'bg-surface-soft text-ink-mid border-line-soft',
      )}
    >
      <span className="text-[8px] leading-none">●</span>
      {active ? '활성' : '비활성'}
    </span>
  );
}

function MemberMenu({
  open,
  onOpenChange,
  active,
  isLead,
  memberName,
  onToggleActive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: boolean;
  isLead: boolean;
  memberName: string;
  onToggleActive: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative" data-member-menu>
      <button
        ref={btnRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`${memberName} 멤버 옵션`}
        className={cn(
          'w-7 h-7 inline-flex items-center justify-center rounded border text-ink-mid hover:text-ink-dark hover:bg-surface',
          open ? 'border-line bg-surface text-ink-dark' : 'border-transparent',
        )}
      >
        <span className="text-base leading-none">⋯</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 w-[180px] bg-white border border-line rounded-md shadow-lg py-1 text-[12px]"
        >
          <MenuItem
            onClick={onToggleActive}
            tone={active ? 'warn' : 'ok'}
            icon={active ? '⏸' : '▶'}
          >
            {active ? '비활성화' : '활성화'}
            {active && isLead && (
              <span className="ml-auto text-[9.5px] font-extrabold text-warn">!</span>
            )}
          </MenuItem>
          <MenuItem
            onClick={() => {
              toast('권한 변경 모달은 권한 관리 화면에서 (목업)');
              onOpenChange(false);
            }}
            icon="🔑"
          >
            권한 변경
          </MenuItem>
          <MenuItem
            onClick={() => {
              toast('그룹 이동 (목업)');
              onOpenChange(false);
            }}
            icon="⇄"
          >
            그룹 이동
          </MenuItem>
          <div className="my-1 border-t border-line-soft" />
          <MenuItem
            onClick={() => {
              if (
                window.confirm(
                  `${memberName}님을 프로젝트에서 제거하시겠습니까? 이 작업은 되돌릴 수 없으며 감사 원장에 기록됩니다.`,
                )
              ) {
                toast('제거 (목업)');
              }
              onOpenChange(false);
            }}
            icon="✕"
            tone="bad"
          >
            프로젝트에서 제거
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  icon,
  tone = 'normal',
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: string;
  tone?: 'normal' | 'ok' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'bad'
      ? 'text-bad hover:bg-bad-bg'
      : tone === 'warn'
      ? 'text-warn hover:bg-warn-bg'
      : tone === 'ok'
      ? 'text-ok hover:bg-ok-bg'
      : 'text-ink-dark hover:bg-surface';
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left font-semibold transition-colors',
        toneCls,
      )}
    >
      {icon && <span className="w-4 text-center text-xs">{icon}</span>}
      <span className="flex-1 flex items-center">{children}</span>
    </button>
  );
}
