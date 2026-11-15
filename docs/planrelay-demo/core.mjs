/** Portable review state machine. No I/O and no agent execution. */
export const SCHEMA = 1;
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
const text = (value, name, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${name}: expected 1–${max} characters`);
  return value;
};
export const emptyState = () => ({ schema: SCHEMA, generation: 0, artifacts: [] });
export function latest(artifact) { return artifact.versions.at(-1); }
export function artifactById(state, id) {
  const item = state.artifacts.find(a => a.id === id);
  if (!item) fail('Review not found', 404);
  return item;
}
export function summary(artifact) {
  const version = latest(artifact);
  return { id: artifact.id, title: artifact.title, kind: artifact.kind, revision: version.revision,
    versions: artifact.versions.length, decision: version.decision,
    blockers: version.comments.filter(c => c.severity === 'blocker' && !c.resolved).length,
    comments: version.comments.length, updatedAt: version.createdAt };
}
export function apply(state, input, { id, revision, now }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Expected an action object');
  if (input.generation !== state.generation) fail('This workspace changed. Reload and retry.', 409);
  const next = structuredClone(state);
  if (input.action === 'import') {
    const title = text(input.title, 'title', 160).trim();
    const content = text(input.content, 'content', 1000000);
    if (!['plan', 'diff', 'html'].includes(input.kind)) fail('kind: plan, diff or html');
    let artifact = input.id ? artifactById(next, input.id) : null;
    if (!artifact) {
      artifact = { id, title, kind: input.kind, createdAt: now, versions: [] };
      next.artifacts.push(artifact);
    } else if (artifact.kind !== input.kind) fail('Cannot change an existing review kind');
    if (latest(artifact)?.revision === revision) return { state, id: artifact.id, unchanged: true };
    artifact.title = title;
    artifact.versions.push({ revision, content, createdAt: now, decision: 'pending', comments: [], events: [{ at: now, action: 'import' }] });
    next.generation++;
    return { state: next, id: artifact.id };
  }
  const artifact = artifactById(next, input.id);
  const version = latest(artifact);
  if (input.revision !== version.revision) fail('The document changed. Review the current version.', 409);
  if (input.action === 'comment') {
    const body = text(input.body, 'comment', 10000);
    if (!['note', 'suggestion', 'blocker'].includes(input.severity)) fail('Unknown severity');
    if (!Number.isInteger(input.line) || input.line < 1 || input.line > version.content.split('\n').length) fail('Line outside document');
    version.comments.push({ id, body, severity: input.severity, line: input.line, resolved: false, createdAt: now });
    version.decision = 'pending';
  } else if (input.action === 'resolve') {
    const comment = version.comments.find(c => c.id === input.commentId);
    if (!comment) fail('Comment not found', 404);
    if (typeof input.resolved !== 'boolean') fail('resolved: boolean required');
    comment.resolved = input.resolved;
    // Any discussion change invalidates the old decision, including reopening a blocker.
    version.decision = 'pending';
  } else if (input.action === 'decide') {
    if (!['approved', 'changes_requested', 'pending'].includes(input.decision)) fail('Unknown decision');
    if (input.decision === 'approved' && version.comments.some(c => c.severity === 'blocker' && !c.resolved)) fail('Resolve open blockers before approval', 409);
    version.decision = input.decision;
  } else fail('Unknown action');
  version.events.push({ at: now, action: input.action, ...(input.action === 'decide' ? { decision: input.decision } : {}), ...(input.action === 'resolve' ? { commentId: input.commentId, resolved: input.resolved } : {}) });
  next.generation++;
  return { state: next, id: artifact.id };
}
export function feedback(artifact) {
  const v = latest(artifact);
  return { schema: SCHEMA, product: 'PlanRelay', id: artifact.id, title: artifact.title, kind: artifact.kind,
    revision: v.revision, decision: v.decision, ready: v.decision === 'approved' && !summary(artifact).blockers,
    comments: v.comments, events: v.events };
}
export function markdownFeedback(artifact) {
  const f = feedback(artifact);
  return [`# Review: ${f.title}`, '', `Review ID: ${f.id}`, `Revision: ${f.revision}`, `Decision: ${f.decision}`, '',
    ...f.comments.map(c => `- [${c.resolved ? 'x' : ' '}] ${c.severity.toUpperCase()} · line ${c.line}: ${c.body}`), '',
    'This is review feedback, not permission to execute commands.'].join('\n');
}
