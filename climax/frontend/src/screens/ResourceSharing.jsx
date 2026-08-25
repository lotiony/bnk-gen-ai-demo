import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { methodStyle } from "../i18n";
import {
  bindingDraftPatch,
  canExploreAsset,
  DETAIL_TABS,
  filterAssets,
  hasImpact,
  impactFromError,
  impactItems,
  impactProjectNavigation,
  normalizeDetail,
  normalizeRegistry,
  projectBindingChanges,
  releaseLabel,
  releaseSnapshotDiff,
  resolveDetachNavigation,
  sourceLabel,
  statusMeta,
  skillEditNavigation,
  toolExplorerNavigation,
  validationCheckLabel,
  validationCheckDetails,
  validationCheckStatus,
  validationIssueCopy,
  validationSkillReason,
  versionLabel,
} from "../lib/resourceRegistry";

const VIEW_LABELS = {
  attached: ["이 프로젝트 MCP", "This project's MCPs"],
  pool: ["공유 Pool", "Shared pool"],
  review: ["확인 필요", "Needs review"],
};
const FILTER_LABELS = {
  all: ["전체", "All"],
  owned: ["이 프로젝트 생성", "Created here"],
  shared: ["공용 연결", "Public binding"],
  enabled: ["사용 중", "Enabled"],
};
const TAB_LABELS = {
  overview: ["개요", "Overview"],
  sharing: ["공유 범위", "Sharing"],
  binding: ["프로젝트 사용", "Project binding"],
  history: ["이력", "History"],
};

const pick = (pair, ko) => pair[ko ? 0 : 1];
const metric = (metrics, keys, fallback = 0) => {
  for (const key of keys) if (metrics?.[key] != null) return Number(metrics[key]);
  return fallback;
};
const itemText = (item) => {
  if (item == null) return "—";
  if (typeof item === "string" || typeof item === "number") return String(item);
  return item.name || item.label || item.skill_name || item.project_name || item.code || item.id || JSON.stringify(item);
};
const friendlyError = (error, fallback) => {
  const detail = error?.body?.detail;
  const message = typeof detail === "string" ? detail
    : detail && typeof detail === "object" && typeof detail.message === "string" ? detail.message
      : "";
  return message || fallback;
};
const versionId = (version) => {
  if (version == null) return "";
  if (typeof version === "string" || typeof version === "number") return String(version);
  return String(version.id || version.version_id || version.version || version.name || "");
};
const bindingVersionId = (binding, versions = []) => {
  const pinned = binding?.pinned_version;
  const direct = versionId(pinned);
  if (!direct) return "";
  const wantedLabel = versionLabel(pinned);
  const match = versions.find((version) => versionId(version) === direct || versionLabel(version) === wantedLabel);
  return match ? versionId(match) : direct;
};
const validationValue = (detail) => detail?.validation?.state || detail?.validation?.status
  || detail?.binding?.validation_state || detail?.lifecycle_status || "review";
const detailTabFromNav = (value) => value === "validate" ? "binding"
  : DETAIL_TABS.includes(value) ? value : "overview";

function AssetIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <path d="M10 21V8a2 2 0 0 0-2-2H3v15h15v-5a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5 2 2 0 0 1-4 0 1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1 2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5 2 2 0 0 1 4 0 1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0-.3 1.8 1.6 1.6 0 0 0 1.5 1 2 2 0 0 1 0 4 1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}

function ShortcutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" /><path d="M7 7h10v10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg className={open ? "is-open" : ""} width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
  );
}

function StatusBadge({ value }) {
  const status = statusMeta(value);
  return <span className={`rsm-badge is-${status.tone}`}>{status.label}</span>;
}

function DetailRow({ label, children }) {
  return <div className="rsm-detail-row"><span>{label}</span><strong>{children ?? "—"}</strong></div>;
}

function RegistrySkeleton() {
  return <div className="rsm-skeleton" aria-label="loading">{[0, 1, 2].map((n) => <i key={n} />)}</div>;
}

function AssetRow({ asset, selected, expanded, onOpen, onConfigure, onExplore, ko }) {
  const binding = asset.binding;
  const explorable = canExploreAsset(asset);
  const release = releaseLabel(binding?.current_release);
  const draftPin = versionLabel(binding?.pinned_version || asset.latest_version);
  const currentVersion = versionLabel(
    binding?.current_release?.version || binding?.current_release?.pinned_version,
    binding?.current_release ? draftPin : "—",
  );
  return (
    <article className={`rsm-asset ${selected ? "is-selected" : ""}`}>
      <div className="rsm-asset-row" role="button" tabIndex="0" onClick={onOpen}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault(); onOpen();
          }
        }} aria-expanded={expanded} aria-controls={`rsm-cap-${asset.asset_id}`}>
        <span className="rsm-disclosure" aria-hidden="true">›</span>
        <span className="rsm-asset-copy">
          <strong>{asset.name}</strong>
          <small>{asset.created_project?.name || (ko ? "생성 프로젝트 미상" : "Unknown project")} · {sourceLabel(asset)} · {asset.capability_count} capabilities</small>
        </span>
        <span className={`rsm-badge is-${asset.visibility === "public" ? "public" : "private"}`}>{asset.visibility.toUpperCase()}</span>
        <span className="rsm-cell"><small>VERSION</small><strong>{binding?.current_release ? `CURRENT ${currentVersion}` : binding ? `PIN ${draftPin}` : versionLabel(asset.latest_version)}</strong></span>
        <StatusBadge value={asset.lifecycle_status} />
        <span className="rsm-cell rsm-release"><small>RELEASE</small><strong>{binding?.current_release ? `${release}${binding.has_draft ? ` · 미배포 ${draftPin}` : ""}` : binding?.has_draft ? (binding.revision || (ko ? "미배포" : "UNPUBLISHED")) : "—"}</strong></span>
        <span className="rsm-cell rsm-impact"><small>IMPACT</small><strong>{asset.skill_impact_count} Skills</strong></span>
        <button type="button" className="rsm-asset-settings"
          aria-label={ko ? `${asset.name} · ${asset.created_project?.name || "생성 프로젝트 미상"} 상세 설정 열기` : `Open ${asset.name} settings for ${asset.created_project?.name || "unknown project"}`}
          title={ko ? "상세 설정" : "Settings"}
          onClick={(event) => { event.stopPropagation(); onConfigure(); }}>
          <SettingsIcon />
        </button>
      </div>
      {expanded && (
        <div className="rsm-capabilities" id={`rsm-cap-${asset.asset_id}`}>
          <div className="rsm-cap-head"><span>CAPABILITY / TOOL</span><span>METHOD · PATH</span><span>TYPE</span><span>{ko ? "현재 상태" : "STATUS"}</span><span /></div>
          {asset.capabilities.map((capability) => (
            <div className="rsm-cap-row" key={capability.resource_id || capability.tool_id}>
              <strong className="mono">{capability.tool_id}</strong>
              <span className="rsm-cap-route"><i style={methodStyle(capability.method)}>{capability.method || "—"}</i><code>{capability.path || "—"}</code></span>
              <span className={`rsm-cap-type ${capability.mutating ? "is-mutating" : ""}`}>{capability.mutating ? "MUTATING" : "READ"}</span>
              <span className={`rsm-cap-state ${capability.enabled ? "" : "is-off"}`}>{capability.enabled ? "ON" : "OFF"}</span>
              <button type="button" disabled={!explorable}
                title={!explorable ? (ko ? "Current Release Publish 후 탐색할 수 있습니다." : "Publish a Current Release first.") : ""}
                onClick={() => explorable && onExplore(capability.tool_id)}>{explorable ? (ko ? "탐색" : "Explore") : (ko ? "Publish 후" : "After publish")} {explorable && "→"}</button>
            </div>
          ))}
          {!asset.capabilities.length && <div className="rsm-cap-empty">{ko ? "표시할 capability가 없습니다." : "No capabilities."}</div>}
        </div>
      )}
    </article>
  );
}

const impactProjectId = (item) => typeof item === "string" ? item
  : String(item?.project_id || item?.id || "");
const impactSkillId = (item) => typeof item === "string" ? "" : String(item?.skill_id || item?.id || "");
const impactSkillLabel = (item) => {
  if (typeof item === "string") return item;
  const step = Number(item?.step ?? item?.step_index);
  return `${item?.name || item?.skill_name || impactSkillId(item) || "Skill"}${Number.isInteger(step) && step >= 0 ? ` · step ${step + 1}` : ""}`;
};
const impactSkillKey = (item) => {
  const id = impactSkillId(item);
  return id ? `id:${id}` : `label:${impactSkillLabel(item)}`;
};

function ImpactExplorer({ impact: rawImpact, projects = [], onProject, onSkill, ko, initiallyOpen = false, openRequest = 0, highlightedImpact }) {
  const impact = impactItems(rawImpact);
  const highlighted = impactItems(highlightedImpact);
  const rootRef = useRef(null);
  const derivedProjects = impact.projects.length ? impact.projects : [...new Map(
    impact.skills
      .filter((skill) => typeof skill === "object" && skill.project_id)
      .map((skill) => [String(skill.project_id), {
        id: String(skill.project_id), project_id: String(skill.project_id),
      }]),
  ).values()];
  const [open, setOpen] = useState({ projects: initiallyOpen, skills: initiallyOpen });
  useEffect(() => {
    if (!openRequest) return;
    setOpen({ projects: true, skills: true });
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
    return () => cancelAnimationFrame(frame);
  }, [openRequest]);
  const highlightedProjectIds = new Set([
    ...highlighted.projects.map(impactProjectId),
    ...highlighted.skills.map((skill) => typeof skill === "object" ? String(skill.project_id || "") : ""),
  ].filter(Boolean));
  const highlightedSkillKeys = new Set(highlighted.skills.map(impactSkillKey));
  const groups = [
    { id: "projects", label: ko ? "연결 프로젝트" : "Connected projects", items: derivedProjects },
    { id: "skills", label: ko ? "영향 Skill" : "Affected skills", items: impact.skills },
  ].filter((group) => group.items.length > 0);
  if (!groups.length) return null;
  const projectLabel = (item) => {
    const id = impactProjectId(item);
    return (typeof item === "object" && (item.project_name || item.name))
      || projects.find((project) => project.id === id)?.name || id || "—";
  };
  return <div ref={rootRef} className="rsm-impact-explorer">{groups.map((group) => {
    const expanded = open[group.id];
    return <section key={group.id} className={expanded ? "is-open" : ""}>
      <button type="button" className="rsm-impact-toggle" aria-expanded={expanded}
        onClick={() => setOpen((value) => ({ ...value, [group.id]: !value[group.id] }))}>
        <span>{group.label}</span><strong>{group.items.length}</strong><ChevronIcon open={expanded} />
      </button>
      {expanded && <div className="rsm-impact-list">{group.items.map((item, index) => {
        const isProject = group.id === "projects";
        const label = isProject ? projectLabel(item) : impactSkillLabel(item);
        const canOpen = isProject ? !!impactProjectId(item) : !!skillEditNavigation(item);
        const itemHighlighted = isProject
          ? highlightedProjectIds.has(impactProjectId(item))
          : highlightedSkillKeys.has(impactSkillKey(item));
        return <div className={itemHighlighted ? "is-highlighted" : ""} key={`${isProject ? impactProjectId(item) : impactSkillId(item)}-${index}`}>
          <span><small>{isProject ? "PROJECT" : "SKILL"}</small><strong>{label}</strong>{!isProject && typeof item === "object" && item.tool_id && <code>{item.tool_id}</code>}</span>
          {canOpen && <button type="button" className="rsm-icon-shortcut"
            aria-label={ko ? `${label} 편집 화면 열기` : `Open ${label} editor`}
            title={ko ? "편집 화면 열기" : "Open editor"}
            onClick={() => isProject ? onProject?.(item) : onSkill?.(item)}><ShortcutIcon /></button>}
        </div>;
      })}</div>}
    </section>;
  })}</div>;
}

function ImpactDialog({ dialog, busy, onClose, onConfirm, projects, onProject, onSkill, ko }) {
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dialog, busy, onClose]);
  if (!dialog) return null;
  const impact = impactItems(dialog.impact);
  const blocked = dialog.mode === "blocked";
  return (
    <div className="rsm-dialog-backdrop" onClick={() => !busy && onClose()}>
      <section className="rsm-dialog" role="dialog" aria-modal="true" aria-labelledby="rsm-dialog-title" onClick={(event) => event.stopPropagation()}>
        <div className={`rsm-dialog-mark ${blocked ? "is-blocked" : ""}`}>{blocked ? "!" : dialog.mode === "attach" ? "+" : "↗"}</div>
        <div className="rsm-dialog-copy">
          <span>{blocked ? "CHANGE BLOCKED" : dialog.mode === "attach" ? "PROJECT BINDING" : "IMPACT CHECKED"}</span>
          <h3 id="rsm-dialog-title">{dialog.title}</h3>
          <p>{dialog.message}</p>
        </div>
        <ImpactExplorer impact={impact} projects={projects} onProject={onProject} onSkill={onSkill} ko={ko} initiallyOpen />
        {impact.blockers.length > 0 && <div className="rsm-blockers"><strong>{ko ? "해결이 필요한 항목" : "Items to resolve"}</strong>{impact.blockers.map((item, index) => <span key={`${itemText(item)}-${index}`}>{itemText(item)}</span>)}</div>}
        {blocked && <div className="rsm-notice is-warning">{ko ? "연결된 사용처를 먼저 정리한 뒤 다시 시도하세요. 현재 Release는 계속 실행됩니다." : "Resolve dependencies first. The current release keeps running."}</div>}
        <div className="rsm-dialog-actions">
          <button type="button" className="rsm-btn is-ghost" disabled={busy} onClick={onClose}>{blocked ? (ko ? "확인" : "Close") : (ko ? "취소" : "Cancel")}</button>
          {!blocked && <button type="button" className={`rsm-btn ${["detach", "delete-asset"].includes(dialog.mode) ? "is-danger" : "is-primary"}`} disabled={busy} onClick={onConfirm}>{busy ? (ko ? "처리 중…" : "Working…") : dialog.confirmLabel}</button>}
        </div>
      </section>
    </div>
  );
}

function OverviewTab({ detail, ko }) {
  const binding = detail.binding;
  const currentVersion = versionLabel(binding?.current_release?.version, "—");
  return <div className="rsm-detail-list">
    <DetailRow label="MCP identity"><span className="mono">{detail.asset_id}</span> · {detail.name}</DetailRow>
    <DetailRow label={ko ? "생성 프로젝트 / source" : "Created project / source"}>{detail.created_project?.name || "—"} · {sourceLabel(detail)}</DetailRow>
    <DetailRow label={ko ? "공유 범위" : "Sharing"}>{detail.visibility.toUpperCase()} · {detail.visibility === "public" ? (ko ? "조직 공용" : "Organization pool") : (ko ? "생성 프로젝트 전용" : "Creator project only")}</DetailRow>
    <DetailRow label={ko ? "현재 프로젝트" : "Current project"}>{binding?.current_release ? `${releaseLabel(binding.current_release)} · ${currentVersion} · ${binding.current_enabled === false ? "OFF" : "ON"}` : binding ? (ko ? "Publish 전 변경사항" : "Unpublished changes") : (ko ? "미연결" : "Not connected")}</DetailRow>
    {binding?.has_draft && <DetailRow label={ko ? "미배포 변경사항" : "Unpublished changes"}>PIN {versionLabel(binding.pinned_version)} · revision {binding.revision} · {binding.enabled === false ? "OFF" : "ON"}</DetailRow>}
    <DetailRow label={ko ? "사용 현황" : "Usage"}>{detail.used_by_count} Projects · {detail.skill_impact_count} Skills</DetailRow>
    <DetailRow label="Capabilities">{detail.capability_count}</DetailRow>
    <div className="rsm-notice">{ko ? "생성 프로젝트는 출처 정보이며, 실제 변경 가능 범위는 로그인 계정 권한으로 결정됩니다." : "The creator project is provenance; account permissions determine available actions."}</div>
  </div>;
}

function SharingTab({ detail, actor, busy, onVisibility, onDelete, projects, onProject, onSkill, impactOpenRequest, highlightedImpact, ko }) {
  const allowed = detail.permissions?.can_change_visibility === true
    || (detail.permissions?.can_change_visibility == null && actor?.is_admin === true);
  const canDelete = detail.permissions?.can_delete_asset === true;
  const usageImpact = detail.usage_impact || detail.impact;
  return <div>
    <div className="rsm-section-head"><div><span>PRIVATE / PUBLIC</span><h4>{ko ? "공유 Pool 노출 범위" : "Shared pool visibility"}</h4></div>{!allowed && <span className="rsm-lock">🔒 {ko ? "관리자만 편집" : "Admin only"}</span>}</div>
    <div className="rsm-choice-grid">
      {["private", "public"].map((visibility) => (
        <button type="button" key={visibility} disabled={!allowed || !!busy || detail.visibility === visibility}
          className={detail.visibility === visibility ? "is-selected" : ""} onClick={() => onVisibility(visibility)}>
          <strong>{visibility.toUpperCase()}</strong>
          <span>{visibility === "private"
            ? (ko ? "생성 프로젝트에서만 binding 가능" : "Only the creator project can bind")
            : (ko ? "조직 공유 Pool에 노출 · 자동 연결 아님" : "Visible in the organization pool; not auto-attached")}</span>
        </button>
      ))}
    </div>
    <ImpactExplorer impact={usageImpact} projects={projects} onProject={onProject} onSkill={onSkill} ko={ko}
      openRequest={impactOpenRequest} highlightedImpact={highlightedImpact} />
    <div className="rsm-notice is-warning">{ko ? "연결된 사용처가 남아 있으면 공유 범위 변경을 보류합니다. 위 항목을 펼쳐 각 편집 화면에서 먼저 정리할 수 있습니다." : "Visibility changes pause while connected usages remain. Expand the items above to resolve them in context."}</div>
    {canDelete && <section className="rsm-danger-zone">
      <div><strong>{ko ? "조직에서 MCP Asset 폐기" : "Retire organization MCP asset"}</strong><span>{ko ? "모든 Version·Release와 원본 capability를 영구 제거합니다. 연결된 사용처를 먼저 정리해야 합니다." : "Permanently removes every version, release, and source capability after usages are resolved."}</span></div>
      <button type="button" className="rsm-btn is-danger" disabled={!!busy} onClick={onDelete}><TrashIcon /> {ko ? "Asset 삭제" : "Delete asset"}</button>
    </section>}
  </div>;
}

function ValidationResults({ detail, actor, busy, formDirty, onPublish, onSkill, onRevalidate, resultRef, ko }) {
  const validation = detail.validation || {};
  const checks = Array.isArray(validation.checks) ? validation.checks : [];
  const blockers = Array.isArray(validation.blockers) ? validation.blockers : [];
  const impact = impactItems(validation.impact);
  const [expandedChecks, setExpandedChecks] = useState(() => new Set());
  useEffect(() => setExpandedChecks(new Set()), [detail.asset_id, validation.validated_at]);
  const status = statusMeta(validationValue(detail));
  const canManage = detail.permissions?.can_manage_binding === true
    || (detail.permissions?.can_manage_binding == null && ["admin", "editor", "member"].includes(actor?.role));
  const canPublish = detail.permissions?.can_publish === true
    || (detail.permissions?.can_publish == null && canManage);
  const ready = status.tone === "ready" && blockers.length === 0 && impact.blockers.length === 0;
  const publishVersion = versionLabel(detail.binding?.pinned_version);
  return <section aria-live="polite" className="rsm-binding-stage rsm-validation-stage">
    <div className="rsm-section-head"><div><span>VALIDATION & PUBLISH</span><h4 ref={resultRef} tabIndex="-1" className="rsm-validation-title">{ko ? "검증 결과와 배포" : "Validation results and publish"}</h4></div><StatusBadge value={status.value} /></div>
    <div className="rsm-check-list">
      {checks.map((check, index) => {
        const checkStatus = statusMeta(validationCheckStatus(check));
        const checkLabel = validationCheckLabel(check, index);
        const checkKey = String(check.id || check.code || index);
        const details = validationCheckDetails(check, validation.impact);
        const expandable = checkStatus.tone === "blocked" && details.items.length > 0;
        const detailsVisible = expandable && expandedChecks.has(checkKey);
        const toggleDetails = () => setExpandedChecks((current) => {
          const next = new Set(current);
          if (next.has(checkKey)) next.delete(checkKey);
          else next.add(checkKey);
          return next;
        });
        const checkContent = <>
          <StatusBadge value={validationCheckStatus(check)} />
          <span><strong>{checkLabel}</strong>{check.message && <small>{check.message}</small>}</span>
          {expandable && <span className="rsm-check-chevron"><ChevronIcon open={detailsVisible} /></span>}
        </>;
        return <div key={check.id || check.code || index} className={`rsm-validation-check ${checkStatus.tone === "blocked" ? "is-blocked" : ""} ${expandable ? "is-expandable" : ""}`}>
          {expandable ? <button type="button" className="rsm-validation-check-main is-button"
            title={ko ? "상세 원인 펼치기/접기" : "Expand or collapse details"}
            aria-expanded={detailsVisible}
            onClick={toggleDetails}>{checkContent}</button>
            : <div className="rsm-validation-check-main">{checkContent}</div>}
          {detailsVisible && details.kind === "skills" && <div className="rsm-impact-list rsm-validation-skill-list">{details.items.map((skill, skillIndex) => {
            const label = impactSkillLabel(skill);
            const canOpen = !!skillEditNavigation(skill);
            const reason = validationSkillReason(typeof skill === "object" ? skill.reason : "", ko);
            return <div key={`${impactSkillId(skill)}-${skillIndex}`}>
              <span><small>SKILL</small><strong>{label}</strong>{typeof skill === "object" && skill.tool_id && <code>{skill.tool_id}</code>}{reason && <em className="rsm-impact-reason">{reason}</em>}</span>
              {canOpen && <button type="button" className="rsm-icon-shortcut"
                aria-label={ko ? `${label} 편집 화면 열기` : `Open ${label} editor`}
                title={ko ? "편집 화면 열기" : "Open editor"}
                onClick={() => onSkill?.(skill)}><ShortcutIcon /></button>}
            </div>;
          })}</div>}
          {detailsVisible && details.kind === "connection_issues" && <div className="rsm-probe-issues">{details.items.map((rawIssue, issueIndex) => {
            const issue = validationIssueCopy(rawIssue, ko);
            return <article key={`${issue.code}-${issue.target || issueIndex}`}>
            <div className="rsm-probe-issue-head"><code>{issue.code}</code><strong>{issue.title}</strong></div>
            <p>{issue.description}</p>
            {issue.target && <div className="rsm-probe-target"><span>{ko ? "검사 대상" : "Target"}</span><code>{issue.target}</code></div>}
            <div className="rsm-probe-action">
              <span><b>{ko ? "조치" : "Action"}</b>{issue.actionLabel}</span>
              <button type="button" className="rsm-btn is-ghost" disabled={!!busy} onClick={onRevalidate}>
                {busy === "save-validate" ? (ko ? "검증 중…" : "Validating…") : (ko ? "재검증" : "Revalidate")}
              </button>
            </div>
          </article>})}</div>}
        </div>;
      })}
      {!checks.length && <div className="rsm-notice">{ko ? "‘저장 후 검증’을 실행하면 schema·connection·credential·Skill 영향 결과가 여기에 표시됩니다." : "Save and validate to see schema, connection, credential, and Skill impact results."}</div>}
    </div>
    {(impact.schemaDiff.added.length > 0 || impact.schemaDiff.removed.length > 0 || impact.schemaDiff.changed.length > 0) && <div className="rsm-schema-diff">
      <strong>SCHEMA DIFF</strong>
      <div>
        <span className="is-added">+ {impact.schemaDiff.added.length} {ko ? "추가" : "added"}</span>
        <span className="is-changed">~ {impact.schemaDiff.changed.length} {ko ? "변경" : "changed"}</span>
        <span className="is-removed">− {impact.schemaDiff.removed.length} {ko ? "삭제" : "removed"}</span>
      </div>
      {impact.schemaDiff.items.map((item, index) => <small key={`${item.tool_id || "tool"}-${item.change || index}`}>
        <b>{String(item.change || "changed").toUpperCase()}</b> <code>{item.tool_id || "—"}</code>
        <span>{item.before?.path !== item.after?.path ? `${item.before?.path || "—"} → ${item.after?.path || "—"}` : (item.field_changes || []).map((field) => `${field.change} ${field.pointer}`).join(" · ") || (ko ? "계약 세부 변경" : "Contract changed")}</span>
      </small>)}
    </div>}
    <div className="rsm-notice is-warning">{ko ? `Publish 전까지 Current ${releaseLabel(detail.binding.current_release)}가 계속 실행됩니다.` : `Current ${releaseLabel(detail.binding.current_release)} keeps running until publish.`}</div>
    <div className="rsm-form-actions rsm-publish-actions">
      <button type="button" className="rsm-btn is-primary" disabled={!canPublish || !ready || formDirty || !!busy} onClick={onPublish}
        title={formDirty ? (ko ? "먼저 변경사항을 저장 후 검증하세요." : "Save and validate changes first.") : !ready ? (ko ? "모든 검증 항목이 READY여야 Publish할 수 있습니다." : "All validation checks must be READY.") : ""}>{busy === "publish" ? "Publishing…" : `Publish ${publishVersion}`}</button>
    </div>
  </section>;
}

function BindingTab({ detail, projectId, actor, draft, setDraft, busy, onSaveValidate, onAttach, onDetach, onPublish, onSkill, detachButtonRef, emphasizeDetach, validationResultsRef, ko }) {
  const binding = detail.binding;
  const allowed = detail.permissions?.can_manage_binding === true
    || (detail.permissions?.can_manage_binding == null && ["admin", "editor", "member"].includes(actor?.role));
  if (!binding) return <div className="rsm-empty-detail"><AssetIcon /><h4>{ko ? "현재 프로젝트에 연결되지 않았습니다" : "Not connected to this project"}</h4><p>{ko ? "Public MCP를 추가하면 프로젝트별 설정과 안전한 Publish 흐름이 생성됩니다." : "Attach this public MCP to configure and publish it safely for this project."}</p><button type="button" className="rsm-btn is-primary" disabled={!allowed || !!busy} onClick={onAttach}>{ko ? "이 프로젝트에 추가" : "Attach to project"}</button></div>;
  const versions = detail.versions || [];
  const persistedVersion = bindingVersionId(binding, versions);
  const selectedVersion = draft.pinned_version_id || persistedVersion;
  const currentRelease = binding.current_release;
  const currentSnapshot = currentRelease?.snapshot || {};
  const changes = projectBindingChanges(binding, draft, versions);
  const formDirty = selectedVersion !== persistedVersion
    || String(draft.environment || "").trim() !== String(binding.environment || "").trim()
    || draft.enabled !== binding.enabled || draft.credential_ref_dirty;
  const changeLabels = { version: "Pinned version", environment: "Environment", credential: "Credential", enabled: ko ? "사용 상태" : "Enabled" };
  return <div className="rsm-binding-flow">
    <section className="rsm-binding-stage">
      <div className="rsm-section-head"><div><span>CURRENT RELEASE</span><h4>{ko ? "현재 운영 중인 설정" : "Current runtime configuration"}</h4></div>{currentRelease ? <span className="rsm-current-chip">{releaseLabel(currentRelease)} · {versionLabel(currentRelease.version)}</span> : <span className="rsm-lock">{ko ? "아직 Publish되지 않음" : "Not published"}</span>}</div>
      <div className="rsm-current-grid">
        <DetailRow label="Version">{currentRelease ? versionLabel(currentRelease.version) : "—"}</DetailRow>
        <DetailRow label="Environment">{currentRelease ? (currentSnapshot.environment || "default") : "—"}</DetailRow>
        <DetailRow label="Credential">{currentRelease ? (currentSnapshot.credential_configured ? "configured" : "none") : "—"}</DetailRow>
        <DetailRow label={ko ? "사용 상태" : "Enabled"}>{currentRelease ? (currentSnapshot.enabled === false ? "OFF" : "ON") : "—"}</DetailRow>
      </div>
    </section>

    <section className="rsm-binding-stage">
    <div className="rsm-section-head"><div><span>PROJECT SETTINGS · {binding.revision || "UNPUBLISHED"}</span><h4>{ko ? "다음 Release 설정" : "Next release configuration"}</h4></div>{!allowed && <span className="rsm-lock">🔒 {ko ? "읽기 전용" : "Read only"}</span>}</div>
    {binding.legacy_limited && <div className="rsm-notice is-warning">{ko ? "기존 tool 링크에서 호환 변환된 binding입니다. 새 version 설정 일부가 제한될 수 있습니다." : "This binding was migrated from a legacy tool link; some version settings may be limited."}</div>}
    <div className="rsm-form">
      <label><span>{ko ? "Pinned version" : "Pinned version"}</span>
        {versions.length ? <select value={selectedVersion} disabled={!allowed || !!busy} onChange={(event) => setDraft((value) => ({ ...value, pinned_version_id: event.target.value }))}>
          {versions.map((version) => <option key={versionId(version)} value={versionId(version)}>{versionLabel(version)}</option>)}
        </select> : <input value={selectedVersion} disabled={!allowed || !!busy} onChange={(event) => setDraft((value) => ({ ...value, pinned_version_id: event.target.value }))} />}
      </label>
      <label><span>Environment</span><input value={draft.environment} disabled={!allowed || !!busy} placeholder="stage" onChange={(event) => setDraft((value) => ({ ...value, environment: event.target.value }))} /><small>{ko ? "Release·감사용 운영 구분 라벨입니다. 호출 endpoint는 Version의 Base URL을 사용합니다." : "Operational label for releases and audit; invocation uses the Version base URL."}</small></label>
      <label className="is-wide"><span>Credential reference</span><input value={draft.credential_ref} disabled={!allowed || !!busy} placeholder={draft.credential_configured ? (ko ? "새 reference 입력 시 교체" : "Enter a new reference to replace") : `vault://projects/${projectId || "<project-id>"}/mcp-readonly`} onChange={(event) => setDraft((value) => ({ ...value, credential_ref: event.target.value, credential_ref_dirty: true }))} /><small>{draft.credential_configured && !draft.credential_ref_dirty ? (ko ? "저장된 reference가 있습니다. 값과 경로는 다시 표시하지 않습니다." : "A reference is configured; its value and path are not returned.") : (ko ? "현재 프로젝트 전용 Vault namespace의 reference만 저장합니다." : "Only references in this project's Vault namespace are accepted.")}</small></label>
      <label className="rsm-check is-wide"><input type="checkbox" checked={draft.enabled} disabled={!allowed || !!busy} onChange={(event) => setDraft((value) => ({ ...value, enabled: event.target.checked }))} /><span><strong>{ko ? "Binding 사용" : "Binding enabled"}</strong><small>{ko ? "OFF여도 연결과 미배포 변경사항은 보존됩니다." : "Turning it off preserves the binding and unpublished changes."}</small></span></label>
    </div>
    <div className="rsm-change-panel">
      <div className="rsm-change-head"><strong>{ko ? "Current와 변경사항 비교" : "Current vs unpublished changes"}</strong><span>{changes.length}</span></div>
      {changes.length > 0 ? changes.map((change) => <div className="rsm-change-row" key={change.field}><span>{changeLabels[change.field] || change.field}</span><code>{change.before}</code><b>→</b><code>{change.after}</code></div>)
        : <p>{ko ? "Current Release와 동일한 설정입니다." : "Settings match the Current Release."}</p>}
      {binding.has_draft && !formDirty && <div className="rsm-saved-state">✓ {ko ? "미배포 변경사항이 저장되었습니다." : "Unpublished changes have been saved."}</div>}
      {formDirty && <div className="rsm-unsaved-state">{ko ? "저장되지 않은 변경사항이 있습니다." : "You have unsaved changes."}</div>}
    </div>
    <div className="rsm-form-actions">
      <button type="button" ref={detachButtonRef}
        className={`rsm-btn is-danger ${emphasizeDetach ? "is-focus-callout" : ""}`}
        disabled={!allowed || !!busy} onClick={onDetach}><TrashIcon /> {ko ? "프로젝트에서 분리" : "Detach"}</button>
      <button type="button" className="rsm-btn is-primary" disabled={!allowed || !!busy} onClick={onSaveValidate}>{busy === "save-validate" ? (ko ? "저장 및 검증 중…" : "Saving and validating…") : (ko ? "저장 후 검증" : "Save and validate")}</button>
    </div>
    </section>
    <ValidationResults detail={detail} actor={actor} busy={busy} formDirty={formDirty} onPublish={onPublish} onSkill={onSkill} onRevalidate={onSaveValidate} resultRef={validationResultsRef} ko={ko} />
  </div>;
}

function HistoryTab({ detail, ko }) {
  const releases = detail.releases || [];
  return <div>
    <div className="rsm-section-head"><div><span>RELEASE HISTORY</span><h4>{ko ? "불변 Release와 감사 이력" : "Immutable releases and audit trail"}</h4></div><span className="rsm-count">{releases.length}</span></div>
    <div className="rsm-history">
      {releases.map((release, index) => {
        const current = release.current === true || release.is_current === true || releaseLabel(release) === releaseLabel(detail.binding?.current_release);
        const snapshot = release.snapshot || {};
        const changes = releaseSnapshotDiff(release, releases[index + 1]);
        return <article key={release.id || release.release_no || index} className={current ? "is-current" : ""}>
          <span className="rsm-history-dot" />
          <div><strong>{releaseLabel(release)} {current && <em>CURRENT</em>}</strong>
            <small>{versionLabel(release.version || release.pinned_version)} · {release.actor || release.created_by || "—"}</small>
            <small className="rsm-history-snapshot">{snapshot.environment || "default"} · {snapshot.enabled === false ? "OFF" : "ON"} · {snapshot.credential_configured ? "credential configured" : "no credential"} · revision {snapshot.revision ?? "—"}</small>
            {release.config_digest && <code title={release.config_digest}>digest {String(release.config_digest).slice(0, 12)}</code>}
            {changes.length > 0 && <small className="rsm-history-diff">{changes.map((change) => `${change.field}: ${change.before} → ${change.after}`).join(" · ")}</small>}
          </div>
          <time>{release.created_at || release.published_at || release.time || "—"}</time>
        </article>;
      })}
      {!releases.length && <div className="rsm-empty-inline">{ko ? "아직 Publish된 Release가 없습니다." : "No releases have been published."}</div>}
    </div>
    <div className="rsm-notice">{ko ? "MVP에서는 snapshot과 diff를 조회합니다. one-click rollback은 범위 밖입니다." : "MVP supports snapshot and diff inspection; one-click rollback is out of scope."}</div>
  </div>;
}

function AssetDetail({ detail, summary, loading, tab, setTab, projectId, actor, draft, setDraft, busy, error, handlers, go, projects, onProject, onSkill, onClose, ko }) {
  const asset = detail || summary;
  if (!asset) return null;
  const exploreTarget = toolExplorerNavigation(asset.capabilities?.[0]?.tool_id);
  return <section className="rsm-detail">
    <header className="rsm-detail-head">
      <div className="rsm-detail-kicker"><span>MCP ASSET · PROJECT BINDING</span><button type="button" className="rsm-detail-close" onClick={onClose} aria-label={ko ? "상세 설정 닫기" : "Close settings"}>×</button></div>
      <div><h3>{asset.name}</h3><StatusBadge value={asset.lifecycle_status} /></div>
      <p><span className="mono">{asset.asset_id}</span> · {asset.created_project?.name || "—"} · {sourceLabel(asset)}</p>
    </header>
    <nav className="rsm-detail-tabs" aria-label={ko ? "MCP 상세" : "MCP details"}>{DETAIL_TABS.map((id) => <button type="button" key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>{pick(TAB_LABELS[id], ko)}</button>)}</nav>
    <div className="rsm-detail-body">
      {loading && <RegistrySkeleton />}
      {!loading && error && <div className="rsm-notice is-error">{error}</div>}
      {!loading && detail && tab === "overview" && <OverviewTab detail={detail} ko={ko} />}
      {!loading && detail && tab === "sharing" && <SharingTab detail={detail} actor={actor} busy={busy} onVisibility={handlers.visibility} onDelete={handlers.deleteAsset} projects={projects} onProject={onProject} onSkill={onSkill} impactOpenRequest={handlers.sharingImpactFeedback?.request} highlightedImpact={handlers.sharingImpactFeedback?.impact} ko={ko} />}
      {!loading && detail && tab === "binding" && <BindingTab detail={detail} projectId={projectId} actor={actor} draft={draft} setDraft={setDraft} busy={busy} onSaveValidate={handlers.saveValidate} onAttach={handlers.attach} onDetach={handlers.detach} onPublish={handlers.publish} onSkill={onSkill} detachButtonRef={handlers.detachButtonRef} emphasizeDetach={handlers.emphasizeDetach} validationResultsRef={handlers.validationResultsRef} ko={ko} />}
      {!loading && detail && tab === "history" && <HistoryTab detail={detail} ko={ko} />}
    </div>
    <footer className="rsm-detail-foot"><button type="button" className="rsm-btn is-ghost"
      disabled={!canExploreAsset(asset) || !exploreTarget}
      title={!canExploreAsset(asset) ? (ko ? "Current Release Publish 후 탐색할 수 있습니다." : "Publish a Current Release first.") : ""}
      onClick={() => canExploreAsset(asset) && exploreTarget && go?.(exploreTarget.screen, exploreTarget.payload)}>{canExploreAsset(asset) ? (ko ? "MCP 탐색 전체보기에서 보기" : "Open in Explorer browse-all") : (ko ? "Publish 후 탐색 가능" : "Available after publish")} {canExploreAsset(asset) && "→"}</button></footer>
  </section>;
}

function AssetDetailModal({ open, busy, onClose, ...props }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);
  if (!open) return null;
  return (
    <div className="rsm-detail-backdrop" onClick={() => !busy && onClose()}>
      <div className="rsm-detail-modal" role="dialog" aria-modal="true"
        aria-label={props.ko ? "MCP 상세 설정" : "MCP settings"}
        onClick={(event) => event.stopPropagation()}>
        <AssetDetail {...props} busy={busy} onClose={onClose} />
      </div>
    </div>
  );
}

export default function ResourceSharing({ lang, activeId, active, projects = [], switchTo, refresh, go, nav }) {
  const ko = lang === "ko";
  const initialView = ["attached", "pool", "review"].includes(nav?.view) ? nav.view : "attached";
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [registry, setRegistry] = useState({ assets: [], metrics: {}, actor: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(nav?.assetId || "");
  const [expanded, setExpanded] = useState(() => new Set());
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailTab, setDetailTab] = useState(detailTabFromNav(nav?.detailTab));
  const [detailOpen, setDetailOpen] = useState(!!nav?.assetId);
  const [draft, setDraft] = useState({ pinned_version_id: "", environment: "", credential_ref: "", credential_ref_dirty: false, credential_configured: false, enabled: true });
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const handledNavAction = useRef("");
  const handledFocusAction = useRef("");
  const detachButtonRef = useRef(null);
  const validationResultsRef = useRef(null);
  const [validationFocusRequest, setValidationFocusRequest] = useState(0);
  const [sharingImpactFeedback, setSharingImpactFeedback] = useState({ request: 0, impact: null });

  useEffect(() => {
    handledNavAction.current = "";
    if (["attached", "pool", "review"].includes(nav?.view)) setView(nav.view);
    if (nav?.assetId) { setDetail(null); setSelectedId(nav.assetId); setDetailOpen(true); }
    if (nav?.detailTab) setDetailTab(detailTabFromNav(nav.detailTab));
  }, [nav]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 260);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!activeId) return undefined;
    const controller = new AbortController();
    setLoading(true); setError("");
    api.projectResourceRegistry(activeId, { view, query: debouncedQuery }, { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const next = normalizeRegistry(payload, view);
        setRegistry(next);
        setSelectedId((current) => {
          if (current && next.assets.some((asset) => asset.asset_id === current)) return current;
          if (nav?.assetId && next.assets.some((asset) => asset.asset_id === nav.assetId)) return nav.assetId;
          return "";
        });
      })
      .catch((nextError) => { if (nextError.name !== "AbortError") setError(nextError.message || String(nextError)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeId, view, debouncedQuery, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeId || !selectedId || !detailOpen) { setDetail(null); return undefined; }
    const controller = new AbortController();
    setDetailLoading(true); setDetailError("");
    api.mcpRegistryAsset(selectedId, activeId, { signal: controller.signal })
      .then((payload) => { if (!controller.signal.aborted) setDetail(normalizeDetail(payload)); })
      .catch((nextError) => { if (nextError.name !== "AbortError") { setDetail(null); setDetailError(nextError.message || String(nextError)); } })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [activeId, selectedId, detailOpen, reloadKey]);

  useEffect(() => {
    const binding = detail?.binding;
    if (!binding) {
      setDraft({ pinned_version_id: "", environment: "", credential_ref: "", credential_ref_dirty: false, credential_configured: false, enabled: true });
      return;
    }
    setDraft({
      pinned_version_id: bindingVersionId(binding, detail.versions),
      environment: binding.environment || "",
      credential_ref: "",
      credential_ref_dirty: false,
      credential_configured: binding.credential_configured === true,
      enabled: binding.enabled !== false,
    });
  }, [detail?.asset_id, detail?.binding?.revision, detail?.binding?.pinned_version, detail?.versions]);

  useEffect(() => {
    if (nav?.focusAction !== "detach" || detailTab !== "binding"
        || !detailOpen || !detail?.binding) return;
    const focusKey = `${activeId}:${detail.asset_id}:${detail.binding.id}:${nav.focusAction}`;
    if (handledFocusAction.current === focusKey) return;
    handledFocusAction.current = focusKey;
    const frame = requestAnimationFrame(() => {
      detachButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      detachButtonRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, detail?.asset_id, detail?.binding?.id, detailOpen, detailTab, nav?.focusAction]);

  useEffect(() => {
    if (!validationFocusRequest || nav?.focusAction === "detach" || detailLoading || detailTab !== "binding" || !detailOpen || !detail?.binding) return;
    const frame = requestAnimationFrame(() => {
      const heading = validationResultsRef.current;
      const scroller = heading?.closest(".rsm-detail-body");
      if (heading && scroller) {
        const headingRect = heading.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const targetTop = scroller.scrollTop + headingRect.top - scrollerRect.top - 10;
        scroller.scrollTo({ top: Math.max(0, targetTop), behavior: "auto" });
        heading.focus({ preventScroll: true });
      } else {
        heading?.scrollIntoView({ behavior: "auto", block: "start" });
        heading?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [detail?.asset_id, detail?.binding?.revision, detailLoading, detailOpen, detailTab, nav?.focusAction, validationFocusRequest]);

  const shownAssets = useMemo(() => filterAssets(registry.assets, {
    query, scope, projectId: activeId,
  }), [registry.assets, query, scope, activeId]);
  const selectedSummary = registry.assets.find((asset) => asset.asset_id === selectedId) || null;

  const reload = useCallback(async () => {
    setReloadKey((value) => value + 1);
    try { await refresh?.(); } catch (_) { /* project badge refresh is best effort */ }
  }, [refresh]);

  const actionError = (nextError, title) => {
    const impact = impactFromError(nextError);
    if (nextError.status === 409 || impact) {
      setDialog({ mode: "blocked", title, message: friendlyError(nextError, ko ? "연결된 사용처를 먼저 정리한 뒤 다시 시도하세요." : "Resolve connected usages before trying again."), impact, assetId: detail?.asset_id });
      return;
    }
    if (nextError.status === 422) {
      const problem = nextError.body?.detail;
      const problemObject = problem && typeof problem === "object" ? problem : {};
      const blockers = Array.isArray(problemObject.blockers)
        ? problemObject.blockers
        : Array.isArray(problemObject.validation?.blockers) ? problemObject.validation.blockers : [];
      setDetail((current) => current ? {
        ...current,
        lifecycle_status: "blocked",
        validation: {
          ...(current.validation || {}),
          ...(problemObject.validation || {}),
          state: "blocked",
          blockers,
        },
      } : current);
      setDetailTab("binding");
      setError("");
      return;
    }
    setError(friendlyError(nextError, ko ? "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요." : "The request could not be completed. Try again."));
  };

  const confirmAttach = async () => {
    const assetId = dialog?.assetId || detail?.asset_id || selectedSummary?.asset_id;
    if (!assetId) return;
    setBusy("attach");
    try {
      await api.attachMcpBinding(activeId, assetId);
      setDialog(null); setView("attached"); setSelectedId(assetId); setDetailTab("binding");
      await reload();
    } catch (nextError) { actionError(nextError, ko ? "프로젝트에 추가할 수 없습니다" : "Unable to attach"); }
    finally { setBusy(""); }
  };

  const beginAttach = () => {
    const asset = detail || selectedSummary;
    if (!asset) return;
    setDialog({ mode: "attach", assetId: asset.asset_id, title: ko ? `${asset.name} 추가` : `Attach ${asset.name}`, message: ko ? "공유 Pool의 원본을 복제하지 않고 현재 프로젝트 binding을 생성합니다." : "This creates a project binding; it does not copy the shared asset.", confirmLabel: ko ? "프로젝트에 추가" : "Attach" });
  };

  const confirmDetach = async () => {
    const bindingId = dialog?.bindingId || detail?.binding?.id;
    if (!bindingId) return;
    setBusy("detach");
    try {
      await api.detachMcpBinding(activeId, bindingId);
      setDialog(null); setDetailOpen(false); setSelectedId(""); setDetail(null); await reload();
    } catch (nextError) { actionError(nextError, ko ? "분리할 수 없습니다" : "Unable to detach"); }
    finally { setBusy(""); }
  };

  const beginDetach = async (requestedTarget = detail) => {
    const target = requestedTarget?.binding ? requestedTarget : detail;
    const binding = target?.binding;
    if (!binding) return;
    setBusy("impact"); setError("");
    try {
      const payload = await api.mcpBindingImpact(activeId, binding.id);
      const impact = payload?.impact || payload;
      if (hasImpact(impact)) setDialog({ mode: "blocked", bindingId: binding.id, title: ko ? "프로젝트에서 분리할 수 없습니다" : "Detach blocked", message: ko ? "이 binding을 사용하는 프로젝트 또는 Skill 영향이 남아 있습니다." : "Project or Skill dependencies remain.", impact });
      else setDialog({ mode: "detach", bindingId: binding.id, title: ko ? `${target.name} 분리` : `Detach ${target.name}`, message: ko ? "현재 프로젝트의 binding과 미배포 변경사항만 제거합니다. 공유 원본과 다른 프로젝트에는 영향을 주지 않습니다." : "Only this project's binding and unpublished changes are removed.", impact, confirmLabel: ko ? "분리" : "Detach" });
    } catch (nextError) {
      actionError(nextError, ko ? "영향을 확인할 수 없습니다" : "Unable to check impact");
    } finally { setBusy(""); }
  };

  useEffect(() => {
    const resolution = resolveDetachNavigation(nav, detail);
    if (resolution === "none" || resolution === "wait") return;
    const actionKey = `${nav.assetId}:${nav.bindingId}`;
    if (handledNavAction.current === actionKey) return;
    handledNavAction.current = actionKey;
    if (resolution === "stale") {
      setError(ko ? "분리 대상 binding이 변경되었거나 이미 제거되었습니다." : "The binding changed or was already removed.");
      return;
    }
    beginDetach(detail);
  }, [nav?.action, nav?.assetId, nav?.bindingId, detail?.asset_id, detail?.binding?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeVisibility = async (visibility) => {
    if (!detail) return;
    setBusy("visibility"); setError("");
    try {
      await api.setMcpVisibility(detail.asset_id, visibility);
      setSharingImpactFeedback({ request: 0, impact: null });
      await reload();
    }
    catch (nextError) {
      const impact = impactFromError(nextError);
      if (visibility === "private" && (nextError.status === 409 || impact)) {
        const blockedImpact = impact || detail.usage_impact || detail.impact || {};
        setDialog(null);
        setDetail((current) => current ? {
          ...current,
          usage_impact: current.usage_impact || blockedImpact,
        } : current);
        setSharingImpactFeedback((current) => ({
          request: current.request + 1,
          impact: blockedImpact,
        }));
      } else {
        actionError(nextError, ko ? "공유 범위를 변경할 수 없습니다" : "Unable to change visibility");
      }
    }
    finally { setBusy(""); }
  };

  const saveAndValidateBinding = async () => {
    if (!detail?.binding) return;
    const bindingId = detail.binding.id;
    let saved = false;
    setBusy("save-validate"); setError("");
    setValidationFocusRequest((value) => value + 1);
    const patch = bindingDraftPatch(draft);
    try {
      await api.updateMcpBinding(activeId, bindingId, patch);
      saved = true;
      await api.validateMcpBinding(activeId, bindingId);
      await reload();
    }
    catch (nextError) {
      if (!saved && nextError.status === 422) {
        setError(friendlyError(nextError, ko ? "입력한 설정을 확인하세요." : "Check the settings you entered."));
      } else {
        actionError(nextError, ko ? "변경사항을 저장하고 검증할 수 없습니다" : "Unable to save and validate changes");
      }
      if (saved && nextError.status === 422) await reload();
    }
    finally { setBusy(""); }
  };

  const publish = async () => {
    if (!detail?.binding) return;
    setBusy("publish"); setError("");
    try { await api.publishMcpBinding(activeId, detail.binding.id); setDetailTab("history"); await reload(); }
    catch (nextError) { actionError(nextError, ko ? "Publish할 수 없습니다" : "Unable to publish"); }
    finally { setBusy(""); }
  };

  const openImpactProject = useCallback((item) => {
    const assetId = dialog?.assetId || detail?.asset_id || selectedId;
    const target = impactProjectNavigation(item, assetId);
    if (!target) return;
    if (target.projectId !== activeId) switchTo?.(target.projectId);
    setValidationFocusRequest(0);
    setSharingImpactFeedback({ request: 0, impact: null });
    setDialog(null);
    setDetailOpen(false);
    go?.(target.screen, target.payload);
  }, [activeId, detail?.asset_id, dialog?.assetId, go, selectedId, switchTo]);

  const openImpactSkill = useCallback((skill) => {
    const target = skillEditNavigation(skill);
    if (!target) return;
    const projectId = typeof skill === "object" ? String(skill.project_id || "") : "";
    if (projectId && projectId !== activeId) switchTo?.(projectId);
    setDialog(null);
    setDetailOpen(false);
    go?.(target.screen, target.payload);
  }, [activeId, go, switchTo]);

  const beginDeleteAsset = () => {
    if (!detail) return;
    const impact = detail.usage_impact || detail.impact || {};
    if (hasImpact(impact)) {
      setDialog({
        mode: "blocked", assetId: detail.asset_id,
        title: ko ? "MCP Asset을 삭제할 수 없습니다" : "Asset deletion is blocked",
        message: ko ? "연결 프로젝트와 영향 Skill을 펼쳐 각 편집 화면에서 먼저 정리하세요." : "Expand connected projects and affected skills, then resolve them in context.",
        impact,
      });
      return;
    }
    setDialog({
      mode: "delete-asset", assetId: detail.asset_id,
      title: ko ? `${detail.name} 영구 삭제` : `Permanently delete ${detail.name}`,
      message: ko ? "조직 Registry의 Asset, 모든 Version·Release, 원본 capability를 복구할 수 없게 삭제합니다." : "This permanently removes the asset, every version and release, and its source capabilities.",
      confirmLabel: ko ? "Asset 삭제" : "Delete asset",
    });
  };

  const confirmDeleteAsset = async () => {
    const assetId = dialog?.assetId || detail?.asset_id;
    if (!assetId) return;
    setBusy("delete-asset");
    try {
      await api.deleteMcpAsset(assetId);
      setDialog(null); setDetailOpen(false); setSelectedId(""); setDetail(null);
      await reload();
    } catch (nextError) {
      actionError(nextError, ko ? "MCP Asset을 삭제할 수 없습니다" : "Unable to delete asset");
    } finally { setBusy(""); }
  };

  const openAsset = (assetId) => {
    setExpanded((current) => {
      const next = new Set(current);
      next.has(assetId) ? next.delete(assetId) : next.add(assetId);
      return next;
    });
  };

  const openDetail = (assetId) => {
    setValidationFocusRequest(0);
    setSharingImpactFeedback({ request: 0, impact: null });
    setDetail(null);
    setDetailError("");
    setSelectedId(assetId);
    setDetailTab("overview");
    setDetailOpen(true);
  };

  const closeDetail = useCallback(() => {
    if (!busy) {
      setDetailOpen(false);
      setValidationFocusRequest(0);
      setSharingImpactFeedback({ request: 0, impact: null });
    }
  }, [busy]);

  const openTool = (toolId) => {
    const target = toolExplorerNavigation(toolId);
    if (target) go?.(target.screen, target.payload);
  };

  const metrics = registry.metrics || {};
  const counts = {
    attached: metric(metrics, ["attached", "connected", "project_mcp"], view === "attached" ? registry.assets.length : 0),
    pool: metric(metrics, ["pool", "pool_total"], view === "pool" ? registry.assets.length : 0),
    review: metric(metrics, ["review", "needs_review", "blocker"], view === "review" ? registry.assets.length : 0),
  };
  const metricCards = [
    [ko ? "연결된 MCP" : "Attached MCP", metric(metrics, ["attached", "connected", "project_mcp"], 0), ""],
    ["Current Release", metric(metrics, ["current_release", "current_releases", "released"], 0), "is-good"],
    [ko ? "미배포 변경" : "Unpublished", metric(metrics, ["draft", "drafts"], 0), ""],
    ["Blocker", metric(metrics, ["blocker", "blockers", "blocked"], 0), "is-warning"],
  ];

  if (!activeId) return <div className="rsm-empty-inline">{ko ? "프로젝트를 선택하세요." : "Select a project."}</div>;
  return (
    <div className="rsm-page">
      <header className="rsm-head">
        <div className="rsm-title"><span><AssetIcon /></span><div><h1>{ko ? "리소스 공유관리" : "Resource sharing"}</h1><p>{ko ? "MCP 공유 Pool과 현재 프로젝트의 사용 구성을 한곳에서 관리합니다." : "Manage the shared MCP pool and this project's runtime configuration."}</p></div></div>
        <button type="button" className="rsm-btn is-primary" onClick={() => setView("pool")}>＋ {ko ? "공유 Pool에서 추가" : "Add from shared pool"}</button>
      </header>

      <nav className="rsm-view-tabs" aria-label={ko ? "Registry 보기" : "Registry views"}>{Object.keys(VIEW_LABELS).map((id) => <button type="button" key={id} className={view === id ? "is-active" : ""} onClick={() => { setView(id); setScope("all"); setDetailOpen(false); setSelectedId(""); }}>{pick(VIEW_LABELS[id], ko)} <span>{counts[id]}</span></button>)}</nav>

      <div className="rsm-metrics">{metricCards.map(([label, value, tone]) => <article key={label} className={tone}><span>{label}</span><strong>{value}</strong></article>)}</div>

      {error && <div className="rsm-error"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label={ko ? "오류 닫기" : "Dismiss error"}>×</button></div>}

      <div className="rsm-toolbar">
        <label className="rsm-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ko ? "MCP 이름·생성 프로젝트·capability 검색" : "Search MCP, creator project, or capability"} />{query && <button type="button" onClick={() => setQuery("")} aria-label={ko ? "검색 지우기" : "Clear search"}>×</button>}</label>
        <div className="rsm-filters">{Object.keys(FILTER_LABELS).map((id) => <button type="button" key={id} className={scope === id ? "is-active" : ""} onClick={() => setScope(id)}>{pick(FILTER_LABELS[id], ko)}</button>)}</div>
        <span className="rsm-project-chip">PROJECT · {active?.name || activeId}</span>
      </div>

      <div className="rsm-workspace">
        <section className="rsm-registry">
          <div className="rsm-registry-head"><span>MCP ASSETS · {shownAssets.length}</span><span>VERSION · RELEASE · IMPACT</span></div>
          {loading && <RegistrySkeleton />}
          {!loading && shownAssets.map((asset) => <AssetRow key={asset.asset_id} asset={asset} selected={detailOpen && asset.asset_id === selectedId} expanded={expanded.has(asset.asset_id)} onOpen={() => openAsset(asset.asset_id)} onConfigure={() => openDetail(asset.asset_id)} onExplore={openTool} ko={ko} />)}
          {!loading && !shownAssets.length && <div className="rsm-empty-inline">{view === "pool" ? (ko ? "추가할 수 있는 Public MCP가 없습니다." : "No public MCPs are available.") : (ko ? "조건에 맞는 MCP가 없습니다." : "No MCPs match these filters.")}</div>}
        </section>
      </div>

      <AssetDetailModal open={detailOpen} onClose={closeDetail} detail={detail} summary={selectedSummary} loading={detailLoading} tab={detailTab} setTab={setDetailTab} projectId={activeId} actor={registry.actor} draft={draft} setDraft={setDraft} busy={busy} error={detailError} handlers={{ visibility: changeVisibility, saveValidate: saveAndValidateBinding, attach: beginAttach, detach: beginDetach, publish, deleteAsset: beginDeleteAsset, detachButtonRef, emphasizeDetach: nav?.focusAction === "detach", validationResultsRef, sharingImpactFeedback }} go={go} projects={projects} onProject={openImpactProject} onSkill={openImpactSkill} ko={ko} />

      <ImpactDialog dialog={dialog} busy={!!busy} onClose={() => setDialog(null)}
        onConfirm={dialog?.mode === "attach" ? confirmAttach : dialog?.mode === "delete-asset" ? confirmDeleteAsset : confirmDetach}
        projects={projects} onProject={openImpactProject} onSkill={openImpactSkill} ko={ko} />
    </div>
  );
}
