import { useState } from 'react';
import { Link } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import SidebarCard from '@/components/projectForm/SidebarCard';

type TabId = 'schema' | 'account' | 'load' | 'connector';

/* ---------------- Mock ---------------- */

const REQUEST = {
  name: 'PB 상담이력 조회 DB',
  purpose: 'PB 상담 이력·고객 요청 내역 조회 (읽기 전용 분석)',
  engine: 'PostgreSQL 15',
  env: '운영(prod)',
  sizeGB: 50,
  retention: '5년',
  network: '내부망(폐쇄망)',
  pii: true,
  encryption: '컬럼 암호화(양방향) + TDE',
};

let _uid = 0;
const uid = () => `u${++_uid}`;

interface Col {
  id: string;
  name: string;
  type: string;
  pii: boolean;
  mask: boolean;
  note: string;
}
interface Idx {
  id: string;
  cols: string;
  kind: string;
}
interface Table {
  id: string;
  env: AccountEnv;
  table: string;
  desc: string;
  cols: Col[];
  indexes: Idx[];
  pending?: '생성' | '수정';
}

const COL_TYPES = ['BIGINT', 'INT', 'VARCHAR(32)', 'VARCHAR(40)', 'VARCHAR(255)', 'TEXT', 'TIMESTAMP', 'DATE', 'NUMERIC(15,2)', 'BOOLEAN'];
const IDX_KINDS = ['PK', 'Unique', 'B-Tree', 'GIN', 'Hash'];

function seedTables(env: AccountEnv): Table[] {
  return [
    {
      id: uid(),
      env,
      table: 'consult_log',
      desc: '상담 이력',
      cols: [
        { id: uid(), name: 'consult_id', type: 'BIGINT', pii: false, mask: false, note: 'PK' },
        { id: uid(), name: 'customer_id', type: 'VARCHAR(32)', pii: true, mask: true, note: 'FK · 고객식별' },
        { id: uid(), name: 'consult_at', type: 'TIMESTAMP', pii: false, mask: false, note: '' },
        { id: uid(), name: 'channel', type: 'VARCHAR(20)', pii: false, mask: false, note: '' },
        { id: uid(), name: 'summary', type: 'TEXT', pii: false, mask: false, note: '' },
      ],
      indexes: [
        { id: uid(), cols: 'consult_id', kind: 'PK' },
        { id: uid(), cols: 'customer_id', kind: 'B-Tree' },
        { id: uid(), cols: 'consult_at DESC', kind: 'B-Tree' },
      ],
    },
    {
      id: uid(),
      env,
      table: 'customer',
      desc: '고객 기본(참조)',
      cols: [
        { id: uid(), name: 'customer_id', type: 'VARCHAR(32)', pii: false, mask: false, note: 'PK' },
        { id: uid(), name: 'name', type: 'VARCHAR(40)', pii: true, mask: true, note: '' },
        { id: uid(), name: 'phone', type: 'VARCHAR(20)', pii: true, mask: true, note: '' },
        { id: uid(), name: 'grade', type: 'VARCHAR(10)', pii: false, mask: false, note: '' },
      ],
      indexes: [
        { id: uid(), cols: 'customer_id', kind: 'PK' },
        { id: uid(), cols: 'grade', kind: 'B-Tree' },
      ],
    },
  ];
}

const INITIAL_TABLES: Table[] = [...seedTables('학습계'), ...seedTables('서빙계')];

type AccountEnv = '학습계' | '서빙계';
type AccountKind = '개인' | '애플리케이션';
type AccountStatus = 'active' | 'pending' | 'deleting';
interface Account {
  id: string;
  env: AccountEnv;
  kind: AccountKind;
  name: string;
  owner: string;
  perms: string;
  period: string;
  password: string;
  status: AccountStatus;
}
const PERM_OPTIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
const APP_PERMS = PERM_OPTIONS.join(' · '); // 애플리케이션 계정: 모든 권한(DDL 제외)

const ACCOUNTS_SEED: Account[] = [
  // 학습계(dev) — 개인 계정(개발자/분석가/DBA 본인) + 애플리케이션 계정(개발 앱/배치)
  { id: uid(), env: '학습계', kind: '개인', name: 'jeong.owner', owner: '정오너', perms: 'SELECT', period: '2026-11-04', password: 'Dev!jeong7291', status: 'active' },
  { id: uid(), env: '학습계', kind: '개인', name: 'kim.jiwoo', owner: '김지우', perms: 'SELECT', period: '2026-11-04', password: 'Dev!jiwoo3840', status: 'active' },
  { id: uid(), env: '학습계', kind: '개인', name: 'park.analyst', owner: '박서연', perms: 'SELECT', period: '2026-09-05', password: 'Dev!seoyeon15', status: 'active' },
  { id: uid(), env: '학습계', kind: '애플리케이션', name: 'svc_pb_consult_ro_dev', owner: '개발 앱', perms: APP_PERMS, period: '상시', password: 'Svc!roDev40817', status: 'active' },
  // 서빙계(prod) — 애플리케이션 계정 + 승인된 개인 계정(운영 조회)
  { id: uid(), env: '서빙계', kind: '개인', name: 'jeong.owner', owner: '정오너', perms: 'SELECT', period: '2026-12-31', password: 'Prd!jeong4Q19', status: 'active' },
  { id: uid(), env: '서빙계', kind: '애플리케이션', name: 'svc_pb_consult_ro', owner: 'PB 에이전트 앱', perms: APP_PERMS, period: '상시', password: 'Prd!ro9F2xQ7mK', status: 'active' },
];

const CHECKLIST = [
  { k: '개인정보 영향평가(DPIA)', done: true },
  { k: '컬럼 암호화·마스킹 적용', done: true },
  { k: '접근권한 최소화 · 계정 분리', done: true },
  { k: '망분리(내부망) 배치', done: true },
  { k: '감사로그(접근기록) 활성화', done: false },
  { k: '보존·파기 정책 등록', done: false },
];

const APPR_STEPS = [
  { seq: '✓', label: '기안', sub: '정오너 · 2026-01-08 10:20', tone: 'done' as const },
  { seq: '2', label: '정보보호 그룹 (개인정보)', sub: '검토 대기', tone: 'current' as const },
  { seq: '3', label: 'DBA · 플랫폼 관리 그룹', sub: '대기', tone: 'upcoming' as const },
];

/* ---------------- Page ---------------- */

export default function DatabaseTaskPage() {
  const [tab, setTab] = useState<TabId>('account');
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [savedTables, setSavedTables] = useState<Table[]>(INITIAL_TABLES);
  const [accounts, setAccounts] = useState<Account[]>(ACCOUNTS_SEED);

  return (
    <div className="max-w-[1120px] mx-auto px-6 py-6">
      <Crumb
        items={[
          { label: '홈', to: '/' },
          { label: '프로젝트', to: '/projects' },
          { label: 'PB 에이전트 프로젝트', to: '/projects/PRJ-101' },
          { label: '데이터베이스' },
        ]}
      />

      {/* Page head */}
      <div className="flex items-end justify-between gap-6 mb-3.5">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px] mb-1.5">데이터베이스</h1>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-line-soft rounded-xl bg-white text-[11px] font-bold">
              <span className="text-[10px] uppercase tracking-[0.3px] text-ink-mid font-bold">과제</span>
              <span className="text-ink font-extrabold">PB 에이전트 프로젝트</span>
            </span>
            <span className="inline-flex items-center gap-1.5 py-[3px] px-2 border border-line-soft rounded-xl bg-white text-[11px] font-bold text-ink-mid">
              테이블 생성 요청 · DBA 처리
            </span>
          </div>
        </div>
        <span className="text-[11.5px] text-ink-mid flex items-center gap-2.5">
          <span className="w-[7px] h-[7px] rounded-full bg-ok shadow-[0_0_0_3px_rgba(27,138,77,0.15)]" />
          자동 저장됨 · 10:42 KST
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-line mb-3.5 -mt-1">
        <TabButton active={tab === 'account'} onClick={() => setTab('account')}>계정</TabButton>
        <TabButton active={tab === 'schema'} onClick={() => setTab('schema')}>테이블</TabButton>
        <TabButton active={tab === 'load'} onClick={() => setTab('load')}>데이터 적재</TabButton>
        <TabButton active={tab === 'connector'} onClick={() => setTab('connector')}>연결</TabButton>
        <span className="flex-1" />
        <Link
          to="/projects/PRJ-101"
          className="text-[11.5px] text-info font-bold py-1.5 px-2.5 hover:underline"
        >
          ← 과제 목록
        </Link>
      </div>

      {tab === 'schema' && (
        <SchemaTab tables={tables} setTables={setTables} savedTables={savedTables} setSavedTables={setSavedTables} />
      )}
      {tab === 'account' && <AccountTab accounts={accounts} setAccounts={setAccounts} />}
      {tab === 'load' && <LoadTab tables={savedTables} />}
      {tab === 'connector' && <ConnectorTab />}
    </div>
  );
}

/* ---------------- 요청서 ---------------- */

function RequestTab({ tables }: { tables: Table[] }) {
  const totalCols = tables.reduce((n, t) => n + t.cols.length, 0);
  const piiCols = tables.reduce((n, t) => n + t.cols.filter((c) => c.pii).length, 0);
  return (
    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="text-sm font-extrabold text-ink">테이블 생성 요청서</div>
        <button className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark">
          ▶ 테이블 생성 신청
        </button>
      </div>
      <div className="px-[18px] py-[18px] grid grid-cols-2 gap-x-6 gap-y-0">
        <KvRow k="대상 DB" v={REQUEST.name} />
        <KvRow k="엔진" v={REQUEST.engine} />
        <KvRow k="용도" v={REQUEST.purpose} span />
        <KvRow k="환경" v={REQUEST.env} />
        <KvRow k="예상 용량" v={`${REQUEST.sizeGB} GB`} />
        <KvRow k="망 구간" v={REQUEST.network} />
        <KvRow k="보존 기간" v={REQUEST.retention} />
        <KvRow
          k="개인정보 포함"
          v={
            REQUEST.pii ? (
              <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold">
                포함 · DPIA 필요
              </span>
            ) : (
              '미포함'
            )
          }
        />
        <KvRow k="암호화 요건" v={REQUEST.encryption} />
      </div>

      {/* 요청 스키마 — 스키마·인덱스 탭에서 확정한 테이블대로 생성 요청 */}
      <div className="px-[18px] pb-[6px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px] font-extrabold text-ink">요청 스키마</span>
          <span className="text-[10.5px] text-ink-mid font-semibold">
            테이블 <b className="text-ink-dark">{tables.length}</b> · 컬럼 <b className="text-ink-dark">{totalCols}</b>
            {piiCols > 0 && (
              <>
                {' '}·{' '}
                <span className="text-warn font-bold">PII {piiCols}</span>
              </>
            )}
          </span>
          <span className="text-[10.5px] text-ink-light font-semibold">확정된 스키마·인덱스대로 생성 요청됩니다.</span>
        </div>
        <div className="border border-line-soft rounded-lg overflow-hidden divide-y divide-line-soft">
          {tables.map((t) => {
            const pk = t.indexes.find((x) => x.kind === 'PK');
            const piiN = t.cols.filter((c) => c.pii).length;
            return (
              <div key={t.id} className="flex items-center gap-3 py-2.5 px-3.5">
                <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap flex-shrink-0', ENV_META[t.env].badge)}>
                  {t.env}
                </span>
                <span className="text-[12.5px] font-mono font-extrabold text-ink truncate w-[150px] flex-shrink-0">{t.table}</span>
                <span className="text-[11.5px] text-ink-mid font-semibold truncate flex-1 min-w-0">{t.desc || '—'}</span>
                <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">컬럼 {t.cols.length}</span>
                <span className="text-ink-light">·</span>
                <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">인덱스 {t.indexes.length}</span>
                {pk && (
                  <span className="text-[10px] text-ink-mid font-mono whitespace-nowrap">PK {pk.cols}</span>
                )}
                {piiN > 0 && (
                  <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">
                    PII {piiN}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-[18px] py-[18px]">
        <div className="text-[11px] font-semibold text-info bg-info-bg border border-info-border rounded px-2.5 py-1.5">
          신청 시 결재선 <b>기안 → 정보보호 그룹 → DBA(플랫폼 관리 그룹)</b>로 상신되며, 승인 후 DBA가 확정된 스키마대로 실제 테이블을 생성합니다.
        </div>
      </div>
    </section>
  );
}

/* ---------------- 스키마 ---------------- */

const INPUT = 'w-full h-7 px-2 border border-line rounded text-[11.5px] bg-white focus:outline-none focus:border-kb-yellow-dark disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:text-ink-dark';

function SchemaTab({
  tables,
  setTables,
  savedTables,
  setSavedTables,
}: {
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  savedTables: Table[];
  setSavedTables: React.Dispatch<React.SetStateAction<Table[]>>;
}) {
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const openTable = tables.find((t) => t.id === openTableId) ?? null;
  const isCreate = openTable != null && openTable.id === creatingId;
  const dirty = JSON.stringify(tables) !== JSON.stringify(savedTables);

  // 생성 신청: 새 빈 테이블을 만들어 편집 상태로 진입
  const startCreate = () => {
    const id = uid();
    setTables((prev) => [
      ...prev,
      { id, env: '학습계', table: '', desc: '', cols: [{ id: uid(), name: 'id', type: 'BIGINT', pii: false, mask: false, note: 'PK' }], indexes: [{ id: uid(), cols: 'id', kind: 'PK' }] },
    ]);
    setCreatingId(id);
    setOpenTableId(id);
    setEditing(true);
  };
  // 신청 제출(생성/수정) → 신청 중(결재 대기) 상태로 전환
  const submitRequest = () => {
    const mark: '생성' | '수정' = isCreate ? '생성' : '수정';
    const next = tables.map((t) => (t.id === openTableId ? { ...t, pending: mark } : t));
    setTables(next);
    setSavedTables(next);
    setEditing(false);
    setCreatingId(null);
    setOpenTableId(null);
  };
  // 취소 → 변경 되돌림(신규 테이블은 폐기)
  const cancelEdit = () => {
    setTables(savedTables);
    setEditing(false);
    setCreatingId(null);
    setOpenTableId(null);
  };

  const patchTable = (tid: string, patch: Partial<Table>) =>
    setTables((prev) => prev.map((t) => (t.id === tid ? { ...t, ...patch } : t)));
  const removeTable = (tid: string) => {
    setTables((prev) => prev.filter((t) => t.id !== tid));
    setOpenTableId((cur) => (cur === tid ? null : cur));
  };

  const patchCol = (tid: string, cid: string, patch: Partial<Col>) =>
    patchTable(tid, { cols: tables.find((t) => t.id === tid)!.cols.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  const addCol = (tid: string) =>
    patchTable(tid, { cols: [...tables.find((t) => t.id === tid)!.cols, { id: uid(), name: '', type: 'VARCHAR(255)', pii: false, mask: false, note: '' }] });
  const removeCol = (tid: string, cid: string) =>
    patchTable(tid, { cols: tables.find((t) => t.id === tid)!.cols.filter((c) => c.id !== cid) });

  const patchIdx = (tid: string, iid: string, patch: Partial<Idx>) =>
    patchTable(tid, { indexes: tables.find((t) => t.id === tid)!.indexes.map((x) => (x.id === iid ? { ...x, ...patch } : x)) });
  const addIdx = (tid: string) =>
    patchTable(tid, { indexes: [...tables.find((t) => t.id === tid)!.indexes, { id: uid(), cols: '', kind: 'B-Tree' }] });
  const removeIdx = (tid: string, iid: string) =>
    patchTable(tid, { indexes: tables.find((t) => t.id === tid)!.indexes.filter((x) => x.id !== iid) });

  return (
    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
          테이블 설계
          <span className="text-[11px] text-ink-mid font-semibold">{tables.length}개 테이블</span>
          {editing && (
            <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold">
              ✎ {isCreate ? '신규 작성' : '수정'} 중{dirty ? ' · 변경 있음' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-mid hover:bg-surface"
              >
                취소
              </button>
              <button
                onClick={submitRequest}
                className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark"
              >
                {isCreate ? '생성' : '수정'}
              </button>
            </>
          ) : openTable ? (
            <button
              onClick={() => setEditing(true)}
              className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark"
            >
              ✎ 수정
            </button>
          ) : (
            <button
              onClick={startCreate}
              className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark"
            >
              ＋ 테이블 생성
            </button>
          )}
        </div>
      </div>
      <div className="px-[18px] py-[18px] flex flex-col gap-3">
        {/* ── 목록 뷰 (학습계/서빙계 그룹) ── */}
        {!openTable &&
          (['학습계', '서빙계'] as AccountEnv[]).map((env) => {
            const rows = tables.filter((t) => t.env === env);
            const meta = ENV_META[env];
            return (
              <div key={env}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10.5px] font-extrabold', meta.badge)}>
                    {env}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <div className="border border-line-soft rounded-lg py-6 text-center text-[11.5px] text-ink-light">
                    테이블이 없습니다.{editing ? ' ＋ 테이블 추가로 시작하세요.' : ''}
                  </div>
                ) : (
                  <div className="border border-line-soft rounded-lg overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                          <th className="text-left py-2 px-3.5 font-bold whitespace-nowrap">테이블</th>
                          <th className="text-left py-2 px-3 font-bold">설명</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">컬럼</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">인덱스</th>
                          <th className="text-left py-2 px-3 font-bold whitespace-nowrap">PK</th>
                          <th className="text-center py-2 px-3 font-bold whitespace-nowrap">PII</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {rows.map((t) => {
                          const piiCount = t.cols.filter((c) => c.pii).length;
                          const pk = t.indexes.find((x) => x.kind === 'PK');
                          return (
                            <tr
                              key={t.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setOpenTableId(t.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setOpenTableId(t.id);
                                }
                              }}
                              className="hover:bg-surface cursor-pointer group"
                            >
                              <td className="py-2.5 px-3.5 font-mono font-extrabold text-ink whitespace-nowrap">
                                <span className="inline-flex items-center gap-2">
                                  {t.table || <span className="text-ink-light font-sans font-semibold">(이름 없음)</span>}
                                  {t.pending && (
                                    <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold font-sans whitespace-nowrap">
                                      ⏳ {t.pending} 신청 중
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-ink-mid font-semibold">{t.desc || '—'}</td>
                              <td className="py-2.5 px-3 text-center text-ink-dark font-semibold">{t.cols.length}</td>
                              <td className="py-2.5 px-3 text-center text-ink-dark font-semibold">{t.indexes.length}</td>
                              <td className="py-2.5 px-3 font-mono text-ink-mid whitespace-nowrap">{pk ? pk.cols : '—'}</td>
                              <td className="py-2.5 px-3 text-center">
                                {piiCount > 0 ? (
                                  <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">
                                    {piiCount}
                                  </span>
                                ) : (
                                  <span className="text-ink-light">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center text-ink-light text-[12px] group-hover:text-ink-mid">›</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

        {/* ── 상세 뷰 ── */}
        {openTable && ((t) => (
          <>
            {!editing && (
              <button
                onClick={() => setOpenTableId(null)}
                className="self-start text-[11.5px] font-bold text-info hover:underline mb-0.5"
              >
                ← 테이블 목록
              </button>
            )}
            <div key={t.id} className="border border-line-soft rounded-lg overflow-hidden">
            {/* 테이블 헤더 (편집) */}
            <div className="flex items-center gap-2 py-2 px-3.5 bg-surface-soft">
              {editing ? (
                <select
                  value={t.env}
                  onChange={(e) => patchTable(t.id, { env: e.target.value as AccountEnv })}
                  className="h-7 px-2 border border-line rounded text-[11px] font-bold bg-white focus:outline-none focus:border-kb-yellow-dark"
                >
                  <option value="학습계">학습계</option>
                  <option value="서빙계">서빙계</option>
                </select>
              ) : (
                <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10.5px] font-extrabold whitespace-nowrap', ENV_META[t.env].badge)}>
                  {t.env}
                </span>
              )}
              <input
                value={t.table}
                onChange={(e) => patchTable(t.id, { table: e.target.value })}
                disabled={!editing}
                placeholder="table_name"
                className="h-7 px-2 border border-line rounded text-[12px] font-mono font-extrabold text-ink bg-white focus:outline-none focus:border-kb-yellow-dark w-[200px] disabled:bg-transparent disabled:border-transparent disabled:px-0"
              />
              <input
                value={t.desc}
                onChange={(e) => patchTable(t.id, { desc: e.target.value })}
                disabled={!editing}
                placeholder="설명"
                className="h-7 px-2 border border-line rounded text-[11.5px] text-ink-dark bg-white focus:outline-none focus:border-kb-yellow-dark flex-1 disabled:bg-transparent disabled:border-transparent disabled:px-0"
              />
              {t.pending && !editing && (
                <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">
                  ⏳ {t.pending} 신청 중
                </span>
              )}
              <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">{t.cols.length} 컬럼</span>
              {editing && (
                <button
                  onClick={() => removeTable(t.id)}
                  title="테이블 삭제"
                  className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-mid hover:bg-bad-bg hover:text-bad"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 컬럼 편집 */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-white text-ink-mid text-[10.5px] font-bold border-b border-line-soft">
                    <th className="text-left py-1.5 px-3 font-bold">컬럼</th>
                    <th className="text-left py-1.5 px-3 font-bold w-[150px]">타입</th>
                    <th className="text-center py-1.5 px-3 font-bold w-16">PII</th>
                    <th className="text-center py-1.5 px-3 font-bold w-16">마스킹</th>
                    <th className="text-left py-1.5 px-3 font-bold">비고</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {t.cols.map((c) => (
                    <tr key={c.id} className="hover:bg-surface">
                      <td className="py-1 px-3">
                        <input
                          value={c.name}
                          onChange={(e) => patchCol(t.id, c.id, { name: e.target.value })}
                          disabled={!editing}
                          placeholder="column"
                          className={cn(INPUT, 'font-mono font-bold')}
                        />
                      </td>
                      <td className="py-1 px-3">
                        <select
                          value={c.type}
                          onChange={(e) => patchCol(t.id, c.id, { type: e.target.value })}
                          disabled={!editing}
                          className={cn(INPUT, 'font-mono', !editing && 'appearance-none')}
                        >
                          {(COL_TYPES.includes(c.type) ? COL_TYPES : [c.type, ...COL_TYPES]).map((tp) => (
                            <option key={tp}>{tp}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-3 text-center">
                        <button
                          onClick={() => patchCol(t.id, c.id, { pii: !c.pii, mask: !c.pii ? c.mask : false })}
                          disabled={!editing}
                          className={cn(
                            'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold disabled:cursor-default',
                            c.pii ? 'bg-warn-bg text-warn border-warn-border' : 'bg-white text-ink-light border-line',
                            !editing && !c.pii && 'opacity-0',
                          )}
                        >
                          PII
                        </button>
                      </td>
                      <td className="py-1 px-3 text-center">
                        <button
                          onClick={() => patchCol(t.id, c.id, { mask: !c.mask })}
                          disabled={!editing || !c.pii}
                          title={!c.pii ? 'PII 컬럼만 마스킹' : ''}
                          className={cn(
                            'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold disabled:cursor-default',
                            c.mask ? 'bg-info-bg text-info border-info-border' : 'bg-white text-ink-light border-line',
                            !c.mask && 'disabled:opacity-0',
                          )}
                        >
                          마스킹
                        </button>
                      </td>
                      <td className="py-1 px-3">
                        <input
                          value={c.note}
                          onChange={(e) => patchCol(t.id, c.id, { note: e.target.value })}
                          disabled={!editing}
                          placeholder="PK / FK / 설명"
                          className={INPUT}
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        {editing && (
                          <button
                            onClick={() => removeCol(t.id, c.id)}
                            title="컬럼 삭제"
                            className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-mid hover:bg-bad-bg hover:text-bad"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editing && (
              <div className="px-3 py-1.5 border-t border-line-soft">
                <button onClick={() => addCol(t.id)} className="h-6 px-2 text-[11px] font-bold text-info hover:bg-info-bg rounded">
                  ＋ 컬럼 추가
                </button>
              </div>
            )}

            {/* 인덱스 편집 */}
            <div className="border-t border-line-soft bg-surface-soft/50 px-3.5 py-2">
              <div className="text-[11px] font-bold text-ink-mid mb-1.5">🔑 인덱스</div>
              <div className="flex flex-col gap-1.5">
                {t.indexes.map((ix) => (
                  <div key={ix.id} className="flex items-center gap-2">
                    <select
                      value={ix.kind}
                      onChange={(e) => patchIdx(t.id, ix.id, { kind: e.target.value })}
                      disabled={!editing}
                      className="h-7 px-2 border border-line rounded text-[11px] bg-white font-bold focus:outline-none focus:border-kb-yellow-dark w-[90px] disabled:bg-transparent disabled:border-transparent disabled:px-0 disabled:appearance-none"
                    >
                      {IDX_KINDS.map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <input
                      value={ix.cols}
                      onChange={(e) => patchIdx(t.id, ix.id, { cols: e.target.value })}
                      disabled={!editing}
                      placeholder="컬럼 (예: customer_id, consult_at DESC)"
                      className="h-7 px-2 border border-line rounded text-[11.5px] font-mono bg-white focus:outline-none focus:border-kb-yellow-dark flex-1 disabled:bg-transparent disabled:border-transparent disabled:px-0"
                    />
                    {editing && (
                      <button
                        onClick={() => removeIdx(t.id, ix.id)}
                        title="인덱스 삭제"
                        className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-mid hover:bg-bad-bg hover:text-bad flex-shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editing && (
                <button onClick={() => addIdx(t.id)} className="h-6 px-2 mt-1.5 text-[11px] font-bold text-info hover:bg-info-bg rounded">
                  ＋ 인덱스 추가
                </button>
              )}
            </div>
          </div>
          </>
        ))(openTable)}
      </div>
    </section>
  );
}

/* ---------------- 계정 · 권한 ---------------- */

const ENV_META: Record<AccountEnv, { badge: string; ownerLabel: string }> = {
  학습계: { badge: 'bg-info-bg text-info border-info-border', ownerLabel: '소유자' },
  서빙계: { badge: 'bg-ok-bg text-ok border-ok-border', ownerLabel: '소유자' },
};

const KIND_PILL: Record<AccountKind, string> = {
  개인: 'bg-surface-soft text-ink-mid border-line',
  애플리케이션: 'bg-info-bg text-info border-info-border',
};

function genPassword(env: AccountEnv) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${env === '서빙계' ? 'Prd' : 'Dev'}!${s}`;
}

function AccountTab({
  accounts,
  setAccounts,
}: {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
}) {
  const envs: AccountEnv[] = ['학습계', '서빙계'];
  const persona = useCurrentPersona();
  const me = persona?.name ?? '';
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deletingModal, setDeletingModal] = useState(false);
  const toggle = (id: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const copy = (a: Account) => {
    navigator.clipboard?.writeText(a.password);
    setCopied(a.id);
    window.setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 1500);
  };
  const submitAccount = (draft: Omit<Account, 'id' | 'status'>) => {
    setAccounts((prev) => [...prev, { ...draft, id: uid(), status: 'pending' }]);
    setAdding(false);
  };
  const requestDelete = (id: string) =>
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'deleting' } : a)));
  // DBA 승인: 추가 결재 → 활성(수동 패스워드는 유지, 자동은 발급), 삭제 결재 → 실제 삭제
  const approve = (id: string) =>
    setAccounts((prev) =>
      prev.flatMap((a) => {
        if (a.id !== id) return [a];
        if (a.status === 'deleting') return [];
        return [{ ...a, status: 'active' as AccountStatus, password: a.password || genPassword(a.env) }];
      }),
    );
  // 반려: 추가 결재 → 요청 삭제, 삭제 결재 → 활성 원복
  const reject = (id: string) =>
    setAccounts((prev) =>
      prev.flatMap((a) => {
        if (a.id !== id) return [a];
        if (a.status === 'deleting') return [{ ...a, status: 'active' as AccountStatus }];
        return [];
      }),
    );

  return (
    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2 text-sm font-extrabold text-ink">계정</div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAdding(true)}
            className="h-7 px-2.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[11px] font-extrabold text-ink hover:bg-kb-yellow-dark"
          >
            계정 생성
          </button>
          <button
            onClick={() => setDeletingModal(true)}
            className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-bad hover:bg-bad-bg"
          >
            계정 삭제
          </button>
        </div>
      </div>
      <div className="px-[18px] py-[18px]">
        <div className="flex flex-col gap-4">
          {envs.map((env) => {
            const rows = accounts.filter((a) => a.env === env);
            const meta = ENV_META[env];
            return (
              <div key={env}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10.5px] font-extrabold', meta.badge)}>
                    {env}
                  </span>
                </div>
                <div className="border border-line-soft rounded-lg overflow-x-auto">
                  <table className="w-full text-[11.5px]">
                    <thead>
                      <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                        <th className="text-left py-2 px-3 font-bold whitespace-nowrap">계정</th>
                        <th className="text-center py-2 px-3 font-bold whitespace-nowrap">유형</th>
                        <th className="text-left py-2 px-3 font-bold whitespace-nowrap">{meta.ownerLabel}</th>
                        <th className="text-left py-2 px-3 font-bold whitespace-nowrap">권한</th>
                        <th className="text-left py-2 px-3 font-bold whitespace-nowrap">사용 기간</th>
                        <th className="text-left py-2 px-3 font-bold whitespace-nowrap">패스워드</th>
                        <th className="text-right py-2 px-3 font-bold whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft">
                      {rows.map((a) => {
                        const shown = revealed.has(a.id);
                        const pending = a.status === 'pending';
                        const deleting = a.status === 'deleting';
                        return (
                          <tr key={a.id} className={cn('hover:bg-surface', pending && 'bg-warn-bg/30', deleting && 'bg-bad-bg/30')}>
                            <td className="py-2 px-3 font-mono font-bold text-ink-dark whitespace-nowrap">{a.name}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap', KIND_PILL[a.kind])}>
                                {a.kind}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink-dark whitespace-nowrap">{a.kind === '개인' ? a.owner : '—'}</td>
                            <td className="py-2 px-3 font-mono text-ink-mid whitespace-nowrap">{a.perms}</td>
                            <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{a.period}</td>
                            {/* 패스워드 */}
                            <td className="py-2 px-3">
                              {pending ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold whitespace-nowrap">
                                    ⏳ 추가 결재 대기
                                  </span>
                                  <span className="text-[10.5px] text-ink-light font-semibold whitespace-nowrap">승인 후 발급</span>
                                </span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <code className="font-mono text-[11.5px] text-ink-dark tracking-[0.5px] min-w-[120px] inline-block">
                                    {shown ? a.password : '••••••••••'}
                                  </code>
                                  {!deleting && a.owner === me ? (
                                    <>
                                      <button
                                        onClick={() => toggle(a.id)}
                                        title={shown ? '숨기기' : '보기 (감사 로그 기록)'}
                                        className="h-6 px-2 border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface bg-white whitespace-nowrap"
                                      >
                                        {shown ? '🙈 숨기기' : '👁 보기'}
                                      </button>
                                      <button
                                        onClick={() => copy(a)}
                                        title="복사"
                                        className="h-6 px-2 border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface bg-white whitespace-nowrap"
                                      >
                                        {copied === a.id ? '✓ 복사됨' : '복사'}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </td>
                            {/* 관리 */}
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-end gap-1.5">
                                {a.status === 'active' && <span className="text-[10.5px] text-ink-light">—</span>}
                                {(pending || deleting) && (
                                  <>
                                    {deleting && (
                                      <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-bad-border bg-bad-bg text-bad text-[10px] font-extrabold whitespace-nowrap mr-0.5">
                                        🗑 삭제 결재 대기
                                      </span>
                                    )}
                                    <button
                                      onClick={() => approve(a.id)}
                                      title="DBA 승인 처리"
                                      className="h-6 px-2 border border-kb-yellow-dark bg-kb-yellow rounded text-[10.5px] font-extrabold text-ink hover:bg-kb-yellow-dark whitespace-nowrap"
                                    >
                                      {deleting ? '삭제 승인 (DBA)' : '승인 (DBA)'}
                                    </button>
                                    <button
                                      onClick={() => reject(a.id)}
                                      title="반려"
                                      className="h-6 px-2 border border-line rounded text-[10.5px] font-bold text-ink-mid hover:bg-surface bg-white whitespace-nowrap"
                                    >
                                      반려
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {adding && (
        <AddAccountModal existing={accounts} me={me} onClose={() => setAdding(false)} onSubmit={submitAccount} />
      )}
      {deletingModal && (
        <DeleteAccountModal
          accounts={accounts}
          onClose={() => setDeletingModal(false)}
          onSubmit={(ids) => {
            ids.forEach(requestDelete);
            setDeletingModal(false);
          }}
        />
      )}
    </section>
  );
}

/* ---------------- 계정 삭제 모달 ---------------- */

function DeleteAccountModal({
  accounts,
  onClose,
  onSubmit,
}: {
  accounts: Account[];
  onClose: () => void;
  onSubmit: (ids: string[]) => void;
}) {
  const persona = useCurrentPersona();
  const me = persona?.name ?? '';
  // 소유자 본인 소유 계정만 노출
  const active = accounts.filter((a) => a.status === 'active' && a.owner === me);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between py-3 px-[18px] border-b border-line-soft">
          <div className="text-sm font-extrabold text-ink">계정 삭제 요청</div>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
        </div>

        <div className="px-[18px] py-4">
          <div className="text-[11.5px] text-ink-mid font-semibold mb-2">
            삭제할 계정을 선택하세요. <span className="text-ink-light">본인({me}) 소유 계정만 삭제할 수 있습니다.</span>
          </div>
          {active.length === 0 ? (
            <div className="py-8 text-center text-[11.5px] text-ink-light">삭제 가능한 본인 소유 계정이 없습니다.</div>
          ) : (
            <div className="border border-line-soft rounded-lg divide-y divide-line-soft max-h-[320px] overflow-y-auto">
              {active.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 py-2 px-3 cursor-pointer hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={sel.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="accent-kb-yellow-dark"
                  />
                  <span className="font-mono font-bold text-[12px] text-ink-dark">{a.name}</span>
                  <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap', KIND_PILL[a.kind])}>
                    {a.kind}
                  </span>
                  <span className="text-[11px] text-ink-mid">{a.owner}</span>
                  <span className="flex-1" />
                  <span className="text-[10px] text-ink-light font-semibold">{a.env}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 py-3 px-[18px] border-t border-line-soft">
          <button onClick={onClose} className="h-8 px-3 border border-line rounded text-[12px] font-bold text-ink-mid hover:bg-surface bg-white">
            취소
          </button>
          <button
            disabled={sel.size === 0}
            onClick={() => onSubmit([...sel])}
            className="h-8 px-3.5 bg-bad border border-bad rounded text-[12px] font-extrabold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            삭제 결재 상신{sel.size > 0 ? ` (${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 계정 추가 모달 ---------------- */

function AddAccountModal({
  existing,
  me,
  onClose,
  onSubmit,
}: {
  existing: Account[];
  me: string;
  onClose: () => void;
  onSubmit: (draft: Omit<Account, 'id' | 'status'>) => void;
}) {
  // 포털에서는 개인 계정만 신청 가능 (애플리케이션 계정은 DBA 관리)
  const kind: AccountKind = '개인';
  const permsLabel = 'SELECT';
  const owner = me; // 소유자 = 신청자 본인
  const [env, setEnv] = useState<AccountEnv>('학습계');
  const [name, setName] = useState('');
  const [period, setPeriod] = useState('');
  const [pwMode, setPwMode] = useState<'auto' | 'manual'>('auto');
  const [pwValue, setPwValue] = useState('');

  const nameDup = existing.some((a) => a.name.trim() === name.trim());
  const pwOk = pwMode === 'auto' || pwValue.trim().length >= 8;
  const valid = name.trim().length > 1 && !nameDup && period.length > 0 && pwOk;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between py-3 px-[18px] border-b border-line-soft">
          <div className="text-sm font-extrabold text-ink">계정 추가 요청</div>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
        </div>

        <div className="px-[18px] py-4 flex flex-col gap-3.5">
          {/* 환경 — 학습계/서빙계 개인 계정 신청 가능 */}
          <Field label="환경">
            <div className="flex gap-1.5">
              {(['학습계', '서빙계'] as AccountEnv[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={cn(
                    'h-8 px-3 rounded border text-[12px] font-bold',
                    env === e ? 'bg-kb-yellow border-kb-yellow-dark text-ink' : 'bg-white border-line text-ink-mid hover:bg-surface',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          {/* 계정명 */}
          <Field label="계정명">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: hong.gildong"
              className="w-full h-8 px-2.5 border border-line rounded text-[12px] font-mono bg-white focus:outline-none focus:border-kb-yellow-dark"
            />
            {nameDup && <div className="text-[10.5px] text-bad font-bold mt-1">이미 존재하는 계정명입니다.</div>}
          </Field>

          {/* 사용 기간 (만료일) */}
          <Field label="사용 기간 (만료일)">
            <input
              type="date"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-kb-yellow-dark"
            />
          </Field>

          {/* 패스워드 설정 */}
          <Field label="패스워드 설정">
            <div className="flex gap-1.5 mb-1.5">
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPwMode(m)}
                  className={cn(
                    'h-8 px-3 rounded border text-[12px] font-bold',
                    pwMode === m ? 'bg-kb-yellow border-kb-yellow-dark text-ink' : 'bg-white border-line text-ink-mid hover:bg-surface',
                  )}
                >
                  {m === 'auto' ? '자동 발급' : '수동 설정'}
                </button>
              ))}
            </div>
            {pwMode === 'auto' ? (
              <div className="text-[10.5px] text-ink-mid font-semibold">승인 시 DBA가 패스워드를 자동 발급합니다.</div>
            ) : (
              <>
                <input
                  type="text"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  placeholder="패스워드 (8자 이상)"
                  className="w-full h-8 px-2.5 border border-line rounded text-[12px] font-mono bg-white focus:outline-none focus:border-kb-yellow-dark"
                />
                {pwValue.length > 0 && pwValue.trim().length < 8 && (
                  <div className="text-[10.5px] text-bad font-bold mt-1">8자 이상 입력하세요.</div>
                )}
              </>
            )}
          </Field>

        </div>

        <div className="flex items-center justify-end gap-2 py-3 px-[18px] border-t border-line-soft">
          <button onClick={onClose} className="h-8 px-3 border border-line rounded text-[12px] font-bold text-ink-mid hover:bg-surface bg-white">
            취소
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                env,
                kind,
                name: name.trim(),
                owner,
                perms: permsLabel,
                period,
                password: pwMode === 'manual' ? pwValue.trim() : '',
              })
            }
            className="h-8 px-3.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[12px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            결재 상신
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-extrabold text-ink-dark mb-1">{label}</div>
      {children}
    </div>
  );
}

/* ---------------- 결재 ---------------- */

function ApprovalTab() {
  return (
    <div className="grid grid-cols-[1fr_320px] gap-3.5">
      <section className="card shadow-sm">
        <div className="py-3 px-[18px] border-b border-line-soft text-sm font-extrabold text-ink">규제 준수 체크리스트</div>
        <ul className="px-[18px] py-2 divide-y divide-line-soft">
          {CHECKLIST.map((c) => (
            <li key={c.k} className="flex items-center gap-2.5 py-2.5 text-[12px]">
              <span
                className={cn(
                  'w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-extrabold flex-shrink-0',
                  c.done ? 'bg-ok text-white' : 'bg-surface-soft text-ink-light border border-line',
                )}
              >
                {c.done ? '✓' : ''}
              </span>
              <span className={cn('font-semibold', c.done ? 'text-ink-dark' : 'text-ink-mid')}>{c.k}</span>
              <span className="flex-1" />
              <span className={cn('text-[10.5px] font-bold', c.done ? 'text-ok' : 'text-warn')}>
                {c.done ? '완료' : '미완료'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <aside className="self-start">
        <div className="card px-4 py-3.5">
          <div className="text-[11.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-2.5">결재 진행</div>
          <div className="space-y-1.5">
            {APPR_STEPS.map((s) => (
              <div
                key={s.seq}
                className={cn(
                  'flex items-start gap-2 py-1.5 px-2 rounded border',
                  s.tone === 'done' && 'bg-ok-bg/40 border-ok-border',
                  s.tone === 'current' && 'bg-kb-yellow-tint border-kb-yellow-dark',
                  s.tone === 'upcoming' && 'bg-white border-line-soft',
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
                    s.tone === 'done' && 'bg-ok text-white',
                    s.tone === 'current' && 'bg-kb-yellow-dark text-white',
                    s.tone === 'upcoming' && 'bg-white text-ink-light border border-line',
                  )}
                >
                  {s.seq}
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[11.5px]', s.tone === 'current' ? 'font-extrabold text-ink' : 'font-bold text-ink-dark')}>
                    {s.label}
                  </span>
                  <span className="block text-[10.5px] text-ink-mid font-semibold">{s.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- 데이터 적재 · 마이그레이션 ---------------- */

type LoadSource = '파일 업로드' | '스키마 마이그레이션';
type LoadMode = '추가(append)' | '전체 교체(replace)' | 'upsert(병합)';
type LoadStatus = 'pending' | 'running' | 'done' | 'failed';
type CodeLang = 'SQL' | 'Python';
interface LoadJob {
  id: string;
  source: LoadSource;
  env: AccountEnv;
  table: string;
  mode: LoadMode | '-';
  origin: string;
  version?: string; // 스키마 마이그레이션 버전 (예: V3)
  lang: CodeLang;
  code: string;
  rows: number;
  status: LoadStatus;
  at: string;
  by: string;
}

const LOAD_SEED: LoadJob[] = [
  {
    id: uid(), source: '스키마 마이그레이션', env: '서빙계', table: 'customer', mode: '-', origin: 'grade 컬럼 추가 → 기본값 설정', version: 'V2', rows: 5200, status: 'done', at: '2026-08-05 22:35', by: '이도현',
    lang: 'SQL',
    code: `-- V2: customer.grade 컬럼 추가 후 기본값/백필\nALTER TABLE customer ADD COLUMN grade VARCHAR(10) DEFAULT 'N';\nUPDATE customer SET grade = 'N' WHERE grade IS NULL;`,
  },
  {
    id: uid(), source: '파일 업로드', env: '서빙계', table: 'customer', mode: 'upsert(병합)', origin: 'customer_seed.csv', rows: 5200, status: 'done', at: '2026-08-05 22:40', by: '정오너',
    lang: 'Python',
    code: `import pandas as pd\ndf = pd.read_csv('customer_seed.csv')\ndf['grade'] = df['grade'].fillna('N')\ndf.to_sql('customer', engine, if_exists='append', index=False)`,
  },
  {
    id: uid(), source: '스키마 마이그레이션', env: '서빙계', table: 'consult_log', mode: '-', origin: 'channel 컬럼 추가 → UNKNOWN 백필', version: 'V3', rows: 0, status: 'pending', at: '2026-08-06 10:41', by: '이도현',
    lang: 'SQL',
    code: `-- V3: consult_log.channel 컬럼 추가 후 기존 행 백필\nALTER TABLE consult_log ADD COLUMN channel VARCHAR(20);\nUPDATE consult_log SET channel = 'UNKNOWN' WHERE channel IS NULL;`,
  },
];

const LOAD_STATUS: Record<LoadStatus, { cls: string; label: string }> = {
  pending: { cls: 'bg-warn-bg text-warn border-warn-border', label: '⏳ 결재 대기' },
  running: { cls: 'bg-info-bg text-info border-info-border', label: '● 적재 중' },
  done: { cls: 'bg-ok-bg text-ok border-ok-border', label: '완료' },
  failed: { cls: 'bg-bad-bg text-bad border-bad-border', label: '실패' },
};

const SOURCE_ICON: Record<LoadSource, string> = {
  '파일 업로드': '📄',
  '스키마 마이그레이션': '🧬',
};

// 적재용 파일이 올라가는 내부 오브젝트 스토리지(폐쇄망)
interface StorageFile {
  id: string;
  name: string;
  format: string;
  sizeMB: number;
  path: string;
  at: string;
  by: string;
}
const STORAGE_BUCKET = 'obj://kb-internal/pb-ingest';
const STORAGE_FILES: StorageFile[] = [
  { id: uid(), name: 'customer_seed.csv', format: 'CSV', sizeMB: 12.4, path: '/seed/', at: '2026-08-05', by: '정오너' },
  { id: uid(), name: 'consult_2020_2025.parquet', format: 'Parquet', sizeMB: 842.1, path: '/migration/', at: '2026-08-04', by: '이도현' },
  { id: uid(), name: 'grade_master.csv', format: 'CSV', sizeMB: 0.3, path: '/ref/', at: '2026-08-03', by: '김지우' },
  { id: uid(), name: 'channel_code.csv', format: 'CSV', sizeMB: 0.1, path: '/ref/', at: '2026-08-03', by: '김지우' },
  { id: uid(), name: 'consult_delta_0806.csv', format: 'CSV', sizeMB: 34.7, path: '/daily/', at: '2026-08-06', by: '야간 배치' },
];

function LoadTab({ tables }: { tables: Table[] }) {
  const [jobs, setJobs] = useState<LoadJob[]>(LOAD_SEED);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<LoadJob | null>(null);
  const [approving, setApproving] = useState<LoadJob | null>(null);
  const submitJob = (draft: Omit<LoadJob, 'id' | 'status' | 'at' | 'by' | 'rows'>) => {
    // 적재 작업도 결재 필요 → 결재 대기 상태로 상신
    setJobs((prev) => [
      { ...draft, id: uid(), rows: 0, status: 'pending', at: '방금', by: '정오너' },
      ...prev,
    ]);
    setAdding(false);
  };
  const approveJob = (id: string) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'running' } : j)));
  const rejectJob = (id: string) => setJobs((prev) => prev.filter((j) => j.id !== id));

  return (
    <>
    {/* 저장소 뷰 — 적재용 파일이 올라가는 내부 오브젝트 스토리지 */}
    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
          저장소
          <span className="text-[11px] text-ink-mid font-mono font-semibold">{STORAGE_BUCKET}</span>
          <span className="text-[11px] text-ink-mid font-semibold">{STORAGE_FILES.length}개 파일</span>
        </div>
        <button className="h-7 px-2.5 bg-white border border-line rounded text-[11px] font-bold text-ink-dark hover:bg-surface">
          ＋ 파일 업로드
        </button>
      </div>
      <div className="px-[18px] py-[18px]">
        <div className="border border-line-soft rounded-lg overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">파일명</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">형식</th>
                <th className="text-right py-2 px-3 font-bold whitespace-nowrap">크기</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">경로</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">업로드일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {STORAGE_FILES.map((f) => (
                <tr key={f.id} className="hover:bg-surface">
                  <td className="py-2 px-3 font-mono font-bold text-ink-dark whitespace-nowrap">📄 {f.name}</td>
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{f.format}</td>
                  <td className="py-2 px-3 text-right font-mono text-ink-mid whitespace-nowrap">{f.sizeMB} MB</td>
                  <td className="py-2 px-3 font-mono text-ink-light whitespace-nowrap">{f.path}</td>
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{f.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center justify-between gap-3.5 py-3 px-[18px] border-b border-line-soft">
        <div className="flex items-center gap-2 text-sm font-extrabold text-ink">
          데이터 적재 · 마이그레이션
          <span className="text-[11px] text-ink-mid font-semibold">{jobs.length}건</span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="h-7 px-3 bg-kb-yellow border border-kb-yellow-dark rounded text-[11.5px] font-extrabold text-ink hover:bg-kb-yellow-dark"
        >
          ＋ 적재 작업
        </button>
      </div>
      <div className="px-[18px] py-[18px]">
        <div className="border border-line-soft rounded-lg overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">소스</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">대상</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">원본 / 사유</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">방식 / 버전</th>
                <th className="text-right py-2 px-3 font-bold whitespace-nowrap">건수</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">스크립트</th>
                <th className="text-center py-2 px-3 font-bold whitespace-nowrap">상태</th>
                <th className="text-left py-2 px-3 font-bold whitespace-nowrap">시각</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {jobs.map((j) => (
                <tr
                  key={j.id}
                  onClick={j.status === 'pending' ? () => setApproving(j) : undefined}
                  className={cn('hover:bg-surface', j.status === 'pending' && 'cursor-pointer')}
                >
                  <td className="py-2 px-3 whitespace-nowrap font-semibold text-ink-dark">
                    <span className="mr-1">{SOURCE_ICON[j.source]}</span>
                    {j.source}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold mr-1.5', ENV_META[j.env].badge)}>
                      {j.env}
                    </span>
                    <span className="font-mono font-bold text-ink-dark">{j.table}</span>
                  </td>
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{j.origin}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {j.source === '스키마 마이그레이션' ? (
                      <span className="inline-flex items-center py-[1px] px-1.5 rounded-full border border-info-border bg-info-bg text-info text-[10px] font-extrabold font-mono">
                        {j.version}
                      </span>
                    ) : (
                      <span className="text-ink-mid">{j.mode}</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-ink-dark whitespace-nowrap">
                    {j.status === 'running' ? '—' : j.rows.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewing(j);
                      }}
                      className="h-6 px-2 border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-surface bg-white whitespace-nowrap"
                    >
                      📝 {j.lang}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold whitespace-nowrap', LOAD_STATUS[j.status].cls)}>
                      {LOAD_STATUS[j.status].label}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{j.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {approving && (
        <LoadApprovalModal
          job={approving}
          onClose={() => setApproving(null)}
          onApprove={() => {
            approveJob(approving.id);
            setApproving(null);
          }}
          onReject={() => {
            rejectJob(approving.id);
            setApproving(null);
          }}
        />
      )}
      {adding && <LoadJobModal tables={tables} onClose={() => setAdding(false)} onSubmit={submitJob} />}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between py-3 px-[18px] border-b border-line-soft">
              <div className="text-sm font-extrabold text-ink">
                변환 스크립트 <span className="text-ink-mid font-semibold">· {viewing.table} · {viewing.lang}</span>
              </div>
              <button onClick={() => setViewing(null)} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
            </div>
            <div className="px-[18px] py-4">
              <pre className="text-[11.5px] font-mono text-ink-dark bg-surface-soft border border-line-soft rounded-lg p-3 overflow-x-auto whitespace-pre">{viewing.code}</pre>
            </div>
          </div>
        </div>
      )}
    </section>
    </>
  );
}

function LoadApprovalModal({
  job,
  onClose,
  onApprove,
  onReject,
}: {
  job: LoadJob;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isMig = job.source === '스키마 마이그레이션';
  const [note, setNote] = useState('');
  const title = isMig ? `스키마 마이그레이션 · ${job.table} ${job.version}` : `데이터 적재 · ${job.table}`;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4 py-8" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-[900px]" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 카드 */}
        <div className="card px-6 py-5 m-3.5 mb-0 relative">
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-bold', isMig ? 'bg-info-bg text-info border-info-border' : 'bg-ok-bg text-ok border-ok-border')}>
              {SOURCE_ICON[job.source]} {job.source}
            </span>
            <span className="inline-flex items-center py-[2px] px-2 rounded-full border border-warn-border bg-warn-bg text-warn text-[10px] font-extrabold">
              승인 대기
            </span>
          </div>
          <h1 className="text-[20px] font-extrabold text-ink tracking-[-0.3px] mb-1.5">{title}</h1>
          <p className="text-xs text-ink-mid font-semibold">
            기안자 <b className="text-ink-dark">{job.by}</b> · 신청 일시 <b className="text-ink-dark">{job.at}</b> ·
            결재선 <b className="text-ink-dark">DBA · 플랫폼 관리 그룹</b>
          </p>
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-3.5 p-3.5">
          {/* 좌측 — 신청 정보 */}
          <div>
            <LFormSection title="신청 정보">
              <LFormRow k="유형" v={<span>{SOURCE_ICON[job.source]} {job.source}</span>} />
              <LFormRow
                k="대상"
                v={
                  <span>
                    <span className={cn('inline-flex items-center py-[1px] px-1.5 rounded-full border text-[10px] font-extrabold mr-1.5', ENV_META[job.env].badge)}>{job.env}</span>
                    <span className="font-mono font-bold text-ink-dark">{job.table}</span>
                  </span>
                }
              />
              <LFormRow k={isMig ? '변경 사유' : '원본 파일'} v={job.origin} />
              {isMig ? (
                <LFormRow k="버전" v={<span className="font-mono font-bold">{job.version}</span>} />
              ) : (
                <LFormRow k="적재 방식" v={job.mode} />
              )}
            </LFormSection>

            <LFormSection title={isMig ? '마이그레이션 스크립트' : '변환 스크립트'}>
              <div className="px-4 py-3">
                <div className="text-[10.5px] text-ink-mid font-semibold mb-1.5">{job.lang}</div>
                <pre className="text-[11.5px] font-mono text-ink-dark bg-surface-soft border border-line-soft rounded-lg p-3 overflow-x-auto whitespace-pre">{job.code}</pre>
              </div>
            </LFormSection>
          </div>

          {/* 우측 — 결재 진행 */}
          <aside>
            <SidebarCard title="결재 진행">
              <div className="space-y-1.5">
                <LApprStep seq="✓" label="기안" sub={`${job.by} · ${job.at}`} tone="done" />
                <LApprStep seq="2" label="정보보호 그룹 (개인정보)" sub="검토 완료" tone="done" />
                <LApprStep seq="3" label="DBA · 플랫폼 관리 그룹" sub="결재 대기" tone="current" />
              </div>
            </SidebarCard>
            <SidebarCard title="결재 의견">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="승인·반려 사유 (선택)"
                className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2 bg-white resize-y focus:outline-none focus:border-kb-yellow-dark"
              />
            </SidebarCard>
          </aside>
        </div>

        {/* 하단 액션 바 */}
        <div className="border-t border-line bg-white rounded-b-xl px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            <span className="text-warn font-extrabold">승인 대기</span>
            <span className="mx-2 text-line">·</span>
            {isMig ? '스키마 마이그레이션' : '데이터 적재'} 결재 · DBA
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="py-2 px-3 rounded text-[12.5px] font-bold text-ink-mid hover:bg-surface">
              닫기
            </button>
            <button
              onClick={onReject}
              className="py-2 px-3.5 bg-white border border-bad-border rounded text-[12.5px] font-extrabold text-bad hover:bg-bad-bg"
            >
              반려
            </button>
            <Button variant="primary" onClick={onApprove}>
              ✓ 승인
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LFormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-3.5">
      <div className="py-2 px-4 bg-surface-soft border-b border-line-soft text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">
        {title}
      </div>
      <div className="divide-y divide-line-soft">{children}</div>
    </div>
  );
}

function LFormRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-4 text-[12.5px]">
      <span className="w-[92px] flex-shrink-0 text-ink-mid font-semibold text-[11.5px]">{k}</span>
      <span className="flex-1 min-w-0 text-ink-dark font-semibold">{v}</span>
    </div>
  );
}

function LApprStep({ seq, label, sub, tone }: { seq: string; label: string; sub: string; tone: 'done' | 'current' | 'upcoming' | 'rejected' }) {
  const current = tone === 'current';
  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 rounded border',
        tone === 'done' && 'bg-ok-bg/40 border-ok-border',
        tone === 'rejected' && 'bg-bad-bg border-bad-border',
        tone === 'upcoming' && 'bg-white border-line-soft',
        current && 'bg-kb-yellow-tint border-kb-yellow-dark',
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          tone === 'done' && 'bg-ok text-white border border-ok',
          tone === 'rejected' && 'bg-bad text-white border border-bad',
          tone === 'upcoming' && 'bg-white text-ink-light border border-line',
          current && 'bg-kb-yellow-dark text-white border border-kb-yellow-dark',
        )}
      >
        {tone === 'rejected' ? '✕' : seq}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[11.5px]', current ? 'font-extrabold text-ink' : 'font-bold text-ink-dark')}>{label}</span>
        <span className="block text-[10.5px] text-ink-mid font-semibold truncate">{sub}</span>
      </span>
    </div>
  );
}

function LoadJobModal({
  tables,
  onClose,
  onSubmit,
}: {
  tables: Table[];
  onClose: () => void;
  onSubmit: (draft: Omit<LoadJob, 'id' | 'status' | 'at' | 'by' | 'rows'>) => void;
}) {
  // 데이터 적재·마이그레이션은 서빙계(운영)만 대상
  const env: AccountEnv = '서빙계';
  const [source, setSource] = useState<LoadSource>('파일 업로드');
  const [mode, setMode] = useState<LoadMode>('추가(append)');
  const [origin, setOrigin] = useState('');
  const [version, setVersion] = useState('');
  const [lang, setLang] = useState<CodeLang>('SQL');
  const [code, setCode] = useState('');
  const [picking, setPicking] = useState(false);
  const envTables = tables.filter((t) => t.env === env);
  const [table, setTable] = useState(envTables[0]?.table ?? '');

  const isMigration = source === '스키마 마이그레이션';
  const codeLabel = isMigration ? '마이그레이션 스크립트' : '변환 스크립트';
  const codePh = isMigration
    ? lang === 'SQL'
      ? `-- 스키마 변경 + 초기값/기본값/백필\nALTER TABLE ${table || 'target_table'} ADD COLUMN ...;\nUPDATE ${table || 'target_table'} SET ... WHERE ... IS NULL;`
      : `# 스키마 변경에 따른 값 설정\nop.add_column('${table || 'target_table'}', ...)\nsession.execute("UPDATE ...")`
    : lang === 'SQL'
    ? `INSERT INTO ${table || 'target_table'} (...)\nSELECT ... FROM staging;`
    : `import pandas as pd\ndf = pd.read_csv('...')\n# transform\ndf.to_sql('${table || 'target_table'}', engine, if_exists='append', index=False)`;
  const valid =
    table.trim().length > 0 &&
    code.trim().length > 0 &&
    (isMigration ? version.trim().length > 0 && origin.trim().length > 0 : origin.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between py-3 px-[18px] border-b border-line-soft">
          <div className="text-sm font-extrabold text-ink">데이터 적재 · 마이그레이션</div>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
        </div>

        <div className="px-[18px] py-4 flex flex-col gap-3.5">
          {/* 소스 유형 */}
          <Field label="소스 유형">
            <div className="flex gap-1.5 flex-wrap">
              {(['파일 업로드', '스키마 마이그레이션'] as LoadSource[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={cn(
                    'h-8 px-3 rounded border text-[12px] font-bold',
                    source === s ? 'bg-kb-yellow border-kb-yellow-dark text-ink' : 'bg-white border-line text-ink-mid hover:bg-surface',
                  )}
                >
                  {SOURCE_ICON[s]} {s}
                </button>
              ))}
            </div>
          </Field>

          {/* 대상 환경 — 서빙계(운영)만 */}
          <Field label="대상 환경">
            <span className={cn('inline-flex items-center py-[3px] px-2.5 rounded border text-[12px] font-bold', ENV_META['서빙계'].badge)}>
              서빙계
            </span>
          </Field>

          {/* 대상 테이블 */}
          <Field label="대상 테이블">
            <select
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="w-full h-8 px-2.5 border border-line rounded text-[12px] font-mono bg-white focus:outline-none focus:border-kb-yellow-dark"
            >
              {envTables.length === 0 && <option value="">(테이블 없음)</option>}
              {envTables.map((t) => (
                <option key={t.id} value={t.table}>{t.table}</option>
              ))}
            </select>
          </Field>

          {isMigration ? (
            <>
              {/* 마이그레이션 버전 */}
              <Field label="버전">
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="예: V4"
                  className="w-full h-8 px-2.5 border border-line rounded text-[12px] font-mono bg-white focus:outline-none focus:border-kb-yellow-dark"
                />
              </Field>
              {/* 변경 사유 */}
              <Field label="변경 사유">
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="예: channel 컬럼 추가 → UNKNOWN 백필"
                  className="w-full h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-kb-yellow-dark"
                />
              </Field>
            </>
          ) : (
            <>
              {/* 원본 파일 */}
              <Field label="파일명 (CSV/Parquet)">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2.5 border border-line rounded text-[12px] font-mono bg-white flex items-center truncate">
                    {origin ? (
                      <span className="text-ink-dark truncate">{origin}</span>
                    ) : (
                      <span className="text-ink-light">저장소에서 파일을 선택하세요</span>
                    )}
                  </div>
                  <button
                    onClick={() => setPicking(true)}
                    className="h-8 px-2.5 bg-white border border-line rounded text-[11.5px] font-bold text-ink-dark hover:bg-surface whitespace-nowrap"
                  >
                    📁 저장소에서 선택
                  </button>
                </div>
              </Field>
              {/* 적재 방식 */}
              <Field label="적재 방식">
                <div className="flex gap-1.5 flex-wrap">
                  {(['추가(append)', '전체 교체(replace)', 'upsert(병합)'] as LoadMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        'h-8 px-3 rounded border text-[11.5px] font-bold',
                        mode === m ? 'bg-kb-yellow border-kb-yellow-dark text-ink' : 'bg-white border-line text-ink-mid hover:bg-surface',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
            </>
          )}

          {/* 스크립트 (인라인 코드 에디터) */}
          <Field label={codeLabel}>
            <div className="flex gap-1.5 mb-1.5">
              {(['SQL', 'Python'] as CodeLang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    'h-7 px-2.5 rounded border text-[11px] font-bold',
                    lang === l ? 'bg-kb-yellow border-kb-yellow-dark text-ink' : 'bg-white border-line text-ink-mid hover:bg-surface',
                  )}
                >
                  {l}
                </button>
              ))}
              <span className="flex-1" />
              <span className="text-[10.5px] text-ink-light font-semibold self-center">ETL·마이그레이션 로직</span>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={codePh}
              rows={7}
              spellCheck={false}
              className="w-full px-2.5 py-2 border border-line rounded text-[11.5px] font-mono leading-[1.6] text-ink-dark bg-surface-soft focus:outline-none focus:border-kb-yellow-dark resize-y"
            />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 py-3 px-[18px] border-t border-line-soft">
          <button onClick={onClose} className="h-8 px-3 border border-line rounded text-[12px] font-bold text-ink-mid hover:bg-surface bg-white">
            취소
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onSubmit({
                source,
                env,
                table: table.trim(),
                mode: isMigration ? '-' : mode,
                origin: origin.trim(),
                version: isMigration ? version.trim() : undefined,
                lang,
                code: code.trim(),
              })
            }
            className="h-8 px-3.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[12px] font-extrabold text-ink hover:bg-kb-yellow-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            적재 실행
          </button>
        </div>
      </div>

      {picking && (
        <FilePickerModal
          onClose={() => setPicking(false)}
          onPick={(f) => {
            setOrigin(f.name);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 저장소 파일 선택 ---------------- */

function FilePickerModal({ onClose, onPick }: { onClose: () => void; onPick: (f: StorageFile) => void }) {
  const [q, setQ] = useState('');
  const rows = STORAGE_FILES.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between py-3 px-[18px] border-b border-line-soft">
          <div className="text-sm font-extrabold text-ink">
            저장소 파일 선택 <span className="text-ink-mid font-mono font-semibold text-[11px]">{STORAGE_BUCKET}</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-mid hover:bg-surface">✕</button>
        </div>
        <div className="px-[18px] py-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="파일명 검색"
            className="w-full h-8 px-2.5 border border-line rounded text-[12px] bg-white focus:outline-none focus:border-kb-yellow-dark mb-2.5"
          />
          <div className="border border-line-soft rounded-lg overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="bg-surface-soft text-ink-mid text-[10.5px] font-bold">
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">파일명</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">형식</th>
                  <th className="text-right py-2 px-3 font-bold whitespace-nowrap">크기</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">경로</th>
                  <th className="text-left py-2 px-3 font-bold whitespace-nowrap">업로드</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-[11.5px] text-ink-light">일치하는 파일이 없습니다.</td></tr>
                )}
                {rows.map((f) => (
                  <tr key={f.id} className="hover:bg-surface">
                    <td className="py-2 px-3 font-mono font-bold text-ink-dark whitespace-nowrap">📄 {f.name}</td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{f.format}</td>
                    <td className="py-2 px-3 text-right font-mono text-ink-mid whitespace-nowrap">{f.sizeMB} MB</td>
                    <td className="py-2 px-3 font-mono text-ink-light whitespace-nowrap">{f.path}</td>
                    <td className="py-2 px-3 text-ink-mid whitespace-nowrap">{f.at} · {f.by}</td>
                    <td className="py-2 px-2 text-right">
                      <button
                        onClick={() => onPick(f)}
                        className="h-6 px-2.5 bg-kb-yellow border border-kb-yellow-dark rounded text-[10.5px] font-extrabold text-ink hover:bg-kb-yellow-dark whitespace-nowrap"
                      >
                        선택
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 연결(커넥터) ---------------- */

interface ConnInfo {
  env: AccountEnv;
  host: string;
  port: number;
  database: string;
  jdbc: string;
  account: string;
  ssl: string;
  network: string;
}
const CONNECTIONS: ConnInfo[] = [
  {
    env: '학습계',
    host: 'pb-consult-db-dev.kb-internal.local',
    port: 5432,
    database: 'pb_consult_dev',
    jdbc: 'jdbc:postgresql://pb-consult-db-dev.kb-internal.local:5432/pb_consult_dev',
    account: 'svc_pb_consult_ro_dev (읽기 전용)',
    ssl: 'require · TLS 1.2+',
    network: '내부망(폐쇄망)',
  },
  {
    env: '서빙계',
    host: 'pb-consult-db.kb-internal.local',
    port: 5432,
    database: 'pb_consult',
    jdbc: 'jdbc:postgresql://pb-consult-db.kb-internal.local:5432/pb_consult',
    account: 'svc_pb_consult_ro (읽기 전용)',
    ssl: 'require · TLS 1.2+',
    network: '내부망(폐쇄망)',
  },
];

function ConnectorTab() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  return (
    <section className="card shadow-sm mb-3.5">
      <div className="flex items-center gap-2 py-3 px-[18px] border-b border-line-soft text-sm font-extrabold text-ink">
        연결 정보
        <span className="text-[11px] text-ink-mid font-semibold">엔진 {REQUEST.engine} · 읽기 전용</span>
      </div>
      <div className="px-[18px] py-[18px] flex flex-col gap-4">
        {CONNECTIONS.map((c) => (
          <div key={c.env}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10.5px] font-extrabold', ENV_META[c.env].badge)}>
                {c.env}
              </span>
              <span className="text-[10.5px] text-ink-mid font-semibold">{c.network}</span>
            </div>
            <div className="border border-line-soft rounded-lg overflow-hidden">
              {/* JDBC URL — 강조 + 복사 */}
              <div className="flex items-center gap-2 py-2.5 px-3.5 bg-surface-soft border-b border-line-soft">
                <span className="text-[10.5px] text-ink-mid font-bold w-[92px] flex-shrink-0">JDBC URL</span>
                <code className="flex-1 min-w-0 text-[11.5px] font-mono text-ink-dark truncate">{c.jdbc}</code>
                <button
                  onClick={() => copy(`${c.env}-jdbc`, c.jdbc)}
                  className="h-6 px-2 border border-line rounded text-[10.5px] font-bold text-ink-dark hover:bg-white bg-white whitespace-nowrap flex-shrink-0"
                >
                  {copied === `${c.env}-jdbc` ? '✓ 복사됨' : '복사'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0 px-3.5 py-1">
                <KvRow k="Host" v={<code className="text-[11px] font-mono text-ink-dark">{c.host}</code>} />
                <KvRow k="Port" v={<code className="text-[11px] font-mono text-ink-dark">{c.port}</code>} />
                <KvRow k="Database" v={<code className="text-[11px] font-mono text-ink-dark">{c.database}</code>} />
                <KvRow k="접속 계정" v={c.account} />
                <KvRow k="SSL/TLS" v={c.ssl} />
                <KvRow k="망 구간" v={c.network} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- helpers ---------------- */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative py-2.5 px-3.5 text-[13px] font-bold -mb-px border-b-2',
        active ? 'text-ink border-kb-yellow-dark' : 'text-ink-mid border-transparent hover:text-ink-dark',
      )}
    >
      {children}
    </button>
  );
}

function KvRow({ k, v, span }: { k: string; v: React.ReactNode; span?: boolean }) {
  return (
    <div className={cn('flex items-start gap-3 py-2.5 border-b border-line-soft last:border-0 text-[12px]', span && 'col-span-2')}>
      <span className="text-ink-mid font-semibold w-[92px] flex-shrink-0">{k}</span>
      <span className="text-ink-dark font-bold min-w-0">{v}</span>
    </div>
  );
}
