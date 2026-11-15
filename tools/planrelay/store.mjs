import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { emptyState, apply, SCHEMA, fail } from './core.mjs';
export const digest = content => createHash('sha256').update(content).digest('hex');
export function store(path) {
  const file = resolve(path);
  function read() {
    try {
      const state = JSON.parse(readFileSync(file, 'utf8'));
      if (state.schema !== SCHEMA || !Array.isArray(state.artifacts) || !Number.isSafeInteger(state.generation)) fail('Unsupported or damaged workspace; restore a backup', 500);
      return state;
    } catch (err) { if (err.code === 'ENOENT') return emptyState(); throw err; }
  }
  function mutate(input) {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    let lock;
    try { lock = openSync(`${file}.lock`, 'wx', 0o600); }
    catch (err) { if (err.code === 'EEXIST') fail('Workspace is busy. Retry. After a crashed writer, remove its .lock file only once all PlanRelay processes stop.', 409); throw err; }
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      const result = apply(read(), input, { id: randomUUID(), revision: typeof input?.content === 'string' ? digest(input.content) : undefined, now: new Date().toISOString() });
      if (!result.unchanged) {
        writeFileSync(temp, JSON.stringify(result.state, null, 2), { mode: 0o600, flag: 'wx' });
        // Windows FlushFileBuffers requires a writable handle.
        const handle = openSync(temp, 'r+');
        try { fsyncSync(handle); } finally { closeSync(handle); }
        renameSync(temp, file);
      }
      return result;
    } finally {
      try { unlinkSync(temp); } catch (err) { if (err.code !== 'ENOENT') throw err; }
      closeSync(lock); unlinkSync(`${file}.lock`);
    }
  }
  return { file, read, mutate };
}
