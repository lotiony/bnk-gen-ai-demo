import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ADMIN_MEMBERS,
  ROLE_LABEL,
  STATUS_LABEL,
  type AdminMember,
  type MemberRole,
  type MemberStatus,
} from '@/data/mockAdminMembers';

type RoleFilter = MemberRole | 'all';
type StatusFilter = MemberStatus | 'all';

const ROLE_TONE: Record<MemberRole, string> = {
  platform_admin: 'bg-warn-bg text-warn border-warn-border',
  pm: 'bg-kb-yellow-bg text-ink border-kb-yellow-dark',
  reviewer: 'bg-info-bg text-info border-info-border',
  member: 'bg-surface text-ink-dark border-line',
  viewer: 'bg-surface-soft text-ink-mid border-line-soft',
};

const STATUS_TONE: Record<MemberStatus, string> = {
  active: 'text-ok',
  invited: 'text-warn',
  suspended: 'text-bad',
};

/**
 * 관리 콘솔 > 멤버 관리.
 * 전사 멤버의 플랫폼 역할/상태/MFA를 한 화면에서 검색·필터·변경한다.
 */
export default function AdminMembersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [members, setMembers] = useState<AdminMember[]>(ADMIN_MEMBERS);

  const stats = useMemo(() => {
    const total = members.length;
    const admins = members.filter((m) => m.role === 'platform_admin').length;
    const pms = members.filter((m) => m.role === 'pm').length;
    const invited = members.filter((m) => m.status === 'invited').length;
    const mfaMissing = members.filter((m) => !m.mfaEnabled && m.status !== 'suspended').length;
    return { total, admins, pms, invited, mfaMissing };
  }, [members]);

  const rows = useMemo(() => {
    const lower = q.trim().toLowerCase();
    return members.filter((m) => {
      if (role !== 'all' && m.role !== role) return false;
      if (status !== 'all' && m.status !== status) return false;
      if (!lower) return true;
      return (
        m.name.toLowerCase().includes(lower) ||
        m.email.toLowerCase().includes(lower) ||
        m.empNo.includes(lower) ||
        m.dept.toLowerCase().includes(lower)
      );
    });
  }, [members, q, role, status]);

  const handleRoleChange = (id: string, nextRole: MemberRole) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: nextRole } : m)));
  };

  return (
    <>
      {/* Header */}
      <div className="card px-6 py-5 mb-3.5 flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] text-ink-mid font-bold tracking-[0.3px] mb-1">
            플랫폼 관리 · 운영 관리
          </div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">멤버 관리</h1>
          <div className="text-[12px] text-ink-mid mt-1.5">
            플랫폼 전역 역할과 MFA·접근 상태를 관리합니다. 모든 변경은 감사 원장에 기록됩니다.
          </div>
        </div>
        <button className="h-9 px-4 bg-kb-yellow text-ink text-[12.5px] font-extrabold rounded border border-kb-yellow-dark hover:bg-kb-yellow-dark">
          + 멤버 초대
        </button>
      </div>

      {/* Stat band */}
      <div className="grid grid-cols-5 gap-3 mb-3.5">
        <StatTile label="전체 멤버" value={stats.total} />
        <StatTile label="플랫폼 관리자" value={stats.admins} tone="warn" />
        <StatTile label="PM" value={stats.pms} tone="ok" />
        <StatTile label="초대 대기" value={stats.invited} tone="warn" />
        <StatTile label="MFA 미등록" value={stats.mfaMissing} tone={stats.mfaMissing > 0 ? 'bad' : 'ok'} />
      </div>

      {/* Filters + Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line-soft flex items-center gap-2 flex-wrap">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·사번·이메일·부서 검색"
            className="h-8 w-[260px] px-3 border border-line rounded text-[12px] outline-none focus:border-kb-yellow-dark"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleFilter)}
            className="h-8 px-2 border border-line rounded text-[12px] outline-none bg-white"
          >
            <option value="all">역할 · 전체</option>
            {(Object.keys(ROLE_LABEL) as MemberRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-8 px-2 border border-line rounded text-[12px] outline-none bg-white"
          >
            <option value="all">상태 · 전체</option>
            {(Object.keys(STATUS_LABEL) as MemberStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11px] text-ink-mid font-semibold">
            {rows.length} / {members.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line bg-surface-soft/40">
              <th className="text-left font-bold py-2.5 px-4">멤버</th>
              <th className="text-left font-bold py-2.5 px-2 w-[120px] whitespace-nowrap">부서</th>
              <th className="text-left font-bold py-2.5 px-2 w-[210px] whitespace-nowrap">역할</th>
              <th className="text-center font-bold py-2.5 px-2 w-[60px]">MFA</th>
              <th className="text-right font-bold py-2.5 px-2 w-[80px] whitespace-nowrap">프로젝트</th>
              <th className="text-left font-bold py-2.5 px-2 w-[80px] whitespace-nowrap">상태</th>
              <th className="text-right font-bold py-2.5 px-4 w-[110px] whitespace-nowrap">최근 활동</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-ink-light py-10 text-[12px]">
                  조건에 맞는 멤버가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/40">
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-kb-yellow-bg border border-kb-yellow-dark flex items-center justify-center text-[11px] font-extrabold text-ink">
                        {m.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-ink leading-tight truncate">{m.name}</div>
                        <div className="text-[10.5px] text-ink-mid font-semibold truncate">
                          {m.email} · {m.empNo}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-ink-dark font-semibold whitespace-nowrap">{m.dept}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('pill border whitespace-nowrap', ROLE_TONE[m.role])}>
                        {ROLE_LABEL[m.role]}
                      </span>
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                        className="h-6 px-1 border border-line rounded text-[10.5px] outline-none bg-white text-ink-mid"
                        title="역할 변경"
                      >
                        {(Object.keys(ROLE_LABEL) as MemberRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {m.mfaEnabled ? (
                      <span className="text-ok font-extrabold" title="MFA 등록됨">✓</span>
                    ) : (
                      <span className="text-bad font-extrabold" title="MFA 미등록">✗</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-extrabold text-ink">
                    {m.projectCount > 0 ? `${m.projectCount}건` : '—'}
                  </td>
                  <td className={cn('py-2.5 px-2 font-extrabold whitespace-nowrap', STATUS_TONE[m.status])}>
                    {STATUS_LABEL[m.status]}
                  </td>
                  <td className="py-2.5 px-4 text-right text-[10.5px] text-ink-mid font-semibold tabular-nums whitespace-nowrap">
                    {m.lastSeen}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="text-[10.5px] text-ink-mid bg-surface-soft border border-line-soft rounded px-3 py-2 mt-3.5">
        🔒 역할 변경·초대·정지는 감사 원장에 기록됩니다. 플랫폼 관리자 부여는 2인 결재가 필요합니다.
      </div>
    </>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink';
  return (
    <div className="card px-4 py-3">
      <div className="text-[10.5px] text-ink-mid font-bold mb-1">{label}</div>
      <div className={cn('text-[20px] font-extrabold tabular-nums', toneCls)}>{value}</div>
    </div>
  );
}
