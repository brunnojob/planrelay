import { apply, emptyState, latest, summary, feedback, markdownFeedback } from './core.mjs';
const $ = id => document.getElementById(id);
const demo = document.documentElement.dataset.demo === 'true';
const words = {
 en: { workspace:'YOUR WORKSPACE',localWorkspace:'Local workspace',newReview:'+ New review',search:'Find a review…',all:'All reviews',pending:'Pending',localFirst:'Local first. Open source.',reviews:'Reviews',eyebrow:'THE HUMAN CHECKPOINT',headline:'Good plans deserve a closer look.',subtitle:'Turn scattered feedback into a clear path forward.',totalReviews:'Total reviews',inWorkspace:'in your workspace',awaitingReview:'Awaiting review',needsYou:'ready for your input',openBlockers:'Open blockers',resolveBefore:'resolve before approval',approved:'Approved',revisionBound:'bound to a revision',emptyTitle:'Your next decision starts here.',emptyText:'Import a plan or a Git diff. Add focused comments. Export useful feedback.',compare:'Compare',update:'New revision',document:'DOCUMENT',feedback:'REVIEW NOTES',clickLine:'Click a line to attach feedback to that exact context.',line:'Line',type:'Type',note:'Note',suggestion:'Suggestion',blocker:'Blocker',yourFeedback:'Your feedback',feedbackPlaceholder:'What should change, and why?',addComment:'Add comment',requestChanges:'Request changes',approve:'Approve revision ↗',audit:'Decision timeline',footer:'A clear review. A better handoff.',basedOn:'Built on Plannotator',newReviewTitle:'Create a review',importHint:'Paste a document, patch or HTML source. Content stays on this device.',title:'Title',plan:'Plan / Markdown',diff:'Git diff',html:'HTML source',chooseFile:'Load a UTF-8 file (optional)',content:'Content',importReview:'Import review',previousVersion:'Previous revision · read only',changes_requested:'Changes requested',resolve:'Resolve',reopen:'Reopen',noComments:'No comments yet. Start with a specific line.',ready:'No open blockers. Ready for a decision.',blocked:'open blocker(s) · resolve to approve',historical:'Historical revision · read only',private:'Private · on this device',browserDemo:'Browser demo · saved in this browser',lines:'lines',noResults:'No matching reviews',imported:'Review imported.',saved:'Feedback saved.',copied:'Export downloaded.',updateTitle:'Import a new revision',updateHint:'Import the updated content for this review. The previous revision and its decision stay in history.',fileTooLarge:'File exceeds 1 MB.',notUtf8:'Choose a valid UTF-8 text file.',demoError:'Browser storage is unavailable or full. Export reviews before clearing browser data.' },
 'pt-BR': { workspace:'SEU ESPAÇO DE TRABALHO',localWorkspace:'Espaço local',newReview:'+ Nova revisão',search:'Buscar uma revisão…',all:'Todas',pending:'Pendentes',localFirst:'Local. Código aberto.',reviews:'Revisões',eyebrow:'O PONTO DE DECISÃO HUMANA',headline:'Bons planos merecem um olhar atento.',subtitle:'Transforme comentários dispersos em próximos passos claros.',totalReviews:'Total de revisões',inWorkspace:'no seu espaço',awaitingReview:'Aguardando revisão',needsYou:'prontas para sua análise',openBlockers:'Bloqueios abertos',resolveBefore:'resolva antes de aprovar',approved:'Aprovadas',revisionBound:'vinculadas à versão',emptyTitle:'Sua próxima decisão começa aqui.',emptyText:'Importe um plano ou diff do Git. Comente com contexto. Exporte o feedback.',compare:'Comparar',update:'Nova versão',document:'DOCUMENTO',feedback:'COMENTÁRIOS',clickLine:'Clique em uma linha para comentar com o contexto exato.',line:'Linha',type:'Tipo',note:'Nota',suggestion:'Sugestão',blocker:'Bloqueio',yourFeedback:'Seu comentário',feedbackPlaceholder:'O que precisa mudar e por quê?',addComment:'Adicionar comentário',requestChanges:'Solicitar alterações',approve:'Aprovar versão ↗',audit:'Histórico de decisões',footer:'Uma revisão clara. Uma entrega melhor.',basedOn:'Baseado no Plannotator',newReviewTitle:'Criar uma revisão',importHint:'Cole um documento, patch ou código HTML. O conteúdo fica neste dispositivo.',title:'Título',plan:'Plano / Markdown',diff:'Diff do Git',html:'Código HTML',chooseFile:'Carregar arquivo UTF-8 (opcional)',content:'Conteúdo',importReview:'Importar revisão',previousVersion:'Versão anterior · somente leitura',changes_requested:'Alterações solicitadas',resolve:'Resolver',reopen:'Reabrir',noComments:'Sem comentários. Comece por uma linha específica.',ready:'Sem bloqueios abertos. Pronto para sua decisão.',blocked:'bloqueio(s) aberto(s) · resolva para aprovar',historical:'Versão anterior · somente leitura',private:'Privado · neste dispositivo',browserDemo:'Demo · salva neste navegador',lines:'linhas',noResults:'Nenhuma revisão encontrada',imported:'Revisão importada.',saved:'Comentário salvo.',copied:'Exportação baixada.',updateTitle:'Importar uma nova versão',updateHint:'Importe o conteúdo atualizado. A versão anterior e sua decisão ficam no histórico.',fileTooLarge:'O arquivo ultrapassa 1 MB.',notUtf8:'Escolha um arquivo de texto UTF-8 válido.',demoError:'O armazenamento do navegador está indisponível ou cheio. Exporte as revisões antes de limpar os dados.' }
};
let lang = localStorage.getItem('planrelay-language') || 'en';
if (!words[lang]) lang = 'en';
let state = emptyState(), token, selected, versionIndex = -1, filter = 'all', compare = false, updateId;
const t = key => words[lang][key] || key;
const el = (tag, cls, value) => { const n = document.createElement(tag); if (cls) n.className = cls; if (value !== undefined) n.textContent = value; return n; };
const sha = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2,'0')).join('');
function message(value) { $('message').textContent = value; $('message').hidden = !value; }
async function load() {
  if (demo) {
    const saved = localStorage.getItem('planrelay-demo-v1');
    if (saved) { const parsed = JSON.parse(saved); if (parsed.schema !== 1 || !Array.isArray(parsed.artifacts)) throw new Error(t('demoError')); state = parsed; }
    else {
      const content = '# Safer authentication rollout\n\n## Goal\nReplace shared credentials with scoped access tokens.\n\n## Implementation\n1. Add a token table with expiry and revocation.\n2. Validate permissions before every write.\n3. Roll out behind a feature flag.\n\n## Verification\n- Test expired and revoked tokens.\n- Add a rollback procedure.\n\n## Open decision\nDefine token retention and rotation policy.';
      state = apply(state, { action:'import', generation:0, title:'Authentication rollout', kind:'plan', content }, { id:crypto.randomUUID(), revision:await sha(content), now:new Date().toISOString() }).state;
      const a = state.artifacts[0];
      state = apply(state, { action:'comment', generation:state.generation, id:a.id, revision:latest(a).revision, line:16, severity:'blocker', body:'Specify token retention and an owner for rotation before approving this rollout.' }, { id:crypto.randomUUID(), now:new Date().toISOString() }).state;
      localStorage.setItem('planrelay-demo-v1', JSON.stringify(state));
    }
  } else {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error(`Workspace unavailable (${res.status})`);
    const data = await res.json(); token = data.token; state = { schema:data.schema, generation:data.generation, artifacts:data.artifacts };
  }
  if (!state.artifacts.some(a => a.id === selected)) selected = state.artifacts[0]?.id;
  render();
}
async function action(input) {
  try {
    const request = { ...input, generation:state.generation };
    if (demo) {
      const result = apply(state, request, { id:crypto.randomUUID(), revision:input.content ? await sha(input.content) : undefined, now:new Date().toISOString() });
      // Commit browser data before updating the displayed decision.
      try { localStorage.setItem('planrelay-demo-v1', JSON.stringify(result.state)); } catch { throw new Error(t('demoError')); }
      state = result.state; selected = result.id;
    } else {
      const response = await fetch('/api/action', { method:'POST', headers:{'Content-Type':'application/json','X-PlanRelay-Token':token}, body:JSON.stringify(request) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 409) await load(); throw new Error(result.error); }
      state = result.state; selected = result.id;
    }
    versionIndex = -1; message(''); render(); return true;
  } catch (err) { message(err.message); return false; }
}
function current() { return state.artifacts.find(a => a.id === selected); }
function translate() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-placeholder]').forEach(n => { n.placeholder = t(n.dataset.placeholder); });
  $('search').setAttribute('aria-label', t('search'));
  $('language').value = lang;
  $('mode-label').textContent = t(demo ? 'browserDemo':'private');
  $('demo-badge').hidden = !demo;
  $('demo-badge').textContent = lang === 'en' ? 'Browser demo' : 'Demo no navegador';
  $('history').setAttribute('aria-label', lang === 'en' ? 'Revision history':'Histórico de versões');
  $('theme').setAttribute('aria-label', lang === 'en' ? 'Toggle theme':'Alternar tema');
}
function render() {
  translate();
  const summaries = state.artifacts.map(summary);
  $('total').textContent = summaries.length;
  $('pending').textContent = summaries.filter(a => a.decision !== 'approved').length;
  $('approved').textContent = summaries.filter(a => a.decision === 'approved').length;
  $('blockers').textContent = summaries.reduce((n,a) => n + a.blockers,0);
  const list = $('artifact-list'); list.replaceChildren();
  const matching = summaries.filter(a => (filter === 'all' || a.decision !== 'approved') && a.title.toLowerCase().includes($('search').value.toLowerCase()));
  for (const a of matching) {
    const button = el('button', `artifact${a.id === selected ? ' selected':''}`);
    button.setAttribute('aria-pressed', String(a.id === selected));
    button.append(el('div','artifact-title',a.title));
    const meta = el('div','artifact-meta');meta.append(el('span',`status-dot ${a.decision}`),el('span',null,`${a.kind.toUpperCase()} · v${a.versions} · ${t(a.decision)}`));
    button.append(meta); button.onclick = () => { selected = a.id; versionIndex = -1; compare = false; render(); }; list.append(button);
  }
  if (!matching.length) list.append(el('p','hint',t('noResults')));
  const artifact = current(); $('empty').hidden = !!artifact; $('review').hidden = !artifact;
  if (!artifact) return;
  const index = versionIndex < 0 ? artifact.versions.length - 1 : versionIndex;
  const version = artifact.versions[index], isCurrent = index === artifact.versions.length - 1;
  $('review-title').textContent = artifact.title; $('breadcrumb-title').textContent = artifact.title;
  $('kind').textContent = artifact.kind.toUpperCase(); $('decision').textContent = t(version.decision); $('decision').className = `status ${version.decision}`;
  $('revision-label').textContent = `SHA-256 ${version.revision} · ${artifact.id}`;
  const history = $('history');history.replaceChildren();
  artifact.versions.forEach((v,i) => { const option = el('option',null,`v${i+1} · ${v.revision.slice(0,7)}`);option.value = String(i); option.selected = i === index; history.append(option); });
  const lines = version.content.split('\n');$('line-count').textContent = `${lines.length} ${t('lines')}`;
  const container = $('lines');container.replaceChildren();
  // Keep giant files usable: text is still available through the imported file and revision history.
  const visible = lines.slice(0,10000);
  for (let i = 0; i < visible.length; i++) {
    const line = visible[i]; let cls = 'line';
    if (artifact.kind === 'diff' && line.startsWith('+') && !line.startsWith('+++')) cls += ' added';
    else if (artifact.kind === 'diff' && line.startsWith('-') && !line.startsWith('---')) cls += ' removed';
    else if (line.startsWith('#')) cls += ' heading';
    if (version.comments.some(c => c.line === i+1 && !c.resolved)) cls += ' has-comment';
    const row = el('button',cls); row.type = 'button';row.setAttribute('aria-label',`${t('line')} ${i+1}: ${line}`);
    row.append(el('span','line-number',String(i+1)),el('span','line-text',line || ' '));
    row.onclick = () => { $('comment-line').value = i+1;container.querySelector('.selected')?.classList.remove('selected');row.classList.add('selected');if(isCurrent) $('comment-body').focus(); };
    container.append(row);
  }
  if (lines.length > visible.length) container.append(el('p','hint',lang === 'en' ? 'Showing the first 10,000 lines. Use the line field to comment beyond this range.' : 'Exibindo as primeiras 10.000 linhas. Use o campo de linha para comentar além desse limite.'));
  $('comment-line').max = lines.length;
  $('comment-line').value = Math.min(Number($('comment-line').value)||1,lines.length);
  $('comment-count').textContent = version.comments.length;
  const comments = $('comments');comments.replaceChildren();
  for (const c of version.comments) {
    const card = el('div',`comment ${c.severity}${c.resolved?' resolved':''}`);
    const meta = el('div','comment-meta');meta.append(el('span',null,t(c.severity)),el('span',null,`${t('line')} ${c.line}`));
    card.append(meta,el('p',null,c.body));
    const button = el('button',null,t(c.resolved?'reopen':'resolve'));button.disabled = !isCurrent;
    button.onclick = () => action({action:'resolve',id:artifact.id,revision:version.revision,commentId:c.id,resolved:!c.resolved});card.append(button);comments.append(card);
  }
  if (!version.comments.length) comments.append(el('p','hint',t('noComments')));
  $('comment-form').querySelectorAll('input,select,textarea,button').forEach(n => {n.disabled = !isCurrent;});
  const blockers = version.comments.filter(c=>c.severity==='blocker'&&!c.resolved).length;
  $('decision-hint').textContent = !isCurrent ? t('historical') : blockers ? `${blockers} ${t('blocked')}` : t('ready');
  $('approve').disabled = !isCurrent || !!blockers || version.decision === 'approved';
  $('request-changes').disabled = !isCurrent;
  $('compare').disabled = index === 0; $('compare').setAttribute('aria-pressed',String(compare && index>0));
  $('comparison').hidden = !compare || index === 0;
  $('previous-content').textContent = index > 0 ? artifact.versions[index-1].content : '';
  $('events').replaceChildren(...version.events.map(e=>el('li',null,`${new Date(e.at).toLocaleString(lang)} · ${e.action}${e.decision?' → '+t(e.decision):''}`)));
}
function openImport(update = false) {
  $('import-form').reset();$('import-error').textContent = '';updateId = update ? selected : undefined;
  $('import-title').textContent = t(update?'updateTitle':'newReviewTitle');
  $('import-kind').disabled = update;
  if (update) { const a=current();$('title').value=a.title;$('import-kind').value=a.kind;$('content').value=latest(a).content; }
  $('import-dialog').showModal();$('title').focus();
}
$('new-review').onclick = $('empty-new').onclick = () => openImport();
$('update').onclick = () => openImport(true);
$('close-import').onclick = () => $('import-dialog').close();
$('file').onchange = async () => {
  const file = $('file').files[0]; if (!file) return;
  if(file.size>1000000) { $('import-error').textContent=t('fileTooLarge');return; }
  try { const content=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());$('content').value=content;if(!$('title').value)$('title').value=file.name;$('import-error').textContent=''; }
  catch { $('import-error').textContent=t('notUtf8'); }
};
$('import-form').onsubmit = async e => {
  e.preventDefault();$('import-submit').disabled=true;
  const ok=await action({action:'import',id:updateId,title:$('title').value,kind:$('import-kind').value,content:$('content').value});
  $('import-submit').disabled=false;
  if(ok) { $('import-dialog').close();message(t('imported')); } else $('import-error').textContent=$('message').textContent;
};
$('comment-form').onsubmit = async e => { e.preventDefault();const a=current();const ok=await action({action:'comment',id:a.id,revision:latest(a).revision,line:Number($('comment-line').value),severity:$('severity').value,body:$('comment-body').value});if(ok)$('comment-body').value=''; };
for(const [id,decision] of [['approve','approved'],['request-changes','changes_requested']]) $(id).onclick=()=>{const a=current();return action({action:'decide',id:a.id,revision:latest(a).revision,decision});};
$('history').onchange = () => {versionIndex=Number($('history').value);render();};
$('compare').onclick = () => { compare=!compare;render(); };
$('search').oninput = render;
for (const button of document.querySelectorAll('[data-filter]')) button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('active',n===button));render();};
$('language').onchange=()=>{lang=$('language').value;localStorage.setItem('planrelay-language',lang);render();};
document.documentElement.dataset.theme=localStorage.getItem('planrelay-theme')||'dark';
$('theme').onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;localStorage.setItem('planrelay-theme',next);};
function download(format) {
  const a=current(), index=versionIndex<0?a.versions.length-1:versionIndex;
  // A historical export must refer to the displayed version, never silently to the latest.
  const view={...a,versions:a.versions.slice(0,index+1)};
  const value=format==='json'?JSON.stringify(feedback(view),null,2):markdownFeedback(view);
  const blob=new Blob([value],{type:format==='json'?'application/json':'text/markdown'});
  const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=`planrelay-${a.id}-v${index+1}.${format==='json'?'json':'md'}`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('export-json').onclick=()=>download('json');$('export-md').onclick=()=>download('markdown');
load().catch(err=>message(err.message));
