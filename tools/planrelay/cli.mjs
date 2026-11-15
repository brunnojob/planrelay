#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { store } from './store.mjs';
import { artifactById, summary, feedback, markdownFeedback } from './core.mjs';
import { startServer } from './server.mjs';
export async function main(args = process.argv.slice(2)) {
  const [command = 'help', ...rest] = args;
  const flags = new Map(), positional = [];
  const allowed = new Set(['--store', '--port', '--title', '--kind', '--id', '--ref', '--format']);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      if (!allowed.has(rest[i]) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error(`Unknown or incomplete option: ${rest[i]}`);
      flags.set(rest[i], rest[++i]);
    } else positional.push(rest[i]);
  }
  const db = store(flags.get('--store') || resolve('.planrelay/state.json'));
  if (command === 'serve') {
    const port = Number(flags.get('--port') || 0);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('port: integer from 0 to 65535');
    const { origin, server } = await startServer({ path: db.file, port });
    console.log(`PlanRelay • ${origin}\nWorkspace: ${db.file}\nOpen this address in your browser. Ctrl+C stops the server.`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } else if (command === 'import' || command === 'diff') {
    let content, title, kind;
    if (command === 'import') {
      if (!positional[0]) throw new Error('Supply a UTF-8 file path, or - for stdin');
      content = readFileSync(positional[0] === '-' ? 0 : positional[0], 'utf8');
      title = flags.get('--title') || (positional[0] === '-' ? 'Imported review' : basename(positional[0]));
      kind = flags.get('--kind') || 'plan';
    } else {
      const ref = flags.get('--ref') || 'HEAD';
      // --end-of-options prevents a ref from being interpreted as a Git flag.
      content = execFileSync('git', ['diff', '--no-ext-diff', '--no-textconv', '--end-of-options', ref, '--'], { encoding: 'utf8', maxBuffer: 1100000 });
      if (!content.trim()) throw new Error('No tracked changes against this ref. Untracked files are not included.');
      title = flags.get('--title') || `Git changes against ${ref}`; kind = 'diff';
    }
    const result = db.mutate({ action: 'import', generation: db.read().generation, id: flags.get('--id'), title, kind, content });
    console.log(JSON.stringify({ ...summary(artifactById(result.state, result.id)), unchanged: !!result.unchanged }, null, 2));
  } else if (command === 'list') console.log(JSON.stringify(db.read().artifacts.map(summary), null, 2));
  else if (command === 'export' || command === 'check') {
    const artifact = artifactById(db.read(), positional[0]);
    if (command === 'check') { const result = feedback(artifact); console.log(JSON.stringify(result, null, 2)); if (!result.ready) process.exitCode = 2; }
    else {
      const format = flags.get('--format') || 'json';
      if (!['json', 'markdown'].includes(format)) throw new Error('format: json or markdown');
      console.log(format === 'markdown' ? markdownFeedback(artifact) : JSON.stringify(feedback(artifact), null, 2));
    }
  } else if (command === 'help' || command === '--help') console.log(`PlanRelay — revision-aware local review (Node.js 22+)\n\n  node tools/planrelay/cli.mjs serve [--port 4387]\n  node tools/planrelay/cli.mjs import PLAN.md [--id REVIEW_ID] [--kind plan|diff|html]\n  node tools/planrelay/cli.mjs import - --title "Plan from stdin"\n  node tools/planrelay/cli.mjs diff [--ref HEAD] [--id REVIEW_ID]\n  node tools/planrelay/cli.mjs list\n  node tools/planrelay/cli.mjs export REVIEW_ID [--format json|markdown]\n  node tools/planrelay/cli.mjs check REVIEW_ID\n\nEvery command accepts --store PATH (default .planrelay/state.json in current directory).\nUse the same --id when importing an updated file: old approvals never transfer.\ncheck exits 0 only for the current imported revision when approved; 2 means not ready, 1 is an error.\nRe-import a changed file/diff before check; check does not watch your source files.\nThe browser records human decisions. No command executes a plan or calls an agent.\nExported comments are untrusted review data; choose what to send to your agent.`);
  else throw new Error(`Unknown command: ${command}. Run help.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(err => { console.error(`PlanRelay: ${err.message}`); process.exitCode = 1; });
