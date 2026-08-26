/**
 * 관리 콘솔 — 공지 · 콘텐츠 · 게시판 관리.
 *
 * RFP 2-1 관리자 포털: 33 사이트·콘텐츠·커뮤니티 관리 / 48 공지·콘텐츠·게시판 관리 화면
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import { NOTICES, BOARD_POSTS, type Notice, type BoardPost } from '@/data/mockContent';

type Tab = 'notice' | 'board';

const NOTICE_TONE: Record<Notice['state'], 'ok' | 'neutral' | 'bad'> = { '게시 중': 'ok', 임시저장: 'neutral', 종료: 'bad' };
const POST_TONE: Record<BoardPost['state'], 'ok' | 'warn' | 'bad'> = { 정상: 'ok', 신고됨: 'warn', 숨김: 'bad' };

export default function AdminContentPage() {
  const [tab, setTab] = useState<Tab>('notice');
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [posts, setPosts] = useState<BoardPost[]>(BOARD_POSTS);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">공지 · 콘텐츠 · 게시판 관리</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            마켓플레이스 공지사항 · 커뮤니티 · 지식공유 게시판을 관리한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal flex-shrink-0 mt-1">
          2-1 공지·콘텐츠
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-line mb-3.5">
        {([{ k: 'notice' as const, label: '공지사항' }, { k: 'board' as const, label: '게시판 모니터링' }]).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              'px-3.5 py-2 text-[12.5px] font-extrabold border-b-2 -mb-px',
              tab === t.k ? 'text-brand border-brand' : 'text-ink-mid border-transparent hover:text-ink-dark',
            )}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'notice' && (
        <>
          <div className="flex justify-end mb-2.5">
            <button
              type="button"
              onClick={() => toast('새 공지 작성 — 데모 범위 밖')}
              className="py-1.5 px-3 bg-brand border border-brand-dark rounded text-[11.5px] font-extrabold text-white hover:bg-brand-dark"
            >+ 새 공지</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {notices.map((n) => (
              <div key={n.id} className="grid grid-cols-[24px_1fr_100px_auto_auto] gap-3 items-center px-3.5 py-2.5 bg-white border border-line-soft rounded">
                <span>{n.pinned ? '📌' : ''}</span>
                <div className="min-w-0">
                  <span className="text-[12px] font-extrabold text-ink truncate">{n.title}</span>
                  <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{n.author} · {n.publishedAt}</div>
                </div>
                <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{n.scope === '그룹 전체' ? n.scope : TENANT_SHORT[n.scope]}</span>
                <StatusPill tone={NOTICE_TONE[n.state]}>{n.state}</StatusPill>
                <button
                  type="button"
                  onClick={() => {
                    setNotices((arr) => arr.map((x) => x.id === n.id ? { ...x, state: x.state === '종료' ? '게시 중' : '종료' } : x));
                    toast(n.state === '종료' ? '다시 게시했습니다' : '게시를 종료했습니다');
                  }}
                  className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand"
                >{n.state === '종료' ? '재게시' : '종료'}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'board' && (
        <div className="flex flex-col gap-1.5">
          {posts.map((p) => (
            <div key={p.id} className="grid grid-cols-[70px_1fr_90px_60px_auto] gap-3 items-center px-3.5 py-2.5 bg-white border border-line-soft rounded">
              <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{p.board}</span>
              <div className="min-w-0">
                <span className="text-[12px] font-extrabold text-ink truncate">{p.title}</span>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">{TENANT_SHORT[p.tenant]} · {p.author} · {p.createdAt}</div>
              </div>
              <span className={cn('text-[10.5px] font-bold', p.reportCount > 0 ? 'text-bad' : 'text-ink-mid')}>
                신고 {p.reportCount}건
              </span>
              <StatusPill tone={POST_TONE[p.state]}>{p.state}</StatusPill>
              {p.state !== '숨김' ? (
                <button
                  type="button"
                  onClick={() => { setPosts((arr) => arr.map((x) => x.id === p.id ? { ...x, state: '숨김' } : x)); toast('게시글을 숨겼습니다'); }}
                  className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-bad hover:text-bad"
                >숨김 처리</button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setPosts((arr) => arr.map((x) => x.id === p.id ? { ...x, state: '정상' } : x)); toast('게시글을 복원했습니다'); }}
                  className="text-[10.5px] font-extrabold text-ink-dark border border-line rounded px-2 py-1 hover:border-brand-dark hover:text-brand"
                >복원</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
